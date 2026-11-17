window.QJZ = window.QJZ || {};
// Single source of truth for the page: settings, history, today's record, the live snapshot.
//
// Persistence model
//  - Today's in-progress record lives in history.days[today.day] with earned === null while open.
//  - A record is "open" when startMs is a number and earned === null.
//  - Older open records are closed on init / rollover: records that never started (startMs null) are DROPPED
//    unless they carry an off-day marker (kept, closed with earned 0); started ones ask QJZ.day.earlyLeaveQuestion first. Only the most recent
//    such question is asked (state.pendingQuestion); older ones are closed directly. Until answered the record
//    stays open. answerEarlyLeave(accept) -> resolveEarlyLeave -> closeDay -> flush save. Before that, init.lastExitMs
//    (the host's last shutdown / sign-out) counts as a lock of its day's open record (QJZ.day.onExit).
//  - Unreadable settings / history text (init.settings / init.history do not parse): backupCorrupt {file} for the
//    main file first. Then, and also when the main text is missing / empty / whitespace (a power loss), the .bak copy
//    (init.backups.settings / .history) is used when it has content that parses, else defaults / an empty history.
//    A settings .bak that was used is saved back as the main file.
//  - 今天休假 (setOffDay): today counts 0, status 'off', whatever its start and end; off again, it counts as before.
//    下班 then 繼續上班 (resumeWork): the end is cleared and the day runs on from its start.
//  - Money is always computed from the wall clock (Date.now() + dev offset), never accumulated from tick counts.
// Hidden or locked (visibility false) the tick stops; refresh() catches up from the wall clock instead (the 04:00
// rollover, today's numbers) and announces it with the refresh event (snap), without celebrating: every REFRESH_MS
// while hidden, and whenever the host sends menuOpening (its menu is about to show the work status and the snacks).
// Events (on): tick (every tickMs(): 100 ms, 250 ms with 省電模式; snap), second (snap), refresh (snap), change
// (state), started (today) on a fresh 開始上班 (startWork; not the auto start, 繼續上班 or 調整起算時間), milestone
// ({count, gained, quiet}) when
// the clock carries today's earnings past another settings.milestone step (gained: how many steps at once). Record /
// settings changes (adjustStart, a new step, init, a new day) only move the baseline, so they never celebrate by
// themselves. quiet: the step was crossed while nobody was watching — the first tick after visibility comes back, or
// after a gap of more than 5 s between ticks (asleep, throttled): the snack is there, but nothing should ring or fly.
// Mood (state.mood = {energy, mood}, QJZ.mood): follows today's record from the wall clock (QJZ.mood.advance, at
// most once a second), starts fresh each day and is counted again when today's start time is changed (a day that
// simply starts now keeps it); pet() / annoy() / feed() move it. Not saved: a restart counts the day again from its
// start (pats and snacks given before the restart are forgotten).
// Host notices are kept for the panels and announced with the notice event (the message itself):
//   hotkeyFailed {combo, reason, active}  state.hotkeyFailed, until the next setHotkey. When the combo that failed
//                                         is the saved one and the host still has a working one (active), the
//                                         saved privacy.hotkey goes back to active, so the next start registers it.
//   storageError {file, reason}           state.storageError (the last one), state.storageErrors (each file once).
// Host settings the page changes (saved at once, then sent): setAutostart(on), setCaptureGuard(on), setHotkey(combo),
// setZoom(percent) (1.1.5 縮放比例; the host sizes the windows from it).
// 1.1.5 檢查更新: checkUpdate() asks the host (its one network request) and state.update is {busy:true} until its
// updateResult {kind:'latest'|'newer'|'unknown', version}, then {kind, version} (an odd answer is unknown; latest without a
// version is the app's own); openUpdate() has the host open that result's page in the default browser.
// Session: lock / unlock are tracked; a resume while locked is not an arrival (the unlock that follows is).
// 相容模式: html.opaque (base.css paints the whole page) while settings.display.opaque or init.forceOpaque.
// 省電模式 (§5.9): while settings.display.powerSaver the tick runs every SAVER_TICK_MS (the money moves 4 times a
// second, not 10; a change restarts the running interval at once), and html.saver tells the CSS and the layouts.
QJZ.app = (function () {
  var SAVE_DELAY = 1000, TICK_MS = 100, SAVER_TICK_MS = 250, QUIET_GAP_MS = 5000, REFRESH_MS = 60000;

  var state = {
    settings: null, history: null, today: null, snap: null, rates: null, snacks: 0, mood: null,
    pendingQuestion: null, startHint: null, ready: false, paused: false, version: null, forceOpaque: false,
    hotkeyFailed: null, storageError: null, storageErrors: [], update: null
  };
  var listeners = { tick: [], second: [], refresh: [], change: [], started: [], milestone: [], notice: [] };
  var tickTimer = null, tickEvery = 0, saveTimer = null, refreshTimer = null, lastSec = null, lastMilestone = null;
  var dirtySettings = false, dirtyHistory = false;
  var clockOffset = 0;   // dev mock only: lets dev.html show a fake time of day
  var started = false, unloadBound = false, tickEnabled = true, resumed = false, lastTickMs = null, locked = false;
  var moodMs = 0, moodDay = null, moodStart = null;
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
      salary: s.salary, hoursPerDay: s.hoursPerDay, lunch: s.lunch, offDay: !!t.offDay
    });
    state.snacks = QJZ.rewards.snacksAvailable(t, state.snap.earned, s.milestone);
    updateMood(ms);
  }
  // Fresh each day; a start that moves (adjustStart) is counted again from the new start, unless the day simply
  // started now (auto start, 開始上班), which keeps the mood the pet already has. An off day is not a work day.
  function updateMood(ms) {
    if (!QJZ.mood) return;
    var t = state.today, start = typeof t.startMs === 'number' && !t.offDay ? t.startMs : null;
    var fresh = !state.mood || moodDay !== t.day ||
      (start !== moodStart && !(moodStart === null && start !== null && start >= moodMs - 1000));
    moodDay = t.day; moodStart = start;
    if (fresh) {
      state.mood = QJZ.mood.initial();
      moodMs = start !== null && start < ms ? start : ms;
    }
    if (ms < moodMs) { moodMs = ms; return; }   // the clock went back
    if (ms - moodMs < 1000 && !fresh) return;
    var s = state.settings;
    state.mood = QJZ.mood.advance(state.mood, moodMs, ms,
      { day: t.day, startMs: start, endMs: t.endMs, hoursPerDay: s.hoursPerDay, lunch: s.lunch });
    moodMs = ms;
  }
  function milestones() { return QJZ.rewards.milestones(state.snap.earned, state.settings.milestone); }
  function changed() {
    if (!state.ready) return;
    recompute(nowMs());
    lastMilestone = milestones();
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
      if (rec.offDay || QJZ.health.has(rec)) closeRecord(rec);
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
  function blank(text) { return text === null || text === undefined || String(text).replace(/\s+/g, '') === ''; }
  // The main text parsed by parse(text). The .bak text (only there after an earlier good save) is used instead
  // (fromBak) when the main text does not parse, or is missing / empty / whitespace (what a power loss can leave),
  // and the .bak has content that parses; else parse's defaults / empty result. backupCorrupt goes out for a main
  // text with content that does not parse, before anything can overwrite it.
  function readFile(file, parse, text, bak) {
    var r = parse(blank(text) ? null : text);
    if (!r.corrupted && !blank(text)) return r;
    if (r.corrupted) bridge.send('backupCorrupt', { file: file });
    if (typeof bak === 'string' && !blank(bak)) {
      var b = parse(bak);
      if (!b.corrupted) { b.fromBak = true; return b; }
    }
    return r;
  }
  // R-F2: the host's last exit counts as a lock of its day's open record, before the record is retired.
  function applyExit(exitMs, todayKey) {
    if (typeof exitMs !== 'number' || !isFinite(exitMs)) return;
    var day = QJZ.time.dayKey(exitMs), rec = state.history.days[day];
    if (day >= todayKey || !rec || rec.earned !== null) return;
    state.history.days[day] = QJZ.day.onExit(rec, exitMs);
  }

  function onInit(msg) {
    if (state.ready) flush();   // a repeated init: do not lose unsaved changes to the host copy
    var bak = isPlain(msg.backups) ? msg.backups : {};
    var sp = readFile('settings', QJZ.settings.parse, msg.settings, bak.settings);
    var hp = readFile('history', QJZ.history.parse, msg.history, bak.history);

    if (bridge.mock && typeof msg.nowMs === 'number') clockOffset = msg.nowMs - nowFn();
    var now = typeof msg.nowMs === 'number' ? msg.nowMs : nowMs();

    state.settings = sp.settings;
    state.history = hp.history;
    state.pendingQuestion = null;
    state.startHint = null;
    state.version = typeof msg.version === 'string' && msg.version ? msg.version : null;   // the host's AppHost.Version (設定 → 關於)
    state.forceOpaque = msg.forceOpaque === true;   // the host could not make the window transparent
    applySound();
    applyDisplay();

    var key = QJZ.time.dayKey(now);
    for (var dk in state.history.days) {   // open records from older versions may carry a start with seconds
      if (Object.prototype.hasOwnProperty.call(state.history.days, dk)) state.history.days[dk] = QJZ.day.normalize(state.history.days[dk]);
    }
    setToday(state.history.days[key] || QJZ.day.empty(key));
    applyExit(msg.lastExitMs, key);
    retireOlder(key);

    if (typeof msg.probeMs === 'number' && QJZ.time.dayKey(msg.probeMs) === key) {
      setToday(QJZ.day.onActivity(state.today, { type: 'probe', ms: msg.probeMs }, state.settings));
    }
    var hadStart = typeof state.today.startMs === 'number';
    setToday(QJZ.day.onActivity(state.today, { type: 'appstart', ms: now }, state.settings));
    if (!hadStart && typeof state.today.startMs === 'number') state.startHint = 'appstart';

    state.ready = true;
    dirtyHistory = true;
    if (sp.fromBak) dirtySettings = true;   // the .bak copy becomes the main file again
    if (!state.paused) startTick();
    recompute(nowMs());
    lastMilestone = milestones();
    lastSec = Math.floor(nowMs() / 1000);
    lastTickMs = nowMs();
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
    var ms = nowMs(), quiet = resumed || lastTickMs === null || ms - lastTickMs > QUIET_GAP_MS || ms < lastTickMs;
    resumed = false;
    lastTickMs = ms;
    checkRollover(ms);
    recompute(ms);
    emit('tick', state.snap);
    var m = milestones();
    if (lastMilestone !== null && m > lastMilestone) {
      var gained = m - lastMilestone;
      lastMilestone = m;
      emit('milestone', { count: m, gained: gained, quiet: quiet });
    }
    else lastMilestone = m;   // also follows the count down (a new day, an earlier clock)
    var sec = Math.floor(ms / 1000);
    if (sec !== lastSec) { lastSec = sec; emit('second', state.snap); }
  }
  // The tick's interval: 100 ms, or 250 ms with 省電模式.
  function tickMs() { return state.settings && state.settings.display.powerSaver ? SAVER_TICK_MS : TICK_MS; }
  function startTick() {
    if (tickTimer || !tickEnabled) return;
    tickEvery = tickMs();
    tickTimer = setInterval(tick, tickEvery);   // only a trigger: every value is recomputed from the wall clock
  }
  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  // Catch up from the wall clock without the tick: a new day, today's numbers. The milestone baseline is left alone, so
  // a step crossed meanwhile is still announced, quietly, by the tick after the re-show.
  function refresh() {
    if (!state.ready) return;
    var ms = nowMs();
    checkRollover(ms);
    recompute(ms);
    emit('refresh', state.snap);
  }
  function startRefresh() {
    if (refreshTimer || !tickEnabled) return;
    refreshTimer = setInterval(refresh, REFRESH_MS);
  }
  function stopRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  function onVisibility(msg) {
    var vis = !!msg.visible;
    state.paused = !vis;
    var root = document.documentElement;
    if (vis) {
      root.classList.remove('paused');
      stopRefresh();
      if (state.ready) { resumed = true; startTick(); tick(); }   // catch up from the wall clock now, quietly
    } else {
      root.classList.add('paused');
      stopTick();
      startRefresh();
    }
  }

  function onSession(msg) {
    if (msg.kind === 'lock') locked = true;
    else if (msg.kind === 'unlock' || msg.kind === 'logon') locked = false;
    if (!state.ready) return;
    var ms = typeof msg.ms === 'number' ? msg.ms : nowMs();
    checkRollover(nowMs());
    if (msg.kind === 'lock' || msg.kind === 'suspend') {
      updateToday(QJZ.day.onLock(state.today, ms));
    } else if (msg.kind === 'resume' && locked) {
      // waking up to the lock screen is not arriving: the unlock that follows is
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
  function applyDisplay() {
    var root = document.documentElement;
    root.classList.toggle('opaque', !!(state.settings.display.opaque || state.forceOpaque));
    root.classList.toggle('saver', !!state.settings.display.powerSaver);
    if (tickTimer && tickEvery !== tickMs()) { stopTick(); startTick(); }
  }

  // ---- actions ----
  function startWork() {
    if (!state.ready) return;
    state.startHint = null;
    updateToday(QJZ.day.manualStart(state.today, nowMs()));
    emit('started', state.today);
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
  // 繼續上班: today was ended (下班); clear the end. false when there is nothing to continue.
  function resumeWork() {
    var t = state.today;
    if (!state.ready || typeof t.startMs !== 'number' || t.endMs === null || t.endMs === undefined) return false;
    updateToday(QJZ.day.resume(t));
    flush();
    return true;
  }
  function setOffDay(v) {
    if (!state.ready) return;
    updateToday(QJZ.day.setOffDay(state.today, v));
  }
  function feed() {
    if (!state.ready || !(state.snacks > 0)) return false;
    if (state.mood) state.mood = QJZ.mood.feed(state.mood);
    updateToday(merge(state.today, { snacksEaten: (state.today.snacksEaten || 0) + 1 }));
    return true;
  }
  // A pat on the head (+5 mood) / one poke too many (-5). No change event: the caller re-renders.
  function pet() { if (state.ready && state.mood) state.mood = QJZ.mood.pet(state.mood); }
  function annoy() { if (state.ready && state.mood) state.mood = QJZ.mood.annoy(state.mood); }
  function saveSettings(patch) {
    if (!state.ready) return;
    // Round-trip through the sanitizer so a bad patch can never leave invalid settings behind.
    state.settings = QJZ.settings.parse(JSON.stringify(merge(state.settings, isPlain(patch) ? patch : {}))).settings;
    applySound();
    applyDisplay();
    markSettings();
    changed();
  }
  // Health counts of a day (§5.6). Saved at once: a cup is a small, deliberate act. A past day keeps the cup goal it
  // already has (a closed day keeps its goal); one without gets today's setting.
  function setHealth(day, h) {
    if (!state.ready || typeof day !== 'string') return;
    if (day === state.today.day) {
      setToday(QJZ.health.withHealth(state.today, h));
    } else if (day > state.today.day) {
      return;
    } else {
      var rec = state.history.days[day] || QJZ.history.closeDay(QJZ.day.empty(day), state.settings);
      var goal = QJZ.health.of(rec).cupGoal, next = QJZ.health.withHealth(rec, h);
      if (goal !== null) next.health.cupGoal = goal;
      state.history.days[day] = QJZ.health.seal(next, state.settings.health.water.goal);
    }
    markHistory();
    flush();
    changed();
  }
  function setPomodoro(p) {
    if (!state.ready) return;
    if (p === null || p === undefined) delete state.history.pomodoro; else state.history.pomodoro = p;
    markHistory();
    flush();
    changed();
  }
  function answerEarlyLeave(accept) { return answerQuestion(accept, false); }
  // menu 結束: save everything now, then tell the host it may exit (it also exits on its own after a timeout).
  function quit() {
    if (!bridge) return;
    flush();
    bridge.send('quit', {});
  }

  // ---- host settings (saved in settings.json at once, which the host reads at start, and applied now) ----
  function setAutostart(on) {
    if (!state.ready) return;
    saveSettings({ autostart: !!on });
    flush();
    bridge.send('setAutostart', { on: !!on });
  }
  function setCaptureGuard(on) {
    if (!state.ready) return;
    saveSettings({ privacy: { hideFromCapture: !!on } });
    flush();
    bridge.send('setCaptureGuard', { on: !!on });
  }
  // combo: "Ctrl+Alt+H" style. The host answers only a failure (hotkeyFailed).
  function setHotkey(combo) {
    if (!state.ready || typeof combo !== 'string' || !combo) return;
    state.hotkeyFailed = null;
    saveSettings({ privacy: { hotkey: combo } });
    flush();
    bridge.send('setHotkey', { combo: combo });
  }

  // 1.1.5 縮放比例: percent snapped to the setting's steps; saved and sent only when it changes. Returns the zoom.
  function setZoom(percent) {
    if (!state.ready) return null;
    var p = QJZ.settings.parse(JSON.stringify({ zoom: percent })).settings.zoom;
    if (p === state.settings.zoom) return p;
    saveSettings({ zoom: p });
    flush();
    bridge.send('setZoom', { percent: p });
    return p;
  }

  // ---- 1.1.5 檢查更新 ----
  function checkUpdate() {
    if (!bridge || (state.update && state.update.busy)) return;
    state.update = { busy: true };
    bridge.send('checkUpdate', {});
    changed();
  }
  function openUpdate() { if (bridge) bridge.send('openUpdate', {}); }
  function onUpdateResult(msg) {
    var kind = msg && (msg.kind === 'latest' || msg.kind === 'newer') ? msg.kind : 'unknown';
    var v = msg && typeof msg.version === 'string' && /^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(msg.version) ? msg.version : null;
    if (kind === 'latest' && !v) v = state.version;
    if (kind === 'newer' && !v) kind = 'unknown';
    state.update = { kind: kind, version: kind === 'unknown' ? null : v };
    changed();
  }

  function onHotkeyFailed(msg) {
    state.hotkeyFailed = msg;
    var s = state.settings, active = msg && msg.active;
    if (state.ready && typeof active === 'string' && active && msg.combo === s.privacy.hotkey && active !== s.privacy.hotkey) {
      saveSettings({ privacy: { hotkey: active } });
    }
    emit('notice', msg);
  }
  function onStorageError(msg) {
    state.storageError = msg;
    var f = msg && msg.file;
    if (typeof f === 'string' && state.storageErrors.indexOf(f) < 0) state.storageErrors.push(f);
    emit('notice', msg);
  }

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
    bridge.on('hotkeyFailed', onHotkeyFailed);
    bridge.on('storageError', onStorageError);
    bridge.on('updateResult', onUpdateResult);
    bridge.on('menuOpening', function () { refresh(); });
    if (!unloadBound) { unloadBound = true; window.addEventListener('beforeunload', function () { flush(); }); }
    if (bridge.boot) bridge.boot();
  }

  // Tests only: back to the state before start().
  function reset() {
    stopTick();
    stopRefresh();
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    dirtySettings = dirtyHistory = false;
    clockOffset = 0; lastSec = null; lastMilestone = null; started = false; tickEnabled = true; bridge = null; nowFn = Date.now;
    resumed = false; lastTickMs = null; moodMs = 0; moodDay = null; moodStart = null; state.mood = null; locked = false;
    listeners.tick = []; listeners.second = []; listeners.refresh = []; listeners.change = []; listeners.started = []; listeners.milestone = []; listeners.notice = [];
    state.settings = state.history = state.today = state.snap = state.rates = null;
    state.snacks = 0; state.pendingQuestion = null; state.startHint = null; state.ready = false; state.paused = false;
    state.hotkeyFailed = state.storageError = null; state.storageErrors = []; state.version = null; state.forceOpaque = false;
    state.update = null;
    document.documentElement.classList.remove('paused');
    document.documentElement.classList.remove('opaque');
    document.documentElement.classList.remove('saver');
  }

  return {
    state: state, start: start, tickNow: tick, tickMs: tickMs, refresh: refresh, _reset: reset, on: on, nowMs: nowMs, flush: flush,
    startWork: startWork, adjustStart: adjustStart, endWork: endWork, resumeWork: resumeWork, setOffDay: setOffDay,
    feed: feed, pet: pet, annoy: annoy, saveSettings: saveSettings, setHealth: setHealth, setPomodoro: setPomodoro, answerEarlyLeave: answerEarlyLeave, quit: quit,
    setAutostart: setAutostart, setCaptureGuard: setCaptureGuard, setHotkey: setHotkey,
    setZoom: setZoom, checkUpdate: checkUpdate, openUpdate: openUpdate
  };
})();
