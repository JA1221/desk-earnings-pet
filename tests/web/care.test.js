// QJZ.care with QJZ.app on one fake bridge and one fake clock. 2026-11-12 is a Thursday (at() from harness.js);
// other days use day(d, h, m, s). Work starts 09:00 (the app's auto start at init), lunch 12:00-13:00, done 18:00.
(function () {
  var C = QJZ.care, A = QJZ.app, MIN = 60000;
  function day(d, h, m, s) { return new Date(2026, 10, d, h, m || 0, s || 0, 0).getTime(); }
  var BOTH = { asked: true, sit: { on: true }, water: { on: true } };
  var SIT = { asked: true, sit: { on: true }, water: { on: false } };
  var WATER = { asked: true, sit: { on: false }, water: { on: true } };
  // health: the settings' health section (null: none, a 1.0 file); extra: more top-level keys.
  function S(health, extra) {
    var s = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true };
    if (health !== null) s.health = health || BOTH;
    for (var k in extra) s[k] = extra[k];
    return s;
  }
  function hist(recs, pomodoro) {
    var h = { version: 1, days: {} };
    recs.forEach(function (r) { h.days[r.day] = r; });
    if (pomodoro) h.pomodoro = pomodoro;
    return JSON.stringify(h);
  }
  function startedAt(key, h, m) { return QJZ.day.manualStart(QJZ.day.empty(key), new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), h, m).getTime()); }

  // A fake bridge that keeps every handler of a type (app and care both listen to session and visibility).
  function mk(now, settings, history) {
    A._reset(); C._reset();
    var sent = [], handlers = {}, clock = { ms: now }, log = [];
    var bridge = {
      send: function (t, p) { sent.push({ type: t, p: p }); },
      on: function (t, f) {
        (handlers[t] = handlers[t] || []).push(f);
        return function () { var l = handlers[t], i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
      },
      emit: function (m) { (handlers[m.type] || []).slice().forEach(function (f) { f(m); }); }
    };
    function nowFn() { return clock.ms; }
    C.start({ bridge: bridge, now: nowFn, heartbeat: false });
    A.start({ bridge: bridge, now: nowFn, tick: false });
    ['prompt', 'cue', 'drank', 'standup', 'snooze'].forEach(function (n) { C.on(n, function (x) { log.push({ n: n, x: x }); }); });
    bridge.emit({ type: 'init', settings: JSON.stringify(settings || S()), history: history || null, probeMs: null, nowMs: now, version: 't' });
    bridge.emit({ type: 'visibility', visible: true });
    return { bridge: bridge, sent: sent, clock: clock, log: log };
  }
  function done() { C._reset(); A._reset(); }
  // A visible page: the app ticks and care steps. While hidden only the heartbeat steps (beat).
  function go(e, t) { e.clock.ms = t; A.tickNow(); C.stepNow(); }
  function beat(e, t) { e.clock.ms = t; C.stepNow(); }
  function walk(e, from, to, every) { for (var t = from; t <= to; t += every) go(e, t); }
  function vis(e, on, t) { e.clock.ms = t; e.bridge.emit({ type: 'visibility', visible: on }); }
  function sess(e, kind, t) { e.clock.ms = t; e.bridge.emit({ type: 'session', kind: kind, ms: t }); }
  function menu(e, action) { e.bridge.emit({ type: 'menu', action: action }); }
  function mark(e) { return { log: e.log.length, sent: e.sent.length }; }
  function events(e, m, n) { return e.log.slice(m.log).filter(function (x) { return x.n === n; }).map(function (x) { return x.x; }); }
  function prompts(e, m) {
    return events(e, m, 'prompt').map(function (x) {
      return x.type + (x.prompt && x.type !== 'wave' ? ':' + x.prompt.kind + (x.prompt.water ? '+w' : '') : '') + (x.quiet ? ':quiet' : '');
    });
  }
  function sends(e, m, type) { return e.sent.slice(m.sent).filter(function (s) { return s.type === type; }).map(function (s) { return s.p; }); }
  function raises(e, m) { return sends(e, m, 'raise').map(function (p) { return p.on; }); }
  function h() { var x = C.state.health; return [x.cups, x.tomatoes, x.standups]; }

  test('care: the reminder shows at 09:50:00, asks both and raises the window', function () {
    var e = mk(at(9, 0)), m = mark(e);
    go(e, at(9, 49, 59));
    eq(prompts(e, m), []);
    eq(raises(e, m), []);
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:both']);
    eq(raises(e, m), [true]);
    eq(events(e, m, 'cue'), ['holdCup']);
    eq(C.state.prompt.kind, 'both');
    var v = C.view();
    eq([v.title, v.sub], ['起來動一動，順便喝口水～', '已經坐 50 分鐘囉・今天 0/8 杯']);
    eq(v.buttons.map(function (b) { return b.label; }), ['喝了', '起來了', '等一下']);
    done();
  });

  test('care: 起來了 counts a stand-up and closes the bubble; the next reminder is at 10:40', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 50));
    var m = mark(e);
    eq(C.answer('up'), true);
    eq(h(), [0, 0, 1]);
    eq(prompts(e, m), ['hide']);
    eq(raises(e, m), [false]);
    eq(events(e, m, 'standup'), [{ count: 1, source: 'up' }]);
    eq(C.view(), null);
    eq(C.answer('up'), false, 'a second press on a bubble already gone does nothing');
    eq(h(), [0, 0, 1]);
    go(e, at(10, 39, 59));
    eq(prompts(e, m), ['hide']);
    go(e, at(10, 40));
    eq(prompts(e, m), ['hide', 'show:both']);
    done();
  });

  // 1.1.2 item 7: on the bubble that asks both, 喝了 only logs the cup; the bubble stays as the 起來動 one and closes on
  // 起來了 or 等一下. The water-only bubble still closes on 喝了 (a cup and a stand-up, as before).
  test('care: 喝了 on the both bubble logs only the cup, saved at once; the bubble stays as 起來了 / 等一下', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 50));
    var m = mark(e);
    eq(C.answer('drink'), true);
    eq(h(), [1, 0, 0], 'a cup, no stand-up');
    eq(events(e, m, 'standup'), []);
    eq(events(e, m, 'drank'), [{ cups: 1, goalReached: false }]);
    ok(sends(e, m, 'saveHistory').some(function (p) { return p.text.indexOf('"cups":1') >= 0; }), 'saved before any later step');
    eq(A.state.history.days['2026-11-12'].health, { cups: 1, cupGoal: 8, tomatoes: 0, standups: 0 });
    eq(prompts(e, m), ['update:sit'], 'the same bubble, now 起來動 alone');
    eq(raises(e, m), [], 'it stays up');
    eq(events(e, m, 'cue'), ['wave']);
    eq(C.view().buttons.map(function (b) { return b.id; }), ['up', 'later']);
    eq(C.answer('drink'), false, 'a second 喝了 does nothing');
    walk(e, at(9, 51), at(9, 55), MIN);
    eq(prompts(e, m), ['update:sit', 'wave', 'wave'], 'it does not ask water again (and re-waves as any bubble)');
    eq(C.answer('up'), true);
    eq(h(), [1, 0, 1]);
    eq(prompts(e, m).slice(3), ['hide']);
    eq(events(e, m, 'standup'), [{ count: 1, source: 'up' }]);
    go(e, at(10, 44, 59));
    eq(prompts(e, m).slice(3), ['hide']);
    go(e, at(10, 45));
    eq(prompts(e, m).slice(3), ['hide', 'show:both'], 'the next round asks water again');
    done();

    e = mk(at(9, 0));
    go(e, at(9, 50));
    C.answer('drink');
    m = mark(e);
    C.answer('later');
    eq(prompts(e, m), ['hide']);
    go(e, at(9, 55));
    eq(prompts(e, m), ['hide', 'show:sit'], '等一下 after 喝了: back as 起來動 alone');
    done();

    e = mk(at(9, 0), S(WATER));
    go(e, at(9, 50));
    m = mark(e);
    C.answer('drink');
    eq(h(), [1, 0, 1], 'water alone: a cup and a stand-up');
    eq(prompts(e, m), ['hide'], 'and it closes');
    eq(events(e, m, 'standup'), [{ count: 1, source: 'drink' }]);
    done();
  });

  test('care: a fresh 開始上班 restarts the timer; 繼續上班 does not', function () {
    var e = mk(at(9, 0)), m = mark(e);
    go(e, at(9, 40));
    A.setOffDay(true);
    walk(e, at(9, 41), at(9, 59), MIN);
    e.clock.ms = at(10, 0);
    A.startWork();
    walk(e, at(10, 0), at(10, 49), MIN);
    go(e, at(10, 49, 59));
    eq(prompts(e, m), [], 'not at 10:10');
    go(e, at(10, 50));
    eq(prompts(e, m), ['show:both']);
    done();

    e = mk(at(9, 0)); m = mark(e);
    go(e, at(9, 40));
    A.endWork();
    walk(e, at(9, 41), at(9, 44), MIN);
    e.clock.ms = at(9, 45);
    eq(A.resumeWork(), true);
    walk(e, at(9, 45), at(9, 49), MIN);
    go(e, at(9, 49, 59));
    eq(prompts(e, m), []);
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:both'], 'the time between 下班 and 繼續上班 counts, as for the money');
    done();
  });

  // 1.1.2 item 8: 等一下 is 5 minutes. care says so (snooze {minutes}) for the pet's line, and publishes snoozed for the
  // countdown's 💤 while it runs.
  test('care: 等一下 brings it back at 09:55:00; snoozed until then', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 50));
    var m = mark(e);
    eq(C.state.snoozed, false);
    C.answer('later');
    eq(prompts(e, m), ['hide']);
    eq(events(e, m, 'snooze'), [{ minutes: 5 }]);
    eq(h(), [0, 0, 0]);
    eq([C.state.snoozed, C.state.standIn], [true, 5]);
    walk(e, at(9, 51), at(9, 54), MIN);
    eq(C.state.standIn, 1);
    go(e, at(9, 54, 59));
    eq(prompts(e, m), ['hide']);
    go(e, at(9, 55));
    eq(prompts(e, m), ['hide', 'show:both']);
    eq(C.state.snoozed, false);
    done();
  });

  test('care: only one switch on asks only that', function () {
    var e = mk(at(9, 0), S(SIT)), m = mark(e);
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:sit']);
    eq(events(e, m, 'cue'), ['wave']);
    eq(C.view().buttons.map(function (b) { return b.id; }), ['up', 'later']);
    done();

    e = mk(at(9, 0), S(WATER)); m = mark(e);
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:water']);
    eq(events(e, m, 'cue'), ['holdCup']);
    eq(C.view().sub, '今天 0 杯，目標 8 杯');
    done();

    e = mk(at(9, 0), S(WATER)); m = mark(e);
    go(e, at(9, 40));
    menu(e, 'drink');
    eq(h(), [1, 0, 0]);
    walk(e, at(9, 41), at(10, 29), MIN);
    go(e, at(10, 29, 59));
    eq(prompts(e, m), [], 'the cup restarted the timer');
    go(e, at(10, 30));
    eq(prompts(e, m), ['show:water']);
    done();
  });

  test('care: at the cup goal the bubble stops asking water', function () {
    var e = mk(at(9, 0)), m = mark(e);
    C.setCups(8);
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:sit']);
    done();

    e = mk(at(9, 0), S(WATER)); m = mark(e);
    C.setCups(8);
    walk(e, at(9, 0), at(17, 59), 15 * MIN);
    eq(prompts(e, m), [], 'water only and 8/8: no reminder all day');
    eq(C.minutesToStand(), null);
    done();
  });

  // 1.1.2 item 9: the lock rule is gone. A lock (the host also sends visibility false) never counts a stand-up and never
  // restarts the timer: the locked time is sat time. A reminder that comes due meanwhile waits, and shows 3 s after the
  // unlock (the hold rule). Nothing is said on the way back.
  test('care: a lock is no stand-up: the timer runs on through it; a reminder due meanwhile shows 3 s after the unlock', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 30));
    var m = mark(e);
    sess(e, 'lock', at(9, 30));
    vis(e, false, at(9, 30));
    eq('away' in C.state, false, 'no away state');
    beat(e, at(9, 40));
    beat(e, at(9, 50));
    beat(e, at(10, 0));
    eq(prompts(e, m), [], 'due at 09:50, held while locked');
    sess(e, 'unlock', at(10, 10));
    vis(e, true, at(10, 10));
    eq(h(), [0, 0, 0], 'no stand-up');
    eq(events(e, m, 'standup'), []);
    eq(C.state.r.ms, 70 * MIN, 'the 40 locked minutes are sat minutes');
    go(e, at(10, 10, 2));
    eq(prompts(e, m), []);
    go(e, at(10, 10, 3));
    eq(prompts(e, m), ['show:both'], '3 s after the unlock');
    eq(C.view().sub, '已經坐 70 分鐘囉・今天 0/8 杯');
    done();

    e = mk(at(9, 0));
    go(e, at(9, 30));
    m = mark(e);
    sess(e, 'lock', at(9, 30));
    sess(e, 'unlock', at(9, 40));
    go(e, at(9, 49, 59));
    eq(prompts(e, m), [], 'a short lock moves nothing either');
    go(e, at(9, 50));
    eq(prompts(e, m), ['show:both'], 'due at 09:50 as if it never happened');
    done();
  });

  test('care: suspend and resume are no stand-up either', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 30));
    sess(e, 'suspend', at(9, 30));
    sess(e, 'resume', at(9, 45));
    beat(e, at(9, 45));
    eq(h(), [0, 0, 0]);
    eq(C.state.r.ms, 45 * MIN);
    done();

    e = mk(at(9, 0));
    go(e, at(9, 30));
    sess(e, 'lock', at(9, 30));
    sess(e, 'suspend', at(9, 31));
    sess(e, 'resume', at(9, 40));
    sess(e, 'unlock', at(9, 41));
    eq(h(), [0, 0, 0]);
    done();
  });

  test('care: hidden → no bubble and no raise; shown again → 3 s later', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 49));
    vis(e, false, at(9, 49));
    var m = mark(e);
    beat(e, at(9, 50));
    beat(e, at(9, 54));
    eq(prompts(e, m), []);
    eq(raises(e, m), []);
    vis(e, true, at(9, 55));
    go(e, at(9, 55, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 55, 3));
    eq(prompts(e, m), ['show:both']);
    eq(raises(e, m), [true]);
    done();
  });

  test('care: fullscreen queues the same way', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 49));
    var m = mark(e);
    e.bridge.emit({ type: 'fullscreen', on: true });
    eq(C.state.fullscreen, true);
    walk(e, at(9, 50), at(9, 54), MIN);
    e.clock.ms = at(9, 55);
    e.bridge.emit({ type: 'fullscreen', on: false });
    go(e, at(9, 55, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 55, 3));
    eq(prompts(e, m), ['show:both']);
    done();
  });

  test('care: PANEL blocks prompts', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 49));
    var m = mark(e);
    C.setPanel(true);
    walk(e, at(9, 50), at(9, 51), MIN);
    e.clock.ms = at(9, 52);
    C.setPanel(false);
    go(e, at(9, 52, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 52, 3));
    eq(prompts(e, m), ['show:both']);
    done();
  });

  // Work 09:00, a focus from 09:40: the reminder due at 09:50 waits; at 10:05 the focus ends.
  function focusFrom940() {
    var e = mk(at(9, 0));
    go(e, at(9, 40));
    e.m = mark(e);
    C.toggleFocus();
    eq(C.state.p.phase, 'focus');
    walk(e, at(9, 41), at(10, 4), MIN);
    go(e, at(10, 4, 59));
    eq(prompts(e, e.m), [], 'the reminder waits for the focus');
    go(e, at(10, 5));
    return e;
  }

  test('care: focus from 09:40 holds the reminder; at 10:05 a tomato, a stand-up and the break bubble with the water line', function () {
    var e = focusFrom940();
    eq(h(), [0, 1, 1]);
    eq(C.state.p.phase, 'break');
    eq(prompts(e, e.m), ['show:break+w']);
    eq([C.state.prompt.kind, C.state.prompt.water], ['break', true]);
    eq(C.state.r.ms, 0);
    eq(events(e, e.m, 'cue'), ['focus', 'stretch']);
    eq(events(e, e.m, 'standup'), [{ count: 1, source: 'break' }]);
    var v = C.view();
    eq([v.title, v.sub, v.waterLine], ['休息 5 分鐘！起來走走～', '第 1 顆番茄完成', '順便喝口水吧～']);
    eq(v.buttons.map(function (b) { return b.id; }), ['ok', 'drink', 'skip']);
    done();
  });

  test('care: 跳過休息 restores the timer and undoes the stand-up', function () {
    var e = focusFrom940();
    e.clock.ms = at(10, 6);
    var m = mark(e);
    C.answer('skip');
    eq(prompts(e, m), ['hide']);
    eq(C.state.p.phase, 'focus');
    eq(C.state.p.endMs, at(10, 31));
    eq(h(), [0, 1, 0]);
    eq(C.state.r.ms, 66 * MIN);
    walk(e, at(10, 7), at(10, 30), MIN);
    go(e, at(10, 30, 59));
    eq(prompts(e, m), ['hide'], 'nothing until the focus ends');
    go(e, at(10, 31));
    eq(prompts(e, m), ['hide', 'show:break+w']);
    eq(h(), [0, 2, 1]);
    done();
  });

  var FOCUS_900 = { phase: 'focus', startMs: at(9, 0), endMs: at(9, 25), day: '2026-11-12', long: false, done: 0, notice: null };

  test('care: a restart after the focus ended counts the tomato; the break bubble shows 3 s after the window is visible', function () {
    var e = mk(at(9, 27), S(), hist([startedAt('2026-11-12', 9, 0)], FOCUS_900)), m = mark(e);
    eq(h(), [0, 1, 1]);
    eq(C.state.p.phase, 'break');
    eq(C.state.p.endMs, at(9, 30));
    var saved = sends(e, { log: 0, sent: 0 }, 'saveHistory').pop();
    eq(JSON.parse(saved.text).pomodoro.phase, 'break', 'the phase change is saved at once');
    go(e, at(9, 27, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 27, 3));
    eq(prompts(e, m), ['show:break']);
    done();
  });

  test('care: a restart after the break ended asks 休息結束 and never starts by itself', function () {
    var e = mk(at(9, 40), S(), hist([startedAt('2026-11-12', 9, 0)], FOCUS_900)), m = mark(e);
    eq(h(), [0, 1, 1]);
    eq(C.state.p.phase, 'breakOver');
    go(e, at(9, 40, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 40, 3));
    eq(prompts(e, m), ['show:breakEnd']);
    eq(C.view().title, '休息結束～要開始下一顆嗎？');
    eq(events(e, m, 'cue'), [], 'no pose of its own');
    walk(e, at(9, 41), at(10, 30), MIN);
    eq(C.state.p.phase, 'breakOver');
    eq(C.state.prompt.kind, 'breakEnd');
    done();
  });

  test('care: a tomato started 03:50 counts for the day before', function () {
    var e = mk(day(12, 3, 50));
    C.toggleFocus();
    eq(C.state.p.day, '2026-11-11');
    go(e, day(12, 4, 0));
    go(e, day(12, 4, 15));
    eq(A.state.history.days['2026-11-11'].health.tomatoes, 1);
    eq(A.state.today.day, '2026-11-12');
    eq(h(), [0, 0, 1], 'the break started on 11-12: its stand-up counts there');
    done();
  });

  // Final review m-1: while hidden the app catches up only every 60 s, care steps on its 10 s heartbeat, so the app's
  // today can lag the clock by up to a minute after 04:00.
  test('care: a break that starts just after 04:00 while hidden keeps its stand-up on the new day', function () {
    var e = mk(day(12, 9, 0));
    vis(e, false, day(12, 18, 0));
    e.clock.ms = day(13, 3, 35, 30);
    A.refresh();   // the menu opens (menuOpening) ...
    menu(e, 'pomodoro');   // ... and 開始番茄鐘: a focus to 04:00:30
    eq([C.state.p.phase, C.state.p.day], ['focus', '2026-11-12']);
    e.clock.ms = day(13, 3, 59, 50);
    A.refresh();   // the hidden page's minute refresh, just before 04:00
    var m = mark(e);
    beat(e, day(13, 4, 0, 40));   // the heartbeat after the focus ended; the app's refresh is 10 s away
    eq(QJZ.health.of(A.state.history.days['2026-11-13']).standups, 1, 'the break\'s stand-up, on 11-13');
    eq(A.state.history.days['2026-11-12'].health.tomatoes, 1, 'the tomato on the day it started');
    eq(A.state.today.day, '2026-11-13', 'the app\'s day caught up first');
    eq(h(), [0, 0, 1]);
    eq(events(e, m, 'standup'), [{ count: 1, source: 'break' }]);
    ok(sends(e, m, 'saveHistory').some(function (p) {
      var r = JSON.parse(p.text).days['2026-11-13'];
      return !!r && !!r.health && r.health.standups === 1;
    }), 'saved');
    e.clock.ms = day(13, 4, 0, 50);
    A.refresh();
    beat(e, day(13, 4, 1, 0));
    eq(h(), [0, 0, 1], 'once');
    eq(C.state.r.day, '2026-11-13');
    done();
  });

  test('care: the 04:00 rollover closes yesterday\'s bubble and restarts the timer', function () {
    var e = mk(day(11, 20, 30), S(BOTH, { startMode: 'manual' }));
    A.startWork();
    var m = mark(e);
    go(e, day(11, 21, 19, 59));
    eq(prompts(e, m), []);
    go(e, day(11, 21, 20));
    eq(prompts(e, m), ['show:both']);
    m = mark(e);
    go(e, day(12, 4, 0));
    eq(prompts(e, m), ['hide:quiet']);
    eq(raises(e, m), [false]);
    eq(C.state.r.day, '2026-11-12');
    eq(C.state.r.ms, 0);
    done();
  });

  test('care: yesterday\'s 休息結束 closes quietly at 04:00; nothing is counted and the window is not raised again', function () {
    var e = mk(day(11, 17, 40));
    C.toggleFocus();
    go(e, day(11, 18, 5));
    go(e, day(11, 18, 10));
    eq([C.state.p.phase, C.state.prompt.kind], ['breakOver', 'breakEnd']);
    var before = JSON.stringify(A.state.history.days['2026-11-11'].health);
    go(e, day(12, 3, 59, 59));
    eq(C.state.prompt.kind, 'breakEnd', 'still the same day');
    var m = mark(e);
    go(e, day(12, 4, 0));
    eq(prompts(e, m), ['hide:quiet']);
    eq(raises(e, m), [false]);
    eq(C.state.p.phase, 'idle');
    eq(events(e, m, 'cue'), [], 'no pose of its own before or after');
    eq('pomodoro' in JSON.parse(sends(e, m, 'saveHistory').pop().text), false, 'saved');
    eq(sends(e, m, 'healthMenu').pop().pomodoro, { phase: 'idle', endsMs: null });
    eq(JSON.stringify(A.state.history.days['2026-11-11'].health), before, 'no tomato, no stand-up');
    eq(events(e, m, 'standup'), []);
    walk(e, day(12, 4, 0, 1), day(12, 4, 0, 5), 1000);
    eq(prompts(e, m), ['hide:quiet']);
    done();
  });

  test('care: a restart the next day drops yesterday\'s break; a focus that ended overnight still counts on its own day', function () {
    var y = startedAt('2026-11-11', 9, 0);
    var pomo = { phase: 'breakOver', startMs: day(11, 18, 5), endMs: day(11, 18, 10), day: '2026-11-11', long: false, done: 1, notice: 'breakEnd' };
    var e = mk(at(9, 0), S(), hist([y], pomo)), m = mark(e);
    eq(C.state.p.phase, 'idle');
    eq('pomodoro' in JSON.parse(sends(e, { log: 0, sent: 0 }, 'saveHistory').pop().text), false, 'saved');
    walk(e, at(9, 0, 1), at(9, 0, 5), 1000);
    eq(prompts(e, m), []);
    eq(raises(e, m), []);
    eq(h(), [0, 0, 0]);
    done();

    pomo = { phase: 'focus', startMs: day(11, 17, 40), endMs: day(11, 18, 5), day: '2026-11-11', long: false, done: 0, notice: null };
    e = mk(at(9, 0), S(), hist([y], pomo)); m = mark(e);
    eq(C.state.p.phase, 'idle');
    eq([A.state.history.days['2026-11-11'].health.tomatoes, A.state.history.days['2026-11-11'].health.standups], [1, 1], '照算 (§5.2), on 11-11');
    eq(h(), [0, 0, 0], 'nothing on today');
    walk(e, at(9, 0, 1), at(9, 0, 5), 1000);
    eq(prompts(e, m), []);
    eq(raises(e, m), []);
    done();
  });

  test('care: lunch closes the bubble quietly', function () {
    var e = mk(at(11, 5)), m = mark(e);
    go(e, at(11, 54, 59));
    eq(prompts(e, m), []);
    go(e, at(11, 55));
    eq(prompts(e, m), ['show:both']);
    m = mark(e);
    go(e, at(12, 0));
    eq(prompts(e, m), ['hide:quiet']);
    eq(raises(e, m), [false]);
    done();
  });

  test('care: a pomodoro after work shows its bubbles, no water line', function () {
    var e = mk(at(9, 0));
    go(e, at(18, 30));
    var m = mark(e);
    C.toggleFocus();
    go(e, at(18, 54, 59));
    eq(prompts(e, m), []);
    go(e, at(18, 55));
    eq(prompts(e, m), ['show:break']);
    eq(h(), [0, 1, 1]);
    eq(A.state.today.day, '2026-11-12');
    done();
  });

  test('care: a window hidden from 10:30 to 14:00 shows one bubble 3 s after it is back (the lunch end restarted the timer)', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 50));
    go(e, at(10, 29));
    vis(e, false, at(10, 30));
    var m = mark(e);
    for (var t = at(10, 30, 10); t < at(14, 0); t += 10 * MIN) beat(e, t);
    vis(e, true, at(14, 0));
    eq(C.state.r.ms, 60 * MIN);
    go(e, at(14, 0, 2));
    eq(prompts(e, m), []);
    go(e, at(14, 0, 3));
    walk(e, at(14, 0, 4), at(14, 1, 0), 1000);
    eq(prompts(e, m), ['show:both']);
    done();
  });

  test('care: waking after 18:00 shows nothing', function () {
    var e = mk(at(9, 0));
    go(e, at(17, 0));
    sess(e, 'suspend', at(17, 0));
    vis(e, false, at(17, 0));
    var m = mark(e);
    sess(e, 'resume', at(18, 30));
    vis(e, true, at(18, 30));
    walk(e, at(18, 30, 1), at(18, 30, 5), 1000);
    walk(e, at(18, 31), at(18, 40), MIN);
    eq(prompts(e, m), []);
    eq(raises(e, m), []);
    done();
  });

  test('care: a cup from the tray while the bubble is open', function () {
    var e = mk(at(9, 0));
    C.setCups(7);
    go(e, at(9, 50));
    var m = mark(e);
    menu(e, 'drink');
    eq(h(), [8, 0, 0]);
    eq(events(e, m, 'drank'), [{ cups: 8, goalReached: true }]);
    go(e, at(9, 50, 1));
    eq(prompts(e, m), ['update:sit']);
    eq(C.answer('drink'), false, '喝了 has left the bubble: a stale press does nothing');
    eq(h(), [8, 0, 0]);
    menu(e, 'drink');
    eq(h(), [9, 0, 0], 'each press counts once');
    done();

    e = mk(at(9, 0), S(WATER));
    C.setCups(7);
    go(e, at(9, 50));
    m = mark(e);
    menu(e, 'drink');
    eq(h(), [8, 0, 0]);
    go(e, at(9, 50, 1));
    eq(prompts(e, m), ['hide:quiet']);
    eq(raises(e, m), [false]);
    eq(C.answer('drink'), false);
    eq(h(), [8, 0, 0]);
    done();
  });

  test('care: menu pomodoro starts and stops; healthMenu follows only on change', function () {
    var e = mk(at(9, 0));
    eq(sends(e, { log: 0, sent: 0 }, 'healthMenu'), [{ cups: '0/8', pomodoro: { phase: 'idle', endsMs: null }, sitOn: true }], 'sent after init');
    go(e, at(10, 0));
    eq(C.state.prompt.kind, 'both');
    var m = mark(e);
    menu(e, 'pomodoro');
    eq(sends(e, m, 'healthMenu'), [{ cups: '0/8', pomodoro: { phase: 'focus', endsMs: at(10, 25) }, sitOn: true }]);
    eq(prompts(e, m), ['hide:quiet'], 'a focus sends the open reminder back to its queue at once');
    eq(events(e, m, 'cue'), ['focus']);
    menu(e, 'pomodoro');
    eq(sends(e, m, 'healthMenu')[1], { cups: '0/8', pomodoro: { phase: 'idle', endsMs: null }, sitOn: true });
    eq(sends(e, m, 'healthMenu').length, 2);
    m = mark(e);
    for (var i = 1; i <= 30; i++) go(e, at(10, 0, i));
    eq(sends(e, m, 'healthMenu'), []);
    eq(sends(e, m, 'saveHistory'), []);
    done();

    e = mk(at(9, 0), S(SIT));
    eq(sends(e, { log: 0, sent: 0 }, 'healthMenu'), [{ cups: null, pomodoro: { phase: 'idle', endsMs: null }, sitOn: true }]);
    eq([C.state.show.cups, C.state.cupsText], [false, '0/8']);
    C.drink();
    eq([C.state.show.cups, C.state.cupsText], [true, '1/8'], 'a cup logged today shows the count');
    done();
  });

  // The host's menuOpening (app.js: QJZ.app.refresh) steps care too: a hidden page (no app tick, the heartbeat off here)
  // answers with the healthMenu of now, so 記一杯水 and 開始／停止番茄鐘 are never left from before the page was hidden.
  test('care: menuOpening while hidden brings healthMenu up to date (a focus that ended meanwhile, a cup)', function () {
    var e = mk(at(9, 0));
    menu(e, 'pomodoro');
    vis(e, false, at(9, 1));
    var m = mark(e);
    e.clock.ms = at(9, 25, 5);
    eq(sends(e, m, 'healthMenu'), [], 'nothing steps while hidden here');
    e.bridge.emit({ type: 'menuOpening' });
    eq(sends(e, m, 'healthMenu'), [{ cups: '0/8', pomodoro: { phase: 'break', endsMs: at(9, 30) }, sitOn: true }], 'the break, at once');
    eq(h(), [0, 1, 1]);
    e.bridge.emit({ type: 'menuOpening' });
    eq(sends(e, m, 'healthMenu').length, 1, 'only on change');
    done();
  });

  test('care: reaching the cup goal', function () {
    var e = mk(at(9, 0));
    C.setCups(7);
    var m = mark(e);
    C.drink();
    eq(events(e, m, 'drank'), [{ cups: 8, goalReached: true }]);
    C.drink();
    eq(events(e, m, 'drank')[1], { cups: 9, goalReached: false });
    done();
  });

  // Final review m-2: §5.6 stores a day's cup goal so that its colour never changes afterwards; a goal changed during the
  // day is the goal the day closes with, so its cell is the same before and after 04:00.
  test('care: a cup goal changed during the day is the goal the day closes with', function () {
    function cell(key) {
      var cal = QJZ.health.calendar(A.state.history, '2026-11', A.state.today, A.state.settings);
      return [].concat.apply([], cal.weeks).filter(function (c) { return c && c.day === key; })[0];
    }
    function full() { var c = cell('2026-11-12'); return [c.full, c.level]; }
    // lowered from 8 to 6 with 6 cups: ✓ today, and still ✓ after 04:00 (it lost its ✓ there before)
    var e = mk(at(9, 0));
    for (var i = 0; i < 6; i++) C.drink();
    eq(full(), [false, 3], 'goal 8');
    var m = mark(e);
    A.saveSettings({ health: { water: { goal: 6 } } });
    eq(full(), [true, 4], 'goal 6: today is full');
    var stamped = A.state.today.health.cupGoal;
    var saved = sends(e, m, 'saveHistory').some(function (p) { return JSON.parse(p.text).days['2026-11-12'].health.cupGoal === 6; });
    go(e, day(13, 4, 0, 1));
    eq(A.state.today.day, '2026-11-13');
    eq(full(), [true, 4], 'the same after 04:00');
    eq(A.state.history.days['2026-11-12'].health.cupGoal, 6);
    eq(stamped, 6, 'today carried the new goal at once');
    ok(saved, 'and it was saved at once');
    m = mark(e);
    A.saveSettings({ health: { water: { goal: 10 } } });
    eq(full(), [true, 4], 'a closed day keeps its goal');
    eq('health' in A.state.today, false, 'a new day with no counts gets no record of its own');
    eq(sends(e, m, 'saveHistory'), [], 'and nothing is written for it');
    done();

    // raised from 8 to 10 with 8 cups: not full today, and no ✓ the next morning either
    e = mk(at(9, 0));
    for (i = 0; i < 8; i++) C.drink();
    eq(full(), [true, 4], 'goal 8');
    A.saveSettings({ health: { water: { goal: 10 } } });
    eq(full(), [false, 3], 'goal 10');
    go(e, day(13, 4, 0, 1));
    eq(full(), [false, 3], 'the same after 04:00');
    eq(A.state.history.days['2026-11-12'].health.cupGoal, 10);
    done();

    // a day without counts: changing the goal writes nothing
    e = mk(at(9, 0));
    m = mark(e);
    A.saveSettings({ health: { water: { goal: 5 } } });
    eq('health' in A.state.today, false);
    eq(sends(e, m, 'saveHistory'), []);
    done();
  });

  test('care: a 1.0 user is never reminded before answering', function () {
    var e = mk(at(9, 0), S(null)), m = mark(e);
    walk(e, at(9, 0), at(17, 59), 10 * MIN);
    eq(prompts(e, m), []);
    eq([C.state.show.cups, C.state.show.tomatoes], [false, false]);
    eq(C.minutesToStand(), null);
    done();

    e = mk(at(9, 0), S({ asked: false, sit: { on: true }, water: { on: true } })); m = mark(e);
    walk(e, at(9, 0), at(11, 0), 10 * MIN);
    eq(prompts(e, m), [], 'switches on in a hand-edited file, but never asked (§5.5)');
    done();
  });

  test('care: state: goals, what shows, the time to the next stand-up', function () {
    var e = mk(at(9, 0));
    eq(C.state.ready, true);
    eq(C.state.goals, { cups: 8, tomatoes: 4, standups: 9 });
    eq([C.state.show.cups, C.state.show.tomatoes], [true, false]);
    go(e, at(9, 20));
    eq(C.minutesToStand(), 30);
    C.toggleFocus();
    eq(C.state.show.tomatoes, true, 'a running focus shows the tomatoes');
    C.toggleFocus();
    eq(C.state.show.tomatoes, false);
    done();
  });

  test('care: a clock set back never holds the bubble, its re-wave or 等一下 for the size of the jump', function () {
    // the 3 s gate after the window comes back
    var e = mk(at(9, 0));
    go(e, at(9, 49));
    vis(e, false, at(9, 49));
    vis(e, true, at(9, 55));
    var m = mark(e);
    go(e, at(9, 35));
    go(e, at(9, 35, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 35, 3));
    eq(prompts(e, m), ['show:both']);
    done();

    // the re-wave, 2 min after the bubble showed
    e = mk(at(9, 0));
    go(e, at(9, 50));
    go(e, at(9, 51));
    m = mark(e);
    go(e, at(9, 31));
    go(e, at(9, 31, 59));
    eq(prompts(e, m), []);
    go(e, at(9, 32));
    eq(prompts(e, m), ['wave']);
    done();

    // 等一下: 5 min, whatever the clock did (3 min left at 09:52, set back to 09:35: due at 09:38)
    e = mk(at(9, 0));
    go(e, at(9, 50));
    C.answer('later');
    go(e, at(9, 52));
    m = mark(e);
    go(e, at(9, 35));
    go(e, at(9, 37, 59));
    eq(prompts(e, m), []);
    go(e, at(9, 38));
    eq(prompts(e, m), ['show:both']);
    eq(C.state.r.ms >= 50 * MIN, true, 'no negative time');
    done();
  });

  // ---------- 1.1.1 ----------
  // Item 4: 少記一杯 (the host's menu {action:'undrink'}) is 今天已喝 −: one cup off today, never below 0, nothing else.
  test('care: 少記一杯 takes one cup off today, never below 0, and changes nothing else', function () {
    var e = mk(at(9, 0));
    C.setCups(3);
    go(e, at(9, 20));
    var r = JSON.stringify(C.state.r), m = mark(e);
    menu(e, 'undrink');
    eq(h(), [2, 0, 0]);
    eq(A.state.history.days['2026-11-12'].health, { cups: 2, cupGoal: 8, tomatoes: 0, standups: 0 }, 'today, as the calendar reads it');
    ok(sends(e, m, 'saveHistory').some(function (p) { return JSON.parse(p.text).days['2026-11-12'].health.cups === 2; }), 'saved at once');
    eq(sends(e, m, 'healthMenu'), [{ cups: '2/8', pomodoro: { phase: 'idle', endsMs: null }, sitOn: true }], 'the menu follows');
    eq([events(e, m, 'drank'), events(e, m, 'standup')], [[], []], 'not a cup, not a stand-up');
    eq(JSON.stringify(C.state.r), r, 'the timer is as it was');
    menu(e, 'undrink');
    menu(e, 'undrink');
    eq(h(), [0, 0, 0]);
    m = mark(e);
    menu(e, 'undrink');
    eq(h(), [0, 0, 0], 'never below 0');
    eq([sends(e, m, 'saveHistory'), sends(e, m, 'healthMenu')], [[], []], 'and nothing is written');
    eq(C.undrink(), false);
    done();

    e = mk(at(9, 0));
    eq(C.undrink(), false, 'no cup yet today');
    C._reset();
    eq(C.undrink(), false, 'not ready');
    done();
  });

  test('care: 少記一杯 while the bubble shows: its count at once, and below the goal it asks water again', function () {
    var e = mk(at(9, 0));
    C.setCups(3);
    go(e, at(9, 50));
    eq(C.view().sub, '已經坐 50 分鐘囉・今天 3/8 杯');
    menu(e, 'undrink');
    eq(C.view().sub, '已經坐 50 分鐘囉・今天 2/8 杯', 'the bubble\'s count');
    done();

    e = mk(at(9, 0));
    C.setCups(8);
    go(e, at(9, 50));
    var m = mark(e);
    eq(C.state.prompt.kind, 'sit', 'at the goal: only 起來動');
    menu(e, 'undrink');
    go(e, at(9, 50, 1));
    eq(prompts(e, m), ['update:both'], '7/8: water again');
    eq(C.view().sub, '已經坐 50 分鐘囉・今天 7/8 杯');
    eq(raises(e, m), [], 'no new bubble, no new raise');
    done();
  });

  // Item 5: 設定 → 健康 →「現在提醒我一次」: a real reminder, due now. The gates still hold it (hidden, full screen, a
  // focus, the open panel: Ruling C1), so pressed in 設定 it shows 3 s after the panel closes. Off work it still shows.
  test('care: 現在提醒我一次 makes the reminder due now; the open panel holds it until 3 s after it closes', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 7));
    C.setPanel(true);
    var m = mark(e);
    eq(C.remindNow(), true);
    eq(C.state.standIn, 0, 'due now');
    go(e, at(9, 7, 30));
    eq(prompts(e, m), [], 'the panel holds it');
    e.clock.ms = at(9, 8);
    C.setPanel(false);
    go(e, at(9, 8, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 8, 3));
    eq(prompts(e, m), ['show:both'], 'asks what the switches say');
    eq(raises(e, m), [true]);
    eq(C.view().sub, '已經坐 8 分鐘囉・今天 0/8 杯', 'the real time sat');
    eq(C.view().buttons.map(function (b) { return b.id; }), ['drink', 'up', 'later']);
    done();
  });

  test('care: 現在提醒我一次 answers like any reminder: 喝了, 起來了, 等一下', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 10));
    C.remindNow();
    eq(C.state.prompt.kind, 'both', 'shown at once when nothing holds it');
    C.answer('drink');
    eq(h(), [1, 0, 0], '喝了: a cup; the bubble stays as 起來動');
    eq(C.state.prompt.kind, 'sit');
    C.answer('up');
    eq(h(), [1, 0, 1], '起來了: the stand-up');
    var m = mark(e);
    walk(e, at(9, 11), at(9, 59), MIN);
    go(e, at(9, 59, 59));
    eq(prompts(e, m), [], 'the timer restarted at 09:10');
    go(e, at(10, 0));
    eq(prompts(e, m), ['show:both'], 'the next one 50 min later');
    done();

    e = mk(at(9, 0), S(SIT));
    go(e, at(9, 10));
    C.remindNow();
    eq(C.state.prompt.kind, 'sit', 'only 起來動 on: only that');
    C.answer('up');
    eq(h(), [0, 0, 1]);
    eq(C.minutesToStand(), 50);
    done();

    e = mk(at(9, 0));
    go(e, at(9, 10));
    C.remindNow();
    m = mark(e);
    C.answer('later');
    eq(h(), [0, 0, 0]);
    eq(C.minutesToStand(), 5, 'the time to the end of the snooze');
    walk(e, at(9, 11), at(9, 14), MIN);
    go(e, at(9, 14, 59));
    eq(prompts(e, m), ['hide']);
    go(e, at(9, 15));
    eq(prompts(e, m), ['hide', 'show:both'], '等一下: 5 minutes later');
    done();
  });

  test('care: 現在提醒我一次 waits for a focus, and shows outside work time too', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 10));
    C.toggleFocus();
    var m = mark(e);
    C.remindNow();
    walk(e, at(9, 11), at(9, 34), MIN);
    eq(prompts(e, m), [], 'a focus holds it');
    go(e, at(9, 35));
    eq(prompts(e, m), ['show:break+w'], 'the break takes it in: the water line');
    C.answer('ok');
    eq(h(), [0, 1, 1], 'and the break was the stand-up');
    m = mark(e);
    walk(e, at(9, 36), at(9, 39), MIN);
    eq(prompts(e, m), [], 'nothing more during the break');
    done();

    e = mk(at(9, 0));
    go(e, at(12, 20));
    m = mark(e);
    eq(prompts(e, m), []);
    C.remindNow();
    eq(prompts(e, m), ['show:both'], 'at lunch too: it was asked for');
    C.answer('up');
    eq(h(), [0, 0, 1]);
    done();
  });

  test('care: 現在提醒我一次 with no minute sat leaves 「已經坐 N 分鐘囉」 out of the bubble', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 0, 3));   // (the 3 s after the window showed)
    C.remindNow();   // 3 s into work
    eq([C.state.prompt.kind, C.view().sub], ['both', '今天 0/8 杯']);
    done();

    e = mk(at(9, 0), S(SIT));
    go(e, at(9, 10));
    C.remindNow();
    C.answer('up');
    go(e, at(9, 10, 30));
    C.remindNow();   // half a minute after the timer restarted
    eq([C.state.prompt.kind, C.view().sub], ['sit', ''], '起來動 alone: no sub at all');
    done();
  });

  test('care: 現在提醒我一次 does nothing when nothing would be asked', function () {
    var e = mk(at(9, 0), S({ asked: true, sit: { on: false }, water: { on: false } }));
    var m = mark(e);
    eq(C.remindNow(), false, 'both switches off');
    go(e, at(9, 0, 5));
    eq(prompts(e, m), []);
    done();

    e = mk(at(9, 0), S(null));
    eq(C.remindNow(), false, 'a 1.0 user who has not answered');
    done();

    e = mk(at(9, 0), S(WATER));
    C.setCups(8);
    eq(C.remindNow(), false, 'water only, and the goal is reached');
    C._reset();
    eq(C.remindNow(), false, 'not ready');
    done();
  });

  // Item 7: fullscreen {on, here}. on holds the reminders (as before); here (the full-screen window is on the pet's
  // monitor, the host has stepped the window behind it) also hushes every line. Nothing is replayed after it.
  test('care: full screen on the pet\'s monitor is here; another monitor holds the reminders only', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 49));
    var m = mark(e);
    e.bridge.emit({ type: 'fullscreen', on: true, here: true });
    eq([C.state.fullscreen, C.state.here], [true, true]);
    walk(e, at(9, 50), at(9, 54), MIN);
    eq(prompts(e, m), [], 'the reminder waits');
    e.clock.ms = at(9, 55);
    e.bridge.emit({ type: 'fullscreen', on: false });
    eq([C.state.fullscreen, C.state.here], [false, false]);
    go(e, at(9, 55, 2));
    eq(prompts(e, m), []);
    go(e, at(9, 55, 3));
    eq(prompts(e, m), ['show:both'], 'the queued reminder 3 s later');
    done();

    e = mk(at(9, 0));
    e.bridge.emit({ type: 'fullscreen', on: true, here: false });
    eq([C.state.fullscreen, C.state.here], [true, false], 'another monitor');
    e.bridge.emit({ type: 'fullscreen', on: false, here: true });
    eq([C.state.fullscreen, C.state.here], [false, false], 'here only with on');
    e.bridge.emit({ type: 'fullscreen', on: true, here: 'yes' });
    eq(C.state.here, false, 'only true is here');
    var n = 0;
    C.on('change', function () { n++; });
    e.bridge.emit({ type: 'fullscreen', on: true, here: true });
    eq([C.state.here, n], [true, 1], 'a change');
    done();
  });

  // Final review M-3: outside work time 等一下 ends a test reminder; a real one never shows after 下班, so neither does
  // its repeat. (During work it comes back 5 minutes later, as any reminder.)
  test('care: 現在提醒我一次 after work: 等一下 ends it, and it does not come back', function () {
    var e = mk(at(9, 0));
    go(e, at(19, 0));   // 可以下班 since 18:00
    var m = mark(e);
    C.remindNow();
    eq(prompts(e, m), ['show:both']);
    C.answer('later');
    eq(C.state.r.forced, false, 'ended');
    eq(events(e, m, 'snooze'), [], 'and no 「5 分鐘後再叫你」: it will not come back');
    walk(e, at(19, 1), at(19, 30), MIN);
    eq(prompts(e, m), ['show:both', 'hide'], 'not again at 19:10');
    done();
  });

  // Final review M-4: a test reminder ends on the first step where nothing would be asked any more, so it never pops up
  // later (a switch turned back on, a later 少記一杯), after 下班 too.
  test('care: a test reminder ends when nothing is asked any more; nothing pops up later', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 10));
    C.setPanel(true);
    C.remindNow();
    A.saveSettings({ health: { sit: { on: false }, water: { on: false } } });
    go(e, at(9, 10, 1));
    eq(C.state.r.forced, false, 'both switches off in the same 設定 visit: it ends');
    A.saveSettings({ health: { sit: { on: true }, water: { on: true } } });
    C.setPanel(false);
    var m = mark(e);
    walk(e, at(9, 10, 2), at(9, 10, 10), 1000);
    eq(prompts(e, m), [], 'turned back on: nothing pops up');
    done();

    e = mk(at(9, 0), S(WATER));
    go(e, at(9, 10));
    C.setPanel(true);
    C.remindNow();
    C.setCups(8);
    go(e, at(9, 10, 1));
    eq(C.state.r.forced, false, 'water only and the goal reached: it ends');
    C.setPanel(false);
    menu(e, 'undrink');
    m = mark(e);
    walk(e, at(9, 10, 2), at(9, 10, 10), 1000);
    eq(prompts(e, m), [], 'a later 少記一杯 pops nothing up');
    done();
  });

  // ---------- 1.1.2 ----------
  // Item 7: 「我剛起來動過了」, from the menu (menu {action:'stoodUp'}) or a long press on the countdown (care.stoodUp):
  // a stand-up, the timer restarts, and the pet says 收到 (the layouts, on standup source 'manual').
  test('care: 我剛起來動過了 counts a stand-up and restarts the timer', function () {
    var e = mk(at(9, 0));
    go(e, at(9, 30));
    var m = mark(e);
    menu(e, 'stoodUp');
    eq(h(), [0, 0, 1]);
    eq(events(e, m, 'standup'), [{ count: 1, source: 'manual' }]);
    ok(sends(e, m, 'saveHistory').some(function (p) { return JSON.parse(p.text).days['2026-11-12'].health.standups === 1; }), 'saved at once');
    eq([C.state.r.ms, C.state.standIn], [0, 50]);
    go(e, at(10, 19, 59));
    eq(prompts(e, m), []);
    go(e, at(10, 20));
    eq(prompts(e, m), ['show:both'], '50 minutes after it');
    eq(C.stoodUp(), true);
    eq(h(), [0, 0, 2]);
    eq(prompts(e, m), ['show:both', 'hide:quiet'], 'a bubble it answers closes, before the line');
    eq(e.log.slice(m.log).map(function (x) { return x.n; }).filter(function (n) { return n === 'prompt' || n === 'standup'; }).slice(-2),
      ['prompt', 'standup'], 'the bubble goes first, then 收到');
    eq(raises(e, m), [true, false]);
    done();

    e = mk(at(9, 0));
    go(e, at(9, 51));
    C.answer('later');
    eq(C.state.snoozed, true);
    C.stoodUp();
    eq([C.state.snoozed, C.state.standIn], [false, 50], 'it ends a 等一下 too');
    done();

    e = mk(at(9, 0), S(null));
    eq(C.stoodUp(), true, 'counted with the reminders off too');
    eq(h(), [0, 0, 1]);
    C._reset();
    eq(C.stoodUp(), false, 'not ready');
    done();
  });

  // healthMenu.sitOn (for the host's 我剛起來動過了 item): the 起來動 reminder is on.
  test('care: healthMenu says whether 起來動 is on', function () {
    var e = mk(at(9, 0), S(WATER));
    eq(sends(e, { log: 0, sent: 0 }, 'healthMenu').pop().sitOn, false);
    var m = mark(e);
    A.saveSettings({ health: { sit: { on: true } } });
    eq(sends(e, m, 'healthMenu').map(function (p) { return p.sitOn; }), [true]);
    done();
    e = mk(at(9, 0), S(null));
    eq(sends(e, { log: 0, sent: 0 }, 'healthMenu').pop().sitOn, false, 'not answered yet: off');
    done();
  });

  test('care: _dev seeds counts, a pomodoro and a prompt (dev.html only)', function () {
    var e = mk(at(10, 0));
    vis(e, false, at(10, 0));
    C._dev({ cups: 3, tomatoes: 2, standups: 4, pomo: 'focus' });
    eq(h(), [3, 2, 4]);
    eq(C.state.p.phase, 'focus');
    eq(QJZ.pomodoro.minutesLeft(C.state.p, at(10, 0)), 13);
    eq(C.state.visible, true, 'dev.html has no host to say the window shows');
    done();

    e = mk(at(10, 0));
    C._dev({ tomatoes: 3, prompt: 'break' });
    eq([C.state.p.phase, C.state.prompt.kind], ['break', 'break']);
    eq(C.view().sub, '第 3 顆番茄完成');
    eq(C.view().waterLine, null);
    C._dev({ prompt: 'break', water: true });
    eq(C.view().waterLine, '順便喝口水吧～', 'and with the water line');
    done();

    e = mk(at(9, 10));
    C._dev({ prompt: 'both' });
    eq(C.state.prompt.kind, 'both');
    C._dev({ prompt: 'both', turn: 3 });   // which line of the copy (dev.html ?turn=, for the screenshots)
    eq(C.view().title, QJZ.prompt.LINES.both[3]);
    done();
  });
})();
