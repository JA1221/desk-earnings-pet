// QJZ.app lifecycle with a fake bridge and a fake clock. Dates: 2026-11-12 is a Thursday, 11-11 a Wednesday.
(function () {
  function at(d, h, m) { return new Date(2026, 10, d, h, m, 0, 0).getTime(); }
  var SETTINGS = JSON.stringify({ salary: { mode: 'monthly', amount: 50000, divisor: 22 } });

  function mk(nowMs) {
    QJZ.app._reset();
    var sent = [], handlers = {}, clock = { ms: nowMs };
    var bridge = {
      send: function (t, p) { sent.push({ type: t, p: p }); },
      on: function (t, f) { handlers[t] = f; },
      emit: function (m) { handlers[m.type](m); }
    };
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    return { bridge: bridge, sent: sent, clock: clock };
  }
  function init(env, o) {
    var msg = {
      type: 'init', settings: o.settings === undefined ? SETTINGS : o.settings,
      history: o.history === undefined ? null : o.history,
      probeMs: o.probeMs === undefined ? null : o.probeMs, nowMs: env.clock.ms, version: 't'
    };
    ['lastExitMs', 'lastLeaveMs', 'backups', 'forceOpaque', 'afterUpdate', 'version'].forEach(function (k) { if (o[k] !== undefined) msg[k] = o[k]; });
    env.bridge.emit(msg);
  }
  function hist(recs) {
    var h = { version: 1, days: {} };
    recs.forEach(function (r) { h.days[r.day] = r; });
    return JSON.stringify(h);
  }
  function rec(day, startMin, extra) {
    var r = QJZ.day.empty(day);
    if (startMin !== null) r.startMs = QJZ.time.atMinutes(day, startMin);
    for (var k in extra) r[k] = extra[k];
    return r;
  }
  function typesOf(sent) { return sent.map(function (s) { return s.type; }); }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }).map(function (s) { return s.p; }); }
  function lastSave(sent, type) {
    for (var i = sent.length - 1; i >= 0; i--) if (sent[i].type === type) return sent[i];
    return null;
  }

  test('app init: probe from today sets the start', function () {
    var e = mk(at(12, 10, 0));
    init(e, { probeMs: at(12, 8, 30) });
    eq(QJZ.app.state.today.startMs, at(12, 8, 30));
    eq(QJZ.app.state.startHint, null);
    QJZ.app._reset();
  });
  test('app init: no probe starts at nowMs with the appstart hint', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    eq(QJZ.app.state.today.startMs, at(12, 10, 0));
    eq(QJZ.app.state.startHint, 'appstart');
    QJZ.app._reset();
  });
  test('app init: a probe from yesterday is ignored', function () {
    var e = mk(at(12, 10, 0));
    init(e, { probeMs: at(11, 8, 30) });
    eq(QJZ.app.state.today.startMs, at(12, 10, 0));
    eq(QJZ.app.state.startHint, 'appstart');
    QJZ.app._reset();
  });
  test('app init: corrupt settings are backed up before any saveSettings', function () {
    var e = mk(at(12, 10, 0));
    init(e, { settings: '{not json' });
    QJZ.app.saveSettings({ milestone: 50 });
    QJZ.app.flush();
    var t = typesOf(e.sent);
    ok(t.indexOf('backupCorrupt') >= 0, 'backupCorrupt sent');
    eq(e.sent[t.indexOf('backupCorrupt')].p, { file: 'settings' });
    ok(t.indexOf('saveSettings') > t.indexOf('backupCorrupt'), 'save after backup');
    QJZ.app._reset();
  });
  test('app: nothing is saved before init', function () {
    var e = mk(at(12, 10, 0));
    QJZ.app.startWork();
    QJZ.app.saveSettings({ milestone: 50 });
    QJZ.app.endWork();
    QJZ.app.flush();
    eq(e.sent.length, 0);
    QJZ.app._reset();
  });
  test('app init: older open record with an early lock raises the question', function () {
    var e = mk(at(12, 10, 0));
    var y = rec('2026-11-11', 540, { lastLockMs: at(11, 15, 0) });
    init(e, { history: hist([y]) });
    var s = QJZ.app.state;
    eq(s.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 15, 0) });
    eq(s.history.days['2026-11-11'].earned, null, 'stays open until answered');
    eq(QJZ.app.answerEarlyLeave(true), true);
    var done = s.history.days['2026-11-11'];
    eq(done.endMs, at(11, 15, 0));
    ok(done.earned > 0, 'closed with earnings');
    eq(s.pendingQuestion, null);
    eq(QJZ.app.answerEarlyLeave(true), false, 'second answer is a no-op');
    ok(lastSave(e.sent, 'saveHistory') !== null, 'answer flushes a save');
    QJZ.app._reset();
  });
  test('app init: older open record without a question is closed, today stays open', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]) });
    var s = QJZ.app.state;
    eq(s.pendingQuestion, null);
    ok(s.history.days['2026-11-11'].earned > 0);
    eq(s.history.days['2026-11-12'].earned, null);
    QJZ.app._reset();
  });
  test('app init: unstarted older record is dropped, an off-day marker is kept as earned 0', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-09', null, {}), rec('2026-11-10', null, { offDay: true })]) });
    var d = QJZ.app.state.history.days;
    eq(d['2026-11-09'], undefined);
    eq(d['2026-11-10'].earned, 0);
    eq(d['2026-11-10'].offDay, true);
    QJZ.app._reset();
  });
  test('app: lock 11-11 17:00, unlock 11-12 08:30 retires the old day and starts the new one', function () {
    var e = mk(at(11, 16, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]) });
    e.clock.ms = at(11, 17, 0);
    e.bridge.emit({ type: 'session', kind: 'lock', ms: at(11, 17, 0) });
    eq(QJZ.app.state.today.lastLockMs, at(11, 17, 0));
    e.clock.ms = at(12, 8, 30);
    e.bridge.emit({ type: 'session', kind: 'unlock', ms: at(12, 8, 30) });
    var s = QJZ.app.state;
    eq(s.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 17, 0) });
    eq(s.history.days['2026-11-11'].lastLockMs, at(11, 17, 0));
    eq(s.today.day, '2026-11-12');
    eq(s.today.startMs, at(12, 8, 30));
    QJZ.app._reset();
  });
  test('app: a second init loses and duplicates nothing', function () {
    var e = mk(at(12, 10, 0));
    var text = hist([rec('2026-11-10', 540, {}), rec('2026-11-11', 540, { lastLockMs: at(11, 15, 0) })]);
    init(e, { history: text });
    QJZ.app.adjustStart(at(12, 9, 0));
    init(e, { history: text });
    var s = QJZ.app.state;
    eq(Object.keys(s.history.days).sort(), ['2026-11-10', '2026-11-11', '2026-11-12']);
    ok(s.history.days['2026-11-10'].earned > 0);
    eq(s.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 15, 0) });
    ok(lastSave(e.sent, 'saveHistory') !== null, 'unsaved changes were flushed before re-parsing');
    QJZ.app._reset();
  });
  test('app: saved history parses and keeps today open', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    QJZ.app.flush();
    var saved = lastSave(e.sent, 'saveHistory');
    ok(saved, 'saveHistory sent');
    var parsed = QJZ.history.parse(saved.p.text);
    eq(parsed.corrupted, false);
    eq(parsed.history.days['2026-11-12'].earned, null);
    eq(parsed.history.days['2026-11-12'].startMs, at(12, 10, 0));
    QJZ.app._reset();
  });
  // 50000 / 22 / 8 h = NT$284.09 an hour: from 09:00 the 3rd NT$100 milestone falls at 10:03:22.
  test('app: milestone fires once when the clock crosses a step, never on init', function () {
    var e = mk(at(12, 10, 0));
    var got = [];
    QJZ.app.on('milestone', function (m) { got.push(m.count); });
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    eq(got, [], 'init with 2 milestones already passed does not celebrate');
    e.clock.ms = at(12, 10, 3); QJZ.app.tickNow();
    eq(got, []);
    e.clock.ms = at(12, 10, 4); QJZ.app.tickNow();
    eq(got, [3]);
    e.clock.ms = at(12, 10, 5); QJZ.app.tickNow();
    eq(got, [3], 'only once per step');
    eq(QJZ.app.state.snacks, 3, 'the step is a snack');
    QJZ.app._reset();
  });
  test('app: a jump from adjustStart moves the milestone baseline without celebrating', function () {
    var e = mk(at(12, 10, 0));
    var got = 0;
    QJZ.app.on('milestone', function () { got++; });
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    QJZ.app.adjustStart(at(12, 7, 0));
    QJZ.app.tickNow();
    eq(got, 0);
    QJZ.app._reset();
  });
  test('app: quit flushes pending saves, then sends quit', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    QJZ.app.saveSettings({ milestone: 50 });
    QJZ.app.quit();
    var t = typesOf(e.sent);
    eq(t[t.length - 1], 'quit');
    ok(t.indexOf('saveSettings') >= 0 && t.indexOf('saveSettings') < t.length - 1, 'settings saved before quit');
    QJZ.app._reset();
  });
  test('app: hotkeyFailed / storageError are kept for the panels', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    e.bridge.emit({ type: 'hotkeyFailed', combo: 'Ctrl+Alt+H', reason: 'taken' });
    e.bridge.emit({ type: 'storageError', file: 'settings', reason: 'locked' });
    eq(QJZ.app.state.hotkeyFailed.reason, 'taken');
    eq(QJZ.app.state.storageError.file, 'settings');
    QJZ.app._reset();
    eq(QJZ.app.state.hotkeyFailed, null);
  });
  // ---- Task 13: mood and quiet milestones ----
  test('app: mood follows the day from the wall clock and rises with petting and feeding', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });   // started 09:00
    var m = QJZ.app.state.mood;
    near(m.energy, 92.5, 0.01, 'an hour of work');
    near(m.mood, 60, 0.01, 'an hour of drift from 70');
    QJZ.app.pet();
    near(QJZ.app.state.mood.mood, 65, 0.01, 'pet +5');
    QJZ.app.annoy();
    near(QJZ.app.state.mood.mood, 60, 0.01, 'annoy -5');
    ok(QJZ.app.feed());
    near(QJZ.app.state.mood.mood, 75, 0.01, 'feed +15');
    eq(QJZ.app.state.mood.energy, 100, 'feed +10, clamped');
    e.clock.ms = at(12, 11, 0); QJZ.app.tickNow();
    near(QJZ.app.state.mood.energy, 92.5, 0.01, 'drains again from the wall clock');
    e.clock.ms = at(12, 12, 30); QJZ.app.tickNow();
    near(QJZ.app.state.mood.energy, 100, 0.01, 'one big jump (hidden) still counts work, then lunch');
    QJZ.app._reset();
    eq(QJZ.app.state.mood, null);
  });
  test('app: a new day starts a fresh mood', function () {
    var e = mk(at(12, 17, 0));
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    ok(QJZ.app.state.mood.energy < 80);
    e.clock.ms = at(13, 8, 0); QJZ.app.tickNow();
    eq(QJZ.app.state.mood, { energy: 100, mood: 70 });
    QJZ.app._reset();
  });
  test('app: a milestone crossed while hidden is quiet on re-show; the snack is still there', function () {
    var e = mk(at(12, 10, 3));
    var got = [];
    QJZ.app.on('milestone', function (m) { got.push(m); });
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    e.bridge.emit({ type: 'visibility', visible: false });
    e.clock.ms = at(12, 10, 5);
    e.bridge.emit({ type: 'visibility', visible: true });
    eq(got.length, 1);
    eq([got[0].count, got[0].quiet, got[0].gained], [3, true, 1]);
    eq(QJZ.app.state.snacks, 3, 'awarded silently');
    // the 4th NT$100 step falls at 10:24:28.8: crossed live it is loud again
    e.clock.ms = at(12, 10, 24) + 28000; QJZ.app.tickNow();
    e.clock.ms = at(12, 10, 24) + 29000; QJZ.app.tickNow();
    eq(got.length, 2);
    eq([got[1].count, got[1].quiet, got[1].gained], [4, false, 1]);
    QJZ.app._reset();
  });
  // Review M-3: hidden or locked, the 100 ms tick stops; a slow refresh (every 60 s) keeps the day and the numbers the
  // menu shows current (refresh event), without celebrating: a milestone crossed meanwhile stays quiet for the re-show.
  test('app: while hidden a slow refresh (60 s) rolls the day over and announces it; it stops when shown', function () {
    var calls = [], si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (fn, ms) { var h = { fn: fn, ms: ms, live: true }; calls.push(h); return h; };
    window.clearInterval = function (h) { if (h && h.live !== undefined) h.live = false; };
    function live(ms) { return calls.filter(function (h) { return h.live && h.ms === ms; }); }
    try {
      QJZ.app._reset();
      var handlers = {}, clock = { ms: at(12, 18, 30) }, got = [], refreshed = 0;
      var bridge = { send: function () {}, on: function (t, f) { handlers[t] = f; }, emit: function (m) { handlers[m.type](m); } };
      QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; } });
      QJZ.app.on('refresh', function () { refreshed++; });
      QJZ.app.on('milestone', function (m) { got.push(m); });
      bridge.emit({ type: 'init', settings: SETTINGS, history: hist([rec('2026-11-12', 540, { endMs: at(12, 18, 0), endSource: 'manual' })]),
        probeMs: null, nowMs: clock.ms, version: 't' });
      eq([live(100).length, live(60000).length], [1, 0], 'shown: the tick, no slow refresh');
      bridge.emit({ type: 'visibility', visible: false });
      eq([live(100).length, live(60000).length], [0, 1], 'hidden: the slow refresh instead');
      clock.ms = at(13, 9, 0);
      live(60000)[0].fn();
      eq(QJZ.app.state.today.day, '2026-11-13', 'the day rolled over while hidden');
      eq(refreshed, 1);
      eq(got.length, 0, 'never celebrates');
      bridge.emit({ type: 'visibility', visible: true });
      eq([live(100).length, live(60000).length], [1, 0], 'shown again: the tick is back, the slow refresh stopped');
      handlers.menuOpening({ type: 'menuOpening' });
      eq(refreshed, 2, 'menuOpening refreshes too');
    } finally { QJZ.app._reset(); window.setInterval = si; window.clearInterval = ci; }
    eq(calls.filter(function (h) { return h.live; }).length, 0, 'reset stops every timer');
  });

  test('app: a tick gap over 5 s without a visibility event makes the milestone quiet', function () {
    var e = mk(at(12, 10, 3));
    var got = [];
    QJZ.app.on('milestone', function (m) { got.push(m); });
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    e.clock.ms = at(12, 10, 3, 5); QJZ.app.tickNow();
    e.clock.ms = at(12, 10, 5); QJZ.app.tickNow();   // 115 s later: the timers were throttled, nothing told us
    eq(got.length, 1);
    eq([got[0].count, got[0].quiet], [3, true]);
    eq(QJZ.app.state.snacks, 3, 'awarded silently');
    e.clock.ms = at(12, 10, 24) + 28000; QJZ.app.tickNow();
    e.clock.ms = at(12, 10, 24) + 29000; QJZ.app.tickNow();
    eq([got[1].count, got[1].quiet], [4, false], 'a normal 1 s step is loud');
    QJZ.app._reset();
  });
  // ---- final review: R-F1 holiday / undo ----
  test('app: 今天休假 on a started day earns 0 and shows off; turning it off restores the day', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    var s = QJZ.app.state;
    near(s.snap.earned, 284.09, 0.01);
    QJZ.app.setOffDay(true);
    eq([s.snap.status, s.snap.earned], ['off', 0]);
    eq(s.today.startMs, at(12, 9, 0), 'the start is kept');
    eq(QJZ.history.monthTotal(s.history, '2026-11', s.today, s.snap.earned), 0, 'nothing counts today');
    e.clock.ms = at(12, 11, 0); QJZ.app.tickNow();
    eq(s.snap.earned, 0, 'the clock does not pay a holiday');
    QJZ.app.setOffDay(false);
    eq(s.snap.status, 'working');
    near(s.snap.earned, 568.18, 0.01, 'from the original start');
    QJZ.app._reset();
  });
  test('app: an off day that had started closes at 0 the next day, with no question', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, { offDay: true, lastLockMs: at(11, 15, 0) })]) });
    eq(QJZ.app.state.pendingQuestion, null);
    eq(QJZ.app.state.history.days['2026-11-11'].earned, 0);
    eq(QJZ.app.state.history.days['2026-11-11'].offDay, true);
    QJZ.app._reset();
    var f = mk(at(11, 16, 0));
    init(f, { history: hist([rec('2026-11-11', 540, {})]) });
    QJZ.app.setOffDay(true);
    f.clock.ms = at(12, 8, 0); QJZ.app.tickNow();
    eq(QJZ.app.state.history.days['2026-11-11'].earned, 0, 'closed by the rollover');
    eq(QJZ.app.state.today.day, '2026-11-12');
    QJZ.app._reset();
  });
  test('app: 開始上班 on an off day clears the marker and starts now', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-12', null, { offDay: true })]) });
    var s = QJZ.app.state;
    eq([s.today.startMs, s.snap.status], [null, 'off'], 'no auto start on an off day');
    QJZ.app.startWork();
    eq([s.today.offDay, s.today.startMs, s.snap.status], [false, at(12, 10, 0), 'working']);
    QJZ.app._reset();
  });
  test('app: 下班 then 繼續上班 (resumeWork) clears the end and the day earns on', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-12', 540, {})]) });
    var s = QJZ.app.state;
    eq(QJZ.app.resumeWork(), false, 'nothing to continue');
    QJZ.app.endWork();
    e.clock.ms = at(12, 11, 0); QJZ.app.tickNow();
    eq(s.snap.status, 'ended');
    near(s.snap.earned, 284.09, 0.01);
    e.sent.length = 0;
    eq(QJZ.app.resumeWork(), true);
    eq([s.today.endMs, s.today.endSource, s.today.startMs, s.snap.status], [null, null, at(12, 9, 0), 'working']);
    near(s.snap.earned, 568.18, 0.01, 'the time in between counts');
    var saved = lastSave(e.sent, 'saveHistory');
    ok(saved, 'saved at once');
    eq(JSON.parse(saved.p.text).days['2026-11-12'].endMs, null);
    QJZ.app._reset();
  });

  // ---- R-F2: the host's last exit (shutdown / sign-out) ----
  test('app init: lastExitMs on an open earlier day counts as its last lock (shut down at 15:00 -> the question)', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]), lastExitMs: at(11, 15, 0) });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 15, 0) });
    eq(QJZ.app.answerEarlyLeave(true), true);
    eq(QJZ.app.state.history.days['2026-11-11'].endMs, at(11, 15, 0));
    QJZ.app._reset();
  });
  test('app init: lastExitMs counts only without a lock; after the planned end there is no question', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, { lastLockMs: at(11, 16, 0) })]), lastExitMs: at(11, 15, 0) });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 16, 0) }, 'the lock');
    QJZ.app._reset();
    e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, { lastLockMs: at(11, 14, 0) })]), lastExitMs: at(11, 15, 30) });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 14, 0) }, 'locked at 14:00, still locked at the exit');
    QJZ.app._reset();
    e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, { lastLockMs: at(11, 15, 0) })]), lastExitMs: at(12, 3, 0) });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-11', lockMs: at(11, 15, 0) },
      'locked at 15:00 and left; Windows Update restarts the PC at 03:00 (still that day): the question is about 15:00');
    QJZ.app._reset();
    e = mk(at(12, 10, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]), lastExitMs: at(11, 18, 30) });
    eq(QJZ.app.state.pendingQuestion, null);
    near(QJZ.app.state.history.days['2026-11-11'].earned, 2272.73, 0.001, 'a full day');
    QJZ.app._reset();
  });
  // 1.1.5: the host's last leave (a sleep / shutdown in the System log) after the exit, on its day, is when the user left
  test('app init: a later leave from the event log replaces the exit stamp (11/16: quit at 14:45, left at 17:48: no question)', function () {
    var e = mk(at(17, 10, 0));   // planned end 17:42 (start 08:42)
    init(e, { history: hist([rec('2026-11-16', 522, {})]), lastExitMs: at(16, 14, 45), lastLeaveMs: at(16, 17, 48) });
    eq(QJZ.app.state.pendingQuestion, null, 'after the planned end: no 提早下班？');
    near(QJZ.app.state.history.days['2026-11-16'].earned, 2272.73, 0.001, 'a full day');
    QJZ.app._reset();
    e = mk(at(17, 10, 0));
    init(e, { history: hist([rec('2026-11-16', 522, {})]), lastExitMs: at(16, 14, 45), lastLeaveMs: at(16, 15, 0) });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-16', lockMs: at(16, 15, 0) }, 'a real early leave: asked at 15:00, not 14:45');
    QJZ.app._reset();
    e = mk(at(17, 10, 0));
    init(e, { history: hist([rec('2026-11-16', 522, {})]), lastExitMs: at(16, 14, 45), lastLeaveMs: null });
    eq(QJZ.app.state.pendingQuestion, { day: '2026-11-16', lockMs: at(16, 14, 45) }, 'none found: the exit stamp, as before');
    QJZ.app._reset();
    [at(16, 14, 0), at(17, 5, 0), '17:48', NaN].forEach(function (x) {   // before the exit, another day, junk
      e = mk(at(17, 10, 0));
      init(e, { history: hist([rec('2026-11-16', 522, {})]), lastExitMs: at(16, 14, 45), lastLeaveMs: x });
      eq(QJZ.app.state.pendingQuestion, { day: '2026-11-16', lockMs: at(16, 14, 45) }, 'not used: ' + x);
      QJZ.app._reset();
    });
  });
  // 1.1.7 item 4: init.afterUpdate true (the first init after 一鍵更新 restarted the app): updatedTo is the version running
  test('app init: afterUpdate makes updatedTo the running version; anything else, or no version, is null', function () {
    [[true, '1.1.7', '1.1.7'], [undefined, '1.1.7', null], [false, '1.1.7', null], ['true', '1.1.7', null], [1, '1.1.7', null], [true, '', null]].forEach(function (c) {
      var e = mk(at(17, 10, 0));
      init(e, { afterUpdate: c[0], version: c[1] });
      eq(QJZ.app.state.updatedTo, c[2], JSON.stringify(c));
      QJZ.app._reset();
      eq(QJZ.app.state.updatedTo, null, 'reset');
    });
  });
  test('app init: lastExitMs on another day, before the start, or junk is ignored', function () {
    [at(10, 15, 0), at(11, 8, 0), null, '15:00', NaN].forEach(function (x) {
      var e = mk(at(12, 10, 0));
      init(e, { history: hist([rec('2026-11-11', 540, {})]), lastExitMs: x });
      eq(QJZ.app.state.pendingQuestion, null, 'exit ' + x);
      near(QJZ.app.state.history.days['2026-11-11'].earned, 2272.73, 0.001, 'exit ' + x);
      QJZ.app._reset();
    });
  });

  // ---- R-F4: .bak copies ----
  test('app init: a corrupt settings.json is backed up, then its .bak is used and saved back', function () {
    var e = mk(at(12, 10, 0));
    var bak = JSON.stringify({ salary: { mode: 'monthly', amount: 60000, divisor: 22 }, milestone: 50, onboarded: true });
    init(e, { settings: '{bad', backups: { settings: bak, history: null } });
    eq(of(e.sent, 'backupCorrupt'), [{ file: 'settings' }], 'the main file is still backed up');
    eq([QJZ.app.state.settings.salary.amount, QJZ.app.state.settings.milestone], [60000, 50]);
    QJZ.app.flush();
    var t = typesOf(e.sent);
    ok(t.indexOf('saveSettings') > t.indexOf('backupCorrupt'), 'the repaired copy goes back after the backup');
    eq(JSON.parse(lastSave(e.sent, 'saveSettings').p.text).salary.amount, 60000);
    QJZ.app._reset();
  });
  test('app init: a corrupt (zero-filled) history.json falls back to its .bak', function () {
    var e = mk(at(12, 10, 0));
    var bak = hist([rec('2026-11-10', 540, { endMs: at(10, 17, 0), earned: 2000 })]);
    init(e, { history: '\u0000\u0000\u0000\u0000', backups: { settings: null, history: bak } });
    eq(of(e.sent, 'backupCorrupt'), [{ file: 'history' }]);
    eq(QJZ.app.state.history.days['2026-11-10'].earned, 2000);
    ok(QJZ.app.state.history.days['2026-11-12'], 'today is there too');
    QJZ.app._reset();
  });
  test('app init: when the .bak is broken too (or missing): defaults / an empty history', function () {
    var e = mk(at(12, 10, 0));
    init(e, { settings: '{bad', history: '{bad', backups: { settings: '{also bad', history: 'nope' } });
    eq(of(e.sent, 'backupCorrupt'), [{ file: 'settings' }, { file: 'history' }]);
    eq(QJZ.app.state.settings.salary.amount, 0);
    eq(Object.keys(QJZ.app.state.history.days), ['2026-11-12']);
    QJZ.app._reset();
    e = mk(at(12, 10, 0));
    init(e, { settings: '{bad', backups: 'junk' });
    eq(QJZ.app.state.settings.salary.amount, 0);
    QJZ.app._reset();
  });
  // A power loss can leave a 0-byte main file; a .bak only exists after an earlier good save, so it is used.
  test('app init: an empty (0-byte / whitespace / missing) settings.json falls back to its .bak, with no backupCorrupt', function () {
    var bak = JSON.stringify({ salary: { mode: 'monthly', amount: 60000, divisor: 22 }, onboarded: true });
    ['', '   \r\n\t', null].forEach(function (main) {
      var e = mk(at(12, 10, 0));
      init(e, { settings: main, backups: { settings: bak, history: null } });
      eq(QJZ.app.state.settings.salary.amount, 60000, 'main ' + JSON.stringify(main));
      eq(of(e.sent, 'backupCorrupt'), [], 'nothing to back up: ' + JSON.stringify(main));
      QJZ.app.flush();
      eq(JSON.parse(lastSave(e.sent, 'saveSettings').p.text).salary.amount, 60000, 'written back: ' + JSON.stringify(main));
      QJZ.app._reset();
    });
  });
  test('app init: an empty (0-byte / whitespace / missing) history.json falls back to its .bak, with no backupCorrupt', function () {
    var bak = hist([rec('2026-11-10', 540, { endMs: at(10, 17, 0), earned: 2000 })]);
    ['', ' \n ', null].forEach(function (main) {
      var e = mk(at(12, 10, 0));
      init(e, { history: main, backups: { settings: null, history: bak } });
      eq(QJZ.app.state.history.days['2026-11-10'].earned, 2000, 'main ' + JSON.stringify(main));
      eq(of(e.sent, 'backupCorrupt'), [], 'nothing to back up: ' + JSON.stringify(main));
      QJZ.app.flush();
      eq(JSON.parse(lastSave(e.sent, 'saveHistory').p.text).days['2026-11-10'].earned, 2000, 'written back: ' + JSON.stringify(main));
      QJZ.app._reset();
    });
  });
  test('app init: an empty main file with no usable .bak gives defaults / an empty history', function () {
    [null, '', '  ', '{bad', 'null'].forEach(function (b) {
      var e = mk(at(12, 10, 0));
      init(e, { settings: '', history: '', backups: { settings: b, history: b } });
      eq(QJZ.app.state.settings.salary.amount, 0, 'bak ' + JSON.stringify(b));
      eq(Object.keys(QJZ.app.state.history.days), ['2026-11-12'], 'bak ' + JSON.stringify(b));
      eq(of(e.sent, 'backupCorrupt'), [], 'bak ' + JSON.stringify(b));
      QJZ.app._reset();
    });
  });

  test('app init: a readable main file ignores its .bak', function () {
    var e = mk(at(12, 10, 0));
    init(e, { history: hist([]), backups: { settings: JSON.stringify({ salary: { amount: 1 } }), history: hist([rec('2026-11-01', 540, { earned: 1 })]) } });
    eq(QJZ.app.state.settings.salary.amount, 50000);
    eq(QJZ.app.state.history.days['2026-11-01'], undefined);
    eq(of(e.sent, 'backupCorrupt'), []);
    QJZ.app._reset();
  });

  // ---- M1: resume while locked ----
  test('app: resume while the session is locked does not start the day; the unlock that follows does', function () {
    var e = mk(at(11, 16, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]) });
    e.clock.ms = at(11, 17, 0);
    e.bridge.emit({ type: 'session', kind: 'lock', ms: at(11, 17, 0) });
    e.clock.ms = at(12, 7, 50);
    e.bridge.emit({ type: 'session', kind: 'resume', ms: at(12, 7, 50) });
    eq([QJZ.app.state.today.day, QJZ.app.state.today.startMs], ['2026-11-12', null], 'still locked');
    e.clock.ms = at(12, 8, 30);
    e.bridge.emit({ type: 'session', kind: 'unlock', ms: at(12, 8, 30) });
    eq(QJZ.app.state.today.startMs, at(12, 8, 30));
    QJZ.app._reset();
  });
  test('app: resume without a lock (sleep while unlocked) still starts the day', function () {
    var e = mk(at(11, 16, 0));
    init(e, { history: hist([rec('2026-11-11', 540, {})]) });
    e.clock.ms = at(11, 17, 0);
    e.bridge.emit({ type: 'session', kind: 'suspend', ms: at(11, 17, 0) });
    e.clock.ms = at(12, 8, 0);
    e.bridge.emit({ type: 'session', kind: 'resume', ms: at(12, 8, 0) });
    eq(QJZ.app.state.today.startMs, at(12, 8, 0));
    QJZ.app._reset();
  });

  // ---- M3: host settings are saved at once ----
  test('app: setAutostart / setCaptureGuard / setHotkey save settings at once (no 1 s debounce)', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    QJZ.app.flush();
    e.sent.length = 0;
    QJZ.app.setAutostart(false);
    ok(lastSave(e.sent, 'saveSettings'), 'autostart saved');
    eq(JSON.parse(lastSave(e.sent, 'saveSettings').p.text).autostart, false);
    ok(typesOf(e.sent).indexOf('setAutostart') >= 0);
    e.sent.length = 0;
    QJZ.app.setCaptureGuard(false);
    eq(JSON.parse(lastSave(e.sent, 'saveSettings').p.text).privacy.hideFromCapture, false);
    e.sent.length = 0;
    QJZ.app.setHotkey('Ctrl+Alt+J');
    eq(JSON.parse(lastSave(e.sent, 'saveSettings').p.text).privacy.hotkey, 'Ctrl+Alt+J');
    QJZ.app._reset();
  });

  // ---- R-F6: 相容模式 ----
  test('app: display.opaque or init.forceOpaque paints the whole page background #FFF8EC', function () {
    var root = document.documentElement;
    var e = mk(at(12, 10, 0));
    init(e, {});
    ok(!root.classList.contains('opaque'));
    eq(QJZ.app.state.forceOpaque, false);
    QJZ.app.saveSettings({ display: { opaque: true } });
    ok(root.classList.contains('opaque'));
    eq(getComputedStyle(root).backgroundColor, 'rgb(255, 248, 236)');
    QJZ.app.saveSettings({ display: { opaque: false } });
    ok(!root.classList.contains('opaque'));
    init(e, { forceOpaque: true });
    ok(root.classList.contains('opaque'), 'forced by the host');
    eq(QJZ.app.state.forceOpaque, true);
    QJZ.app.saveSettings({ display: { opaque: false } });
    ok(root.classList.contains('opaque'), 'the setting cannot turn a forced one off');
    init(e, { settings: JSON.stringify({ display: { opaque: true } }) });
    ok(root.classList.contains('opaque'), 'from settings.json');
    QJZ.app._reset();
    ok(!root.classList.contains('opaque'));
  });

  // ---- 省電模式 (§5.9): the money ticks 4 times a second instead of 10 ----
  test('app: the tick runs every 100 ms, every 250 ms with 省電模式', function () {
    var calls = [], si = window.setInterval, ci = window.clearInterval, root = document.documentElement;
    window.setInterval = function (fn, ms) { var h = { fn: fn, ms: ms, live: true }; calls.push(h); return h; };
    window.clearInterval = function (h) { if (h && h.live !== undefined) h.live = false; };
    function live() { return calls.filter(function (h) { return h.live && h.ms !== 60000; }).map(function (h) { return h.ms; }); }
    try {
      QJZ.app._reset();
      var handlers = {}, clock = { ms: at(12, 10, 0) };
      var bridge = { send: function () {}, on: function (t, f) { handlers[t] = f; }, emit: function (m) { handlers[m.type](m); } };
      QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; } });
      eq(QJZ.app.tickMs(), 100, 'before init: the default');
      bridge.emit({ type: 'init', settings: SETTINGS, history: null, probeMs: null, nowMs: clock.ms, version: 't' });
      eq([QJZ.app.tickMs(), live(), root.classList.contains('saver')], [100, [100], false], 'off: 10 times a second');
      QJZ.app.saveSettings({ display: { powerSaver: true } });
      eq([QJZ.app.tickMs(), live(), root.classList.contains('saver')], [250, [250], true], 'on: the interval restarts at 250 ms, html.saver');
      var n = calls.length;
      QJZ.app.saveSettings({ milestone: 50 });
      eq([live(), calls.length], [[250], n], 'another settings change leaves the running interval alone');
      QJZ.app.saveSettings({ display: { powerSaver: false } });
      eq([QJZ.app.tickMs(), live(), root.classList.contains('saver')], [100, [100], false], 'off again');
      bridge.emit({ type: 'visibility', visible: false });
      QJZ.app.saveSettings({ display: { powerSaver: true } });
      eq(live(), [], 'hidden: a change starts no tick');
      bridge.emit({ type: 'visibility', visible: true });
      eq(live(), [250], 'shown again at the saver rate');
      bridge.emit({ type: 'init', settings: SETTINGS, history: null, probeMs: null, nowMs: clock.ms, version: 't' });
      eq([live(), root.classList.contains('saver')], [[100], false], 'a repeated init with it off');
      bridge.emit({ type: 'init', settings: JSON.stringify({ display: { powerSaver: true } }), history: null, probeMs: null, nowMs: clock.ms, version: 't' });
      eq([QJZ.app.tickMs(), live(), root.classList.contains('saver')], [250, [250], true], 'from settings.json');
    } finally { QJZ.app._reset(); window.setInterval = si; window.clearInterval = ci; }
    eq([calls.filter(function (h) { return h.live; }).length, root.classList.contains('saver')], [0, false], 'reset stops it and drops html.saver');
  });

  test('app: tickNow recomputes from the clock, no accumulation', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    e.clock.ms = at(12, 11, 0);
    QJZ.app.tickNow();
    near(QJZ.app.state.snap.workedSec, 3600, 0.001);
    e.clock.ms = at(12, 11, 30);
    QJZ.app.tickNow();
    near(QJZ.app.state.snap.workedSec, 5400, 0.001);
    QJZ.app._reset();
  });

  test('app init: an open record whose start has seconds is floored to the minute', function () {
    var e = mk(at(12, 10, 0));
    var r = rec('2026-11-12', null, {}); r.startMs = at(12, 8, 37) + 58095; r.startSource = 'auto';
    init(e, { history: hist([r]) });
    var s = QJZ.app.state;
    eq(s.today.startMs, at(12, 8, 37));
    eq(s.history.days['2026-11-12'].startMs, at(12, 8, 37));
    eq(s.snap.endAtMs, at(12, 17, 37));
    QJZ.app._reset();
  });
  test('app init: a probe with seconds starts the day at the floored minute', function () {
    var e = mk(at(12, 10, 0));
    init(e, { probeMs: at(12, 8, 37) + 58095 });
    eq(QJZ.app.state.today.startMs, at(12, 8, 37));
    QJZ.app._reset();
  });
  test('app: the working status flips to done exactly at 17:37:00 for a 08:37:58 start', function () {
    var e = mk(at(12, 17, 36) + 59000);
    var r = rec('2026-11-12', null, {}); r.startMs = at(12, 8, 37) + 58095;
    init(e, { history: hist([r]) });
    eq(QJZ.app.state.snap.status, 'working');
    e.clock.ms = at(12, 17, 37);
    QJZ.app.tickNow();
    eq(QJZ.app.state.snap.status, 'done');
    eq(QJZ.app.state.snap.workedSec, 28800);
    QJZ.app._reset();
  });
  test('app: setHealth on today is saved at once', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    QJZ.app.setHealth('2026-11-12', { cups: 1, cupGoal: null, tomatoes: 0, standups: 0 });
    var s = lastSave(e.sent, 'saveHistory');
    ok(s && s.p.text.indexOf('"cups":1') >= 0);
    eq(QJZ.app.state.today.health.cups, 1);
    QJZ.app._reset();
  });
  test('app: setHealth on an earlier day without a record creates it closed and sealed', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    QJZ.app.setHealth('2026-11-10', { cups: 1 });
    var r = QJZ.app.state.history.days['2026-11-10'];
    eq(r.earned, 0);
    eq(r.health.cups, 1);
    eq(r.health.cupGoal, 8);
    ok(lastSave(e.sent, 'saveHistory').p.text.indexOf('2026-11-10') >= 0);
    QJZ.app._reset();
  });
  test('app: an unstarted day with health is kept and closed at the rollover; one without is dropped as in 1.0', function () {
    var e = mk(at(13, 10, 0));
    init(e, { settings: JSON.stringify({ startMode: 'manual' }) });
    eq(QJZ.app.state.today.startMs, null);
    e.clock.ms = at(14, 10, 0);
    QJZ.app.tickNow();
    eq(QJZ.app.state.history.days['2026-11-13'], undefined);
    QJZ.app.setHealth('2026-11-14', { cups: 2 });
    e.clock.ms = at(15, 5, 0);
    QJZ.app.tickNow();
    var r = QJZ.app.state.history.days['2026-11-14'];
    eq(r.earned, 0);
    eq(r.health.cups, 2);
    eq(r.health.cupGoal, 8);
    QJZ.app._reset();
  });
  test('app: the sealed cup goal does not follow a later change', function () {
    var e = mk(at(15, 10, 0));
    init(e, { settings: JSON.stringify({ startMode: 'manual' }) });
    QJZ.app.setHealth('2026-11-14', { cups: 2 });
    QJZ.app.saveSettings({ health: { water: { goal: 10 } } });
    eq(QJZ.app.state.history.days['2026-11-14'].health.cupGoal, 8);
    QJZ.app._reset();
  });
  test('app: setPomodoro is saved at once and comes back at init', function () {
    var e = mk(at(12, 10, 0));
    init(e, {});
    var p = QJZ.pomodoro.start(QJZ.pomodoro.idle(), at(12, 10, 0), QJZ.app.state.settings.health.pomodoro);
    QJZ.app.setPomodoro(p);
    var text = lastSave(e.sent, 'saveHistory').p.text;
    ok(text.indexOf('"pomodoro"') >= 0);
    var e2 = mk(at(12, 10, 5));
    init(e2, { history: text });
    eq(QJZ.app.state.history.pomodoro.phase, 'focus');
    QJZ.app.setPomodoro(null);
    eq('pomodoro' in QJZ.app.state.history, false);
    QJZ.app._reset();
  });
  test('app: a 1.0 history keeps its days unchanged', function () {
    var e = mk(at(12, 10, 0));
    init(e, { settings: V10.settings, history: V10.history });
    QJZ.app.flush();
    var before = JSON.parse(V10.history).days, after = JSON.parse(lastSave(e.sent, 'saveHistory').p.text).days;
    eq(after['2026-11-10'], before['2026-11-10']);
    eq(after['2026-11-11'], before['2026-11-11']);
    QJZ.app._reset();
  });
  test('app: setHealth keeps the cup goal a past day was closed with (§5.6)', function () {
    var e = mk(at(12, 10, 0));
    var old = rec('2026-11-10', 9 * 60, { earned: 1000, health: { cups: 3, cupGoal: 6, tomatoes: 0, standups: 0 } });
    init(e, { history: hist([old]) });
    QJZ.app.setHealth('2026-11-10', { cups: 4, cupGoal: null, tomatoes: 1, standups: 0 });
    eq(QJZ.app.state.history.days['2026-11-10'].health, { cups: 4, cupGoal: 6, tomatoes: 1, standups: 0 });
    QJZ.app.setHealth('2026-11-10', { cups: 4, cupGoal: 10, tomatoes: 1, standups: 0 });
    eq(QJZ.app.state.history.days['2026-11-10'].health.cupGoal, 6);
    QJZ.app._reset();
  });
  test('app: 開始上班 announces started; 繼續上班 and 調整起算時間 do not', function () {
    var e = mk(at(12, 10, 0)), seen = [];
    QJZ.app.on('started', function (t) { seen.push(t.startMs); });
    init(e, {});
    eq(seen, [], 'the auto start at init is not a 開始上班');
    QJZ.app.endWork();
    QJZ.app.resumeWork();
    QJZ.app.adjustStart(at(12, 9, 0));
    eq(seen, []);
    e.clock.ms = at(12, 11, 0);
    QJZ.app.startWork();
    eq(seen, [at(12, 11, 0)]);
    QJZ.app._reset();
  });
})();
