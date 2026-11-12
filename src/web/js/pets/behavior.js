window.QJZ = window.QJZ || {};
// What the pet does (spec §5.1). Pure and timer-free: everything is decided from the wall-clock time the caller
// passes in, so layouts.js drives it from the app's existing 100 ms tick and a page that was hidden (throttled
// timers, paused tick) simply catches up on the next call.
//   base(status, minutesToEnd, secInStatus) -> the state for the work status:
//       before -> idle, working -> typing (sprint in the last 30 minutes), lunch -> lunchSleep,
//       done / ended -> celebrate for the first 8 s, then waitBag.
//   pickIdle(m, rng, status) -> an idle action or null: while working one of stretch|yawn|coffee|stare|scratch
//       (yawn x3 when energy < 40); before work doze now and then (RULING-3); otherwise null.
//   Poker: poke(nowMs) -> 'petted' | 'angry' (5 pokes within 2 s -> angry for 4 s).
//   Brain: the running pet. update(nowMs, info) -> the state to show, where
//       info = {status, minutesToEnd, lunchMin (minutes into lunch, or null), mood ({energy, mood}, optional)}.
//       On top of the base state: lunchEat for the first 10 minutes of lunch (RULING-3), an idle action every
//       20–60 s for 3–5 s (doze 8–15 s), and overlays: dangle while dragged > angry > petted / eat / hop / sip (show).
//       After each update brain.change is {from, to, quiet} when the base state changed (from null the first
//       time); quiet when it was not seen happening live: the first look, or after a gap over 5 s (the window
//       was hidden). brain.base is the current base state.
//   1.1 cues (spec §5.1, §5.2, §5.8): cue(name | null, nowMs) with QJZ.care's cue ('focus' | 'wave' | 'holdCup' |
//       'stretch'), knock(nowMs) for care's re-wave every 2 minutes while a bubble waits. brain.cued is the cue.
//       focus: the base state is 'focus' whatever the status. A focus lasts until its cue changes, or, when it changes
//         to 'stretch' (care: the focus ended with its break bubble), until that stretch is over (Ruling M8). Then the
//         status clock restarts, so 可以下班 during a focus celebrates for 8 s after it, live (§5.2).
//       wave: 'wave' for WAVE_MS after the cue and after each knock, 'idle' in between.
//       holdCup: 'holdCup' all along; a knock replays its wave (brain.waveAt: when the last wave began).
//       stretch: 'stretch' for STRETCH_MS, then the base state.
//       A knock with no cue or the stretch's (a pomodoro bubble) waves for WAVE_MS too (§5.1). While a cue is on there
//       are no idle actions; overlays still win.
QJZ.behavior = (function () {
  var IDLES = ['stretch', 'yawn', 'coffee', 'stare', 'scratch'];
  var CELEBRATE_SEC = 8, SPRINT_MIN = 30, LUNCH_EAT_MIN = 10;
  var IDLE_EVERY = [20000, 60000], IDLE_FOR = [3000, 5000], DOZE_FOR = [8000, 15000], DOZE_CHANCE = 0.4;
  var GAP_MS = 5000, PET_MS = 2000;
  var POKE_WINDOW = 2000, POKE_COUNT = 5, ANGRY_MS = 4000;
  var WAVE_MS = 4000, STRETCH_MS = 4000, SIP_MS = 3000;
  var CUES = { focus: 1, wave: 1, holdCup: 1, stretch: 1 };

  function base(status, minutesToEnd, secInStatus) {
    switch (status) {
      case 'working': return minutesToEnd <= SPRINT_MIN ? 'sprint' : 'typing';
      case 'lunch': return 'lunchSleep';
      case 'done': case 'ended': return secInStatus >= CELEBRATE_SEC ? 'waitBag' : 'celebrate';
      default: return 'idle';
    }
  }

  function pickIdle(m, rng, status) {
    rng = rng || Math.random;
    if (status === 'before') return rng() < DOZE_CHANCE ? 'doze' : null;
    if (status !== undefined && status !== 'working') return null;
    var yawn = m && m.energy < 40 ? 3 : 1, total = IDLES.length - 1 + yawn, r = rng() * total;
    for (var i = 0; i < IDLES.length; i++) {
      r -= IDLES[i] === 'yawn' ? yawn : 1;
      if (r < 0) return IDLES[i];
    }
    return IDLES[IDLES.length - 1];
  }

  // mulberry32: a small seeded generator for tests and reproducible dev runs.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function between(r, span) { return span[0] + r() * (span[1] - span[0]); }

  function Poker() { this.recent = []; this.angryUntil = -Infinity; }
  Poker.prototype.angry = function (nowMs) { return nowMs < this.angryUntil; };
  Poker.prototype.poke = function (nowMs) {
    if (this.angry(nowMs)) return 'angry';
    var keep = [];
    for (var i = 0; i < this.recent.length; i++) if (nowMs - this.recent[i] < POKE_WINDOW) keep.push(this.recent[i]);
    keep.push(nowMs);
    this.recent = keep;
    if (keep.length >= POKE_COUNT) {
      this.recent = [];
      this.angryUntil = nowMs + ANGRY_MS;
      return 'angry';
    }
    return 'petted';
  };

  function Brain(r) {
    this.rng = r || Math.random;
    this.poker = new Poker();
    this.status = null; this.since = 0; this.last = null;
    this.base = null; this.change = null; this.state = null;
    this.idle = null;          // {state, until}
    this.nextIdle = null;      // when the next idle action is due (null: schedule on the next update)
    this.over = null;          // {state, from, until}: petted / eat / hop
    this.held = false;         // dragged (U7)
    this.angered = false;      // the last poke made it angry just now
    this.cued = null;          // care's cue
    this.cuedAt = 0;           // when it came
    this.waveAt = -Infinity;   // when the last wave began (a wave or holdCup cue, or a knock)
    this.focusEnd = -Infinity; // when the last focus ended, or ends (after its stretch)
  }
  // The pose the cue shows at now, or null for none (the base state and its idle actions show).
  function cuePose(br, now) {
    var c = br.cued;
    if (c === 'focus' || c === 'holdCup') return c;
    if (c === 'stretch' && now >= br.cuedAt && now < br.cuedAt + STRETCH_MS) return 'stretch';
    if (now >= br.waveAt && now < br.waveAt + WAVE_MS) return 'wave';
    return c === 'wave' ? 'idle' : null;
  }
  Brain.prototype.schedule = function (now) { this.nextIdle = now + between(this.rng, IDLE_EVERY); };
  Brain.prototype.update = function (now, info) {
    var back = this.last !== null && now < this.last;
    var gap = this.last === null || now - this.last > GAP_MS || back;
    this.last = now;
    if (back && this.cued !== 'focus' && this.focusEnd > now) this.focusEnd = now;   // the clock went back: no long wait
    if (info.status !== this.status || now < this.since) { this.status = info.status; this.since = now; }
    var b = 'focus';
    if (this.cued !== 'focus' && now >= this.focusEnd) {
      // the status clock restarts when a focus ends: 可以下班 during a focus celebrates after it (§5.2)
      b = base(info.status, info.minutesToEnd, (now - Math.max(this.since, this.focusEnd)) / 1000);
      if (b === 'lunchSleep' && info.lunchMin !== null && info.lunchMin !== undefined && info.lunchMin < LUNCH_EAT_MIN) b = 'lunchEat';
    }

    this.change = b !== this.base ? { from: this.base, to: b, quiet: gap || this.base === null } : null;
    if (this.change || gap) { this.idle = null; this.nextIdle = null; }
    this.base = b;

    var over = this.over && now < this.over.until ? this.over : null;
    if (this.over && now >= this.over.until) this.over = null;
    var busy = this.held || this.poker.angry(now) || (over && now >= over.from);
    var s = b, cp = cuePose(this, now);
    if (busy) {
      this.idle = null; this.nextIdle = null;   // an idle action never cuts into a reaction; the wait restarts after it
      s = this.held ? 'dangle' : this.poker.angry(now) ? 'angry' : over.state;
    } else if (cp) {
      this.idle = null; this.nextIdle = null;
      s = cp;
    } else if (!this.cued && (b === 'typing' || b === 'idle')) {
      if (this.idle && now >= this.idle.until) { this.idle = null; this.nextIdle = null; }
      if (this.nextIdle === null && !this.idle) this.schedule(now);
      if (!this.idle && now >= this.nextIdle) {
        var pick = pickIdle(info.mood || null, this.rng, b === 'idle' ? 'before' : 'working');
        if (pick) this.idle = { state: pick, until: now + between(this.rng, pick === 'doze' ? DOZE_FOR : IDLE_FOR) };
        else this.schedule(now);
      }
      if (this.idle) s = this.idle.state;
    } else {
      this.idle = null; this.nextIdle = null;
    }
    this.state = s;
    return s;
  };
  // A poke (a plain click on the pet): 'petted' for 2 s, or 'angry' (brain.angered when it just turned angry).
  Brain.prototype.poke = function (now) {
    var was = this.poker.angry(now), r = this.poker.poke(now);
    this.angered = r === 'angry' && !was;
    // The snack is already spent and a milestone hop is a one-off: a poke that lands during the flight, eat or hop
    // still counts (r) but does not take their slot, so that pose always plays. Angry shows over it meanwhile.
    var keep = this.over && this.over.state !== 'petted' && now < this.over.until;
    if (r === 'petted') { if (!keep) this.over = { state: 'petted', from: now, until: now + PET_MS }; }
    else if (!keep) this.over = null;
    return r;
  };
  // A reaction shown for ms, starting delayMs from now (feeding: when the snack lands).
  Brain.prototype.show = function (state, now, ms, delayMs) {
    var from = now + (delayMs || 0);
    this.over = { state: state, from: from, until: from + ms };
  };
  Brain.prototype.drag = function (on) { this.held = !!on; };
  // care's cue (an unknown name is null). Leaving 'focus' ends the focus now, or after the stretch for 'stretch'; a new
  // cue during that stretch ends it then. A cue cuts an idle action short.
  Brain.prototype.cue = function (name, now) {
    name = CUES.hasOwnProperty(name) ? name : null;
    if (name === this.cued) return;
    if (this.cued === 'focus') this.focusEnd = name === 'stretch' ? now + STRETCH_MS : now;
    else if (now < this.focusEnd) this.focusEnd = now;
    this.cued = name;
    this.cuedAt = now;
    this.waveAt = name === 'wave' || name === 'holdCup' ? now : -Infinity;
    this.idle = null; this.nextIdle = null;
  };
  // care's re-wave: the wave again (holdCup's own); never during a focus.
  Brain.prototype.knock = function (now) { if (this.cued !== 'focus') this.waveAt = now; };

  return {
    IDLES: IDLES, base: base, pickIdle: pickIdle, rng: rng, Poker: Poker, Brain: Brain,
    PET_MS: PET_MS, EAT_MS: 3000, HOP_MS: 2400, WAVE_MS: WAVE_MS, STRETCH_MS: STRETCH_MS, SIP_MS: SIP_MS
  };
})();
