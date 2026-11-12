// QJZ.behavior (base state, idle picks, the poker, the Brain that decides what the pet shows from the wall clock)
// and QJZ.lines (what the pet says). All pure: the rng is seeded, times are plain numbers.
(function () {
  var B = QJZ.behavior, L = QJZ.lines;
  var WORK_IDLES = ['stretch', 'yawn', 'coffee', 'stare', 'scratch'];
  var BASE = ['idle', 'typing', 'sprint', 'lunchSleep', 'celebrate', 'waitBag'];
  var T0 = new Date(2026, 10, 12, 10, 0, 0, 0).getTime();
  function working(min) { return { status: 'working', minutesToEnd: min === undefined ? 300 : min }; }

  // ---------- base ----------
  test('behavior: base state per status', function () {
    eq(B.base('working', 31), 'typing');
    eq(B.base('working', 30), 'sprint');
    eq(B.base('working', 0.5), 'sprint');
    eq(B.base('lunch', 0), 'lunchSleep');
    eq(B.base('before', 480), 'idle');
    eq(B.base('done', 0), 'celebrate');
    eq(B.base('ended', 0), 'celebrate');
    eq(B.base('done', 0, 7.9), 'celebrate', 'celebrate for 8 s');
    eq(B.base('done', 0, 8), 'waitBag', 'then waitBag');
    eq(B.base('ended', 0, 600), 'waitBag');
    eq(B.base('bogus', 10), 'idle');
  });

  // ---------- poker ----------
  test('behavior: poker — four pokes pet, the fifth within 2 s angers it for 4 s', function () {
    var p = new B.Poker();
    eq([p.poke(T0), p.poke(T0 + 300), p.poke(T0 + 600), p.poke(T0 + 900)], ['petted', 'petted', 'petted', 'petted']);
    ok(!p.angry(T0 + 900));
    eq(p.poke(T0 + 1200), 'angry');
    ok(p.angry(T0 + 1200 + 3900), 'still angry before 4 s');
    eq(p.poke(T0 + 1200 + 2000), 'angry', 'pokes while angry stay angry');
    ok(!p.angry(T0 + 1200 + 4000), 'calm after 4 s');
    eq(p.poke(T0 + 1200 + 5000), 'petted', 'a poke after 5 s is petting again');
  });

  test('behavior: poker — slow pokes never anger', function () {
    var p = new B.Poker(), got = [];
    for (var i = 0; i < 12; i++) got.push(p.poke(T0 + i * 600));
    ok(got.every(function (s) { return s === 'petted'; }), got.join());
  });

  // ---------- pickIdle ----------
  test('behavior: pickIdle with a seeded rng picks only the five working idles, all of them', function () {
    var rng = B.rng(42), seen = {};
    for (var i = 0; i < 500; i++) {
      var s = B.pickIdle({ energy: 80, mood: 60 }, rng);
      ok(WORK_IDLES.indexOf(s) >= 0, 'allowed: ' + s);
      seen[s] = true;
    }
    eq(Object.keys(seen).sort(), WORK_IDLES.slice().sort());
    eq(B.pickIdle({ energy: 80, mood: 60 }, B.rng(1), 'working') !== null, true);
  });

  test('behavior: pickIdle yawns three times as often when energy < 40', function () {
    function share(energy) {
      var rng = B.rng(9), n = 0;
      for (var i = 0; i < 4000; i++) if (B.pickIdle({ energy: energy, mood: 50 }, rng) === 'yawn') n++;
      return n / 4000;
    }
    var tired = share(30), fresh = share(80);
    ok(tired > 0.37 && tired < 0.49, 'tired ' + tired + ' (3/7)');
    ok(fresh > 0.16 && fresh < 0.24, 'fresh ' + fresh + ' (1/5)');
  });

  test('behavior: RULING-3 — before work pickIdle sometimes dozes, never a working idle', function () {
    var rng = B.rng(5), doze = 0, none = 0;
    for (var i = 0; i < 400; i++) {
      var s = B.pickIdle({ energy: 100, mood: 70 }, rng, 'before');
      if (s === 'doze') doze++;
      else if (s === null) none++;
      else ok(false, 'before work: ' + s);
    }
    ok(doze > 40 && none > 40, 'doze ' + doze + ' / none ' + none);
    ['lunch', 'done', 'ended'].forEach(function (st) {
      eq(B.pickIdle({ energy: 30, mood: 50 }, B.rng(3), st), null, st);
    });
  });

  test('behavior: rng is seeded and stays in [0, 1)', function () {
    var a = B.rng(77), b = B.rng(77), xs = [];
    for (var i = 0; i < 200; i++) { var x = a(); eq(x, b()); ok(x >= 0 && x < 1); xs.push(x); }
    ok(xs[0] !== xs[1]);
  });

  // ---------- Brain ----------
  // Runs the brain from t0 for sec seconds in steps of stepMs; returns the runs [{state, from, to}].
  function runs(brain, info, sec, stepMs, t0) {
    var out = [], t = t0 || T0, end = t + sec * 1000, cur = null;
    for (; t <= end; t += stepMs || 250) {
      var s = brain.update(t, typeof info === 'function' ? info(t) : info);
      if (!cur || cur.state !== s) { cur = { state: s, from: t, to: t }; out.push(cur); }
      else cur.to = t;
    }
    return out;
  }

  test('behavior: brain — idle actions every 20–60 s for 3–5 s while typing', function () {
    var r = runs(new B.Brain(B.rng(7)), working(), 900);
    var acts = r.filter(function (x) { return x.state !== 'typing'; });
    ok(acts.length >= 12 && acts.length <= 40, acts.length + ' idle actions in 15 min');
    acts.forEach(function (a) {
      ok(WORK_IDLES.indexOf(a.state) >= 0, a.state);
      var len = a.to - a.from + 250;
      ok(len >= 3000 && len <= 5250, a.state + ' lasted ' + len);
    });
    for (var i = 1; i < r.length - 1; i++) {
      if (r[i].state !== 'typing') continue;
      var gap = r[i].to - r[i].from + 250;
      ok(gap >= 20000 && gap <= 60250, 'typing for ' + gap + ' between idle actions');
    }
  });

  test('behavior: brain — no idle actions while sprinting, at lunch or after work', function () {
    eq(runs(new B.Brain(B.rng(7)), working(20), 300).map(function (x) { return x.state; }), ['sprint']);
    eq(runs(new B.Brain(B.rng(7)), { status: 'lunch', minutesToEnd: 300, lunchMin: 20 }, 300).map(function (x) { return x.state; }), ['lunchSleep']);
    eq(runs(new B.Brain(B.rng(7)), { status: 'done', minutesToEnd: 0 }, 300).map(function (x) { return x.state; }), ['celebrate', 'waitBag']);
  });

  test('behavior: brain — celebrate for 8 s from when 可以下班 is first seen, then waitBag', function () {
    var b = new B.Brain(B.rng(1));
    eq(b.update(T0, working(1)), 'sprint');
    eq(b.update(T0 + 1000, { status: 'done', minutesToEnd: 0 }), 'celebrate');
    eq(b.update(T0 + 8900, { status: 'done', minutesToEnd: 0 }), 'celebrate');
    eq(b.update(T0 + 9000, { status: 'done', minutesToEnd: 0 }), 'waitBag');
    eq(b.update(T0 + 9100, { status: 'ended', minutesToEnd: 0 }), 'celebrate', '下班 after 可以下班 celebrates again');
  });

  test('behavior: brain — RULING-3 lunch: lunchEat for the first 10 minutes, then lunchSleep', function () {
    var b = new B.Brain(B.rng(1));
    eq(b.update(T0, { status: 'lunch', minutesToEnd: 240, lunchMin: 0 }), 'lunchEat');
    eq(b.update(T0 + 1000, { status: 'lunch', minutesToEnd: 240, lunchMin: 9.9 }), 'lunchEat');
    eq(b.update(T0 + 2000, { status: 'lunch', minutesToEnd: 240, lunchMin: 10 }), 'lunchSleep');
    eq(b.update(T0 + 3000, { status: 'lunch', minutesToEnd: 240 }), 'lunchSleep', 'no lunch clock: sleep');
  });

  test('behavior: brain — before work it mostly idles and dozes now and then', function () {
    var r = runs(new B.Brain(B.rng(11)), { status: 'before', minutesToEnd: 480 }, 1800, 500);
    var states = {};
    r.forEach(function (x) { states[x.state] = true; });
    eq(Object.keys(states).sort(), ['doze', 'idle']);
    r.filter(function (x) { return x.state === 'doze'; }).forEach(function (d) {
      var len = d.to - d.from + 500;
      ok(len >= 8000 && len <= 15500, 'doze lasted ' + len);
    });
  });

  test('behavior: brain — overlays: petted, angry, eat (delayed), hop; dangle wins while dragging', function () {
    var b = new B.Brain(B.rng(2)), w = working();
    eq(b.update(T0, w), 'typing');
    eq(b.poke(T0 + 100), 'petted');
    ok(!b.angered);
    eq(b.update(T0 + 200, w), 'petted');
    eq(b.update(T0 + 2200, w), 'typing', 'petting lasts 2 s');
    for (var i = 0; i < 4; i++) b.poke(T0 + 3000 + i * 100);
    eq(b.poke(T0 + 3400), 'angry');
    ok(b.angered, 'just turned angry');
    eq(b.update(T0 + 3500, w), 'angry');
    eq(b.poke(T0 + 3600), 'angry');
    ok(!b.angered, 'already angry');
    eq(b.update(T0 + 7300, w), 'angry');
    eq(b.update(T0 + 7400, w), 'typing', 'angry for 4 s');
    b.show('eat', T0 + 8000, 3000, 800);
    eq(b.update(T0 + 8500, w), 'typing', 'the snack is still flying');
    eq(b.update(T0 + 8800, w), 'eat');
    eq(b.update(T0 + 11700, w), 'eat');
    eq(b.update(T0 + 11800, w), 'typing');
    b.show('hop', T0 + 12000, 2400);
    eq(b.update(T0 + 12000, w), 'hop');
    b.drag(true);
    eq(b.update(T0 + 12100, w), 'dangle');
    b.poke(T0 + 12200);
    eq(b.update(T0 + 12300, w), 'dangle', 'dangle beats everything');
    b.drag(false);
    eq(b.update(T0 + 12400, w), 'hop', 'the poke did not take the hop slot');
    eq(b.update(T0 + 30000, w), 'typing');
  });

  test('behavior: brain — a poke during the snack flight, eat or hop does not drop that pose', function () {
    var b = new B.Brain(B.rng(2)), w = working();
    b.update(T0, w);
    b.show('eat', T0 + 100, 3000, 800);
    eq(b.poke(T0 + 300), 'petted', 'the poke itself still counts');
    eq(b.update(T0 + 400, w), 'typing', 'still flying: no petted pose either');
    eq(b.update(T0 + 1000, w), 'eat', 'the eat pose plays');
    b.poke(T0 + 1500);
    eq(b.update(T0 + 1600, w), 'eat', 'a poke while eating is ignored');
    eq(b.update(T0 + 3800, w), 'eat');
    eq(b.update(T0 + 3900, w), 'typing');
    b.show('hop', T0 + 10000, 2400);
    b.poke(T0 + 10100);
    eq(b.update(T0 + 10200, w), 'hop');
    eq(b.update(T0 + 12400, w), 'typing');
    // an angry streak pauses the pose, it does not eat it
    b.show('eat', T0 + 20000, 3000, 800);
    for (var i = 0; i < 5; i++) b.poke(T0 + 20100 + i * 50);
    eq(b.update(T0 + 20400, w), 'angry');
    eq(b.update(T0 + 21000, w), 'angry');
    eq(b.update(T0 + 24500, w), 'typing', 'angry is over; the eat window has passed');
    b.poke(T0 + 30000);
    eq(b.update(T0 + 30100, w), 'petted', 'with nothing playing a poke pets as before');
  });

  test('behavior: brain — change reports base transitions; a gap or the first look is quiet', function () {
    var b = new B.Brain(B.rng(3));
    b.update(T0, working());
    eq(b.change, { from: null, to: 'typing', quiet: true }, 'first look');
    b.update(T0 + 1000, working());
    eq(b.change, null);
    b.update(T0 + 2000, working(30));
    eq(b.change, { from: 'typing', to: 'sprint', quiet: false });
    var t = T0 + 3600000, done = { status: 'done', minutesToEnd: 0 };
    b.update(t, done);
    eq(b.change, { from: 'sprint', to: 'celebrate', quiet: true }, 'after an hour hidden');
    var seen = null;
    for (var s = 1; s <= 8; s++) { b.update(t + s * 1000, done); if (b.change) seen = b.change; }
    eq(seen, { from: 'celebrate', to: 'waitBag', quiet: false });
    eq(b.base, 'waitBag');
  });

  test('behavior: brain — after a gap the idle schedule restarts instead of firing at once', function () {
    var b = new B.Brain(B.rng(4)), t = T0 + 3600000;
    b.update(T0, working());
    eq(b.update(t, working()), 'typing');
    for (var s = 1; s < 20; s++) eq(b.update(t + s * 1000, working()), 'typing', 'not before 20 s (' + s + ')');
  });

  // ---------- cues (1.1: QJZ.care's reminders and pomodoro, spec §5.1, §5.2, §5.8) ----------
  // Runs the brain once a second from t0 to t1 (both included); returns the last state.
  function upTo(b, info, t0, t1) {
    var s = null;
    for (var t = t0; t <= t1; t += 1000) s = b.update(t, info);
    return s;
  }

  test('behavior: the focus cue replaces typing and sprint', function () {
    var b = new B.Brain(B.rng(1));
    eq(b.update(T0, working()), 'typing');
    b.cue('focus', T0 + 1000);
    eq(b.update(T0 + 1000, { status: 'working', minutesToEnd: 20 }), 'focus', 'not sprint');
    eq(b.change, { from: 'typing', to: 'focus', quiet: false });
    eq(b.base, 'focus');
    eq(b.update(T0 + 2000, working()), 'focus', 'not typing');
    [{ status: 'before', minutesToEnd: 480 }, { status: 'lunch', minutesToEnd: 240, lunchMin: 2 }, { status: 'lunch', minutesToEnd: 240, lunchMin: 30 },
      { status: 'done', minutesToEnd: 0 }, { status: 'ended', minutesToEnd: 0 }].forEach(function (info, i) {
      eq(b.update(T0 + 3000 + i * 1000, info), 'focus', info.status + ' ' + info.lunchMin);
    });
    eq(b.poke(T0 + 9000), 'petted');
    eq(b.update(T0 + 9100, working()), 'petted', 'overlays still win');
    eq(b.update(T0 + 11100, working()), 'focus');
    b.cue('focus', T0 + 12000);
    eq(b.update(T0 + 12000, working()), 'focus', 'the same cue again changes nothing');
  });

  test('behavior: 可以下班 during a focus waits; celebrate for 8 s after the focus and its stretch, then waitBag', function () {
    var T = T0 + 3600000, done = { status: 'done', minutesToEnd: 0 };
    // focused from 5 minutes before 可以下班 (T) until T + 10 min
    function focused() {
      var b = new B.Brain(B.rng(2));
      b.cue('focus', T - 300000);
      eq(upTo(b, working(5), T - 300000, T - 1000), 'focus');
      eq(upTo(b, done, T, T + 600000), 'focus', '可以下班 from T: the focus goes on');
      return b;
    }
    // care's real sequence: the focus ends with the break bubble's stretch (Ruling M8)
    var b = focused();
    b.cue('stretch', T + 600000);
    eq(b.update(T + 600000, done), 'stretch');
    eq(b.change, null, 'nothing new to celebrate yet');
    eq(b.update(T + 603999, done), 'stretch');
    eq(b.update(T + 604000, done), 'celebrate', 'after the 4 s stretch');
    eq(b.change, { from: 'focus', to: 'celebrate', quiet: false }, 'seen live: the jingle plays');
    eq(upTo(b, done, T + 605000, T + 611000), 'celebrate');
    eq(b.update(T + 612000, done), 'waitBag', 'celebrate for 8 s');
    // the focus stopped with no break bubble: at once
    b = focused();
    b.cue(null, T + 600000);
    eq(b.update(T + 600000, done), 'celebrate');
    eq(b.change, { from: 'focus', to: 'celebrate', quiet: false });
    eq(upTo(b, done, T + 601000, T + 607000), 'celebrate');
    eq(b.update(T + 608000, done), 'waitBag');
    // the break bubble answered within the stretch: the stretch ends then
    b = focused();
    b.cue('stretch', T + 600000);
    eq(upTo(b, done, T + 600000, T + 602000), 'stretch');
    b.cue(null, T + 602000);
    eq(b.update(T + 602000, done), 'celebrate');
    eq(b.update(T + 610000, done), 'waitBag');
    // at work the focus gives way to typing after its stretch
    b = new B.Brain(B.rng(2));
    b.cue('focus', T0);
    upTo(b, working(), T0, T0 + 5000);
    b.cue('stretch', T0 + 6000);
    eq(upTo(b, working(), T0 + 6000, T0 + 9000), 'stretch');
    eq(b.update(T0 + 10000, working()), 'typing');
    eq(b.change, { from: 'focus', to: 'typing', quiet: false });
  });

  test('behavior: only a 可以下班 that came during the focus celebrates after it; a focus started after it goes back to waitBag', function () {
    var T = T0 + 3600000, done = { status: 'done', minutesToEnd: 0 }, ended = { status: 'ended', minutesToEnd: 0 };
    function states(b, info, t0, t1) {
      var seen = {};
      for (var t = t0; t <= t1; t += 1000) seen[b.update(t, info)] = true;
      return Object.keys(seen).sort();
    }
    // status turned done during the focus: celebrate after its stretch
    var b = new B.Brain(B.rng(2));
    b.update(T - 2000, working(1));
    b.cue('focus', T - 1000);
    eq(upTo(b, done, T, T + 600000), 'focus');
    b.cue('stretch', T + 600000);
    eq(upTo(b, done, T + 600000, T + 603000), 'stretch');
    eq(b.update(T + 604000, done), 'celebrate');
    eq(b.change, { from: 'focus', to: 'celebrate', quiet: false });
    // a focus started after 可以下班: the stretch, then straight back to waitBag (no celebrate, no jingle)
    [done, ended].forEach(function (info) {
      var c = new B.Brain(B.rng(2));
      eq(upTo(c, info, T, T + 60000), 'waitBag', info.status + ' before the focus');
      c.cue('focus', T + 61000);
      eq(upTo(c, info, T + 61000, T + 661000), 'focus');
      c.cue('stretch', T + 661000);
      eq(upTo(c, info, T + 661000, T + 664000), 'stretch');
      eq(c.update(T + 665000, info), 'waitBag', info.status + ': after the stretch');
      eq(c.change, { from: 'focus', to: 'waitBag', quiet: false }, info.status + ': no celebrate');
      eq(states(c, info, T + 666000, T + 700000), ['waitBag'], info.status);
      // the same with no stretch
      c.cue('focus', T + 701000);
      upTo(c, info, T + 701000, T + 710000);
      c.cue(null, T + 711000);
      eq(c.update(T + 711000, info), 'waitBag', info.status + ': stopped');
    });
    // a focus that starts while it still celebrates leaves the clock alone too
    b = new B.Brain(B.rng(2));
    b.update(T, working(1));
    eq(b.update(T + 1000, done), 'celebrate');
    b.cue('focus', T + 3000);
    upTo(b, done, T + 3000, T + 20000);
    b.cue(null, T + 21000);
    eq(b.update(T + 21000, done), 'waitBag');
    // the app opened during a focus after 可以下班: the first look is not a change during the focus
    b = new B.Brain(B.rng(2));
    b.cue('focus', T);
    eq(upTo(b, done, T, T + 10000), 'focus');
    b.cue(null, T + 11000);
    eq(b.update(T + 11000, done), 'waitBag');
    // 下班 pressed during a focus started after 可以下班 is a new status: it celebrates after the focus, as in 1.0
    b = new B.Brain(B.rng(2));
    upTo(b, done, T, T + 20000);
    b.cue('focus', T + 21000);
    upTo(b, done, T + 21000, T + 30000);
    upTo(b, ended, T + 31000, T + 40000);
    b.cue(null, T + 41000);
    eq(b.update(T + 41000, ended), 'celebrate');
    eq(b.update(T + 49000, ended), 'waitBag');
  });

  test('behavior: wave for 4 s after the cue and each knock, idle between; holdCup holds; stretch for 4 s', function () {
    var t = T0 + 600000, w = working();
    eq([B.WAVE_MS, B.STRETCH_MS, B.SIP_MS], [4000, 4000, 3000]);
    // wave (the reminder asks only 起來動)
    var b = new B.Brain(B.rng(3));
    b.update(t - 1000, w);
    b.cue('wave', t);
    eq(b.update(t, w), 'wave');
    eq(b.update(t + 3999, w), 'wave');
    eq(b.update(t + 4000, w), 'idle', 'then waits, looking at you');
    eq(upTo(b, w, t + 5000, t + 119000), 'idle');
    eq(b.base, 'typing', 'the base state goes on underneath');
    b.knock(t + 120000);
    eq(b.update(t + 120000, w), 'wave', 'a knock waves again');
    eq(b.update(t + 123999, w), 'wave');
    eq(b.update(t + 124000, w), 'idle');
    // holdCup (the reminder asks for water)
    b = new B.Brain(B.rng(3));
    b.update(t - 1000, w);
    b.cue('holdCup', t);
    eq(b.update(t, w), 'holdCup');
    eq(b.waveAt, t);
    eq(upTo(b, w, t + 1000, t + 60000), 'holdCup', 'holds the cup');
    b.knock(t + 120000);
    eq(b.update(t + 120000, w), 'holdCup', 'a knock replays its own wave');
    eq(b.waveAt, t + 120000);
    b.show('sip', t + 121000, B.SIP_MS);
    eq(b.update(t + 121000, w), 'sip', 'overlays still win');
    eq(b.update(t + 123999, w), 'sip');
    eq(b.update(t + 124000, w), 'holdCup');
    // stretch (the break bubble)
    b = new B.Brain(B.rng(3));
    b.update(t - 1000, w);
    b.cue('stretch', t);
    eq(b.update(t, w), 'stretch');
    eq(b.update(t + 3999, w), 'stretch');
    eq(b.update(t + 4000, w), 'typing', 'then the base state');
    b.knock(t + 120000);
    eq(b.update(t + 120000, w), 'wave', 'a pomodoro bubble re-waves too (§5.1)');
    eq(b.update(t + 124000, w), 'typing');
    b.cue(null, t + 125000);
    eq(b.update(t + 125000, w), 'typing');
    // a cue cuts an idle action short
    b = new B.Brain(B.rng(7));
    var r = runs(b, w, 120, 1000), act = r.filter(function (x) { return x.state !== 'typing'; })[0];
    ok(act, 'an idle action came');
    b = new B.Brain(B.rng(7));
    upTo(b, w, T0, act.from);
    eq(b.state, act.state);
    b.cue('holdCup', act.from + 500);
    eq(b.update(act.from + 1000, w), 'holdCup');
  });

  test('behavior: no idle actions while a cue is on', function () {
    function seq(cue) {
      var b = new B.Brain(B.rng(7));
      if (cue) b.cue(cue, T0);
      return runs(b, working(), 120, 1000).map(function (x) { return x.state; });
    }
    ok(seq(null).some(function (s) { return WORK_IDLES.indexOf(s) >= 0; }), 'the same pet without a cue: ' + seq(null));
    eq(seq('focus'), ['focus']);
    eq(seq('wave'), ['wave', 'idle']);
    eq(seq('holdCup'), ['holdCup']);
    eq(seq('stretch'), ['stretch', 'typing']);
  });

  // ---------- lines ----------
  var RICH = { name: '金金', kind: 'hamster', minutesToLunch: 15, minutesToEnd: 12, earned: 1234.5, step: 100, gained: 2,
    hour: 10, energy: 30, mood: 30, items: QJZ.settings.DEFAULTS.items, goal: 8 };
  function ctxs() {
    var out = [{}, { kind: 'cat' }, { kind: 'hamster', off: true }, { kind: 'cat', minutesToEnd: 200, earned: 30, hour: 15 },
      { kind: 'cat', minutesToLunch: 1, minutesToEnd: 1, earned: 65, hour: 18, energy: 90, mood: 95 },
      { kind: 'hamster', minutesToLunch: 60.5, minutesToEnd: 30.2, earned: 0.4, hour: 8, items: [] }, RICH];
    var cat = {}; for (var x in RICH) cat[x] = RICH[x];
    cat.kind = 'cat'; cat.name = '小橘';
    out.push(cat);
    return out;
  }

  test('lines: every base state has at least 5 lines for each kind', function () {
    BASE.forEach(function (s) {
      ['cat', 'hamster'].forEach(function (k) {
        ok(L.templates(s, k).length >= 5, s + ' ' + k + ': ' + L.templates(s, k).length);
      });
    });
    eq(BASE.filter(function (s) { return L.STATES.indexOf(s) < 0; }), []);
  });

  test('lines: pick never leaves a { placeholder, for every state, kind and context', function () {
    var rng = B.rng(21);
    L.STATES.forEach(function (s) {
      ctxs().forEach(function (c, ci) {
        for (var i = 0; i < 40; i++) {
          var o = {}; for (var k in c) o[k] = c[k];
          o.rng = rng;
          var line = L.pick(s, o);
          ok(typeof line === 'string' && line.length > 0, s + ' ctx ' + ci + ': empty');
          ok(!/[{}]/.test(line), s + ' ctx ' + ci + ': ' + line);
        }
      });
    });
  });

  test('lines: every template fills completely with a rich context (coverage)', function () {
    var n = 0;
    L.STATES.forEach(function (s) {
      ['cat', 'hamster'].forEach(function (k) {
        L.templates(s, k).forEach(function (t) {
          var c = {}; for (var x in RICH) c[x] = RICH[x];
          c.kind = k; c.rng = B.rng(n);
          var out = L.fill(t, c);
          ok(out && !/[{}\[\]]/.test(out), s + ' ' + k + ': ' + t + ' -> ' + out);
          n++;
        });
      });
    });
    ok(n > 150, n + ' templates');
  });

  test('lines: cats often end with 喵, hamsters with 吱, never the other one', function () {
    var rng = B.rng(8), cat = 0, ham = 0, N = 300;
    for (var i = 0; i < N; i++) {
      var c = L.pick('typing', { kind: 'cat', rng: rng }), h = L.pick('typing', { kind: 'hamster', rng: rng });
      if (c.indexOf('喵') >= 0) cat++;
      if (h.indexOf('吱') >= 0) ham++;
      ok(c.indexOf('吱') < 0, c);
      ok(h.indexOf('喵') < 0, h);
    }
    ok(cat > N * 0.5, 'cat ' + cat);
    ok(ham > N * 0.5, 'hamster ' + ham);
  });

  test('lines: time-aware and money lines show when they apply, and only then', function () {
    function some(state, ctx, re) {
      var rng = B.rng(31), hit = 0;
      for (var i = 0; i < 400; i++) { ctx.rng = rng; if (re.test(L.pick(state, ctx))) hit++; }
      return hit;
    }
    ok(some('typing', { kind: 'cat', minutesToLunch: 15 }, /^再 15 分鐘就午休了！$/) > 0, 'lunch countdown');
    eq(some('typing', { kind: 'cat', minutesToLunch: 200 }, /午休/), 0, 'not hours ahead');
    ok(some('sprint', { kind: 'cat', minutesToEnd: 12 }, /^再 12 分鐘就下班了！$/) > 0, 'end countdown');
    ok(some('typing', { kind: 'hamster', earned: 300 }, /^已經賺到.*(珍奶|便當|拿鐵)了！$/) > 0, 'money in items');
    ok(some('typing', { kind: 'hamster', earned: 130 }, /已經賺到兩杯珍奶了！/) > 0, 'two cups');
    eq(some('typing', { kind: 'hamster', earned: 20 }, /已經賺到|NT\$/), 0, 'nothing to brag about yet');
    ok(some('typing', { kind: 'hamster', minutesToEnd: 125 }, /2 小時 5 分/) > 0, 'time left');
    ok(some('idle', { kind: 'cat', off: true }, /休假|放鬆|耍廢/) > 0, 'day off');
    eq(some('idle', { kind: 'cat', off: true }, /上班|開工/), 0, 'no work talk on a day off');
    ok(some('hop', { kind: 'cat', step: 100 }, /NT\$ 100/) > 0, 'milestone amount');
    ok(some('missed', { kind: 'cat', gained: 2, step: 100 }, /NT\$ 200/) > 0, 'missed while hidden: the money');
    ok(some('missed', { kind: 'cat', gained: 2, step: 100 }, /小魚乾又多了兩份喵/) > 0, 'missed while hidden: the snacks');
  });

  test('lines: waitBag says 可以走了！ and names fill in literally', function () {
    var rng = B.rng(13), seen = false;
    for (var i = 0; i < 200; i++) if (L.pick('waitBag', { kind: 'hamster', rng: rng }).indexOf('可以走了！') >= 0) seen = true;
    ok(seen, '可以走了！');
    var withName = 0;
    for (var j = 0; j < 300; j++) {
      var s = L.pick('typing', { kind: 'cat', name: '{x}', rng: rng });
      if (s.indexOf('{x}') >= 0) withName++;
      ok(!/\{(?!x\})/.test(s), s);
    }
    ok(withName > 0, 'the name is used');
    var dflt = 0;
    for (var k = 0; k < 300; k++) if (L.pick('typing', { kind: 'cat', rng: rng }).indexOf('小橘') >= 0) dflt++;
    ok(dflt > 0, 'default cat name 小橘');
    eq(L.pick('nope', {}), '', 'unknown state');
  });

  test('lines: drank / waterGoal / standOk have 5+ lines with no unfilled placeholder; focusPoke is 專心中～; waterGoal with goal 8 mentions 8 杯', function () {
    var rng = B.rng(4);
    ['drank', 'waterGoal', 'standOk'].forEach(function (s) {
      ['cat', 'hamster'].forEach(function (k) {
        ok(L.templates(s, k).length >= 5, s + ' ' + k + ': ' + L.templates(s, k).length);
        for (var i = 0; i < 60; i++) {
          [{ kind: k, rng: rng }, { kind: k, rng: rng, goal: 8 }].forEach(function (c) {
            var line = L.pick(s, c);
            ok(line && !/[{}\[\]]/.test(line), s + ' ' + k + ': ' + line);
          });
        }
      });
    });
    ['cat', 'hamster'].forEach(function (k) {
      eq(L.templates('focusPoke', k), ['專心中～'], k);
      eq(L.pick('focusPoke', { kind: k, rng: rng }), '專心中～', k);
    });
    eq(L.templates('waterGoal', 'cat')[0], '{goal} 杯喝滿了！你好棒～', 'B_after_goal');
    eq(L.fill('{goal} 杯喝滿了！你好棒～', { goal: 8 }), '8 杯喝滿了！你好棒～');
    var withGoal = 0;
    for (var j = 0; j < 200; j++) {
      if (L.pick('waterGoal', { kind: 'cat', goal: 8, rng: rng }).indexOf('8 杯') >= 0) withGoal++;
      ok(!/\d 杯/.test(L.pick('waterGoal', { kind: 'hamster', rng: rng })), 'no goal, no number');
    }
    ok(withGoal > 0, 'the goal line comes up');
  });
})();
