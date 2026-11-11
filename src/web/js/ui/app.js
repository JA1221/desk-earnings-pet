window.QJZ = window.QJZ || {};
// Single source of truth for the page: settings, history, today's record, the live snapshot.
//
// Persistence model
//  - Today's in-progress record lives in history.days[today.day] with earned === null while open.
//  - A record is "open" when startMs is a number and earned === null.
//  - Older open records are closed on init / rollover: records that never started (startMs null) are DROPPED
//    unless they carry an off-day marker (kept, closed with earned 0); started ones ask QJZ.day.earlyLeaveQuestion first. Only the most recent
//    such question is asked (state.pendingQuestion); older ones are closed directly. Until answered the record
//    stays open. answerEarlyLeave(accept) -> resolveEarlyLeave -> closeDay -> flush save.
//  - Money is always computed from the wall clock (Date.now() + dev offset), never accumulated from tick counts.
QJZ.app = (function () {
  var SAVE_DELAY = 1000, TICK_MS = 100;

  var state = {
    settings: null, history: null, today: null, snap: null, rates: null, snacks: 0,
    pendingQuestion: null, startHint: null, ready: false, paused: false
  };
  var listeners = { tick: [], second: [], change: [] };
  var tickTimer = null, saveTimer = null, lastSec = null;
  var dirtySettings = false, dirtyHistory = false;
  var clockOffset = 0;   // dev mock only: lets dev.html show a fake time of day
  var started = false, unloadBound = false, tickEnabled = true;
  var bridge = null, nowFn = Date.now;

  function nowMs() { return nowFn() + clockOffset; }

  function emit(name, arg) {
    var l = listeners[name].slice();
    for (var i = 0; i < l.length; i++) {
      try { l[i](arg); } catch (e) { if (window.console) console.error('[app] ' + name + ' handler failed', e); }
    }
  }
  function on(name, fn) {
    if (!listeners[name]) return function () {};
    listeners[name].push(fn);
    return function () { var at = listeners[name].indexOf(fn); if (at >= 0) listeners[name].splice(at, 1); };
  }

  // ---- persistence ----
  function markSettings() { dirtySettings = true; schedule(); }
  function markHistory() { dirtyHistory = true; schedule(); }
  function schedule() {
    if (!state.ready || saveTimer) return;
    saveTimer = setTimeout(flush, SAVE_DELAY);
  }
  function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!state.ready) return;   // never save before init has been received
    if (dirtySettings) { dirtySettings = false; bridge.send('saveSettings', { text: JSON.stringify(state.settings) }); }
    if (dirtyHistory) { dirtyHistory = false; bridge.send('saveHistory', { text: JSON.stringify(state.history) }); }
  }

  // ---- derived values ----
  function recompute(ms) {
    var s = state.settings, t = state.today;
    state.rates = QJZ.earn.rates(s.salary, s.hoursPerDay);
    state.snap = QJZ.earn.snapshot({
      startMs: t.startMs, endMs: t.endMs, nowMs: ms, day: t.day,
      salary: s.salary, hoursPerDay: s.hoursPerDay, lunch: s.lunch
    });
    state.snacks = QJZ.rewards.snacksAvailable(t, state.snap.earned, s.milestone);
  }
  function changed() {
    if (!state.ready) return;
    recompute(nowMs());
    emit('change', state);
  }
  function setToday(rec) {
    state.today = rec;
    state.history.days[rec.day] = rec;
  }
  function updateToday(rec) { setToday(rec); markHistory(); changed(); }

  // ---- closing old days ----
  function closeRecord(rec) {
    state.history.days[rec.day] = QJZ.history.closeDay(rec, state.settings);
    markHistory();
  }
  // rec is an older, still open record. allowQuestion: this is the most recent one, so ask the early-leave question.
  function retire(rec, allowQuestion) {
    if (typeof rec.startMs !== 'number') {
      // Never started: an off-day marker is kept (closeDay -> earned 0, flags preserved); anything else is dropped.
      if (rec.offDay) closeRecord(rec);
      else { delete state.history.days[rec.day]; markHistory(); }
      return;
    }
    if (allowQuestion) {
      var q = QJZ.day.earlyLeaveQuestion(rec, state.settings);
      if (q) {
        if (state.pendingQuestion) answerQuestion(false, true);   // an even older question: decline it
        state.pendingQuestion = q;
        markHistory();
        return;
      }
    }
    closeRecord(rec);
  }
  function answerQuestion(accept, quiet) {
    var q = state.pendingQuestion;
    if (!q) return false;
    state.pendingQuestion = null;
    var rec = state.history.days[q.day];
    if (rec && rec.earned === null) {
      state.history.days[q.day] = QJZ.history.closeDay(QJZ.day.resolveEarlyLeave(rec, !!accept), state.settings);
      markHistory();
    }
    if (!quiet) { flush(); changed(); }
    return true;
  }
  function retireOlder(todayKey) {
    var open = [];
    for (var k in state.history.days) {
      if (Object.prototype.hasOwnProperty.call(state.history.days, k) && k < todayKey && state.history.days[k].earned === null) open.push(k);
    }
    open.sort();
    for (var i = 0; i < open.length; i++) {
      var rec = state.history.days[open[i]];
      if (state.pendingQuestion && state.pendingQuestion.day === rec.day) continue;
      retire(rec, i === open.length - 1);
    }
  }

  // ---- init ----
  function onInit(msg) {
    if (state.ready) flush();   // a repeated init: do not lose unsaved changes to the host copy
    var sp = QJZ.settings.parse(msg.settings === undefined ? null : msg.settings);
    var hp = QJZ.history.parse(msg.history === undefined ? null : msg.history);
    // Back up unreadable files before anything can overwrite them.
    if (sp.corrupted) bridge.send('backupCorrupt', { file: 'settings' });
    if (hp.corrupted) bridge.send('backupCorrupt', { file: 'history' });

    if (bridge.mock && typeof msg.nowMs === 'number') clockOffset = msg.nowMs - nowFn();
    var now = typeof msg.nowMs === 'number' ? msg.nowMs : nowMs();

    state.settings = sp.settings;
    state.history = hp.history;
    state.pendingQuestion = null;
    state.startHint = null;
    applySound();

    var key = QJZ.time.dayKey(now);
    setToday(state.history.days[key] || QJZ.day.empty(key));
    retireOlder(key);

    if (typeof msg.probeMs === 'number' && QJZ.time.dayKey(msg.probeMs) === key) {
      setToday(QJZ.day.onActivity(state.today, { type: 'probe', ms: msg.probeMs }, state.settings));
    }
    var hadStart = typeof state.today.startMs === 'number';
    setToday(QJZ.day.onActivity(state.today, { type: 'appstart', ms: now }, state.settings));
    if (!hadStart && typeof state.today.startMs === 'number') state.startHint = 'appstart';

    state.ready = true;
    dirtyHistory = true;
    if (!state.paused) startTick();
    recompute(nowMs());
    lastSec = Math.floor(nowMs() / 1000);
    schedule();
    emit('change', state);
    emit('tick', state.snap);
  }

  // ---- clock ----
  function checkRollover(ms) {
    var r = QJZ.day.rollover(state.today, ms);
    if (!r.closed) return;
    retire(r.closed, true);
    // No auto-start here: the next unlock / resume / logon starts the new day.
    setToday(r.current);
    state.startHint = null;
    markHistory();
    emit('change', state);
  }

  function tick() {
    if (!state.ready) return;
    var ms = nowMs();
    checkRollover(ms);
    recompute(ms);
    emit('tick', state.snap);
    var sec = Math.floor(ms / 1000);
    if (sec !== lastSec) { lastSec = sec; emit('second', state.snap); }
  }
  function startTick() {
    if (tickTimer || !tickEnabled) return;
    tickTimer = setInterval(tick, TICK_MS);   // only a trigger: every value is recomputed from the wall clock
  }
  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function onVisibility(msg) {
    var vis = !!msg.visible;
    state.paused = !vis;
    var root = document.documentElement;
    if (vis) {
      root.classList.remove('paused');
      if (state.ready) { startTick(); tick(); }   // catch up from the wall clock immediately
    } else {
      root.classList.add('paused');
      stopTick();
    }
  }

  function onSession(msg) {
    if (!state.ready) return;
    var ms = typeof msg.ms === 'number' ? msg.ms : nowMs();
    checkRollover(nowMs());
    if (msg.kind === 'lock' || msg.kind === 'suspend') {
      updateToday(QJZ.day.onLock(state.today, ms));
    } else if (msg.kind === 'logon' || msg.kind === 'unlock' || msg.kind === 'resume') {
      var before = state.today.startMs;
      updateToday(QJZ.day.onActivity(state.today, { type: msg.kind, ms: ms }, state.settings));
      if (before === null && typeof state.today.startMs === 'number') state.startHint = null;
    }
  }

  // ---- settings ----
  function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function merge(base, patch) {
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (var p in patch) {
      if (p === '__proto__' || !Object.prototype.hasOwnProperty.call(patch, p)) continue;
      out[p] = isPlain(patch[p]) && isPlain(out[p]) ? merge(out[p], patch[p]) : patch[p];
    }
    return out;
  }
  function applySound() {
    QJZ.sound.setVolume(state.settings.sound.volume);
    QJZ.sound.setEnabled(state.settings.sound.enabled);
  }

  // ---- actions ----
  function startWork() {
    if (!state.ready) return;
    state.startHint = null;
    updateToday(QJZ.day.manualStart(state.today, nowMs()));
  }
  function adjustStart(ms) {
    if (!state.ready || typeof ms !== 'number' || !isFinite(ms)) return;
    state.startHint = null;
    updateToday(QJZ.day.adjustStart(state.today, ms));
  }
  function endWork() {
    if (!state.ready || typeof state.today.startMs !== 'number') return;
    updateToday(QJZ.day.manualEnd(state.today, nowMs()));
    flush();
  }
  function setOffDay(v) {
    if (!state.ready) return;
    updateToday(QJZ.day.setOffDay(state.today, v));
  }
  function feed() {
    if (!state.ready || !(state.snacks > 0)) return false;
    updateToday(merge(state.today, { snacksEaten: (state.today.snacksEaten || 0) + 1 }));
    return true;
  }
  function saveSettings(patch) {
    if (!state.ready) return;
    // Round-trip through the sanitizer so a bad patch can never leave invalid settings behind.
    state.settings = QJZ.settings.parse(JSON.stringify(merge(state.settings, isPlain(patch) ? patch : {}))).settings;
    applySound();
    markSettings();
    changed();
  }
  function answerEarlyLeave(accept) { return answerQuestion(accept, false); }

  // opts (tests): {bridge, now, tick:false}. Loading this file has no side effects; start() wires everything.
  function start(opts) {
    if (started) return;
    started = true;
    opts = opts || {};
    bridge = opts.bridge || QJZ.bridge;
    nowFn = opts.now || Date.now;
    tickEnabled = opts.tick !== false;
    bridge.on('init', onInit);
    bridge.on('session', onSession);
    bridge.on('visibility', onVisibility);
    if (!unloadBound) { unloadBound = true; window.addEventListener('beforeunload', function () { flush(); }); }
    if (bridge.boot) bridge.boot();
  }

  // Tests only: back to the state before start().
  function reset() {
    stopTick();
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    dirtySettings = dirtyHistory = false;
    clockOffset = 0; lastSec = null; started = false; tickEnabled = true; bridge = null; nowFn = Date.now;
    listeners.tick = []; listeners.second = []; listeners.change = [];
    state.settings = state.history = state.today = state.snap = state.rates = null;
    state.snacks = 0; state.pendingQuestion = null; state.startHint = null; state.ready = false; state.paused = false;
    document.documentElement.classList.remove('paused');
  }

  return {
    state: state, start: start, tickNow: tick, _reset: reset, on: on, nowMs: nowMs, flush: flush,
    startWork: startWork, adjustStart: adjustStart, endWork: endWork, setOffDay: setOffDay,
    feed: feed, saveSettings: saveSettings, answerEarlyLeave: answerEarlyLeave
  };
})();
