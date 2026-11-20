// 1.1.7 item 7: 上班方式 彈性／固定. Settings, the effective hours (QJZ.settings.hours), the fixed start (QJZ.day), the app
// around it and the 薪水和時間 panel. 2026-11-12 is a Thursday, 11-14 a Saturday.
(function () {
  var D = '2026-11-12';
  function at(d, h, m, s) { return new Date(2026, 10, d, h, m, s || 0, 0).getTime(); }
  function T(h, m) { return at(12, h, m); }
  function P(o) { return QJZ.settings.parse(JSON.stringify(o)).settings; }
  var SAL = { mode: 'monthly', amount: 50000, divisor: 22 };
  var FIX = P({ salary: SAL, workMode: 'fixed' });   // 08:00–17:30, lunch 12:00–13:00
  var FLEX = P({ salary: SAL });
  function act(rec, ms, s) { return QJZ.day.onActivity(rec, { type: 'unlock', ms: ms }, s || FIX); }
  function snap(rec, ms, s) {
    s = s || FIX;
    return QJZ.earn.snapshot({ startMs: rec.startMs, endMs: rec.endMs, nowMs: ms, day: rec.day, salary: s.salary,
      hoursPerDay: QJZ.settings.hours(s), lunch: s.lunch, offDay: !!rec.offDay });
  }

  // ---------- settings ----------
  test('hours settings: 彈性 by default, and a file from before 1.1.7 loads as 彈性 with the default times', function () {
    eq([QJZ.settings.DEFAULTS.workMode, QJZ.settings.DEFAULTS.fixed], ['flex', { start: '08:00', end: '17:30' }]);
    var old = P({ salary: SAL, hoursPerDay: 9, startMode: 'manual', lunch: { start: '12:30', end: '13:30' } });
    eq([old.workMode, old.fixed, old.hoursPerDay, old.startMode], ['flex', { start: '08:00', end: '17:30' }, 9, 'manual']);
    eq(QJZ.settings.hours(old), 9, '彈性: hoursPerDay as before');
  });
  test('hours settings: workMode and fixed are validated; a bad pair falls back to 08:00 / 17:30', function () {
    eq(P({ workMode: 'fixed', fixed: { start: '09:00', end: '18:00' } }).fixed, { start: '09:00', end: '18:00' });
    eq(P({ workMode: 'shift' }).workMode, 'flex');
    [{ start: '18:00', end: '09:00' }, { start: '09:00', end: '09:00' }, { start: '25:00', end: '18:00' }, { start: '09:00' },
      { start: 9, end: 18 }, 'x', null].forEach(function (f) {
      eq(P({ workMode: 'fixed', fixed: f }).fixed, { start: '08:00', end: '17:30' }, JSON.stringify(f));
    });
  });
  test('hours: 固定 is the span less the lunch inside it; every caller gets it (rates, end, stand-up goal)', function () {
    eq(QJZ.settings.hours(FIX), 8.5, '08:00–17:30 less 12:00–13:00');
    eq(QJZ.settings.hours(P({ workMode: 'fixed', fixed: { start: '13:00', end: '22:00' } })), 9, 'lunch before it: nothing taken out');
    eq(QJZ.settings.hours(P({ workMode: 'fixed', fixed: { start: '12:30', end: '18:00' } })), 5, 'half the lunch inside it');
    eq(QJZ.settings.hours(P({ workMode: 'fixed', hoursPerDay: 7, fixed: { start: '12:00', end: '13:00' } })), 7, 'all lunch: hoursPerDay');
    eq(QJZ.settings.hours(P({ workMode: 'fixed', hoursPerDay: 10 })), 8.5, 'hoursPerDay is not used in 固定');
    eq(QJZ.settings.standGoal(FIX), 10, '8.5 h at 50 min: 10');
    eq(QJZ.settings.standGoal(FLEX), 9, '8 h: 9 as before');
    var hourly = P({ salary: { mode: 'hourly', amount: 200 }, workMode: 'fixed' });
    eq(QJZ.earn.rates(hourly.salary, QJZ.settings.hours(hourly)).daily, 1700, '200 x 8.5');
    eq(QJZ.earn.endAtMs(T(8, 0), D, QJZ.settings.hours(FIX), FIX.lunch), T(17, 30), 'the planned end is the fixed end');
  });

  // ---------- the fixed start ----------
  test('固定: the first activity of a work day before the end starts it at the fixed start, earlier or later', function () {
    var r = act(QJZ.day.empty(D), T(7, 40));
    eq([r.startMs, r.startSource], [T(8, 0), 'fixed'], '07:40');
    r = act(QJZ.day.empty(D), T(8, 20));
    eq([r.startMs, r.startSource], [T(8, 0), 'fixed'], '08:20 counts from 08:00');
    eq(act(r, T(10, 0)).startMs, T(8, 0), 'later activity keeps it');
    eq(act(QJZ.day.empty(D), T(18, 0)).startMs, null, '18:00: after the end, no start');
    eq(act(QJZ.day.empty(D), T(17, 30)).startMs, null, 'at the end: none either');
    eq(act(QJZ.day.empty('2026-11-14'), at(14, 9, 0)).startMs, null, 'Saturday: not a work day');
    eq(act(QJZ.day.setOffDay(QJZ.day.empty(D), true), T(9, 0)).startMs, null, '今天休假');
    eq(act(QJZ.day.empty(D), T(9, 0), P({ workMode: 'fixed', startMode: 'manual' })).startMs, T(8, 0), 'startMode is not used in 固定');
    var m = QJZ.day.manualStart(QJZ.day.empty('2026-11-14'), at(14, 10, 0));
    eq([m.startMs, m.startSource], [at(14, 10, 0), 'manual'], '開始上班 still works on a day off');
  });
  test('固定: before the start the day shows 0 and before; then it counts from 08:00 and is done at 17:30', function () {
    var r = act(QJZ.day.empty(D), T(7, 40)), s = snap(r, T(7, 40));
    eq([s.status, s.earned, s.workedSec, s.pct, s.endAtMs], ['before', 0, 0, 0, T(17, 30)], '07:40');
    var r2 = act(QJZ.day.empty(D), T(8, 20)), daily = 50000 / 22;
    s = snap(r2, T(8, 20));
    eq(s.status, 'working');
    near(s.earned, daily / 8.5 / 3, 1e-6, '20 minutes of an 8.5 h day');
    eq(snap(r2, T(12, 30)).status, 'lunch');
    s = snap(r2, T(17, 29, 59));
    eq(s.status, 'working', 'a second before the end');
    s = snap(r2, T(17, 30));
    eq(s.status, 'done');
    near(s.earned, daily, 1e-6, 'the whole day');
    near(QJZ.history.closeDay(r2, FIX).earned, Math.round(daily * 100) / 100, 1e-9, 'closed at the fixed end');
  });
  test('固定: the early-leave question uses the fixed end', function () {
    var r = act(QJZ.day.empty(D), T(8, 20)), s10 = P({ workMode: 'fixed', hoursPerDay: 10 });
    eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(r, T(16, 0)), s10), { day: D, lockMs: T(16, 0) }, 'locked 16:00');
    eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(r, T(17, 40)), s10), null, 'locked after 17:30 (10 h would end later)');
  });
  test('固定 review: a lock before the fixed start asks nothing; 開始上班 before it starts now by hand', function () {
    var r = act(QJZ.day.empty(D), T(7, 40));
    eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(r, T(7, 50)), FIX), null, 'locked 07:50, start 08:00');
    var m = QJZ.day.manualStart(r, T(7, 45));
    eq([m.startMs, m.startSource], [T(7, 45), 'manual'], 'manual start at 07:45');
  });
  test('固定: applyMode moves an auto start, starts an unstarted day before the end, keeps one set by hand', function () {
    var auto = QJZ.day.onActivity(QJZ.day.empty(D), { type: 'unlock', ms: T(8, 37) }, FLEX);
    var r = QJZ.day.applyMode(auto, FIX, T(10, 0));
    eq([r.startMs, r.startSource], [T(8, 0), 'fixed'], 'auto 08:37 -> 08:00');
    eq(QJZ.day.applyMode(QJZ.day.empty(D), FIX, T(10, 0)).startMs, T(8, 0), 'not started yet');
    eq(QJZ.day.applyMode(QJZ.day.empty(D), FIX, T(18, 0)).startMs, null, 'not started, after the end');
    var manual = QJZ.day.manualStart(QJZ.day.empty(D), T(9, 30));
    ok(QJZ.day.applyMode(manual, FIX, T(10, 0)) === manual, '開始上班 kept');
    var adj = QJZ.day.adjustStart(auto, T(8, 15));
    ok(QJZ.day.applyMode(adj, FIX, T(10, 0)) === adj, '調整起算時間 kept');
    var off = QJZ.day.setOffDay(auto, true);
    ok(QJZ.day.applyMode(off, FIX, T(10, 0)) === off, '今天休假 kept');
    ok(QJZ.day.applyMode(auto, FLEX, T(10, 0)) === auto, '彈性: nothing');
    var sat = QJZ.day.empty('2026-11-14');
    ok(QJZ.day.applyMode(sat, FIX, at(14, 10, 0)) === sat, 'not a work day');
    var nine = P({ workMode: 'fixed', fixed: { start: '09:00', end: '18:00' } });
    eq(QJZ.day.applyMode(r, nine, T(10, 0)).startMs, T(9, 0), 'new fixed times move a fixed start');
  });

  // ---------- the app ----------
  function mkApp(nowMs, settings, history) {
    QJZ.app._reset();
    var handlers = {}, clock = { ms: nowMs };
    var bridge = { send: function () {}, on: function (t, f) { handlers[t] = f; }, emit: function (m) { handlers[m.type](m); } };
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    bridge.emit({ type: 'init', settings: JSON.stringify(settings), history: history ? JSON.stringify(history) : null,
      probeMs: null, nowMs: nowMs, version: 't' });
    return { clock: clock, bridge: bridge, tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  var FIXED_RAW = { salary: SAL, workMode: 'fixed', onboarded: true, health: { asked: true } };
  test('app 固定: started at 07:40 the day waits for 08:00 at 0, then counts', function () {
    var e = mkApp(T(7, 40), FIXED_RAW), st = QJZ.app.state;
    eq([st.today.startMs, st.today.startSource, st.snap.status, st.snap.earned], [T(8, 0), 'fixed', 'before', 0]);
    eq(QJZ.layouts.util.statusKey(st.snap, st.today, st.settings), 'before', '還沒開始上班, not 休假');
    e.tick(T(8, 20));
    eq(QJZ.app.state.snap.status, 'working');
    near(QJZ.app.state.snap.earned, 50000 / 22 / 8.5 / 3, 1e-6);
    QJZ.app._reset();
  });
  // review h1: before the 固定 start the countdown is to 上班 (U1 距離上班, U3 上班, the phrases); from 08:00 to 下班 again
  test('app 固定: at 07:40 the countdown is 距離上班 00:20:00; at 08:00 距離下班 08:30:00', function () {
    var e = mkApp(T(7, 40), FIXED_RAW), U = QJZ.layouts.util;
    var m = U.model(QJZ.app.state, T(7, 40));
    eq([m.remainLbl, m.remainTo, m.remain, m.remainPhrase, m.m3sub], ['距離上班', '上班', '00:20:00', '還有 00:20:00 上班', '還沒上班 · 還有 00:20:00']);
    e.tick(T(8, 0));
    m = U.model(QJZ.app.state, T(8, 0));
    eq([m.remainLbl, m.remainTo, m.remain, m.remainPhrase], ['距離下班', '下班', '08:30:00', '還有 08:30:00 下班']);
    QJZ.app._reset();
    mkApp(T(7, 40), { salary: SAL, onboarded: true, health: { asked: true }, startMode: 'manual' });
    m = U.model(QJZ.app.state, T(7, 40));
    eq([m.remainLbl, m.remainPhrase], ['距離下班', '還沒開始上班'], '彈性, no start yet: as before');
    QJZ.app._reset();
  });
  test('app 固定: started at 08:20 counts from 08:00; at 18:00 nothing starts', function () {
    mkApp(T(8, 20), FIXED_RAW);
    eq(QJZ.app.state.today.startMs, T(8, 0));
    near(QJZ.app.state.snap.earned, 50000 / 22 / 8.5 / 3, 1e-6);
    mkApp(T(18, 0), FIXED_RAW);
    eq([QJZ.app.state.today.startMs, QJZ.app.state.snap.earned], [null, 0]);
    QJZ.app._reset();
  });
  test('app: a user from before 1.1.7 stays 彈性 and keeps today', function () {
    var h = { version: 1, days: {} };
    h.days[D] = QJZ.day.onActivity(QJZ.day.empty(D), { type: 'unlock', ms: T(9, 12) }, FLEX);
    mkApp(T(10, 0), { salary: SAL, onboarded: true, hoursPerDay: 8 }, h);
    eq([QJZ.app.state.settings.workMode, QJZ.app.state.today.startMs, QJZ.app.state.today.startSource], ['flex', T(9, 12), 'auto']);
    QJZ.app._reset();
  });
  test('app: switching to 固定 mid-day moves an auto start to 08:00; back to 彈性 keeps it; 開始上班 is kept', function () {
    mkApp(T(10, 0), { salary: SAL, onboarded: true });
    eq(QJZ.app.state.today.startMs, T(10, 0), 'auto at 10:00');
    QJZ.app.saveSettings({ workMode: 'fixed' });
    eq([QJZ.app.state.today.startMs, QJZ.app.state.today.startSource], [T(8, 0), 'fixed']);
    near(QJZ.app.state.snap.earned, 50000 / 22 / 8.5 * 2, 1e-6, 'two hours, of 8.5');
    QJZ.app.saveSettings({ fixed: { start: '09:00', end: '18:00' } });
    eq(QJZ.app.state.today.startMs, T(9, 0), 'new times while 固定');
    QJZ.app.saveSettings({ workMode: 'flex' });
    eq([QJZ.app.state.today.startMs, QJZ.settings.hours(QJZ.app.state.settings)], [T(9, 0), 8], '彈性 again: start as is');
    QJZ.app.startWork();
    QJZ.app.saveSettings({ workMode: 'fixed' });
    eq([QJZ.app.state.today.startMs, QJZ.app.state.today.startSource], [T(10, 0), 'manual'], '開始上班 kept');
    QJZ.app._reset();
  });
  test('app: switching to 固定 after the end does not start the day', function () {
    mkApp(T(19, 0), { salary: SAL, onboarded: true, startMode: 'manual' });
    eq(QJZ.app.state.today.startMs, null);
    QJZ.app.saveSettings({ workMode: 'fixed' });
    eq(QJZ.app.state.today.startMs, null);
    QJZ.app._reset();
  });

  // ---------- the panel ----------
  function fixture() {
    var el = document.getElementById('layout-fixture');
    if (!el) {
      el = document.createElement('div');
      el.id = 'layout-fixture';
      el.style.cssText = 'position:absolute;left:0;top:0';
      document.body.appendChild(el);
    }
    return el;
  }
  function mk(nowMs, settings, first) {
    QJZ.panels._reset(); QJZ.layouts._reset(); QJZ.care._reset(); QJZ.app._reset();
    var handlers = {}, clock = { ms: nowMs };
    var bridge = {
      send: function () {},
      on: function (t, f) {
        (handlers[t] = handlers[t] || []).push(f);
        return function () { var l = handlers[t], i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
      },
      emit: function (m) { (handlers[m.type] || []).slice().forEach(function (f) { f(m); }); }
    };
    var root = fixture();
    QJZ.layouts.start(root, { bridge: bridge, first: first });
    QJZ.panels.start();
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    bridge.emit({ type: 'init', settings: JSON.stringify(settings), history: null, probeMs: null, nowMs: nowMs, version: 't' });
    bridge.emit({ type: 'menu', action: 'settings' });
    root.querySelector('[data-tab=time]').click();
    return root;
  }
  function done() { QJZ.panels._reset(); QJZ.layouts._reset(); QJZ.care._reset(); QJZ.app._reset(); }
  function shown(n) { return !!n && n.offsetParent !== null; }
  function commit(input, v) {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  test('panel 上班方式: 彈性 shows 每日工時 and 開始算錢; 固定 shows 上班 / 下班 and the hours, and hides them', function () {
    var root = mk(T(10, 0), { salary: SAL, onboarded: true, health: { asked: true } });
    var $ = function (s) { return root.querySelector(s); };
    eq($('[data-seg=workMode] .on').getAttribute('data-v'), 'flex');
    ok(shown($('[data-hstep="+"]')) && shown($('[data-seg=startMode]')), '彈性 as before');
    ok(!shown($('[data-f=fixedStart]')) && !shown($('[data-o=workModeHint]')), 'nothing of 固定');
    $('[data-seg=workMode] [data-v=fixed]').click();
    eq(QJZ.app.state.settings.workMode, 'fixed');
    ok(!shown($('[data-hstep="+"]')) && !shown($('[data-seg=startMode]')), '每日工時 and 開始算錢 hidden');
    ok(shown($('[data-f=fixedStart]')) && shown($('[data-f=fixedEnd]')) && shown($('[data-wd="1"]')), '上班 / 下班, 工作日 still');
    eq([$('[data-f=fixedStart]').value, $('[data-f=fixedEnd]').value], ['08:00', '17:30']);
    eq($('[data-o=fixedHours]').textContent, '每天 8.5 小時（自動算）');
    ok($('[data-o=todayStart]').textContent.indexOf('08:00 起算（固定）') >= 0, $('[data-o=todayStart]').textContent);
    ok($('[data-o=endHint]').textContent.indexOf('17:30') >= 0, $('[data-o=endHint]').textContent);
    commit($('[data-f=fixedEnd]'), '07:00');
    eq($('[data-err=fixed]').textContent, '下班要晚於上班');
    eq(QJZ.app.state.settings.fixed.end, '17:30', 'not saved');
    commit($('[data-f=fixedEnd]'), '1800');
    eq([$('[data-err=fixed]').textContent, QJZ.app.state.settings.fixed, $('[data-f=fixedEnd]').value], ['', { start: '08:00', end: '18:00' }, '18:00']);
    eq($('[data-o=fixedHours]').textContent, '每天 9 小時（自動算）');
    commit($('[data-f=fixedStart]'), '12:00');
    commit($('[data-f=fixedEnd]'), '13:00');
    eq($('[data-err=fixed]').textContent, '扣掉午休就沒有上班時間了');
    $('[data-seg=workMode] [data-v=flex]').click();
    ok(shown($('[data-hstep="+"]')) && !shown($('[data-f=fixedStart]')), '彈性 again');
    done();
  });
  test('panel 上班方式: 固定 fits the 300 px in-place panel', function () {
    var root = mk(T(10, 0), FIXED_RAW, 'U13');
    ok(root.querySelector('.panel.inplace'), 'in place');
    var card = root.querySelector('[data-sec=hours] .card'), cr = card.getBoundingClientRect();
    ok(cr.width <= 300, 'card ' + cr.width);
    Array.prototype.forEach.call(root.querySelectorAll('[data-sec=hours] .row, [data-sec=start] .row'), function (r) {
      if (!shown(r)) return;
      ok(r.scrollWidth <= r.clientWidth + 1, 'a row fits: ' + r.textContent + ' ' + r.scrollWidth + '/' + r.clientWidth);
      ok(r.getBoundingClientRect().right <= cr.right, 'inside its card: ' + r.textContent);
    });
    ok(root.querySelector('[data-seg=workMode]').getBoundingClientRect().right <= cr.right - 2, 'the switch inside the card');
    done();
  });
  test('panel 上班方式: in 深色模式 the 上班 / 下班 fields look like the 午休 ones', function () {
    var s = JSON.parse(JSON.stringify(FIXED_RAW));
    s.display = { dark: true };
    var root = mk(T(10, 0), s);
    ok(document.documentElement.classList.contains('dark'), 'dark');
    var a = getComputedStyle(root.querySelector('[data-f=fixedStart]')), b = getComputedStyle(root.querySelector('[data-f=lunchStart]'));
    eq([a.backgroundColor, a.color, a.borderColor, a.width], [b.backgroundColor, b.color, b.borderColor, b.width]);
    var sg = getComputedStyle(root.querySelector('[data-seg=workMode] .on')), sm = getComputedStyle(root.querySelector('[data-seg=mode] .on'));
    eq(sg.backgroundColor, sm.backgroundColor, 'the switch as the other switches');
    done();
  });
})();
