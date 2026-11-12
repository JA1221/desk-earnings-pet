window.QJZ = window.QJZ || {};
// The pomodoro state machine (spec 4.3, 5.2). Pure: every function returns a new object and never reads the clock.
//   P = {phase:'idle'|'focus'|'break'|'breakOver', startMs, endMs, day, long, done, notice:null|'break'|'breakEnd'}
//   day = dayKey of the focus start; done = that day's tomato count after this one; notice = the bubble still owed.
//   cfg = settings.health.pomodoro = {focus, short, long, longEvery}  (minutes / count; the caller sanitises it)
QJZ.pomodoro = (function () {
  var MIN = 60000, MAX_PHASE_MS = 86400000, PHASES = ['idle', 'focus', 'break', 'breakOver'], NOTICES = ['break', 'breakEnd'];

  function make(o) {
    return { phase: o.phase, startMs: o.startMs, endMs: o.endMs, day: o.day, long: !!o.long, done: o.done || 0, notice: o.notice || null };
  }
  function idle() { return make({ phase: 'idle', startMs: null, endMs: null, day: null, long: false, done: 0, notice: null }); }
  function focusFrom(nowMs, cfg) {
    return make({ phase: 'focus', startMs: nowMs, endMs: nowMs + cfg.focus * MIN, day: QJZ.time.dayKey(nowMs), long: false, done: 0, notice: null });
  }

  function start(p, nowMs, cfg) { return p.phase === 'idle' || p.phase === 'breakOver' ? focusFrom(nowMs, cfg) : p; }
  function stop() { return idle(); }
  function skipBreak(p, nowMs, cfg) { return p.phase === 'break' ? focusFrom(nowMs, cfg) : p; }
  function ack(p) { return p.notice === null ? p : make({ phase: p.phase, startMs: p.startMs, endMs: p.endMs, day: p.day, long: p.long, done: p.done, notice: null }); }

  // Walks every phase that has ended by nowMs, in order. countBefore = tomatoes already done on p.day.
  function advance(p, nowMs, cfg, countBefore) {
    var events = [];
    if (p.phase === 'focus' && nowMs >= p.endMs) {
      var atMs = p.endMs, n = countBefore + 1, isLong = n % cfg.longEvery === 0;
      events.push({ type: 'focusDone', day: p.day, atMs: atMs });
      events.push({ type: 'breakStart', day: QJZ.time.dayKey(atMs), atMs: atMs, long: isLong });
      p = make({ phase: 'break', startMs: atMs, endMs: atMs + (isLong ? cfg.long : cfg.short) * MIN, day: p.day, long: isLong, done: n, notice: 'break' });
    }
    if (p.phase === 'break' && nowMs >= p.endMs) {
      events.push({ type: 'breakDone', atMs: p.endMs });
      p = make({ phase: 'breakOver', startMs: p.startMs, endMs: p.endMs, day: p.day, long: p.long, done: p.done, notice: 'breakEnd' });
    }
    return { p: p, events: events };
  }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || PHASES.indexOf(raw.phase) < 0) return null;
    var notice = NOTICES.indexOf(raw.notice) >= 0 ? raw.notice : null;
    if (raw.phase === 'idle') return make({ phase: 'idle', startMs: null, endMs: null, day: null, long: false, done: 0, notice: notice });
    var s = raw.startMs, e = raw.endMs;
    if (typeof s !== 'number' || typeof e !== 'number' || !isFinite(s) || !isFinite(e) || e <= s || e - s > MAX_PHASE_MS) return null;
    if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;
    var done = typeof raw.done === 'number' && isFinite(raw.done) && raw.done >= 0 ? Math.floor(raw.done) : 0;
    return make({ phase: raw.phase, startMs: s, endMs: e, day: raw.day, long: raw.long === true, done: done, notice: notice });
  }

  // Ring readouts: null unless a phase is running; a clock set back never shows more than the phase length.
  function remainingMs(p, nowMs) {
    if (p.phase !== 'focus' && p.phase !== 'break') return null;
    return Math.min(Math.max(p.endMs - nowMs, 0), p.endMs - p.startMs);
  }
  function minutesLeft(p, nowMs) { var r = remainingMs(p, nowMs); return r === null ? null : Math.ceil(r / MIN); }
  function mmss(p, nowMs) {
    var r = remainingMs(p, nowMs); if (r === null) return null;
    var s = Math.ceil(r / 1000), m = Math.floor(s / 60), x = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function fraction(p, nowMs) {
    var r = remainingMs(p, nowMs); if (r === null) return null;
    return Math.min(Math.max(1 - r / (p.endMs - p.startMs), 0), 1);
  }

  return { idle: idle, start: start, stop: stop, skipBreak: skipBreak, ack: ack, advance: advance, sanitize: sanitize,
    remainingMs: remainingMs, minutesLeft: minutesLeft, mmss: mmss, fraction: fraction };
})();
