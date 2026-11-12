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
    env.bridge.emit({
      type: 'init', settings: o.settings === undefined ? SETTINGS : o.settings,
      history: o.history === undefined ? null : o.history,
      probeMs: o.probeMs === undefined ? null : o.probeMs, nowMs: env.clock.ms, version: 't'
    });
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
})();
