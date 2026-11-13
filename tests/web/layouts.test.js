// QJZ.layouts: pure helpers, then the real DOM (fixture at the page's top-left, layouts.css loaded by run.html)
// driven by QJZ.app with a fake bridge and a fake clock. 2026-11-12 is a Thursday, 11-14 a Saturday.
(function () {
  var U = QJZ.layouts.util;
  function at(d, h, m, s) { return new Date(2026, 10, d, h, m, s || 0, 0).getTime(); }
  var SETTINGS = { salary: { mode: 'monthly', amount: 50000, divisor: 22 } };

  // ---------- pure helpers ----------
  test('layouts: clock text (no date: the taskbar has it)', function () {
    eq(U.dateText, undefined);
    eq(U.clockText(at(12, 9, 5, 3)), '09:05:03');
    eq(U.hms(3725.9), '01:02:05');
    eq(U.hms(-5), '00:00:00');
    eq(U.hms(8 * 3600), '08:00:00');
    eq(U.hm(9000), '02:30');
  });

  test('layouts: status key and text for every status', function () {
    var s = QJZ.settings.parse(null).settings;
    var thu = QJZ.day.empty('2026-11-12'), sat = QJZ.day.empty('2026-11-14');
    var started = QJZ.day.manualStart(thu, at(12, 9, 0));
    function key(status, rec) { return U.statusKey({ status: status }, rec, s); }
    eq(key('working', started), 'working');
    eq(key('lunch', started), 'lunch');
    eq(key('done', started), 'done');
    eq(key('ended', started), 'ended');
    eq(key('before', thu), 'before');
    eq(key('before', QJZ.day.setOffDay(thu, true)), 'off', '今天休假');
    eq(key('before', sat), 'off', 'not a work day');
    eq(key('working', QJZ.day.manualStart(sat, at(14, 10, 0))), 'working', 'a weekend started by hand');
    eq(['working', 'lunch', 'done', 'ended', 'before', 'off'].map(function (k) { return U.STATUS[k]; }),
      ['上班中', '午休中', '可以下班', '已下班', '還沒上班', '休假日']);
    eq(U.PET_STATE, undefined, 'the stand-in table is gone: QJZ.behavior decides');
  });

  test('layouts: main vs temporary layouts and the way back', function () {
    eq(QJZ.layouts.MAIN, ['U1', 'U3', 'U5B', 'U7', 'U10', 'U12', 'U13']);
    ok(U.isMain('U5B') && !U.isMain('M3') && !U.isMain('PANEL') && !U.isMain('U5-B'));
    eq(U.backTarget({ layout: { current: 'U3' } }), 'U3');
    eq(U.backTarget({ layout: { current: 'M3' } }), 'U1', 'a stored temporary layout would loop');
    eq(U.backTarget(null), 'U1');
  });

  test('layouts: the main layouts include U10 U12 U13', function () {
    eq(QJZ.layouts.ALL, ['U1', 'U3', 'U5B', 'U7', 'U10', 'U12', 'U13', 'M3', 'PANEL']);
    ok(['U10', 'U12', 'U13'].every(U.isMain));
    eq(U.lastLayout({ layout: { current: 'U12', mini: false } }), 'U12');
    eq(U.lastLayout({ layout: { current: 'U12', mini: true } }), 'M3');
    eq([U.backTarget({ layout: { current: 'U10' } }), U.backTarget({ layout: { current: 'U13' } })], ['U10', 'U13']);
  });

  test('layouts: item rotates every 4 s by the wall clock', function () {
    var items = QJZ.settings.DEFAULTS.items;
    eq([0, 3999, 4000, 8000, 12000].map(function (ms) { return U.itemAt(items, ms).name; }), ['珍奶', '珍奶', '便當', '拿鐵', '珍奶']);
    eq(U.itemAt([], 0), null);
  });

  test('layouts: U3 has one card: 可以買 and 本月累計 in turn, 10 s each; the item changes once a round', function () {
    var items = QJZ.settings.DEFAULTS.items;
    function c(ms) { var r = U.cardAt(items, ms); return r.month ? 'month' : r.item.name; }
    eq(U.CARD_MS, 10000);
    eq([0, 9999, 10000, 19999, 20000, 30000, 40000, 50000, 60000].map(c),
      ['珍奶', '珍奶', 'month', 'month', '便當', 'month', '拿鐵', 'month', '珍奶']);
    eq(U.cardAt([], 0), { month: false, item: null });
  });

  test('layouts: rate line (never the salary), remaining phrases, hearts', function () {
    eq(U.rateText({ mode: 'monthly', amount: 50000, divisor: 22 }, 50000 / 22 / 8 / 3600), '每秒 +NT$ 0.079');
    eq(U.rateText({ mode: 'hourly', amount: 183.5, divisor: 22 }, 183.5 / 3600), '每秒 +NT$ 0.051');
    eq(U.rateText({ mode: 'monthly', amount: 0, divisor: 22 }, 0), '還沒設定薪資（右鍵 → 設定）');
    eq(U.remainPhrase('working', 3600 * 2 + 59), '還有 02:01 下班', 'rounded up to the next minute');
    eq(U.remainPhrase('working', 30), '還有 00:01 下班');
    eq(U.remainPhrase('working', 3600 * 2), '還有 02:00 下班');
    eq(U.remainPhrase('done', 0), '可以下班囉！');
    eq(U.m3Sub('working', 3725), '上班中 · 還有 01:02:05');
    eq(U.m3Sub('lunch', 3725), '午休中 · 還有 01:02:05');
    eq(U.m3Sub('done', 0), '可以下班');
    eq(U.m3Sub('off', 28800), '休假日');
    eq(U.heartsText(4), '♥♥♥♥♡');
    eq(U.heartsText(0), '♡♡♡♡♡');
  });

  function fakeState(nowMs, startMs, extra) {
    var s = QJZ.settings.parse(JSON.stringify(SETTINGS)).settings;
    var day = QJZ.time.dayKey(nowMs);
    var today = QJZ.day.empty(day);
    if (startMs !== null) today = QJZ.day.manualStart(today, startMs);
    for (var k in extra) today[k] = extra[k];
    var snap = QJZ.earn.snapshot({ startMs: today.startMs, endMs: today.endMs, nowMs: nowMs, day: day, salary: s.salary, hoursPerDay: 8, lunch: s.lunch });
    var history = { version: 1, days: { '2026-11-02': { day: '2026-11-02', earned: 1000 }, '2026-10-30': { day: '2026-10-30', earned: 999 } } };
    history.days[day] = today;
    return { settings: s, history: history, today: today, snap: snap, rates: QJZ.earn.rates(s.salary, 8),
      snacks: QJZ.rewards.snacksAvailable(today, snap.earned, s.milestone) };
  }

  test('layouts: model while working (start 09:00, now 10:00)', function () {
    var m = U.model(fakeState(at(12, 10, 0), at(12, 9, 0)), at(12, 10, 0));
    eq(m.key, 'working');
    eq(m.status, '上班中');
    eq([m.date, m.worked], [undefined, undefined], 'no date, no 已上班');
    eq(m.clock, '10:00:00');
    eq(m.hm, '10:00');
    eq(m.money, '284.09');
    eq(m.remain, '07:00:00');
    eq(m.pct, '12.5%');
    eq(m.month, '1,284.09', 'closed days of this month + today, not October');
    eq(m.rate, '每秒 +NT$ 0.079');
    eq(m.snacks, 2);
    eq(m.snack, '🌻×2');
    eq(m.plus, '+0.08');
    eq(m.petState, 'typing');
    eq(m.hearts, '♥♥♥♥♡');
    ok(m.bolts >= 0 && m.bolts <= 5);
    var it = U.itemAt(QJZ.settings.DEFAULTS.items, at(12, 10, 0));
    eq(m.itemLabel, '可以買' + it.name);
    eq(m.item, it.icon + ' ×' + QJZ.rewards.itemCount(284.0909, it));
    var c = U.cardAt(QJZ.settings.DEFAULTS.items, at(12, 10, 0));
    eq(m.cardMonth, c.month);
    eq(m.card, c.month ? '📅 ' + m.month : c.item.icon + ' ×' + QJZ.rewards.itemCount(284.0909, c.item), 'U3 card');
    var m2 = U.model(fakeState(at(12, 10, 0, 10), at(12, 9, 0)), at(12, 10, 0, 10));
    ok(m2.cardMonth !== m.cardMonth, '10 s later the other one');
  });

  test('layouts: model at 12:30 (lunch), 18:00 (done), ended, before, off', function () {
    var lunch = U.model(fakeState(at(12, 12, 30), at(12, 9, 0)), at(12, 12, 30));
    eq([lunch.status, lunch.petState, lunch.plus], ['午休中', 'lunchSleep', null]);
    eq(lunch.money, U.model(fakeState(at(12, 12, 0), at(12, 9, 0)), at(12, 12, 0)).money, 'lunch is unpaid');
    var done = U.model(fakeState(at(12, 18, 0), at(12, 9, 0)), at(12, 18, 0));
    eq([done.status, done.petState, done.remain, done.pct, done.money], ['可以下班', 'celebrate', '00:00:00', '100.0%', '2,272.73']);
    var ended = U.model(fakeState(at(12, 15, 0), at(12, 9, 0), { endMs: at(12, 15, 0) }), at(12, 15, 0));
    eq(ended.status, '已下班');
    var before = U.model(fakeState(at(12, 8, 0), null), at(12, 8, 0));
    eq([before.status, before.money, before.petState], ['還沒上班', '0.00', 'idle']);
    var sat = U.model(fakeState(at(14, 10, 0), null), at(14, 10, 0));
    eq(sat.status, '休假日');
    var cat = fakeState(at(12, 10, 0), at(12, 9, 0));
    cat.settings.pet.kind = 'cat';
    eq(U.model(cat, at(12, 10, 0)).snack, '🐟×2');
  });

  test('layouts: hit rect geometry', function () {
    var r = U.subRect({ left: 10, top: 20, width: 176, height: 170 }, [30, 4, 176, 170], [38, 24, 160, 148]);
    eq([r.left, r.top, r.width, r.height], [18, 40, 160, 148]);
    var half = U.subRect({ left: 0, top: 0, width: 88, height: 85 }, [30, 4, 176, 170], [38, 24, 160, 148]);
    eq([half.left, half.top, half.width, half.height], [4, 10, 80, 74]);
    eq(U.outer({ left: 10.4, top: 20.6, width: 30.2, height: 40.1 }), [10, 20, 31, 41]);
    eq(U.outer({ left: 0, top: 0, width: 340, height: 600 }), [0, 0, 340, 600]);
  });

  test('layouts: layoutBox ignores its own transform and counts ancestor borders', function () {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:30px;top:40px;width:200px;height:100px;border:3px solid #000';
    host.innerHTML = '<div style="position:absolute;left:10px;top:20px;width:50px;height:30px;transform:translateY(6px) scale(.5)"></div>';
    document.body.appendChild(host);
    try {
      var b = U.layoutBox(host.firstChild);
      eq([b.left, b.top, b.width, b.height], [43, 63, 50, 30]);
      var r = host.firstChild.getBoundingClientRect();
      ok(r.width < 50, 'getBoundingClientRect would have shrunk it');
    } finally { host.remove(); }
  });

  // CPU: animating background-position repainted the U7 tag (money text and its outline shadows) every frame,
  // 2.50 % -> 1.63 % of the machine with U7 shown. The stripes must move by transform on their own layer.
  test('layouts: progress stripes move by transform on ::before, not by repainting the bar', function () {
    var host = document.createElement('div');
    host.innerHTML = '<div class="thin"><div class="fill" style="width:50%"></div></div>';
    document.body.appendChild(host);
    try {
      var fill = host.querySelector('.fill');
      eq(getComputedStyle(fill).animationName, 'none', 'the bar itself does not animate');
      var before = getComputedStyle(fill, '::before');
      eq(before.animationName, 'stripes');
      eq(before.willChange, 'transform');
      eq(getComputedStyle(fill).overflow, 'hidden');
    } finally { host.remove(); }
  });

  // ---------- DOM + app ----------
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
  // o: {first, seed, session, settings (top-level keys), start (null: not started), rec (today's record keys),
  //     care: also start QJZ.care on the same bridge and clock (no heartbeat), pomo: history.pomodoro}
  function mk(nowMs, o) {
    o = o || {};
    QJZ.care._reset();
    QJZ.layouts._reset();
    QJZ.app._reset();
    var sent = [], handlers = {}, clock = { ms: nowMs };
    var bridge = {
      send: function (t, p) { sent.push({ type: t, p: p }); },
      on: function (t, f) {
        (handlers[t] = handlers[t] || []).push(f);
        return function () { var l = handlers[t], i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
      },
      emit: function (m) { (handlers[m.type] || []).slice().forEach(function (f) { f(m); }); }
    };
    var root = fixture();
    QJZ.layouts.start(root, { bridge: bridge, first: o.first, seed: o.seed, session: o.session });
    if (o.care) QJZ.care.start({ bridge: bridge, now: function () { return clock.ms; }, heartbeat: false });
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    var settings = JSON.parse(JSON.stringify(SETTINGS));
    for (var k in (o.settings || {})) settings[k] = o.settings[k];
    var day = QJZ.time.dayKey(nowMs), h = { version: 1, days: {} };
    if (o.start !== null) {
      var rec = QJZ.day.manualStart(QJZ.day.empty(day), o.start === undefined ? at(12, 9, 0) : o.start);
      for (var x in (o.rec || {})) rec[x] = o.rec[x];
      h.days[day] = rec;
    }
    if (o.pomo) h.pomodoro = o.pomo;
    bridge.emit({ type: 'init', settings: JSON.stringify(settings), history: JSON.stringify(h), probeMs: null, nowMs: nowMs, version: 't' });
    return { bridge: bridge, sent: sent, clock: clock, root: root,
      menu: function (a) { bridge.emit({ type: 'menu', action: a }); },
      tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  function done() { QJZ.care._reset(); QJZ.layouts._reset(); QJZ.app._reset(); }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }); }
  function last(sent, type) { var l = of(sent, type); return l.length ? l[l.length - 1].p : null; }
  function types(sent) { return sent.map(function (s) { return s.type; }); }
  function $(e, sel) { return e.root.querySelector(sel); }
  function all(el) { return [el].concat(Array.prototype.slice.call(el.querySelectorAll('*'))); }
  function text(e, sel) { var n = $(e, sel); return n ? n.textContent : null; }
  function mouse(el, type, x, y, extra) {
    var o = { bubbles: true, cancelable: true, button: 0, buttons: 1, screenX: x || 0, screenY: y || 0, clientX: x || 0, clientY: y || 0 };
    for (var k in (extra || {})) o[k] = extra[k];
    var ev = new MouseEvent(type, o);
    el.dispatchEvent(ev);
    return ev;
  }

  test('layouts DOM: init shows the last used layout (none yet: U1) at once with setLayout, hitRects, setTopmost', function () {
    var e = mk(at(12, 10, 0));
    eq(QJZ.layouts.current(), 'U1');
    eq(types(e.sent).filter(function (t) { return /^set|^hit/.test(t); }).slice(0, 3), ['setLayout', 'hitRects', 'setTopmost'],
      'sent synchronously while handling init (no rAF)');
    var sl = last(e.sent, 'setLayout');
    eq(sl.layout, 'U1');
    eq(sl.width, 347, '340 + the 7px shadow');
    ok(sl.height > 500, 'height ' + sl.height);
    eq(sl.dpr, window.devicePixelRatio);
    var hr = last(e.sent, 'hitRects');
    eq(hr.rects, [[0, 0, 340, sl.height - 7]], 'the window body, not its shadow');
    eq(hr.dpr, window.devicePixelRatio);
    eq(last(e.sent, 'setTopmost'), { on: false });
    eq(text(e, '[data-b=status]'), '上班中');
    eq(text(e, '[data-b=clock]'), '10:00:00');
    eq($(e, '[data-odo]').getAttribute('aria-label'), '284.09');
    eq(text(e, '[data-b=snack]'), '🌻×2');
    eq($(e, '[data-bolts]').children.length, 5);
    ok($(e, '.lay').classList.contains('s-working'));
    ok($(e, '[data-pet] svg.st-typing'), 'typing pet in the room');
    done();
  });

  test('layouts DOM: a failing pet render still sizes and shows the window', function () {
    var orig = QJZ.pets.compose, oe = console.error;
    QJZ.pets.compose = function () { throw new Error('boom'); };
    console.error = function () {};
    try {
      var e = mk(at(12, 10, 0));
      eq(last(e.sent, 'setLayout').layout, 'U1');
      eq(text(e, '[data-b=status]'), '上班中');
    } finally { QJZ.pets.compose = orig; console.error = oe; done(); }
  });

  test('layouts DOM: ?layout / opts.first overrides the start layout', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' });
    eq(QJZ.layouts.current(), 'U7');
    eq(last(e.sent, 'setLayout').layout, 'U7');
    done();
  });

  test('layouts DOM: status text and pet state follow the clock (12:30 lunch, 18:00 done)', function () {
    var e = mk(at(12, 12, 30));
    eq(text(e, '[data-b=status]'), '午休中');
    var holder = $(e, '[data-pet]');
    ok(holder.querySelector('svg.st-lunchSleep'), 'lunch: ' + petState(e));
    e.tick(at(12, 18, 0));
    eq(text(e, '[data-b=status]'), '可以下班');
    ok($(e, '[data-pet] svg.st-celebrate'), 'done: ' + petState(e));
    done();
    var f = mk(at(12, 10, 0));
    var h = $(f, '[data-pet]'), svg1 = h.firstElementChild;
    f.tick(at(12, 10, 0, 5));
    eq(h.firstElementChild, svg1, 'same state: the SVG is not recomposed');
    f.tick(at(12, 12, 10));
    eq($(f, '[data-pet]'), h, 'the holder node stays');
    ok(h.firstElementChild !== svg1 && h.firstElementChild.classList.contains('st-lunchSleep'), 'the SVG is swapped on a state change: ' + petState(f));
    done();
  });

  test('layouts DOM: second ticks update text from the wall clock', function () {
    var e = mk(at(12, 10, 0));
    e.tick(at(12, 11, 0, 0));
    eq(text(e, '[data-b=clock]'), '11:00:00');
    eq(text(e, '[data-b=remain]'), '06:00:00');
    eq($(e, '[data-odo]').getAttribute('aria-label'), '568.18');
    ok($(e, '[data-plus] .plus'), '+0.08 floats');
    done();
  });

  // Simplification #1 / #4: U1 drops the date and 已上班; time and status share the top row; the rate line has no salary.
  test('layouts DOM: U1 has time and status in one row, two cards (可以買, 本月累計), 心情 / 體力 / 餵食 in their own row', function () {
    var e = mk(at(12, 10, 0)), u1 = $(e, '.u1');
    eq([$(e, '[data-b=date]'), $(e, '.date'), $(e, '[data-b=worked]')], [null, null, null], 'no date, no 已上班');
    var top = $(e, '.row-top'), clock = $(e, '[data-b=clock]'), pill = $(e, '.status');
    ok(top.contains(clock) && top.contains(pill), 'the clock and the status pill in one row');
    var cr = clock.getBoundingClientRect(), pr = pill.getBoundingClientRect();
    ok(Math.abs((cr.top + cr.bottom) / 2 - (pr.top + pr.bottom) / 2) <= 2, 'side by side, centred: ' + cr.top + '/' + pr.top);
    var chips = e.root.querySelectorAll('.chips .chip');
    eq(chips.length, 2);
    eq(chips[0].querySelector('small').textContent.indexOf('可以買'), 0);
    eq(chips[1].querySelector('small').textContent, '本月累計');
    eq(text(e, '[data-b=month]'), '284.09');
    ok(Math.abs(chips[0].getBoundingClientRect().width - chips[1].getBoundingClientRect().width) < 1, 'two equal cards');
    var v = $(e, '.vitals');
    ok(v && v.querySelector('.hearts') && v.querySelector('[data-bolts]') && v.querySelector('[data-feed]'), '心情, 體力 and 餵食 in their own row');
    ok(!$(e, '.scene-wrap').contains(v), 'not in the room');
    eq(text(e, '[data-b=rate]'), '每秒 +NT$ 0.079');
    // no gap below the last row: the window ends 16 px (the body padding) under the vitals row
    var sl = last(e.sent, 'setLayout'), body = $(e, '.u1 .body').getBoundingClientRect();
    eq(sl.height, Math.ceil(u1.getBoundingClientRect().bottom) + 7);
    ok(Math.abs(body.bottom - v.getBoundingClientRect().bottom - 16) <= 1, 'the body ends at the vitals row');
    // 1.1: the 番茄鐘 pill under the 每秒 line always shows (§4.4, §4.9 #8); its row adds its height and its 8 px margin
    var pills = $(e, '.u1 .mpills').getBoundingClientRect().height;
    ok(pills > 0 && sl.height <= 582 + Math.ceil(pills) + 8, '16 px shorter than with the date row (596), plus the pill row: ' + sl.height);
    done();
  });

  test('layouts DOM: U3 has one card on the right, 可以買 and 本月累計 in turn; no 已上班; the clock stays', function () {
    var e = mk(at(12, 10, 0), { first: 'U3' });
    var side = $(e, '.u3 .side');
    eq(side.querySelectorAll('.pill').length, 1, 'one card');
    eq($(e, '[data-b=worked]'), null);
    ok(side.textContent.indexOf('⏱') < 0, 'no 已上班');
    eq(text(e, '[data-b=clock]'), '10:00:00');
    var seen = {};
    for (var s = 0; s <= 40; s += 10) {
      e.tick(at(12, 10, 0, s));
      var t = text(e, '[data-b=card]'), dots = side.querySelectorAll('.alt-dots i'), month = t.indexOf('📅') === 0;
      seen[month ? 'month' : 'buy'] = true;
      eq(dots.length, 2);
      eq([dots[0].classList.contains('on'), dots[1].classList.contains('on')], [!month, month], 'the dots show which one: ' + t);
    }
    ok(seen.month && seen.buy, 'both show within 40 s');
    done();
  });

  test('layouts DOM: no layout shows the salary (月薪 / 時薪 / ÷ / the amount)', function () {
    ['U1', 'U3', 'U5B', 'U7', 'M3'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name }), t = e.root.textContent;
      ok(t.indexOf('月薪') < 0 && t.indexOf('時薪') < 0 && t.indexOf('÷') < 0 && t.indexOf('50,000') < 0 && t.indexOf('50000') < 0, name + ': ' + t);
      done();
    });
  });

  test('layouts DOM: M3 is temporary; current keeps the main layout; double-click goes back', function () {
    var e = mk(at(12, 10, 0));
    e.menu('layout:U3');
    eq(QJZ.layouts.current(), 'U3');
    eq(QJZ.app.state.settings.layout.current, 'U3');
    eq(last(e.sent, 'setLayout').width, 507);
    e.menu('mini');
    eq(QJZ.layouts.current(), 'M3');
    eq(QJZ.app.state.settings.layout.current, 'U3', 'M3 is never stored');
    eq(last(e.sent, 'setLayout').layout, 'M3');
    eq(last(e.sent, 'setTopmost'), { on: true }, 'M3 floats on top by default');
    eq(last(e.sent, 'hitRects').rects.length, QJZ.layouts.util.DISC_BANDS + 2, 'the ring as bands along the disc, money tag, status line');
    eq(text(e, '[data-b=m3sub]'), '上班中 · 還有 07:00:00');
    mouse($(e, '.ring'), 'dblclick');
    eq(QJZ.layouts.current(), 'U3');
    QJZ.app.flush();
    var saved = JSON.parse(last(e.sent, 'saveSettings').text);
    eq(saved.layout.current, 'U3');
    done();
  });

  test('layouts DOM: U7 hit rects are tight (tag + pet), hover tools join them, bubbles never do', function () {
    var e = mk(at(12, 10, 0));
    e.menu('layout:U7');
    QJZ.layouts._bands.flush();   // the pet's bands are measured while the page is idle
    var sl = last(e.sent, 'setLayout'), rects = last(e.sent, 'hitRects').rects;
    eq(sl.layout, 'U7');
    eq(last(e.sent, 'setTopmost'), { on: true });
    ok(rects.length >= 3 && rects.length <= 16, 'the tag and the pet as a few bands along its shape: ' + rects.length);
    var area = 0, n0 = rects.length;
    rects.forEach(function (r) {
      area += r[2] * r[3];
      ok(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= sl.width && r[1] + r[3] <= sl.height, 'inside the window: ' + r);
    });
    ok(area < sl.width * sl.height * 0.7, 'not the whole window');
    var n = of(e.sent, 'hitRects').length;
    mouse($(e, '.mtag'), 'mouseover');
    ok($(e, '.dpet').classList.contains('hover'));
    eq(of(e.sent, 'hitRects').length, n + 1);
    eq(last(e.sent, 'hitRects').rects.length, n0 + 1, '+ the ⚙ ✕ tools');
    QJZ.layouts.say('吱！');
    ok($(e, '[data-bubble]').classList.contains('show'));
    eq(last(e.sent, 'hitRects').rects.length, n0 + 1, 'a bubble is not interactive: it never joins the hit rects');
    done();
  });

  // ---------- the speech bubble beside the pet's head ----------
  test('layouts: vbPoint maps a viewBox point into the box that shows it (meet / slice)', function () {
    var PO = U.PETONLY_VB;
    eq(U.vbPoint({ width: 176, height: 170 }, PO, [118, 98], false), { x: 88, y: 94 });
    eq(U.vbPoint({ width: 352, height: 340 }, PO, [118, 98], false), { x: 176, y: 188 }, 'twice the size');
    eq(U.vbPoint({ width: 400, height: 170 }, PO, [30, 4], false), { x: 112, y: 0 }, 'meet: centred in a wider box');
    eq(U.vbPoint({ width: 300, height: 400 }, [0, 0, 300, 200], [150, 100], true), { x: 150, y: 200 }, 'slice: fills a taller box');
    eq(U.vbPoint({ width: 300, height: 400 }, [0, 0, 300, 200], [0, 0], true), { x: -150, y: 0 }, 'slice crops the sides');
    eq(U.VIEWBOX, { petonly: [30, 4, 176, 170], scene: [0, 0, 300, 200], hud: [0, -4, 300, 236] });
  });

  var SKINS = ['hamster:p0', 'hamster:p4', 'hamster:h2', 'hamster:s4', 'hamster:s5', 'cat:p0', 'cat:p4', 'cat:h2', 'cat:s4', 'cat:s5'];
  var MID = '你今天很努力喔，金金都有看到吱！', LONG = '今天賺到兩杯珍奶，回家路上犒賞自己一下吧吱！';
  function petOf(id) { var k = id.split(':'); return { settings: { pet: { kind: k[0], skin: k[1] } } }; }
  // say a line and show all of it at once (say types it in, 55 ms a character)
  function speak(e, text) {
    var b = $(e, '[data-bubble]');
    QJZ.layouts.say(text, 600000);
    b.textContent = text;
    return b;
  }
  function lines(b) {
    var cs = getComputedStyle(b);
    return Math.round((b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight));
  }
  // the tail's end (--tx / --ty) in page px
  function tail(b) {
    var f = b.offsetParent.getBoundingClientRect();
    return { x: f.left + parseFloat(b.style.getPropertyValue('--tx')), y: f.top + parseFloat(b.style.getPropertyValue('--ty')) };
  }
  // the bubble's layout box in page px (getBoundingClientRect would include its pop-in transition)
  function boxOf(b) {
    var f = b.offsetParent.getBoundingClientRect(), x = f.left + b.offsetLeft, y = f.top + b.offsetTop;
    return { left: x, top: y, right: x + b.offsetWidth, bottom: y + b.offsetHeight };
  }
  function headOf(e) { return $(e, '[data-pet] svg').querySelector('.head, .squish').getBoundingClientRect(); }
  function apart(a, b) { return a.right + 3 <= b.left || b.right + 3 <= a.left || a.bottom + 3 <= b.top || b.bottom + 3 <= a.top; }

  test('layouts DOM: U7 speaks beside the pet head — every skin, tail at the face, in the window, clear of the tag, 2–3 lines', function () {
    SKINS.forEach(function (id) {
      var e = mk(at(12, 10, 0), { first: 'U7', settings: petOf(id).settings });
      var win = $(e, '.u7').getBoundingClientRect(), sl = last(e.sent, 'setLayout');
      eq([sl.width, Math.round(win.width) + 7], [327, 327], id + ' the window: 320 + the shadow');
      var b = speak(e, MID), r = boxOf(b), t = tail(b), h = headOf(e);
      ok(b.classList.contains('side'), id + ' beside the pet');
      ok(t.x > h.left + h.width * 0.7 && t.x <= h.right + 1, id + ' tail end on the right of the head: ' + t.x + ' in ' + h.left + '..' + h.right);
      ok(t.y > h.top + h.height * 0.25 && t.y < h.bottom - h.height * 0.15, id + ' tail end at eye height: ' + t.y + ' in ' + h.top + '..' + h.bottom);
      near(r.left - t.x, 8, 1, id + ' the bubble starts just right of it');
      near(r.bottom - t.y, 17, 1, id + ' the tail is low on its left side');
      eq(lines(b), 2, id + ' 16 characters: two lines');
      ok(r.left >= win.left && r.top >= win.top && r.right + 2 <= win.right && r.bottom + 2 <= win.bottom, id + ' inside the window');
      ok(apart(r, $(e, '.mtag').getBoundingClientRect()), id + ' clear of the money tag');
      r = boxOf(speak(e, LONG));
      eq(lines(b), 3, id + ' 22 characters: three lines');
      ok(r.top >= win.top && r.right + 2 <= win.right, id + ' long line inside the window');
      ok(apart(r, $(e, '.mtag').getBoundingClientRect()), id + ' long line clear of the money tag');
      eq(getComputedStyle(b).pointerEvents, 'none', id + ' takes no clicks');
      done();
    });
  });

  test('layouts DOM: U1 and U3 speak beside the head too, inside the room; U3 stays under its side pills', function () {
    SKINS.forEach(function (id) {
      ['U1', 'U3'].forEach(function (name) {
        var e = mk(at(12, 10, 0), { first: name, settings: petOf(id).settings }), at2 = id + ' ' + name + ': ';
        var b = speak(e, MID), box = b.offsetParent.getBoundingClientRect(), t = tail(b), h = headOf(e);
        ok(b.classList.contains('side'), at2 + 'beside the pet');
        ok(t.x > h.left + h.width * 0.7 && t.x <= h.right + 1, at2 + 'tail end on the right of the head');
        ok(t.y > h.top + h.height * 0.25 && t.y < h.bottom - h.height * 0.15, at2 + 'tail end at eye height');
        eq(lines(b), 2, at2 + '16 characters: two lines');
        var r = boxOf(speak(e, LONG));
        ok(lines(b) <= 3, at2 + '22 characters: at most three lines');
        ok(r.left > t.x && r.left >= box.left && r.top >= box.top && r.right + 2 <= box.right && r.bottom + 2 <= box.bottom, at2 + 'inside the room');
        if (name === 'U3') {
          ok(r.top >= $(e, '.side').getBoundingClientRect().bottom + 3, at2 + 'under the side pills');
          ok(apart(r, $(e, '.hud-bottom').getBoundingClientRect()), at2 + 'clear of the money box');
        }
        done();
      });
    });
  });

  test('layouts DOM: a bubble that shows follows the head when the pose changes (U7 dangle and back)', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), b = speak(e, '吱！'), y0 = tail(b).y, pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    ok(b.classList.contains('show') && tail(b).y < y0 - 5, 'up with the lifted head: ' + tail(b).y + ' < ' + y0);
    e.bridge.emit({ type: 'dragEnd' });
    eq(petState(e), 'typing');
    ok(b.classList.contains('show'), 'still talking');
    eq(tail(b).y, y0, 'back down');
    done();
  });

  test('layouts DOM: without a drawn pet the bubble keeps its plain corner place', function () {
    var orig = QJZ.pets.compose, oe = console.error;
    QJZ.pets.compose = function () { throw new Error('boom'); };
    console.error = function () {};
    try {
      var e = mk(at(12, 10, 0), { first: 'U7' }), b = speak(e, '吱！');
      ok(b.classList.contains('show') && !b.classList.contains('side'), 'shown, not beside a pet');
      eq(U.anchorBubble(null, null, 'petonly', 'hamster:p0', 'typing'), null);
    } finally { QJZ.pets.compose = orig; console.error = oe; done(); }
  });

  test('layouts DOM: speech bubbles take no clicks in any layout (pointer-events none, no data-hit)', function () {
    ['U1', 'U3', 'U7'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name });
      var b = $(e, '[data-bubble]');
      ok(b, name + ' has a bubble');
      QJZ.layouts.say('吱！');
      eq(getComputedStyle(b).pointerEvents, 'none', name);
      ok(!b.hasAttribute('data-hit'), name + ': not a hit rect of its own');
      done();
    });
  });

  test('layouts DOM: panels are temporary and go back to where they came from', function () {
    var e = mk(at(12, 10, 0));
    e.menu('layout:U5B');
    e.menu('settings');
    eq(QJZ.layouts.current(), 'PANEL');
    eq(last(e.sent, 'setLayout').layout, 'PANEL');
    eq(QJZ.app.state.settings.layout.current, 'U5B');
    eq(text(e, '.ptitle'), '設定');
    eq(text(e, '[data-b=title]'), '錢進中 · 設定');
    e.menu('history');
    eq(text(e, '.ptitle'), '紀錄');
    e.menu('adjust');
    eq(text(e, '.ptitle'), '設定');
    ok(text(e, '[data-o=todayStart]').indexOf('09:00') >= 0, 'opens 起算 with today\'s start');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U5B');
    e.menu('mini');
    e.menu('settings');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'M3', 'back to the mini badge it was opened from');
    done();
  });

  test('layouts DOM: topmost toggles per layout and is saved', function () {
    var e = mk(at(12, 10, 0));
    e.menu('topmost');
    eq(last(e.sent, 'setTopmost'), { on: true });
    eq(QJZ.app.state.settings.layout.topmost.U1, true);
    e.menu('layout:U3');
    eq(last(e.sent, 'setTopmost'), { on: false });
    e.menu('layout:U1');
    eq(last(e.sent, 'setTopmost'), { on: true }, 'U1 remembers');
    done();
  });

  test('layouts DOM: the menu\'s topmost while a panel shows is the setting of the layout it came from', function () {
    var e = mk(at(12, 10, 0), { settings: { layout: { current: 'U3' } } });
    e.menu('settings');
    eq(last(e.sent, 'setTopmost'), { on: false });
    e.menu('topmost');
    eq(QJZ.app.state.settings.layout.topmost.U3, true);
    eq(last(e.sent, 'setTopmost'), { on: true }, 'the panel floats now too');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U3');
    eq(last(e.sent, 'setTopmost'), { on: true });
    eq([QJZ.app.state.settings.layout.topmost.U1, QJZ.app.state.settings.layout.topmost.U7], [false, true], 'the others keep their defaults');
    done();
  });

  test('layouts DOM: unknown or malformed messages are ignored', function () {
    var e = mk(at(12, 10, 0));
    var n = e.sent.length;
    e.menu('bogus');
    e.menu('layout:M3');
    e.menu('layout:PANEL');
    e.menu('toggleVisible');
    e.bridge.emit({ type: 'menu' });
    e.bridge.emit({ type: 'menu', action: 42 });
    e.bridge.emit({ type: 'dragEnd' });
    e.bridge.emit({ type: 'whatever', x: 1 });
    eq(e.sent.length, n);
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('layouts DOM: menu quit saves and answers quit', function () {
    var e = mk(at(12, 10, 0));
    e.menu('layout:U3');
    e.menu('quit');
    var t = types(e.sent);
    eq(t[t.length - 1], 'quit');
    ok(t.lastIndexOf('saveSettings') > 0 && t.lastIndexOf('saveSettings') < t.length - 1);
    done();
  });

  test('layouts DOM: drag starts after a small move from a non-button area, right-click opens the menu', function () {
    var e = mk(at(12, 10, 0));
    var bar = $(e, '.bar');
    mouse(bar, 'mousedown', 100, 100);
    mouse(bar, 'mousemove', 102, 100);
    eq(of(e.sent, 'dragStart').length, 0, 'a click is not a drag');
    mouse(bar, 'mousemove', 106, 100);
    mouse(bar, 'mousemove', 120, 100);
    eq(of(e.sent, 'dragStart').length, 1);
    mouse(bar, 'mouseup', 120, 100, { buttons: 0 });
    var feed = $(e, '[data-act=feed]');
    mouse(feed, 'mousedown', 10, 10);
    mouse(feed, 'mousemove', 40, 10);
    eq(of(e.sent, 'dragStart').length, 1, 'buttons never drag');
    mouse($(e, '[data-act=mini]'), 'mousedown', 10, 10);
    mouse($(e, '[data-act=mini]'), 'mousemove', 40, 10);
    eq(of(e.sent, 'dragStart').length, 1, 'nor do the title-bar dots');
    var ev = mouse($(e, '.clock'), 'contextmenu', 5, 5, { button: 2 });
    eq(of(e.sent, 'contextMenu').length, 1);
    ok(ev.defaultPrevented);
    done();
  });

  test('layouts DOM: buttons — dots, ⋯, feed', function () {
    var e = mk(at(12, 10, 0));
    $(e, '[data-act=hide]').click();
    eq(of(e.sent, 'hide').length, 1);
    $(e, '[data-act=mini]').click();
    eq(QJZ.layouts.current(), 'M3');
    e.menu('layout:U5B');
    $(e, '[data-act=menu]').click();
    eq(of(e.sent, 'contextMenu').length, 1);
    $(e, '[data-act=feed]').click();
    eq(QJZ.app.state.today.snacksEaten, 1);
    eq(QJZ.app.state.snacks, 1);
    eq(text(e, '[data-b=snack]'), '🌻×1');
    e.menu('feed');
    e.menu('feed');
    eq(QJZ.app.state.today.snacksEaten, 2, 'no snack left: nothing eaten');
    ok($(e, '[data-feed]').classList.contains('none'));
    done();
  });

  test('layouts DOM: start / end from the menu', function () {
    var e = mk(at(12, 10, 0), { start: null, settings: { startMode: 'manual' } });
    eq(text(e, '[data-b=status]'), '還沒上班');
    e.menu('end');
    eq(QJZ.app.state.today.endMs, null, 'nothing to end yet');
    e.menu('start');
    eq(QJZ.app.state.today.startMs, at(12, 10, 0));
    e.tick(at(12, 11, 0));
    e.menu('start');
    eq(QJZ.app.state.today.startMs, at(12, 10, 0), 'a second start keeps the first');
    e.menu('end');
    eq(QJZ.app.state.today.endMs, at(12, 11, 0));
    eq(text(e, '[data-b=status]'), '已下班');
    done();
  });

  // #2: the menu's one work item (開始上班 / 下班 / 繼續上班) and 餵食's snack count follow the page: menuState
  // {work: 'before' | 'working' | 'ended', snacks}, sent when either changes.
  test('layouts DOM: menuState tells the host the work status and the snacks, when they change', function () {
    var e = mk(at(12, 10, 0), { start: null, settings: { startMode: 'manual' } });
    function states() { return of(e.sent, 'menuState').map(function (m) { return m.p.work + ' ' + m.p.snacks; }); }
    eq(states(), ['before 0'], 'with the first layout');
    e.tick(at(12, 10, 0, 1));
    e.tick(at(12, 10, 0, 2));
    eq(states().length, 1, 'nothing new: nothing sent');
    e.menu('start');
    eq(states(), ['before 0', 'working 0']);
    e.tick(at(12, 10, 21, 8));   // NT$100 at 10:21:07.2
    eq(states().slice(-1), ['working 1'], 'a new snack');
    e.menu('feed');
    eq(states().slice(-1), ['working 0'], 'eaten');
    e.tick(at(12, 12, 30));
    var n = QJZ.app.state.snacks;
    ok(n > 1, 'more snacks by now: ' + n);
    eq(states().slice(-1), ['working ' + n], 'lunch is still the day (下班 ends it)');
    e.menu('end');
    eq(states().slice(-1), ['ended ' + n], '下班 -> the item reads 繼續上班');
    e.menu('start');
    eq(states().slice(-1), ['working ' + n], '繼續上班 continues');
    var k = states().length;
    e.menu('layout:U7');
    eq(states().length, k, 'a layout switch sends nothing new');
    QJZ.app.setOffDay(true);
    eq(states().slice(-1), ['before 0'], 'a day off: 開始上班');
    done();
    var f = mk(at(12, 19, 0));
    eq(of(f.sent, 'menuState').slice(-1)[0].p.work, 'working', '可以下班: 下班 still ends the day');
    done();
  });

  // Review M-3: while the window is hidden the page does not tick, so the menu could lag (a new day, new snacks). The
  // host sends menuOpening when the menu opens: the page catches up from the wall clock and answers at once.
  test('layouts DOM: menuOpening while hidden brings the menu up to date (a new day, the snacks earned meanwhile)', function () {
    var e = mk(at(12, 10, 0));
    function lastState() { var m = last(e.sent, 'menuState'); return m.work + ' ' + m.snacks; }
    eq(lastState(), 'working 2');
    e.bridge.emit({ type: 'visibility', visible: false });
    e.clock.ms = at(12, 11, 0);
    eq(lastState(), 'working 2', 'hidden: no tick, nothing new');
    e.bridge.emit({ type: 'menuOpening' });
    eq(lastState(), 'working ' + QJZ.app.state.snacks);
    ok(QJZ.app.state.snacks > 2, 'snacks earned while hidden: ' + QJZ.app.state.snacks);
    e.menu('end');
    eq(lastState().indexOf('ended '), 0, '下班 -> 繼續上班');
    e.clock.ms = at(13, 9, 0);   // the next morning, still hidden, never locked
    e.bridge.emit({ type: 'menuOpening' });
    eq(QJZ.app.state.today.day, '2026-11-13', 'the day rolled over');
    eq(lastState(), 'before 0', 'a new day: 開始上班, no snacks yet');
    var n = of(e.sent, 'menuState').length;
    e.bridge.emit({ type: 'menuOpening' });
    eq(of(e.sent, 'menuState').length, n, 'nothing changed: nothing sent');
    done();
  });

  test('layouts DOM: 開始上班 after 下班 continues the day (繼續上班)', function () {
    var e = mk(at(12, 10, 0));
    e.menu('end');
    eq(QJZ.app.state.today.endMs, at(12, 10, 0));
    eq(text(e, '[data-b=status]'), '已下班');
    e.tick(at(12, 11, 0));
    e.menu('start');
    eq([QJZ.app.state.today.endMs, QJZ.app.state.today.startMs], [null, at(12, 9, 0)], 'the end is gone, the start kept');
    eq(text(e, '[data-b=status]'), '上班中');
    eq($(e, '[data-odo]').getAttribute('aria-label'), '568.18', 'the time in between counts');
    ok($(e, '[data-bubble]').classList.contains('show'), 'it says so');
    e.menu('start');
    eq(QJZ.app.state.today.startMs, at(12, 9, 0), 'a second 開始上班 changes nothing');
    done();
  });

  test('layouts DOM: 今天休假 zeroes a started day (休假日); 開始上班 on an off day starts now', function () {
    var e = mk(at(12, 10, 0));
    QJZ.app.setOffDay(true);
    eq(text(e, '[data-b=status]'), '休假日');
    ok($(e, '.lay').classList.contains('s-off'));
    eq($(e, '[data-odo]').getAttribute('aria-label'), '0.00');
    e.menu('end');
    eq(QJZ.app.state.today.endMs, null, 'nothing to end on a holiday');
    e.tick(at(12, 11, 0));
    e.menu('start');
    eq([QJZ.app.state.today.offDay, QJZ.app.state.today.startMs], [false, at(12, 11, 0)]);
    eq(text(e, '[data-b=status]'), '上班中');
    done();
  });

  test('layouts DOM: U7 runs no perpetual decorative loop (only the pet moves)', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' });
    var loops = [];
    all(e.root.querySelector('.u7')).forEach(function (el) {
      if (el.closest('[data-pet]')) return;
      [null, '::before', '::after'].forEach(function (pseudo) {
        var cs = getComputedStyle(el, pseudo);
        if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') loops.push(el.className + (pseudo || '') + ' ' + cs.animationName);
      });
    });
    eq(loops, []);
    ok($(e, '.u7 .fill'), 'the progress bar is still there');
    done();
    var u1 = mk(at(12, 10, 0));
    eq(getComputedStyle($(u1, '.u1 .fill'), '::before').animationName, 'stripes', 'U1 keeps its moving stripes');
    done();
  });

  // #12: a new start shows the layout used last (layout.current; M3 when it was left as the mini badge, layout.mini);
  // 1.0's layout.start picker is gone and its key is no longer read.
  test('layouts DOM: a start shows the last used layout: layout.current, not the old layout.start', function () {
    var e = mk(at(12, 10, 0), { settings: { layout: { start: 'U7', current: 'U3' } } });
    eq(QJZ.layouts.current(), 'U3');
    eq(last(e.sent, 'setLayout').layout, 'U3');
    eq(last(e.sent, 'setTopmost'), { on: false }, 'U3 keeps its own topmost');
    done();
    var f = mk(at(12, 10, 0), { settings: { layout: { current: 'U7' } } });
    eq(QJZ.layouts.current(), 'U7');
    eq(last(f.sent, 'setTopmost'), { on: true });
    done();
  });

  test('layouts DOM: left as the mini badge, the next start is the mini badge; double-click goes back to the main layout', function () {
    var e = mk(at(12, 10, 0), { settings: { layout: { current: 'U5B' } } });
    e.menu('mini');
    eq(QJZ.app.state.settings.layout, { start: 'U1', current: 'U5B', topmost: QJZ.settings.DEFAULTS.layout.topmost, mini: true, capsule: 'top' });
    e.menu('settings');
    $(e, '[data-act=back]').click();
    eq(QJZ.app.state.settings.layout.mini, true, 'a panel opened from it changes nothing');
    QJZ.app.flush();
    var saved = JSON.parse(last(e.sent, 'saveSettings').text).layout;
    eq([saved.current, saved.mini], ['U5B', true], 'saved');
    done();
    var f = mk(at(12, 10, 0), { settings: { layout: saved } });   // the next start
    eq(QJZ.layouts.current(), 'M3');
    eq(last(f.sent, 'setLayout').layout, 'M3');
    eq(last(f.sent, 'setTopmost'), { on: true }, 'M3 floats on top by default');
    mouse($(f, '.ring'), 'dblclick');
    eq(QJZ.layouts.current(), 'U5B', 'back to the main layout');
    eq([QJZ.app.state.settings.layout.current, QJZ.app.state.settings.layout.mini], ['U5B', false]);
    done();
    var g = mk(at(12, 10, 0), { settings: { layout: { current: 'U7', mini: true } } });
    g.menu('layout:U1');
    eq([QJZ.app.state.settings.layout.current, QJZ.app.state.settings.layout.mini], ['U1', false], 'a main layout from the menu ends it too');
    done();
  });

  // Review M-1: in M3 the menu shows 「✓ 縮成迷你」; clicking it again goes back, as a double-click on the badge does.
  test('layouts DOM: 縮成迷你 from the menu is a toggle: in M3 it goes back to the main layout', function () {
    var e = mk(at(12, 10, 0), { settings: { layout: { current: 'U3' } } });
    e.menu('mini');
    eq([QJZ.layouts.current(), QJZ.app.state.settings.layout.mini], ['M3', true]);
    e.menu('mini');
    eq([QJZ.layouts.current(), QJZ.app.state.settings.layout.current, QJZ.app.state.settings.layout.mini], ['U3', 'U3', false], 'back, like a double-click');
    e.menu('mini');
    eq(QJZ.layouts.current(), 'M3', 'and down again');
    e.menu('settings');
    e.menu('mini');
    eq(QJZ.layouts.current(), 'M3', 'from a panel (opened from the badge) it is the badge');
    done();
  });

  // Review M-2: 1.0's 開啟時的版型 = 迷你徽章 (layout.start 'M3', no layout.mini) still opens the badge after the update.
  test('layouts DOM: a 1.0 start layout of M3 opens the mini badge; once the user goes back it is the last used layout again', function () {
    var e = mk(at(12, 10, 0), { settings: { layout: { start: 'M3', current: 'U3' } } });
    eq(QJZ.layouts.current(), 'M3');
    mouse($(e, '.ring'), 'dblclick');
    eq(QJZ.layouts.current(), 'U3');
    QJZ.app.flush();
    var saved = JSON.parse(last(e.sent, 'saveSettings').text).layout;
    eq([saved.start, saved.current, saved.mini], ['M3', 'U3', false], 'start kept as it was; mini is now there');
    done();
    mk(at(12, 10, 0), { settings: { layout: saved } });
    eq(QJZ.layouts.current(), 'U3', 'the next start: the layout used last');
    done();
  });

  test('layouts DOM: a reload (renderer crash) comes back to the layout it showed, not layout.start', function () {
    function store() {
      var m = {};
      return { getItem: function (k) { return m.hasOwnProperty(k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); },
        removeItem: function (k) { delete m[k]; } };
    }
    var s = store(), e = mk(at(12, 10, 0), { session: s });
    eq(QJZ.layouts.current(), 'U1');
    e.menu('layout:U7');
    e.menu('mini');
    e.menu('settings');
    eq(QJZ.layouts.current(), 'PANEL');
    mk(at(12, 10, 0), { session: s });   // the host reloads the page: same session storage
    eq(QJZ.layouts.current(), 'M3', 'back to the mini badge the panel came from');
    QJZ.layouts.show('U3');
    mk(at(12, 10, 0), { session: s });
    eq(QJZ.layouts.current(), 'U3');
    mk(at(12, 10, 0), { session: store() });   // a new start: a fresh session (and these tests' settings: none saved)
    eq(QJZ.layouts.current(), 'U1', 'the last used layout, none saved: U1');
    done();
  });

  test('layouts DOM: off day and weekend show 休假日', function () {
    var e = mk(at(14, 10, 0), { start: null });
    eq(text(e, '[data-b=status]'), '休假日');
    ok($(e, '.lay').classList.contains('s-off'));
    done();
  });

  test('layouts DOM: a milestone crossing throws confetti', function () {
    var e = mk(at(12, 10, 3));
    eq($(e, '.confetti'), null);
    e.tick(at(12, 10, 3, 21));
    eq($(e, '.confetti'), null, 'NT$300 falls at 10:03:21.6');
    e.tick(at(12, 10, 3, 22));
    ok(e.root.querySelectorAll('.confetti').length > 0);
    eq(QJZ.app.state.snacks, 3);
    ok($(e, '[data-pet] svg.st-hop'), 'milestone -> hop');
    done();
  });

  // ---------- Task 13: the behaviour engine in the layouts ----------
  // Replaces QJZ.sound's players with counters for the duration of fn.
  function sounds(fn) {
    var names = ['coin', 'meow', 'squeak', 'jingle'], orig = {}, n = {};
    names.forEach(function (k) { orig[k] = QJZ.sound[k]; n[k] = 0; QJZ.sound[k] = function () { n[k]++; return true; }; });
    try { fn(n); } finally { names.forEach(function (k) { QJZ.sound[k] = orig[k]; }); done(); }
  }
  // a painted part of the animal itself (compose's .pa, not a .prop), and a click on it at its centre
  function petPart(e) {
    var parts = e.root.querySelectorAll('[data-pet] .pa path, [data-pet] .pa ellipse, [data-pet] .pa circle');
    for (var i = 0; i < parts.length; i++) {
      var r = parts[i].getBoundingClientRect();
      if (!parts[i].closest('.prop') && parts[i].getAttribute('fill') !== 'none' && r.width > 20 && r.height > 20) return parts[i];
    }
    return null;
  }
  function clickOn(el) {
    var r = el.getBoundingClientRect();
    return mouse(el, 'click', r.left + r.width / 2, r.top + r.height / 2, { buttons: 0 });
  }
  function petState(e) {
    var svg = $(e, '[data-pet] svg');
    var m = svg && /\bst-(\w+)/.exec(svg.getAttribute('class'));
    return m ? m[1] : null;
  }
  function steps(e, fromMs, toMs, stepMs) {
    for (var t = fromMs; t <= toMs; t += stepMs || 1000) e.tick(t);
  }

  test('layouts DOM: RULING-3 lunch — lunchEat at 12:05, lunchSleep from 12:10', function () {
    var e = mk(at(12, 12, 5));
    eq(petState(e), 'lunchEat');
    e.tick(at(12, 12, 10));
    eq(petState(e), 'lunchSleep');
    done();
  });

  test('layouts DOM: sprint in the last 30 minutes; 可以下班 celebrates 8 s with one jingle, then waitBag', function () {
    sounds(function (n) {
      var e = mk(at(12, 17, 40));
      eq(petState(e), 'sprint');
      steps(e, at(12, 17, 59, 57), at(12, 18, 0, 0));
      eq(petState(e), 'celebrate');
      eq(n.jingle, 1, 'jingle on 可以下班 seen live');
      steps(e, at(12, 18, 0, 1), at(12, 18, 0, 7));
      eq(petState(e), 'celebrate');
      e.tick(at(12, 18, 0, 8));
      eq(petState(e), 'waitBag');
      eq(n.jingle, 1);
    });
  });

  test('layouts DOM: 可以下班 reached while hidden celebrates on re-show without the jingle', function () {
    sounds(function (n) {
      var e = mk(at(12, 17, 0));
      e.bridge.emit({ type: 'visibility', visible: false });
      e.clock.ms = at(12, 18, 30);
      e.bridge.emit({ type: 'visibility', visible: true });
      eq(petState(e), 'celebrate');
      eq(n.jingle, 0);
    });
  });

  test('layouts DOM: poking pets (sound, hearts, mood +5); five quick pokes make it angry (mood -5, no sound)', function () {
    sounds(function (n) {
      var e = mk(at(12, 10, 0));
      var m0 = QJZ.app.state.mood.mood;
      clickOn(petPart(e));
      eq(petState(e), 'petted');
      eq(n.squeak, 1, 'hamster squeaks');
      eq(n.meow, 0);
      ok(e.root.querySelectorAll('.heart').length > 0, 'hearts');
      near(QJZ.app.state.mood.mood, m0 + 5, 0.01);
      for (var i = 0; i < 4; i++) clickOn(petPart(e));
      eq(petState(e), 'angry');
      near(QJZ.app.state.mood.mood, m0 + 20 - 5, 0.01, 'four pets, then angry');
      eq(n.squeak, 4, 'no squeak when it gets angry');
      ok($(e, '[data-bubble]').classList.contains('show'), 'it says something');
      e.tick(at(12, 10, 0) + 4000);
      eq(petState(e), 'typing', 'calm after 4 s');
    });
  });

  test('layouts DOM: a cat meows when petted', function () {
    sounds(function (n) {
      var e = mk(at(12, 10, 0), { settings: { pet: { kind: 'cat', skin: 'p0' } } });
      clickOn(petPart(e));
      eq([n.meow, n.squeak], [1, 0]);
    });
  });

  test('layouts DOM: feeding eats a snack, plays eat when it lands and lifts the mood', function () {
    var e = mk(at(12, 10, 0));
    var m0 = QJZ.app.state.mood.mood;
    $(e, '[data-act=feed]').click();
    eq(QJZ.app.state.snacks, 1);
    near(QJZ.app.state.mood.mood, m0 + 15, 0.01);
    e.tick(at(12, 10, 0) + 1000);
    eq(petState(e), 'eat');
    e.tick(at(12, 10, 0) + 4000);
    eq(petState(e), 'typing');
    done();
  });

  test('layouts DOM: U7 dangles from dragStart until dragEnd; other layouts never dangle', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' });
    var pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(of(e.sent, 'dragStart').length, 1);
    ok(QJZ.layouts.dragging());
    eq(petState(e), 'dangle');
    e.tick(at(12, 10, 1));
    eq(petState(e), 'dangle', 'still held');
    e.bridge.emit({ type: 'dragEnd' });
    eq(petState(e), 'typing');
    ok(!QJZ.layouts.dragging());
    // released before the host's move loop started: the page sees the mouseup, and that click is not a poke
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    mouse(pet, 'mouseup', 110, 100, { buttons: 0 });
    mouse(pet, 'click', 110, 100, { buttons: 0 });
    eq(petState(e), 'typing');
    ok(!QJZ.layouts.dragging());
    done();
    var f = mk(at(12, 10, 0));
    mouse($(f, '.bar'), 'mousedown', 100, 100);
    mouse($(f, '.bar'), 'mousemove', 120, 100);
    eq(of(f.sent, 'dragStart').length, 1);
    eq(petState(f), 'typing', 'U1 is moved by its frame, the pet stays put');
    done();
  });

  test('layouts: the pet hit area covers hop and dangle as measured, inside the petonly viewBox, only while they play', function () {
    var U = QJZ.layouts.util, vb = U.PETONLY_VB;
    function edges(r) { return [r[0], r[1], r[0] + r[2], r[1] + r[3]]; }
    function covers(r, box) { var a = edges(r); return a[0] <= box[0] && a[1] <= box[1] && a[2] >= box[2] && a[3] >= box[3]; }
    eq(U.petHit('typing'), U.PET_HIT, 'base states keep the tight box');
    eq(U.petHit(undefined), U.PET_HIT);
    eq(U.petHit('toString'), U.PET_HIT, 'only its own keys');
    // T14 measurements (all 8 skins, whole animation, clipped to the viewBox 30..206 x 4..174; PET_HIT's bottom 172 kept)
    ok(covers(U.petHit('hop'), [34.6, 11.3, 203.6, 172]), 'hop: ' + U.petHit('hop'));
    ok(covers(U.petHit('dangle'), [30, 4, 206, 172]), 'dangle: ' + U.petHit('dangle'));
    ['hop', 'dangle'].forEach(function (s) {
      var r = U.petHit(s);
      ok(covers(r, edges(U.PET_HIT)), s + ' contains the base box');
      ok(covers(vb, edges(r)), s + ' stays inside the viewBox');
    });
    // N-1: a head that rises above the box (cat P0 13 units stretching or celebrating) may reach the viewBox top
    ['stretch', 'celebrate', 'waitBag', 'yawn'].forEach(function (s) {
      var r = U.petHit(s);
      ok(covers(r, edges(U.PET_HIT)) && r[1] <= 24 - 13 - 3, s + ' reaches above the base box: ' + r);
      ok(covers(vb, edges(r)), s + ' stays inside the viewBox');
      eq([r[0], r[0] + r[2], r[1] + r[3]], [U.PET_HIT[0], U.PET_HIT[0] + U.PET_HIT[2], U.PET_HIT[1] + U.PET_HIT[3]], s + ' only taller');
    });
  });

  // A skin that declares no 1.1 pose (cat P4's def as 'test:stub', kind 'test'), as in pets.test.js (Ruling M10).
  function stubSkin() {
    var src = QJZ.pets.get('cat:p4'), d = {};
    for (var k in src) if (k !== 'poses11') d[k] = src[k];
    d.id = 'test:stub'; d.kind = 'test'; d.skin = 'stub';
    QJZ.pets.register(d);
    return d.id;
  }

  test('layouts: hit box and bubble anchor follow the shown pose', function () {
    var U = QJZ.layouts.util, P = QJZ.pets, id = stubSkin();
    eq(P.poseFor(id, 'wave'), 'celebrate', 'the stub draws wave as celebrate');
    eq(U.petHit('wave', id), U.PET_HIT_TALL, 'celebrate\'s head rises above PET_HIT (PET_REACH)');
    eq(U.petHit('celebrate', id), U.PET_HIT_TALL);
    eq([U.petHit('focus', id), U.petHit('holdCup', id), U.petHit('sip', id)], [U.PET_HIT, U.PET_HIT, U.PET_HIT], 'typing and coffee');
    eq(U.petHit('dangle', id), U.petHit('dangle'), 'the other states as before');
    eq(U.bandKey(id, 'wave'), U.bandKey(id, 'celebrate'), 'celebrate\'s measured bands serve');
    eq(U.bandKey(id, 'focus'), U.bandKey(id, 'typing'));
    // the bubble points where it does for celebrate, even once a 'wave' state of its own (drawn elsewhere) exists
    var e = mk(at(12, 10, 0), { first: 'U7' }), b = $(e, '[data-bubble]'), pet = $(e, '[data-pet]'), S = P.states, get = S.get;
    try {
      S.get = function (n) { return n === 'wave' ? get('dangle') : get(n); };
      ok(String(P.speechAt(id, 'wave')) !== String(P.speechAt(id, 'celebrate')), 'its own wave would point elsewhere');
      var celebrate = U.anchorBubble(b, pet, 'petonly', id, 'celebrate', e.root);
      ok(celebrate, 'anchored');
      eq(U.anchorBubble(b, pet, 'petonly', id, 'wave', e.root), celebrate, 'the shown pose\'s anchor');
    } finally { S.get = get; done(); }
  });

  // Task 17's measurement (Rulings M11, M12): every skin's painted body, pet and desk, 0–8 s every 40 ms, in petonly
  // units. [x0, y0, x1]: wave's head rises 9.6 above PET_HIT (cat P0 14.4, cat S5 21.0), as celebrate's does; the rest
  // stay in it. The left edges (37.5 cat P4's wave paw, 37.6 cat P0 holding the cup) are the bounding-box overestimate
  // of a rotated paw, up to EDGE (typing, inside PET_HIT, measures 38.6); the painted-pixel scan below checks the real
  // pixels.
  test('layouts: the 1.1 poses\' hit boxes cover their motion', function () {
    var U = QJZ.layouts.util, P = QJZ.pets, EDGE = 0.5;
    var MEASURED = { wave: [37.5, 14.4, 192.9], holdCup: [37.6, 23.9, 192.9], sip: [40.2, 27.9, 192.9], focus: [38.4, 27.9, 192.9] };
    var BOX = { wave: U.PET_HIT_TALL, holdCup: U.PET_HIT, sip: U.PET_HIT, focus: U.PET_HIT };
    var skins = P.list('hamster').concat(P.list('cat'));
    eq(skins.length, 10);
    P.NEW_POSES.forEach(function (pose) {
      var r = BOX[pose], m = MEASURED[pose];
      ok(r[0] <= m[0] + EDGE && r[1] <= m[1] + EDGE && r[0] + r[2] >= m[2], pose + ': ' + r + ' covers ' + m);
      skins.forEach(function (d) {
        eq(P.poseFor(d.id, pose), pose, d.id + ' draws ' + pose + ' itself');
        eq(U.petHit(pose, d.id), r, d.id + ' ' + pose);
      });
    });
  });

  test('layouts DOM: U7 widens the pet hit rect at once while it dangles and narrows it again after dragEnd', function () {
    var U = QJZ.layouts.util, e = mk(at(12, 10, 0), { first: 'U7' });
    var box = $(e, '[data-hit=pet]').getBoundingClientRect();
    function petRect(state) { return JSON.stringify(U.outer(U.subRect(box, U.PETONLY_VB, U.petHit(state)))); }
    function has(rects, r) { return rects.map(function (x) { return JSON.stringify(x); }).indexOf(r) >= 0; }
    function inBox(r, state) { var b = JSON.parse(petRect(state)); return r[0] >= b[0] && r[1] >= b[1] && r[0] + r[2] <= b[0] + b[2] && r[1] + r[3] <= b[1] + b[3]; }
    function petBands(rects) { var tag = $(e, '.mtag').getBoundingClientRect(); return rects.filter(function (r) { return r[1] >= tag.bottom - 1; }); }
    QJZ.layouts._bands.flush();
    ok(petRect('dangle') !== petRect('typing'), 'a different box');
    var first = petBands(last(e.sent, 'hitRects').rects);
    ok(first.length >= 2 && first.every(function (r) { return inBox(r, 'typing'); }) && !has(first, petRect('typing')), 'bands along the pet, inside the tight box: ' + JSON.stringify(first));
    var n = of(e.sent, 'hitRects').length;
    var pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    ok(of(e.sent, 'hitRects').length > n, 'sent with the pose, not a second later');
    var held = last(e.sent, 'hitRects').rects;
    ok(has(held, petRect('dangle')) && !has(held, petRect('typing')), 'the dangle box: ' + JSON.stringify(held));
    e.bridge.emit({ type: 'dragEnd' });
    eq(petState(e), 'typing');
    var after = last(e.sent, 'hitRects').rects;
    ok(!has(after, petRect('dangle')) && petBands(after).every(function (r) { return inBox(r, 'typing'); }), 'back to the bands: ' + JSON.stringify(after));
    done();
  });

  // ---- 拎起來: U7 hangs from the cursor by the scruff tip of the lifted pose ----
  test('layouts DOM: U7 dragStart carries the lifted pet\'s scruff tip, which is the top of its painted shape, for every skin', function () {
    SKINS.forEach(function (id) {
      var e = mk(at(12, 10, 0), { first: 'U7', settings: petOf(id).settings }), part = petPart(e), r = part.getBoundingClientRect();
      mouse(part, 'mousedown', r.left + 10, r.top + 10);
      mouse(part, 'mousemove', r.left + 20, r.top + 10);
      eq(petState(e), 'dangle', id + ' lifted');
      var g = last(e.sent, 'dragStart').grab, sl = last(e.sent, 'setLayout');
      ok(Array.isArray(g) && g.length === 2, id + ' grab: ' + JSON.stringify(g));
      ok(g[0] > 0 && g[1] > 0 && g[0] < sl.width && g[1] < sl.height, id + ' the tip is inside the window');
      // the host moves the window so the cursor sits at grab: the painted tip must be right there
      var below = document.elementFromPoint(g[0], g[1] + 2.5), above = document.elementFromPoint(g[0], g[1] - 3.5);
      function what(n) { return n ? '<' + n.tagName + ' ' + (n.getAttribute('class') || '') + (n.parentNode && n.parentNode.getAttribute ? ' in ' + (n.parentNode.getAttribute('class') || n.parentNode.tagName) : '') + '>' : 'nothing'; }
      ok(below && below.closest('[data-pet] .pa'), id + ' the pet is painted just below the grab point ' + JSON.stringify(g) + ': ' + what(below));
      ok(!above || !above.closest('[data-pet] .pa'), id + ' nothing of the pet above it: the topmost point');
      // and it is the swing pivot, so it stays under the cursor while the pet swings
      var svg = $(e, '[data-pet] svg'), gb = QJZ.pets.grabAt(id), st = svg.getAttribute('style'), m = /--gx:\s*([\d.]+)px;\s*--gy:\s*([\d.]+)px/.exec(st);
      ok(m && +m[1] === gb[0] && +m[2] === gb[1], id + ' swings around the tip: ' + st);
      ok($(e, '.dpet').classList.contains('held'), id + ' held: in front of its tag');
      e.bridge.emit({ type: 'dragEnd' });
      ok(!$(e, '.dpet').classList.contains('held'), id + ' put down');
      done();
    });
  });

  test('layouts DOM: only U7 sends a grab point; the other layouts move like any window', function () {
    ['U1', 'U3', 'U5B', 'M3'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name === 'M3' ? 'U1' : name });
      if (name === 'M3') e.menu('mini');
      var t = name === 'M3' ? $(e, '.ring') : $(e, '[data-hit]') || e.root.firstElementChild;
      mouse(t, 'mousedown', 100, 100);
      mouse(t, 'mousemove', 110, 100);
      eq(last(e.sent, 'dragStart'), {}, name);
      done();
    });
  });

  // ---- 摸摸: only the animal itself ----
  test('layouts DOM: a click on the animal pets it; a click on the empty space, the desk, the room or a bubble does not', function () {
    sounds(function () {
      ['U7', 'U1', 'U3', 'U5B'].forEach(function (name) {
        var e = mk(at(12, 10, 0), { first: name }), holder = $(e, '[data-pet]'), svg = $(e, '[data-pet] svg');
        // not the animal: the holder and the SVG's empty space, every painted thing outside .pa (desk, keyboard, room)
        var misses = [holder, svg].concat(Array.prototype.slice.call(svg.querySelectorAll('rect, path')).filter(function (n) {
          return !n.closest('.pa') && !n.closest('defs,clipPath,pattern');
        }).slice(0, 12));
        var b = $(e, '[data-bubble]');
        if (b) { QJZ.layouts.say('吱！'); misses.push(b); }
        misses.forEach(function (n, i) {
          clickOn(n);
          eq(petState(e), 'typing', name + ' miss #' + i + ' <' + n.tagName + ' ' + (n.getAttribute('class') || '') + '>');
        });
        // the real thing: a point next to the pet, in the transparent part of the holder
        var hr = holder.getBoundingClientRect(), x = hr.left + 3, y = hr.top + 3, at0 = document.elementFromPoint(x, y);
        if (at0) { mouse(at0, 'click', x, y, { buttons: 0 }); eq(petState(e), 'typing', name + ' empty corner of the pet area'); }
        clickOn(petPart(e));
        eq(petState(e), 'petted', name + ' the animal itself');
        done();
      });
      // M3: the ring around the portrait is not the animal; the portrait's painted pet is
      var m = mk(at(12, 10, 0));
      m.menu('mini');
      clickOn($(m, '.ring'));
      eq(petState(m), 'typing', 'M3 ring');
      clickOn(petPart(m));
      eq(petState(m), 'petted', 'M3 portrait');
      done();
    });
  });

  test('layouts DOM: U7 pet hit rects follow the painted pet for every skin: they cover it, leave the empty corners to the desktop', function () {
    var U = QJZ.layouts.util;
    SKINS.forEach(function (id) {
      var e = mk(at(12, 10, 0), { first: 'U7', settings: petOf(id).settings });
      QJZ.layouts._bands.flush();
      var holder = $(e, '[data-pet]'), box = holder.getBoundingClientRect(), tag = $(e, '.mtag').getBoundingClientRect();
      var big = U.outer(U.subRect(box, U.PETONLY_VB, U.PET_HIT)), rects = last(e.sent, 'hitRects').rects.filter(function (r) { return r[1] >= tag.bottom - 1; });
      function inside(x, y) { return rects.some(function (r) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }); }
      var area = 0;   // the union of the rects, sampled every 2 px
      for (var ay = big[1]; ay < big[1] + big[3]; ay += 2) for (var ax = big[0]; ax < big[0] + big[2]; ax += 2) if (inside(ax + 1, ay + 1)) area += 4;
      ok(rects.length >= 2 && area < big[2] * big[3] * 0.85, id + ' smaller than the old box: ' + Math.round(area) + ' of ' + big[2] * big[3]);
      ok(rects.every(function (r) { return r[0] >= big[0] && r[1] >= big[1] && r[0] + r[2] <= big[0] + big[2] && r[1] + r[3] <= big[1] + big[3]; }), id + ' inside the old box');
      // everything the animal paints inside the old box (the measured pet area; the rects stay within it) is covered
      var missed = [];
      for (var y = big[1] + 1; y < big[1] + big[3]; y += 6) {
        for (var x = big[0] + 1; x < big[0] + big[2]; x += 6) {
          var n = document.elementFromPoint(x, y);
          if (n && n.closest('[data-pet] .pa') && !inside(x, y)) missed.push([Math.round(x - box.left), Math.round(y - box.top)]);
        }
      }
      eq(missed, [], id + ' every painted point of the pet is in a rect');
      // the top corners of the old box are empty and now click through
      var c1 = U.vbPoint(box, U.PETONLY_VB, [U.PET_HIT[0] + 2, U.PET_HIT[1] + 2], false), c2 = U.vbPoint(box, U.PETONLY_VB, [U.PET_HIT[0] + U.PET_HIT[2] - 2, U.PET_HIT[1] + 2], false);
      ok(!inside(box.left + c1.x, box.top + c1.y) && !inside(box.left + c2.x, box.top + c2.y), id + ' the empty top corners click through');
      done();
    });
  });

  test('layouts DOM: the U7 pet bands are measured while the page is idle: the box until then, nothing measured at once', function () {
    var U = QJZ.layouts.util;
    QJZ.layouts._bands.clear();
    var e = mk(at(12, 10, 0), { first: 'U7', settings: petOf('cat:s5').settings });
    var box = $(e, '[data-hit=pet]').getBoundingClientRect(), tag = $(e, '.mtag').getBoundingClientRect();
    var big = JSON.stringify(U.outer(U.subRect(box, U.PETONLY_VB, U.PET_HIT)));
    function pet(rects) { return rects.filter(function (r) { return r[1] >= tag.bottom - 1; }); }
    var first = pet(last(e.sent, 'hitRects').rects);
    eq(first.map(function (r) { return JSON.stringify(r); }), [big], 'the measured box while the bands are not ready');
    ok(QJZ.layouts._bands.pending() > 0, 'a measuring job is queued');
    eq(document.querySelectorAll('[aria-hidden][style*="-10000px"]').length, 0, 'and not started: no hidden copy yet');
    var n = of(e.sent, 'hitRects').length;
    QJZ.layouts._bands.flush();
    eq(QJZ.layouts._bands.pending(), 0);
    eq(document.querySelectorAll('[aria-hidden][style*="-10000px"]').length, 0, 'the hidden copy is gone');
    ok(of(e.sent, 'hitRects').length === n + 1 && pet(last(e.sent, 'hitRects').rects).length > 1, 'then the bands, sent at once');
    done();
  });

  // The reviewer's scan (I-1): the U7 pet's painted pixels, stepped through its animations off the measuring grid, all
  // inside the hit rects (where the measured box lets them be). The cases are the worst ones found: stretching
  // hamsters, whiskers and ear tips of a tilting or puffing head, crayon sparkles, the waving and sleeping new cats.
  // N-1 (re-review of d9bba4f): a head can rise above the box's top (cat P0 stretching or celebrating, up to 15.5 px;
  // cat S5 7.5 px; cat P0 waiting with the bag 7.5 px), so the scan also covers everything above the box, up to the
  // top of the viewBox: a painted ear tip there must click and drag too.
  test('layouts DOM: while the U7 pet moves, every painted pixel of it (inside the measured box, or above it) stays inside its hit rects', function () {
    var U = QJZ.layouts.util, wrap = document.createElement('div');
    var CASES = [['hamster:p0', 'stretch'], ['hamster:s4', 'stretch'], ['hamster:s5', 'stretch'], ['hamster:h2', 'stretch'], ['cat:p0', 'stretch'],
      ['cat:p0', 'angry'], ['cat:p0', 'petted'], ['cat:p0', 'typing'], ['cat:s5', 'doze'], ['cat:s5', 'celebrate'], ['hamster:s5', 'waitBag'],
      ['cat:s4', 'scratch'], ['cat:s4', 'waitBag'], ['cat:h2', 'celebrate'], ['cat:h2', 'angry'], ['cat:h2', 'lunchSleep'],
      ['cat:p0', 'celebrate'], ['cat:p0', 'waitBag'], ['cat:s5', 'stretch'],
      // the 1.1 poses at their measured extremes (Task 17): the highest waves, the leftmost paws, the cup and the sip
      ['cat:p0', 'wave'], ['cat:s5', 'wave'], ['cat:p4', 'wave'], ['hamster:p0', 'wave'], ['cat:p0', 'holdCup'],
      ['hamster:s4', 'holdCup'], ['cat:p0', 'sip'], ['cat:p0', 'focus']];
    wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:99';
    wrap.innerHTML = '<div class="u7 lay"><div class="dpet"><div class="po" data-pet="petonly" data-hit="pet"></div></div></div>';
    document.body.appendChild(wrap);
    function hidden(n, svg) {
      for (; n && n !== svg; n = n.parentNode) { var cs = getComputedStyle(n); if (cs.opacity === '0' || cs.visibility === 'hidden') return true; }
      return false;
    }
    function dist(x, y, rs) {
      var b = Infinity;
      rs.forEach(function (r) {
        var dx = x < r[0] ? r[0] - x : x > r[0] + r[2] ? x - r[0] - r[2] : 0, dy = y < r[1] ? r[1] - y : y > r[1] + r[3] ? y - r[1] - r[3] : 0;
        b = Math.min(b, Math.sqrt(dx * dx + dy * dy));
      });
      return b;
    }
    try {
      var po = wrap.querySelector('.po');
      CASES.forEach(function (c) {
        po.innerHTML = QJZ.pets.compose(c[0], 'petonly', { state: c[1] });
        var svg = po.firstElementChild, box = po.getBoundingClientRect();
        // by the skin too: the box and bands of the pose it shows (a 1.1 pose with no skin is its 1.0 stand-in's)
        var rects = U.bandRects(U.measureBands(c[0], c[1]), c[1], box, c[0]).map(U.outer), lim = U.outer(U.subRect(box, U.PETONLY_VB, U.petHit(c[1], c[0])));
        var top = U.outer(U.subRect(box, U.PETONLY_VB, U.PETONLY_VB))[1];   // the viewBox top: above the box too (N-1)
        ok(rects.length > 1, c.join(' ') + ': bands, not the box');
        var anims = svg.getAnimations({ subtree: true }), pts = [], worst = 0, at = null, span = 4800;
        anims.forEach(function (a) {
          a.pause();
          // a loop that starts late (holdCup offers the glass from 3.6 s on): its first round too, up to 8 s
          var tm = a.effect.getComputedTiming();
          if (isFinite(tm.duration)) span = Math.max(span, Math.min(8000, tm.delay + tm.duration * (/alternate/.test(tm.direction) ? 2 : 1)));
        });
        for (var y = top + 1.5; y < lim[1] + lim[3]; y += 3) for (var x = lim[0] + 1.5; x < lim[0] + lim[2]; x += 3) if (dist(x, y, rects) > 0) pts.push([x, y]);
        for (var t = 35; t <= span; t += 265) {   // off the measuring grid (every 100 ms)
          anims.forEach(function (a) { a.currentTime = t; });
          pts.forEach(function (p) {
            var n = document.elementFromPoint(p[0], p[1]);
            if (!n || n === svg || !svg.contains(n) || n.closest('.tops') || hidden(n, svg)) return;
            var d = dist(p[0], p[1], rects);
            if (d > worst) { worst = d; at = [t, Math.round(p[0] - box.left), Math.round(p[1] - box.top), n.tagName]; }
          });
        }
        ok(worst <= 1.5, c.join(' ') + ': a painted pixel ' + Math.round(worst * 10) / 10 + ' px outside the hit rects at ' + JSON.stringify(at));
      });
    } finally { wrap.remove(); }
  });

  test('layouts: a disc hit area is covered by its bands and leaves its corners out', function () {
    var U = QJZ.layouts.util, r = { left: 10, top: 20, width: 100, height: 100 }, bands = U.discRects(r, U.DISC_BANDS);
    eq(bands.length, U.DISC_BANDS);
    function inside(x, y) { return bands.some(function (b) { return x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height; }); }
    for (var a = 0; a < 360; a += 10) {
      var t = a * Math.PI / 180, x = 60 + Math.cos(t) * 49.5, y = 70 + Math.sin(t) * 49.5;
      ok(inside(x, y), 'covers the disc edge at ' + a + '°');
    }
    ok(!inside(12, 22) && !inside(108, 22) && !inside(12, 118) && !inside(108, 118), 'the corners stay out');
  });

  test('layouts DOM: the pet talks every 7–15 s where there is a bubble, never as banners in U5-B', function () {
    var e = mk(at(12, 10, 0));
    var b = $(e, '[data-bubble]'), t0 = at(12, 10, 0);
    steps(e, t0 + 1000, t0 + 6000);
    ok(!b.classList.contains('show'), 'quiet for the first 7 s');
    steps(e, t0 + 7000, t0 + 15000);
    ok(b.classList.contains('show'), 'talked by 15 s');
    done();
    var f = mk(at(12, 10, 0), { first: 'U5B' });
    steps(f, t0 + 1000, t0 + 40000);
    eq(f.root.querySelectorAll('.banner').length, 0);
    done();
  });

  // Math.random held at a constant for fn (the Brain captures it when the layouts start, so call mk inside fn).
  function withRandom(v, fn) {
    var orig = Math.random;
    Math.random = function () { return v; };
    try { return fn(); } finally { Math.random = orig; }
  }
  // The first second (from the start of the run) at which the pet says something.
  function firstChatter(seed, rv) {
    return withRandom(rv, function () {
      var e = mk(at(12, 10, 0), { seed: seed }), b = $(e, '[data-bubble]'), t0 = at(12, 10, 0);
      try {
        for (var s = 1; s <= 40; s++) {
          e.tick(t0 + s * 1000);
          if (b.classList.contains('show')) return { s: s, text: b.textContent };
        }
        return null;
      } finally { done(); }
    });
  }
  test('layouts DOM: chatter timing follows the injected rng, not Math.random (?rng= is reproducible)', function () {
    var a = firstChatter(5, 0.05), b = firstChatter(5, 0.95);
    ok(a && b, 'it talks within 40 s');
    eq(a.s, b.s, 'same seed, same moment, whatever Math.random says');
    ok(a.s >= 8 && a.s <= 16, 'within 7–15 s of the first tick: ' + a.s);
    eq(a.text, b.text, 'and the same line');
  });

  test('layouts DOM: a layout switch reschedules the next chatter line 7–15 s out', function () {
    withRandom(0, function () {
      var e = mk(at(12, 10, 0)), t0 = at(12, 10, 0), b;
      steps(e, t0, t0 + 6000);   // chatter due at t0 + 7 s (random 0)
      e.clock.ms = t0 + 6000;
      QJZ.layouts.show('U3');
      b = $(e, '[data-bubble]');
      ok(b, 'U3 has a bubble');
      steps(e, t0 + 6500, t0 + 12500, 500);
      ok(!b.classList.contains('show'), 'nothing for 7 s after the switch');
      steps(e, t0 + 13000, t0 + 22000);
      ok(b.classList.contains('show'), 'then it talks');
      done();
    });
  });

  test('layouts DOM: a buttonless mousemove ends the dangle', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    mouse(pet, 'mousemove', 112, 100, { buttons: 0 });
    ok(!QJZ.layouts.dragging());
    eq(petState(e), 'typing');
    done();
  });

  test('layouts DOM: the next mousedown ends a dangle whose dragEnd never came', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    mouse(pet, 'mousedown', 100, 100);
    ok(!QJZ.layouts.dragging());
    eq(petState(e), 'typing');
    done();
  });

  test('layouts DOM: a dangle with no dragEnd and no mouse event ends after 60 s', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    e.tick(at(12, 10, 0) + 59000);
    eq(petState(e), 'dangle', 'still held at 59 s');
    e.tick(at(12, 10, 0) + 61000);
    ok(!QJZ.layouts.dragging());
    eq(petState(e), 'typing');
    done();
  });

  test('layouts DOM: a layout switch in the middle of a drag does not leave the pet dangling', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), pet = $(e, '[data-pet]');
    mouse(pet, 'mousedown', 100, 100);
    mouse(pet, 'mousemove', 110, 100);
    eq(petState(e), 'dangle');
    QJZ.layouts.show('U1');
    mouse($(e, '.bar'), 'mousemove', 120, 100, { buttons: 0 });
    ok(!QJZ.layouts.dragging(), 'the buttonless move ended the drag');
    QJZ.layouts.show('U7');
    e.tick(at(12, 10, 0) + 1000);
    eq(petState(e), 'typing', 'back in U7 the pet is not held');
    done();
    var f = mk(at(12, 10, 0), { first: 'U7' });
    mouse($(f, '[data-pet]'), 'mousedown', 100, 100);
    mouse($(f, '[data-pet]'), 'mousemove', 110, 100);
    QJZ.layouts.show('U1');
    f.bridge.emit({ type: 'dragEnd' });
    QJZ.layouts.show('U7');
    f.tick(at(12, 10, 0) + 1000);
    eq(petState(f), 'typing', 'dragEnd after the switch frees it too');
    done();
  });

  test('layouts DOM: the U7 hover tools expire 4 s after the last move', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' }), tag = $(e, '.mtag'), pend = [];
    var st = window.setTimeout, ct = window.clearTimeout, dn = Date.now, T = 1000000;
    window.setTimeout = function (fn, ms) { var h = { fn: fn, ms: ms, live: true }; pend.push(h); return h; };
    window.clearTimeout = function (h) { if (h && h.live !== undefined) h.live = false; };
    Date.now = function () { return T; };
    function fire() {   // the pending idle timer (the only one that is not the 300 ms mouseout delay)
      var l = pend.filter(function (h) { return h.live && h.ms !== 300; });
      pend = pend.filter(function (h) { return !(h.live && h.ms !== 300); });
      l.forEach(function (h) { h.live = false; h.fn(); });
    }
    try {
      mouse(tag, 'mouseover');
      ok($(e, '.dpet').classList.contains('hover'), 'shown');
      T += 3000; mouse(tag, 'mousemove', 5, 0, { buttons: 0 });
      T += 3900; fire();
      ok($(e, '.dpet').classList.contains('hover'), 'only 3.9 s since the last move');
      T += 200; fire();
      ok(!$(e, '.dpet').classList.contains('hover'), 'gone 4 s after the last move');
    } finally { window.setTimeout = st; window.clearTimeout = ct; Date.now = dn; }
    done();
  });

  test('layouts DOM: a milestone crossed while hidden is quiet on re-show (no coin, no confetti, one bubble)', function () {
    sounds(function (n) {
      var e = mk(at(12, 10, 3));
      e.bridge.emit({ type: 'visibility', visible: false });
      e.clock.ms = at(12, 10, 4);
      e.bridge.emit({ type: 'visibility', visible: true });
      eq(QJZ.app.state.snacks, 3, 'the snack is there');
      eq(e.root.querySelectorAll('.confetti').length, 0);
      eq(n.coin, 0);
      ok(petState(e) !== 'hop');
      ok($(e, '[data-bubble]').classList.contains('show'), 'one quiet bubble');
      e.tick(at(12, 10, 4) + 100);
      e.tick(at(12, 10, 24) + 28000);
      e.tick(at(12, 10, 24) + 29000);
      eq(n.coin, 1, 'the next live step is loud again');
    });
  });

  test('layouts DOM: hover keeps the U7 tools without timer churn on every mousemove', function () {
    var e = mk(at(12, 10, 0), { first: 'U7' });
    var tag = $(e, '.mtag');
    mouse(tag, 'mouseover');
    ok($(e, '.dpet').classList.contains('hover'));
    var st = window.setTimeout, ct = window.clearTimeout, calls = 0;
    window.setTimeout = function () { calls++; return st.apply(window, arguments); };
    window.clearTimeout = function () { calls++; return ct.apply(window, arguments); };
    try {
      for (var i = 0; i < 20; i++) mouse(tag, 'mousemove', i, 0, { buttons: 0 });
    } finally { window.setTimeout = st; window.clearTimeout = ct; }
    eq(calls, 0);
    ok($(e, '.dpet').classList.contains('hover'));
    done();
  });

  // Reduced motion: html.calm is set by QJZ.fx from (prefers-reduced-motion: reduce) (file:// sheets cannot be read
  // through the CSSOM and the media query cannot be forced here, so the computed styles are checked under the class).
  test('layouts: reduced motion stops the perpetual idle loops and scales the confetti', function () {
    var html = document.documentElement, box = document.createElement('div');
    eq(html.classList.contains('calm'), window.matchMedia('(prefers-reduced-motion: reduce)').matches, 'html.calm follows the media query');
    box.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:200px';
    document.body.appendChild(box);
    function anim(state, sel, skin) {
      box.innerHTML = QJZ.pets.compose(skin || 'cat:p0', 'petonly', { state: state });
      var el = box.querySelector(sel);
      ok(el, state + ' ' + sel);
      return getComputedStyle(el);
    }
    try {
      ok(anim('idle', '.blink').animationName !== 'none', 'blinks normally');
      html.classList.add('calm');
      eq(anim('idle', '.blink').animationName, 'none', 'blink');
      eq(anim('idle', '.look').animationName, 'none', 'look (idle)');
      eq(anim('typing', '.tail').animationName, 'none', 'tail');
      eq(anim('stare', '.dot1').animationName, 'none', 'dots');
      var zz = anim('lunchSleep', '.zz');
      eq([zz.animationName, zz.opacity], ['none', '1'], 'Zzz stays, still');
      ok(box.querySelector('.puff') === null || getComputedStyle(box.querySelector('.puff')).animationName === 'none');
      eq(anim('idle', '.puff', 'hamster:h2').animationName, 'none', 'puff (H2 cheeks)');
      eq(anim('typing', '.pawL').animationName, 'tap', 'state poses still move (scaled by --m)');
      // confetti: near the end of its fall, --m .3 falls and spins about 0.3 as far
      function fall(m) {
        box.innerHTML = QJZ.pets.compose('cat:p0', 'petonly', { state: 'celebrate' });
        var svg = box.firstElementChild, cf = box.querySelector('.cf');
        svg.style.setProperty('--m', m);
        var a = cf.getAnimations()[0];
        a.pause();
        a.currentTime = a.effect.getComputedTiming().duration * 0.999;
        var mt = new DOMMatrix(getComputedStyle(cf).transform);
        return { y: mt.f, deg: Math.atan2(mt.b, mt.a) * 180 / Math.PI };
      }
      var full = fall('1'), calm = fall('.3');
      ok(full.y > 150 && calm.y > 30 && calm.y < 60, 'fall ' + full.y + ' / ' + calm.y);
      near(calm.deg, 60, 2, 'spin 200deg x .3');
    } finally { html.classList.remove('calm'); box.remove(); }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) html.classList.add('calm');
    // the milestone burst (QJZ.fx.confetti) scales its spread, fall and spin too
    var host = document.createElement('div'), rnd = Math.random;
    host.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:200px';
    document.body.appendChild(host);
    function lastFrame(scale) {
      QJZ.fx._motion(scale);
      Math.random = function () { return 0.75; };
      try { QJZ.fx.confetti(host, 100, 100); } finally { Math.random = rnd; }
      var a = host.lastChild.getAnimations()[0], k = a.effect.getKeyframes();
      var tf = k[k.length - 1].transform;
      host.innerHTML = '';
      return parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(tf)[1]);
    }
    try {
      var full = lastFrame(1), calm = lastFrame(0.3);
      near(full, 180, 0.01);
      near(calm, 54, 0.01);
    } finally { QJZ.fx._motion(null); host.remove(); }
  });

  // ---------- 1.1 (Task 10): cups, tomatoes and the countdown ring in U1 U3 U5-B U7 M3 ----------
  // The DOM tests start QJZ.care on the same fake bridge (mk's o.care). 1.0 settings: no reminder, nothing logged.
  var C = QJZ.care;
  var WATER_ON = { asked: true, sit: { on: false }, water: { on: true, goal: 8 } };
  function counts(cups, tomatoes) { return { health: { cups: cups, cupGoal: 8, tomatoes: tomatoes, standups: 0 } }; }
  // the element is drawn (not hidden by the §4.9 #8 rule, and it keeps no space when it is)
  function drawn(n) { var r = n ? n.getBoundingClientRect() : null; return !!r && r.width > 0 && r.height > 0; }
  // the text of each drawn element in list, without what its hidden parts hold, nor the 「+1」 a logged cup pops on it
  function seen(n) {
    var out = '';
    (function walk(x) {
      if (x.nodeType === 3) out += x.nodeValue;
      else if (x.nodeType === 1 && drawn(x) && !x.classList.contains('plus')) for (var c = x.firstChild; c; c = c.nextSibling) walk(c);
    })(n);
    return out.replace(/\s+/g, ' ').trim();
  }
  function shownText(list) { return Array.prototype.filter.call(list, drawn).map(seen); }
  function rgbOf(hex) { return 'rgb(' + [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); }).join(', ') + ')'; }
  var TOM = rgbOf('#FF6B57'), REST = rgbOf('#8EE3B0');

  // Ruling S11: no care, or one that has not started, is zero counts, an idle pomodoro and nothing shown.
  test('layouts: model without care', function () {
    var st = fakeState(at(12, 10, 0), at(12, 9, 0));
    [undefined, null, { ready: false, show: { cups: true, tomatoes: true }, cupsText: '3/8', p: null, health: { cups: 3, tomatoes: 3 } }].forEach(function (cs, i) {
      var m = U.model(st, at(12, 10, 0), cs);
      eq([m.showCups, m.showTomatoes, m.pomoBtn, m.ring.phase, m.tomatoes, m.nth, m.mmss, m.standIn],
        [false, false, '▶ 番茄鐘', null, '×0', '', '', ''], 'care ' + i);
      eq([m.status, m.m3sub], ['上班中', '上班中 · 還有 07:00:00'], 'the 1.0 texts ' + i);
    });
  });

  test('layouts: model health fields', function () {
    var focus = { phase: 'focus', startMs: at(12, 9, 40), endMs: at(12, 10, 5), day: '2026-11-12', long: false, done: 0, notice: null };
    var e = mk(at(12, 9, 52, 30), { care: true, settings: { health: WATER_ON }, rec: counts(3, 3), pomo: focus });
    var m = U.model(QJZ.app.state, at(12, 9, 52, 30), C.state);
    eq([m.cups, m.cupsLong, m.tomatoes, m.showCups, m.showTomatoes], ['3/8', '3/8 杯', '×3', true, true]);
    eq([m.pomoBtn, m.ring.phase, m.ring.label, m.status, m.nth, m.mmss], ['■ 停止', 'focus', '還剩 13 分', '專心中', '第 4 顆', '12:30']);
    near(m.ring.fraction, 0.5, 1e-9, 'the elapsed share (QJZ.pomodoro.fraction)');
    eq(m.m3sub, '專心中 · 還剩 13 分');
    eq([m.standIn, m.showStand], ['', false], 'water only (1.1.1): the timer runs, but no stand-up is asked');
    C.toggleFocus();   // stop
    m = U.model(QJZ.app.state, at(12, 9, 52, 30), C.state);
    eq([m.pomoBtn, m.ring.phase, m.ring.label, m.status, m.nth, m.mmss], ['▶ 番茄鐘', null, '', '上班中', '', '']);
    eq([m.showCups, m.showTomatoes], [true, true], 'care decides what shows (Ruling R4): 3 tomatoes today');
    done();
    mk(at(12, 10, 0), { care: true });
    eq(U.model(QJZ.app.state, at(12, 10, 0), C.state).standIn, '', 'nothing asked: empty');
    done();
  });

  test('layouts: unused counts are hidden (§4.9 #8)', function () {
    var e = mk(at(12, 10, 0), { care: true });   // water off, no cup, no tomato, idle
    eq(shownText(e.root.querySelectorAll('.u1 .mpills > *')), ['▶ 番茄鐘'], 'U1: only the 番茄鐘 pill');
    e.menu('layout:U7');
    eq(drawn($(e, '.u7 .hline')), false, 'U7: no tag line');
    var tag = $(e, '.u7 .mtag').getBoundingClientRect().height;
    e.menu('mini');
    eq(shownText(e.root.querySelectorAll('.m3 .mb')), [], 'M3: no sticker');
    C.drink();   // from the menu or the tray: the layout follows at once, no tick needed
    eq(shownText(e.root.querySelectorAll('.m3 .mb')), ['1/8'], 'M3: the cups sticker');
    ok($(e, '.m3 .mb.l').contains($(e, '.m3 .mb svg.ic')), 'with its icon, top left');
    e.menu('layout:U7');
    eq(shownText(e.root.querySelectorAll('.u7 .hline')), ['1/8'], 'U7: cups only, no ・');
    ok($(e, '.u7 .mtag').getBoundingClientRect().height > tag + 10, 'the line takes room only when it shows');
    C.toggleFocus();
    eq(shownText(e.root.querySelectorAll('.u7 .hline')), ['1/8・×0'], 'U7: a running focus shows the tomatoes');
    e.menu('layout:U1');
    eq(shownText(e.root.querySelectorAll('.u1 .mpills > *')), ['1/8 杯', '■ 停止', '×0'], '1.1.2: the button in the middle');
    done();
  });

  test('layouts: U1 pills drink and start', function () {
    var e = mk(at(12, 10, 0), { care: true, settings: { health: WATER_ON } });
    var pills = $(e, '.u1 .money-box .mpills'), rate = $(e, '.u1 [data-b=rate]');
    ok(pills && pills.getBoundingClientRect().top >= rate.getBoundingClientRect().bottom, 'under the 每秒 line');
    eq(shownText(pills.children), ['0/8 杯', '▶ 番茄鐘'], 'water on: the cups show from the start');
    ok(pills.querySelector('[data-act=drink] svg.ic-drop') && pills.querySelector('[data-act=pomo]'), 'drink and pomo buttons');
    clickOn($(e, '.u1 [data-act=drink]'));
    eq(C.state.health.cups, 1);
    eq(text(e, '.u1 [data-act=drink] [data-b=cupsLong]'), '1/8 杯');
    clickOn($(e, '.u1 [data-act=pomo]'));
    eq(C.state.p.phase, 'focus');
    eq(text(e, '.u1 [data-act=pomo]'), '■ 停止');
    eq(shownText(pills.children), ['1/8 杯', '■ 停止', '×0']);
    eq(text(e, '[data-b=status]'), '專心中', 'the status pill');
    ok(drawn($(e, '.u1 .status .pi-foc')) && !drawn($(e, '.u1 .status .pi-brk')), 'with the headphones');
    eq(of(e.sent, 'dragStart').length, 0, 'buttons never drag');
    clickOn($(e, '.u1 [data-act=pomo]'));
    eq([C.state.p.phase, text(e, '.u1 [data-act=pomo]'), text(e, '[data-b=status]')], ['idle', '▶ 番茄鐘', '上班中']);
    done();
  });

  test('layouts: U3 tomato and water buttons share one row, no bottle', function () {
    var e = mk(at(12, 10, 0), { first: 'U3', care: true, settings: { health: WATER_ON }, rec: counts(3, 3) });
    var tom = $(e, '.u3 [data-act=pomo]'), wat = $(e, '.u3 [data-act=drink]'), money = $(e, '.u3 .hud-bottom .money');
    var tr = tom.getBoundingClientRect(), wr = wat.getBoundingClientRect(), mr = money.getBoundingClientRect();
    ok(drawn(tom) && drawn(wat), 'both buttons');
    ok(Math.abs((tr.top + tr.bottom) / 2 - (wr.top + wr.bottom) / 2) <= 1, 'one row: ' + tr.top + ' / ' + wr.top);
    eq([Math.round(tr.width), Math.round(tr.height)], [Math.round(wr.width), Math.round(wr.height)], 'the same style');
    ok(wr.left >= mr.right && tr.left >= mr.right, 'right of the money');
    ok($(e, '.u3 .hud-bottom').contains(tom) && $(e, '.u3 .hud-bottom').contains(wat), 'in the money box');
    eq([$(e, '.u3 .bottle'), $(e, '.u3 .gauge')], [null, null], 'no bottle');
    eq(shownText(e.root.querySelectorAll('.u3 .tomslot .n')), ['3/8', '×3'], 'the captions');
    Array.prototype.forEach.call(e.root.querySelectorAll('.u3 .tomslot .n'), function (n, i) {
      ok(n.getBoundingClientRect().top >= [wr, tr][i].bottom - 1, 'caption under its button ' + i);
    });
    eq(text(e, '.u3 [data-act=pomo] .play'), '▶');
    clickOn(tom);
    eq(C.state.p.phase, 'focus');
    eq(text(e, '.u3 [data-act=pomo] .play'), '■');
    clickOn(wat);
    eq(C.state.health.cups, 4);
    eq(shownText(e.root.querySelectorAll('.u3 .tomslot .n')), ['4/8', '×3']);
    done();
    var f = mk(at(12, 10, 0), { first: 'U3', care: true });
    eq([drawn($(f, '.u3 [data-act=drink]')), drawn($(f, '.u3 [data-act=pomo]'))], [false, true], 'unused: the tomato button only');
    eq(shownText(f.root.querySelectorAll('.u3 .tomslot .n')), [], 'and no caption');
    done();
  });

  test('layouts: U5-B is about 65 px wider', function () {
    var e = mk(at(12, 10, 0), { first: 'U5B' }), w = last(e.sent, 'setLayout').width;
    ok(w >= 542 && w <= 562, '1.0 sent 487; now ' + w);
    var col = $(e, '.u5b .rcol'), mid = $(e, '.u5b .mid');
    ok(col && col.getBoundingClientRect().left >= mid.getBoundingClientRect().right, 'a right column');
    ok(drawn(col.querySelector('[data-act=pomo]')), 'its tomato button always shows');
    eq(drawn(col.querySelector('[data-act=drink]')), false, 'no cups while unused');
    done();
    var f = mk(at(12, 10, 0), { first: 'U5B', care: true, settings: { health: WATER_ON }, rec: counts(3, 3) });
    eq(shownText(f.root.querySelectorAll('.u5b .rcol [data-b]')), ['×3', '▶', '3/8']);
    clickOn($(f, '.u5b .rcol [data-act=drink]'));
    eq(C.state.health.cups, 4);
    clickOn($(f, '.u5b .rcol [data-act=pomo]'));
    eq([C.state.p.phase, text(f, '.u5b .rcol .play')], ['focus', '■']);
    eq(last(f.sent, 'setLayout').width, w, 'the same width in use');
    done();
  });

  test('layouts: U7 tag line and M3 stickers have no data-act', function () {
    var e = mk(at(12, 10, 0), { first: 'U7', care: true, settings: { health: WATER_ON }, rec: counts(3, 3) });
    var line = $(e, '.u7 .mtag .hline');
    eq(shownText([line]), ['3/8・×3']);
    eq([line.querySelectorAll('[data-act]').length, line.closest('[data-act]')], [0, null], 'display only (§5.3)');
    clickOn(line);
    eq(C.state.health.cups, 3, 'a click logs nothing');
    e.menu('mini');
    var mb = e.root.querySelectorAll('.m3 .mb');
    eq(shownText(mb), ['3/8', '×3']);
    ok(mb[0].classList.contains('l') && mb[1].classList.contains('r'), 'cups top left, tomatoes top right');
    Array.prototype.forEach.call(mb, function (n) {
      eq([n.querySelectorAll('[data-act]').length, n.closest('[data-act]')], [0, null]);
      clickOn(n);
    });
    eq([C.state.health.cups, C.state.p.phase], [3, 'idle'], 'clicks log nothing, start nothing');
    var ring = $(e, '.m3 .ring').getBoundingClientRect(), badge = $(e, '.m3').getBoundingClientRect();
    Array.prototype.forEach.call(mb, function (n) {
      var r = n.getBoundingClientRect();
      ok(r.top < ring.top + 30 && r.left >= 0 && r.right <= badge.right, 'on the ring\'s top corners, inside the badge');
    });
    done();
  });

  test('layouts: the ring follows the pomodoro once a second, red then green, without transitions', function () {
    ['U1', 'U3', 'U5B', 'U7'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true });
      var r = $(e, '[data-pring]'), arc = r.querySelector('[data-ring-arc]');
      ok(r.hidden && !drawn(r), name + ': idle, no ring');
      C.toggleFocus();
      ok(!r.hidden && drawn(r), name + ': a focus shows it at once');
      eq(text(e, '[data-pring] [data-ring-label]'), '還剩 25 分', name);
      var rr = r.getBoundingClientRect(), hr = headOf(e), cx = (hr.left + hr.right) / 2, cy = (hr.top + hr.bottom) / 2;
      ok(cx > rr.left && cx < rr.right && cy > rr.top && cy < rr.bottom, name + ': around the pet ' + JSON.stringify([cx, cy, rr.left, rr.top, rr.right, rr.bottom]));
      eq(getComputedStyle(arc).transitionDuration, '0s', name + ': no transition on the arc');
      eq(getComputedStyle(arc).stroke, TOM, name + ': tomato red');
      ok(!r.classList.contains('rest'));
      var writes = 0, set = arc.setAttribute;
      arc.setAttribute = function (k, v) { if (k === 'stroke-dasharray') writes++; return set.call(this, k, v); };
      for (var t = 100; t <= 2000; t += 100) {
        e.tick(at(12, 10, 0) + t);
        if (t === 500 || t === 1500) C.drink();   // a re-render within the second
      }
      ok(writes >= 1 && writes <= 2, name + ': at most once a second, ' + writes + ' writes in 2 s');
      delete arc.setAttribute;
      e.tick(at(12, 10, 12, 30));
      eq(text(e, '[data-pring] [data-ring-label]'), '還剩 13 分', name);
      near(parseFloat(arc.getAttribute('stroke-dasharray')), QJZ.ring.LEN / 2, 0.1, name + ': half the circle left');
      e.tick(at(12, 10, 25));   // the tomato is done: the break
      eq(C.state.p.phase, 'break');
      ok(r.classList.contains('rest') && !r.hidden, name + ': green for the break');
      eq(getComputedStyle(arc).stroke, REST, name);
      eq(text(e, '[data-pring] [data-ring-label]'), '還剩 5 分', name);
      ok(drawn(r.querySelector('.pi-brk')) && !drawn(r.querySelector('.pi-foc')), name + ': the break icon');
      e.tick(at(12, 10, 30));   // 休息結束: nothing runs
      ok(r.hidden && !drawn(r), name + ': gone after the break');
      done();
    });
  });

  test('layouts: M3 outer ring counts down during a pomodoro', function () {
    var e = mk(at(12, 10, 0), { first: 'M3', care: true }), ring = $(e, '.m3 [data-ring]');
    function p() { return ring.style.getPropertyValue('--p'); }
    eq([p(), text(e, '[data-b=m3sub]')], ['12.50', '上班中 · 還有 07:00:00'], 'the day\'s progress');
    ok(!ring.classList.contains('p-foc') && !ring.classList.contains('p-brk'));
    var day = getComputedStyle(ring).backgroundImage;
    C.toggleFocus();
    eq([p(), text(e, '[data-b=m3sub]')], ['100.00', '專心中 · 還剩 25 分']);
    ok(ring.classList.contains('p-foc'), 'p-foc');
    ok(getComputedStyle(ring).backgroundImage.indexOf(TOM) >= 0 && getComputedStyle(ring).backgroundImage !== day, 'tomato red');
    e.tick(at(12, 10, 10));
    eq([p(), text(e, '[data-b=m3sub]')], ['60.00', '專心中 · 還剩 15 分'], 'counts down');
    e.tick(at(12, 10, 25));
    ok(ring.classList.contains('p-brk') && !ring.classList.contains('p-foc'), 'p-brk');
    eq([p(), text(e, '[data-b=m3sub]')], ['100.00', '休息中 · 還剩 5 分']);
    ok(getComputedStyle(ring).backgroundImage.indexOf(REST) >= 0, 'green');
    e.tick(at(12, 10, 27));
    eq(p(), '60.00');
    e.tick(at(12, 10, 30));
    ok(!ring.classList.contains('p-foc') && !ring.classList.contains('p-brk'), 'back to the day');
    eq([p(), text(e, '[data-b=m3sub]')], ['18.75', '上班中 · 還有 06:30:00']);
    eq(getComputedStyle(ring).transitionDuration, '0s');
    done();
  });
  // ---------- 1.1 (Task 12): the new layouts U10 頂端小膠囊, U12 健康儀表板, U13 番茄鐘優先 ----------
  var BOTH = { asked: true, sit: { on: true }, water: { on: true, goal: 8 } };
  function today(cups, tomatoes, standups) { return { health: { cups: cups, cupGoal: 8, tomatoes: tomatoes, standups: standups } }; }
  function shown(e) { e.bridge.emit({ type: 'visibility', visible: true }); return e; }   // care prompts only while the window shows
  function hitsOf(e) { return last(e.sent, 'hitRects').rects; }
  function sizeOf(e) { var s = last(e.sent, 'setLayout'); return [s.width, s.height]; }
  // U10's capsule grows and shrinks over U.CAP_MS (1.1.1 item 8): its animations end at once, and the page measures
  // again as on a resize (in the page a frame does it), for the tests that look at where it ends up.
  function capDone(el) {
    el.getAnimations({ subtree: true }).forEach(function (a) { if (a.id === 'qjz-cap') a.finish(); });
    window.dispatchEvent(new Event('resize'));
  }
  function hoverOn(el) { mouse(el, 'mouseover'); capDone(el); }
  // The pointer leaves el: what the delay after the mouseout does (300 ms; U10 100 ms), at once, and the fold's end.
  function leave(el) {
    var st = window.setTimeout, run = [];
    window.setTimeout = function (fn, ms) { if (ms === 300 || ms === 100) { run.push(fn); return 0; } return st.apply(window, arguments); };
    try { mouse(el, 'mouseout', 0, 0, { relatedTarget: document.body, buttons: 0 }); } finally { window.setTimeout = st; }
    run.forEach(function (f) { f(); });
    capDone(el);
  }

  test('layouts DOM: U10: one window size for collapsed / hover / remind / focus', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U10', care: true, settings: { health: BOTH }, rec: today(3, 3, 0) }));
    e.tick(at(12, 9, 49, 59));
    var win = sizeOf(e);
    eq(last(e.sent, 'setLayout').layout, 'U10');
    ok(win[0] >= 440 && win[0] <= 560 && win[1] >= 140 && win[1] <= 160, 'the window: the widest state and its banner lane (1.1.1); the widest state\'s footprint: ' + win);
    function check(state, w, h) {
      var lay = $(e, '.u10'), isl = $(e, '.isl'), box = lay.getBoundingClientRect(), r = isl.getBoundingClientRect();
      eq(sizeOf(e), win, state + ': the same window');
      eq([Math.round(box.width), Math.round(box.height)], win, state + ': the window is the layout (the capsule\'s shadow is inside it)');
      ok(r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom + 5 <= box.bottom + 0.5,
        state + ': the capsule and its shadow inside ' + JSON.stringify([r.left, r.top, r.right, r.bottom]));
      if (w) ok(r.width >= w[0] && r.width <= w[1] && r.height >= h[0] && r.height <= h[1], state + ': ' + r.width + 'x' + r.height);
    }
    check('collapsed', [180, 280], [34, 40]);
    hoverOn($(e, '.isl'));
    check('hover', [320, 500], [92, 106]);
    e.menu('layout:U10');   // built again: collapsed
    e.tick(at(12, 9, 50));
    ok($(e, '.u10').classList.contains('prompting'), 'the reminder');
    check('remind', [300, 560], [50, 90]);
    // the longest copy there is: every reminder line, the long break with its water line and three buttons, 休息結束
    ['both', 'sit', 'water'].forEach(function (kind) {
      QJZ.prompt.LINES[kind].forEach(function (t, i) {
        QJZ.promptView.render($(e, '.u10'), 'U10', QJZ.prompt.view({ kind: kind, water: false }, { turn: i, min: 120, cups: 12, cupGoal: 20 }));
        check('remind ' + kind + ' ' + i);
      });
    });
    QJZ.promptView.render($(e, '.u10'), 'U10', QJZ.prompt.view({ kind: 'break', water: true }, { breakMin: 15, done: 12, long: true }));
    check('the long break');
    QJZ.promptView.render($(e, '.u10'), 'U10', QJZ.prompt.view({ kind: 'breakEnd', water: false }, {}));
    check('休息結束');
    QJZ.promptView.render($(e, '.u10'), 'U10', C.view());
    clickOn($(e, '[data-answer=later]'));
    ok(!$(e, '.u10').classList.contains('prompting'), '等一下 closes it');
    C.toggleFocus();
    ok(drawn($(e, '.iv-f')), 'the countdown');
    check('focus', [180, 300], [34, 40]);
    done();
  });

  test('layouts DOM: U10: dock classes and setLayout dock', function () {
    var e = mk(at(12, 10, 0), { first: 'U10', care: true, settings: { layout: { capsule: 'bottomRight' } } });
    function where() {   // the capsule's place in the window
      var lay = $(e, '.u10').getBoundingClientRect(), r = $(e, '.isl').getBoundingClientRect();
      var h = Math.abs(r.left - lay.left) < 1 ? 'left' : Math.abs(r.right - lay.right) < 1 ? 'right' :
        Math.abs(r.left + r.right - lay.left - lay.right) < 2 ? 'centre' : '?';
      var v = Math.abs(r.top - lay.top) < 1 ? 'top' : Math.abs(r.bottom + 5 - lay.bottom) < 1 ? 'bottom' : '?';
      return h + ' ' + v;
    }
    var sl = last(e.sent, 'setLayout');
    eq([sl.layout, sl.dock], ['U10', 'bottomRight']);
    ok($(e, '.u10').classList.contains('d-bottomRight'));
    eq(where(), 'right bottom');
    hoverOn($(e, '.isl'));
    eq(where(), 'right bottom', 'expanded up and to the left, away from its corner');
    var n = of(e.sent, 'setLayout').length;
    e.bridge.emit({ type: 'capsuleDock', dock: 'top' });   // the host snapped a drop to the top
    eq(QJZ.app.state.settings.layout.capsule, 'top', 'saved');
    eq([of(e.sent, 'setLayout').length, last(e.sent, 'setLayout').dock], [n + 1, 'top'], 'setLayout again, with the new dock');
    ok($(e, '.u10').classList.contains('d-top') && !$(e, '.u10').classList.contains('d-bottomRight'));
    eq(where(), 'centre top', 'still expanded, down from the top');
    e.bridge.emit({ type: 'capsuleDock', dock: 'top' });
    eq([of(e.sent, 'setLayout').length, last(e.sent, 'setLayout').dock], [n + 2, 'top'],
      'the same dock: sent again all the same, so no older setLayout in flight can undo the snap');
    e.menu('capsule:bottomLeft');
    eq([QJZ.app.state.settings.layout.capsule, last(e.sent, 'setLayout').dock, where()], ['bottomLeft', 'bottomLeft', 'left bottom'], 'the menu\'s 膠囊位置');
    e.bridge.emit({ type: 'capsuleDock', dock: 'left' });
    e.bridge.emit({ type: 'capsuleDock' });
    e.menu('capsule:middle');
    eq(QJZ.app.state.settings.layout.capsule, 'bottomLeft', 'junk is ignored');
    QJZ.app.flush();
    eq(JSON.parse(last(e.sent, 'saveSettings').text).layout.capsule, 'bottomLeft', 'written');
    e.menu('layout:U1');
    eq('dock' in last(e.sent, 'setLayout'), false, 'only U10 sends a dock');
    e.menu('capsule:bottomCenter');
    eq([QJZ.app.state.settings.layout.capsule, QJZ.layouts.current()], ['bottomCenter', 'U1'], 'kept for U10');
    e.menu('layout:U10');
    eq([last(e.sent, 'setLayout').dock, where()], ['bottomCenter', 'centre bottom']);
    ok(of(e.sent, 'setLayout').every(function (s) { return s.p.layout !== 'U10' || QJZ.settings.DOCKS.indexOf(s.p.dock) >= 0; }),
      'every U10 setLayout carries its dock');
    eq(last(e.sent, 'setTopmost'), { on: true }, 'on top by default');
    done();
  });

  test('layouts DOM: U10: hover expands, leaving collapses, the hit rect follows; the chips follow the visibility rule', function () {
    var e = mk(at(12, 10, 0), { first: 'U10', care: true });   // 1.0 settings: water off, nothing logged, nothing asked
    var isl = $(e, '.isl'), small = isl.getBoundingClientRect();
    eq(hitsOf(e), [U.outer(small)], 'only the capsule takes clicks');
    eq(shownText(e.root.querySelectorAll('.iv-c > :not(.gd)')), ['NT$ 284'], 'collapsed: whole dollars, no chips');
    hoverOn(isl);
    ok(isl.classList.contains('hover'));
    var big = isl.getBoundingClientRect();
    ok(big.width > small.width + 100 && big.height > small.height + 40, 'expanded ' + big.width + 'x' + big.height);
    eq(hitsOf(e), [U.outer(big)], 'the hit rect follows');
    eq(text(e, '.iv-x .im'), 'NT$ 284.09', '2 decimals');
    eq(shownText(e.root.querySelectorAll('.iv-x .ichip')), ['▶'], 'the 番茄鐘 button is always there; no cups, no stand-up');
    mouse(isl.querySelector('.iv-x .im'), 'mousemove', 3, 3, { buttons: 0 });
    leave(isl);
    ok(!isl.classList.contains('hover'), 'leaving collapses');
    eq(isl.getBoundingClientRect().width, small.width);
    eq(hitsOf(e), [U.outer(small)]);
    QJZ.app.saveSettings({ health: BOTH });
    C.drink();
    eq(shownText(e.root.querySelectorAll('.iv-c > .ichip')), ['1'], 'a cup today: the cups chip (§4.9 #8)');
    hoverOn(isl);
    eq(shownText(e.root.querySelectorAll('.iv-x .ichip')), ['▶', '1/8 杯', '50 分後'], 'water on: the cups; the reminder asked: the next stand-up');
    clickOn($(e, '.iv-x [data-act=drink]'));
    eq(C.state.health.cups, 2, 'the cups chip logs a cup');
    clickOn($(e, '.iv-x [data-act=pomo]'));
    eq(C.state.p.phase, 'focus', '▶ starts a focus');
    eq(shownText(e.root.querySelectorAll('.iv-x .ichip')), ['■×0', '2/8 杯', '50 分後'], 'a focus shows the tomatoes; ■ stops it');
    clickOn($(e, '.iv-x [data-act=pomo]'));
    eq(C.state.p.phase, 'idle');
    eq(of(e.sent, 'dragStart').length, 0, 'buttons never drag');
    done();
  });

  test('layouts DOM: U10: remind shows the buttons; focus shows mm:ss and 第 N 顆', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U10', care: true, settings: { health: BOTH }, rec: today(3, 2, 0) }));
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    var lay = $(e, '.u10'), call = $(e, '.iv-r');
    ok(lay.classList.contains('prompting') && drawn(call), 'the call');
    eq([text(e, '.iv-r .imsg'), text(e, '.iv-r .isub')], ['起來動一動，順便喝口水～', '已經坐 50 分鐘囉・今天 3/8 杯']);
    eq(Array.prototype.map.call(call.querySelectorAll('[data-answer]'), function (b) { return b.textContent; }), ['喝了', '起來了', '等一下']);
    ok(!drawn($(e, '.iv-c')) && !drawn($(e, '.iv-x')) && !drawn($(e, '.iv-f')), 'nothing else on it');
    hoverOn($(e, '.isl'));
    ok(drawn(call) && !drawn($(e, '.iv-x')), 'the pointer on it keeps the call');
    var cap = U.layoutBox($(e, '.isl')), h0 = U.outer(cap);   // (it may be in the middle of its knock)
    eq(hitsOf(e)[0], h0, 'the capsule');
    ok(hitsOf(e).every(function (h) { return h[0] >= h0[0] && h[1] >= h0[1] && h[0] + h[2] <= h0[0] + h0[2] && h[1] + h[3] <= h0[1] + h0[3]; }),
      'its buttons are on it: nothing outside it takes clicks');
    clickOn($(e, '[data-answer=up]'));
    eq([C.state.health.standups, lay.classList.contains('prompting')], [1, false], '起來了 counts and closes');
    leave($(e, '.isl'));
    C.toggleFocus();
    ok(drawn($(e, '.iv-f')) && !drawn($(e, '.iv-c')), 'the countdown instead');
    eq(shownText(e.root.querySelectorAll('.iv-f > *')), ['', '25:00', '第 3 顆', 'NT$ 236'], 'the donut, mm:ss, 第 N 顆 (two today), whole dollars');
    eq($(e, '.iv-f .donut').style.getPropertyValue('--p'), '100');
    e.tick(at(12, 10, 2, 30));
    eq([text(e, '.iv-f [data-b=mmss]'), $(e, '.iv-f .donut').style.getPropertyValue('--p')], ['12:30', '50']);
    e.tick(at(12, 10, 15));
    ok(lay.classList.contains('prompting') && drawn(call) && !drawn($(e, '.iv-f')), 'the break bubble is a call too, alone on it');
    eq(text(e, '.iv-r .imsg'), '休息 5 分鐘！起來走走～');
    clickOn($(e, '[data-answer=ok]'));
    ok(drawn($(e, '.iv-f')) && $(e, '.iv-f .donut').classList.contains('rest'), 'the break counts down, green');
    eq([text(e, '.iv-f [data-b=mmss]'), text(e, '.iv-f [data-b=phaseNote]')], ['05:00', '休息中']);
    done();
  });

  function rings(e) {
    return Array.prototype.map.call(e.root.querySelectorAll('.u12 [data-gauge]'), function (g) {
      return g.getAttribute('data-gauge') + ' ' + g.style.getPropertyValue('--p') + ' ' + seen(g.querySelector('.rg')) + ' ' + seen(g.querySelector('.gl'));
    });
  }
  function hots(e) { return Array.prototype.map.call(e.root.querySelectorAll('.u12 [data-gauge]'), function (g) { return g.classList.contains('hot'); }); }

  test('layouts DOM: U12: rings from the three goals, always shown; the water ring drinks; the matching ring glows; the bottom line', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U12', care: true, settings: { health: BOTH }, rec: today(3, 3, 5) }));
    e.tick(at(12, 9, 42));
    eq(rings(e), ['cups 37.5 3/8 喝水（杯）', 'tom 75 3 番茄（顆）', 'stand 55.6 5 起來動（次）'], 'goals: 8 cups, 4 tomatoes, 9 stand-ups (8 h / 50 min)');
    eq(shownText(e.root.querySelectorAll('.u12 .say')), ['再 8 分鐘起來動～']);
    eq(getComputedStyle($(e, '.u12 [data-gauge=cups] .rg')).transitionDuration, '0s', 'no transition on the rings');
    clickOn($(e, '.u12 [data-gauge=cups]'));
    eq(C.state.health.cups, 4, 'the water ring logs a cup');
    eq(rings(e)[0], 'cups 50 4/8 喝水（杯）');
    var size = sizeOf(e);
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    eq(hots(e), [true, false, true], 'both: the water and the stand-up rings glow');
    eq(seen($(e, '[data-gauge=stand] .gl')), '該起來了！');
    eq(shownText(e.root.querySelectorAll('.u12 .say')), [], 'the bubble takes the line\'s place');
    var b = $(e, '.u12 .dfoot [data-prompt] .rbub');
    ok(b && b.classList.contains('sm') && b.classList.contains('inl') && drawn(b), 'the small bubble beside the pet');
    ok(b.getBoundingClientRect().left > $(e, '.u12 .dfoot .po').getBoundingClientRect().left, 'right of the pet');
    eq(sizeOf(e), size, 'the window keeps its size');
    clickOn($(e, '[data-answer=up]'));
    eq(hots(e), [false, false, false]);
    eq(rings(e)[2], 'stand 66.7 6 起來動（次）');
    QJZ.app.saveSettings({ health: { water: { on: false } } });
    C._dev({ prompt: 'sit' });
    eq(hots(e), [false, false, true], 'sit: the stand-up ring');
    eq(sizeOf(e), size, 'sit: the same size');
    QJZ.app.saveSettings({ health: { sit: { on: false }, water: { on: true } } });
    C._dev({ prompt: 'water' });
    eq(hots(e), [true, false, false], 'water: the water ring');
    eq(sizeOf(e), size, 'water: the same size');
    eq(seen($(e, '[data-gauge=stand] .gl')), '起來動（次）');
    C._dev({ prompt: 'break' });
    eq(hots(e), [false, true, false], 'a pomodoro bubble: the tomato ring');
    clickOn($(e, '[data-answer=ok]'));
    eq(rings(e)[1], 'tom 60 休息03:00 番茄倒數', 'the break counts down in the tomato ring');
    eq(['cups', 'tom', 'stand'].map(function (g) { return $(e, '[data-gauge=' + g + ']').classList.contains('rest'); }), [false, true, false],
      'only the countdown turns green');
    eq(shownText(e.root.querySelectorAll('.u12 .say')), [], 'water only (1.1.1): no stand-up line');
    QJZ.app.saveSettings({ health: { sit: { on: true } } });
    C.toggleFocus();
    C.toggleFocus();
    eq(rings(e)[1], 'tom 100 專心25:00第 4 顆 番茄倒數', 'a focus: 專心 mm:ss 第 N 顆');
    eq(shownText(e.root.querySelectorAll('.u12 .say')), ['專心中～提醒等休息再說']);
    eq(sizeOf(e), size);
    done();
    var f = mk(at(12, 10, 0), { first: 'U12', care: true });   // water off, no cup, nothing asked
    eq(rings(f), ['cups 0 0/8 喝水（杯）', 'tom 0 0 番茄（顆）', 'stand 0 0 起來動（次）'], 'unused: the rings are still there (§4.9 #8)');
    ok(Array.prototype.every.call(f.root.querySelectorAll('.u12 [data-gauge]'), drawn));
    eq(shownText(f.root.querySelectorAll('.u12 .say')), [], 'nothing asked: no line');
    done();
  });

  test('layouts DOM: U13: the ring starts a focus; 第 1 顆 and 停止 on it during it; the reminder sits in the ring; four tomato slots', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U13', care: true, settings: { health: BOTH } }));
    var size = sizeOf(e), go = $(e, '.u13 .br-go'), ring = $(e, '.u13 .bigring'), run = $(e, '.u13 .br-run'), idle = $(e, '.u13 .br-idle');
    function slots(x) {
      return Array.prototype.map.call(x.root.querySelectorAll('.u13 [data-tslots] svg.ic'), function (s) { return s.classList.contains('e') ? 'o' : 'x'; }).join('');
    }
    eq(slots(e), 'oooo', 'four slots: one per the day\'s goal (每 4 顆長休息)');
    eq(text(e, '.u13 [data-b=tslotText]'), '今天 ×0・每 4 顆長休息');
    ok(drawn(go) && drawn(idle) && !drawn(run), 'idle: the ring is the button');
    eq(seen(go), '下一顆 25 分鐘25:00▶ 開始專心');
    var gr = go.getBoundingClientRect(), rr = ring.getBoundingClientRect(), pill = $(e, '.u13 .br-go .go').getBoundingClientRect();
    ok(gr.width >= rr.width - 8 && gr.height >= rr.height - 8, 'the whole ring');
    eq(e.root.querySelectorAll('.u13 [data-act=pomo]').length, 1, 'and the only 番茄鐘 button (1.1.2: no separate 停止)');
    eq(shownText(e.root.querySelectorAll('.u13 .pline')), ['0/8 杯・50 分後起來動']);
    clickOn(go);
    eq(C.state.p.phase, 'focus');
    ok(drawn(go) && !drawn(idle) && drawn(run), 'the same button counts the focus down');
    eq(seen(go), '專心中25:00第 1 顆■ 停止');
    var stopAt = $(e, '.u13 .br-go .go').getBoundingClientRect();
    eq(Math.round((stopAt.left + stopAt.right) / 2), Math.round((pill.left + pill.right) / 2), '■ 停止 where ▶ 開始專心 was');
    eq([stopAt.top, stopAt.height], [pill.top, pill.height]);
    eq(shownText(e.root.querySelectorAll('.u13 .pline')), ['0/8 杯・提醒等休息再說']);
    eq(sizeOf(e), size, 'the window keeps its size');
    e.tick(at(12, 9, 10));
    eq([text(e, '.u13 .br-run [data-b=mmss]'), ring.style.getPropertyValue('--p')], ['15:00', '60']);
    clickOn(go);
    eq(C.state.p.phase, 'idle', '■ 停止 on the ring stops it');
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    var rem = $(e, '.u13 [data-prompt-ring]');
    ok($(e, '.u13').classList.contains('prompting') && drawn(rem) && ring.contains(rem), 'the reminder sits in the ring (Ruling C4)');
    ok(!drawn(go) && !drawn(run), 'nothing else in it');
    eq(text(e, '.u13 [data-prompt-ring] .rb-t'), '起來動一動，順便喝口水～');
    rr = ring.getBoundingClientRect();
    var cx = (rr.left + rr.right) / 2, cy = (rr.top + rr.bottom) / 2, R = rr.width / 2;
    Array.prototype.forEach.call(rem.querySelectorAll('[data-answer], .rb-t'), function (n) {
      var r = n.getBoundingClientRect();
      [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].forEach(function (p) {
        ok(Math.sqrt(Math.pow(p[0] - cx, 2) + Math.pow(p[1] - cy, 2)) <= R - 3, n.textContent + ' inside the ring');
      });
    });
    eq(sizeOf(e), size);
    clickOn(rem);
    eq(C.state.p.phase, 'idle', 'a click on the ring starts nothing while it holds the reminder');
    clickOn($(e, '[data-answer=later]'));
    ok(!$(e, '.u13').classList.contains('prompting') && drawn(go), 'back to the button');
    clickOn(go);
    e.tick(at(12, 10, 15));
    clickOn($(e, '[data-answer=ok]'));
    eq([slots(e), text(e, '.u13 [data-b=tslotText]')], ['xooo', '今天 ×1・每 4 顆長休息'], 'one done');
    ok(ring.classList.contains('rest') && drawn(run), 'the break, green');
    eq(seen(run), '休息中05:00');
    eq(sizeOf(e), size);
    done();
    var f = mk(at(12, 10, 0), { first: 'U13', care: true, settings: { health: { asked: true, pomodoro: { longEvery: 6 } } }, rec: today(0, 7, 0) });
    eq([slots(f), text(f, '.u13 [data-b=tslotText]')], ['xxxxxx', '今天 ×7・每 6 顆長休息'], 'the slots follow the goal; more than it are all filled');
    done();
  });

  test('layouts: 第 N 顆 is the focus\'s place on the day it started, across 04:00', function () {
    var e = mk(at(12, 3, 50), { first: 'U13', care: true, start: at(11, 9, 0), rec: today(0, 2, 0) });
    eq(QJZ.app.state.today.day, '2026-11-11', '03:50 is still the 11th');
    C.toggleFocus();
    eq(text(e, '.u13 .br-run [data-b=nth]'), '第 3 顆');
    e.tick(at(12, 4, 5));
    eq([QJZ.app.state.today.day, C.state.health.tomatoes], ['2026-11-12', 0], 'a new day, nothing done on it yet');
    eq(text(e, '.u13 .br-run [data-b=nth]'), '第 3 顆', 'still the third of the 11th');
    eq(U.model(QJZ.app.state, at(12, 4, 5), C.state).nth, '第 3 顆');
    e.tick(at(12, 4, 15));
    eq(QJZ.health.of(QJZ.app.state.history.days['2026-11-11']).tomatoes, 3, 'and it counts there');
    done();
  });

  test('layouts: the next stand-up is the one care publishes; after 等一下 the end of the snooze, not 0; none after work', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U12', care: true, settings: { health: BOTH } }));
    eq(C.state.standIn, 50);
    e.tick(at(12, 9, 42));
    eq([C.state.standIn, text(e, '.u12 .say')], [8, '再 8 分鐘起來動～']);
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    clickOn($(e, '[data-answer=later]'));
    eq([C.state.standIn, text(e, '.u12 .say')], [5, '再 5 分鐘起來動～'], '等一下: in 5 minutes, not 0');
    e.tick(at(12, 9, 52, 30));
    eq(C.state.standIn, 3);
    e.tick(at(12, 18, 30));   // 可以下班
    eq(shownText(e.root.querySelectorAll('.u12 .say')), [], 'after work: no next stand-up');
    done();
  });

  // §5.1: the timer stands still at lunch and starts again when it ends, so whatever it held at 12:00 never comes true.
  test('layouts: no next stand-up at lunch: no line in U12, no 「0 分後」 in U13 or U10, nothing left of it', function () {
    var e = shown(mk(at(12, 11, 9), { first: 'U12', care: true, settings: { health: BOTH } }));   // work from 09:00, the page from 11:09
    e.tick(at(12, 11, 58, 59));
    e.tick(at(12, 11, 59));
    ok($(e, '.u12').classList.contains('prompting'), 'the reminder is due at 11:59 and left unanswered');
    e.tick(at(12, 12, 0));
    ok(!$(e, '.u12').classList.contains('prompting'), 'lunch closes it quietly');
    e.tick(at(12, 12, 30));
    eq([text(e, '[data-b=status]'), C.state.standIn], ['午休中', 0], 'care\'s timer stands still, past due');
    eq(shownText(e.root.querySelectorAll('.u12 .say')), [], 'U12: no line');
    eq(e.root.textContent.indexOf('分鐘起來動'), -1, 'U12: not even hidden text');
    e.menu('layout:U13');
    eq(shownText(e.root.querySelectorAll('.u13 .pline')), ['0/8 杯'], 'U13: the cups only, no stand-up, no separator');
    eq(e.root.textContent.indexOf('分後'), -1, 'U13: no 「0 分後」');
    e.menu('layout:U10');
    hoverOn($(e, '.isl'));
    eq(shownText(e.root.querySelectorAll('.iv-x .ichip')), ['▶', '0/8 杯'], 'U10: no stand-up chip');
    eq(e.root.textContent.indexOf('分後'), -1, 'U10: no 「0 分後」');
    e.tick(at(12, 13, 0, 30));   // lunch is over: the timer starts again
    eq(shownText(e.root.querySelectorAll('.iv-x .ichip')), ['▶', '0/8 杯', '50 分後'], 'after lunch it is back');
    done();
  });

  test('layouts DOM: new layouts: no infinite animation outside the pet while nothing happens', function () {
    function loops(e) {
      return document.getAnimations().filter(function (a) {
        var t = a.effect && a.effect.target;
        return !!t && e.root.contains(t) && !t.closest('[data-pet]') && a.effect.getComputedTiming().iterations === Infinity;
      }).map(function (a) { return (a.effect.target.getAttribute('class') || a.effect.target.tagName) + (a.effect.pseudoElement || '') + ' ' + a.animationName; });
    }
    var u1 = mk(at(12, 10, 0), { care: true });
    ok(loops(u1).length > 0, 'the check sees U1\'s stripes and pulse');
    done();
    ['U10', 'U12', 'U13'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true, settings: { health: WATER_ON }, rec: today(3, 3, 5) });
      ok(e.root.querySelector('[data-pet] svg'), name + ': the pet is drawn (its own loops are its own)');
      eq(loops(e), [], name + ' working');
      if (name === 'U10') { mouse($(e, '.isl'), 'mouseover'); eq(loops(e), [], name + ' expanded'); }
      C.toggleFocus();
      e.tick(at(12, 10, 0, 1));
      eq(loops(e), [], name + ' during a focus');
      done();
    });
  });

  // 省電模式 (§5.9, Task 15): html.saver stops every decorative loop outside the pet, in every layout (the status
  // pulse, the progress stripes, U3's coin); the pet is drawn with the saver texture and its Brain idles less often.
  test('layouts: html.saver while 省電模式; no infinite animation outside the pet in U1 and U7 then', function () {
    var html = document.documentElement;
    function loops(e) {
      return document.getAnimations().filter(function (a) {
        var t = a.effect && a.effect.target;
        return !!t && e.root.contains(t) && !t.closest('[data-pet]') && a.effect.getComputedTiming().iterations === Infinity;
      }).map(function (a) { return (a.effect.target.getAttribute('class') || a.effect.target.tagName) + (a.effect.pseudoElement || '') + ' ' + a.animationName; });
    }
    var SAVER = { display: { opaque: false, powerSaver: true }, health: WATER_ON };
    ['U1', 'U3', 'U5B', 'U7', 'M3', 'U10', 'U12', 'U13'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true, settings: SAVER, rec: today(3, 3, 5) });
      eq(QJZ.layouts.current(), name);
      ok(html.classList.contains('saver'), name + ': html.saver');
      eq(loops(e), [], name + ' working');
      if (name === 'U10') { mouse($(e, '.isl'), 'mouseover'); eq(loops(e), [], name + ' expanded'); }
      done();
    });
    ok(!html.classList.contains('saver'), 'gone with the app');
    // U1: on stops its loops at once, off brings them back
    var u1 = mk(at(12, 10, 0), { care: true }), before = loops(u1);
    ok(before.length >= 2 && !html.classList.contains('saver'), 'off: ' + before);
    QJZ.app.saveSettings({ display: { powerSaver: true } });
    eq([loops(u1), html.classList.contains('saver')], [[], true], 'on');
    QJZ.app.saveSettings({ display: { powerSaver: false } });
    eq([loops(u1).length, html.classList.contains('saver')], [before.length, false], 'off again');
    done();
    // U7 with the crayon cat: redrawn at once with the still grain, and the Brain spaces its idle actions out
    var e = mk(at(12, 10, 0), { first: 'U7', settings: { pet: { kind: 'cat', skin: 's5' } } });
    ok($(e, '[data-pet] [filter*="-crayon"]'), 'off: the crayon filter');
    eq(QJZ.layouts._brain().saver, false);
    QJZ.app.saveSettings({ display: { powerSaver: true } });
    eq(loops(e), [], 'U7 on');
    eq($(e, '[data-pet] [filter*="-crayon"]'), null, 'on: no crayon filter');
    ok($(e, '[data-pet] [fill*="-gr"]'), 'the still grain instead');
    eq(QJZ.layouts._brain().saver, true, 'fewer idle actions');
    QJZ.app.saveSettings({ display: { powerSaver: false } });
    ok($(e, '[data-pet] [filter*="-crayon"]'), 'off again: the crayon filter');
    eq(QJZ.layouts._brain().saver, false);
    done();
  });

  // 省電模式, Task 15 step b (§5.9 CPU): between idle actions the pet rests, every loop of it paused (svg.rest), so
  // nothing is drawn; an idle action, a reaction or a cue plays as usual. Off, the pet moves all the time.
  test('layouts: 省電模式 pauses the pet between idle actions', function () {
    var t0 = at(12, 10, 0);
    function svg(e) { return $(e, '[data-pet] svg'); }
    function running(e) {
      return svg(e).getAnimations({ subtree: true }).filter(function (a) { return a.playState === 'running'; }).length;
    }
    var e = mk(t0, { first: 'U7', seed: 7, settings: { display: { opaque: false, powerSaver: true } } });
    eq(petState(e), 'typing');
    ok(svg(e).classList.contains('rest'), 'typing rests');
    ok(svg(e).getAnimations({ subtree: true }).length > 0, 'its loops are there');
    eq(running(e), 0, 'all paused');
    eq(getComputedStyle($(e, '[data-pet] .blink')).animationName, 'none', 'never frozen mid-blink');
    var t = t0, s = 'typing';
    while (s === 'typing' && t < t0 + 200000) { t += 1000; e.tick(t); s = petState(e); }
    ok(s !== 'typing', 'an idle action came within 200 s: ' + s);
    ok(!svg(e).classList.contains('rest') && running(e) > 0, s + ' plays');
    while (s !== 'typing' && t < t0 + 220000) { t += 1000; e.tick(t); s = petState(e); }
    ok(s === 'typing' && svg(e).classList.contains('rest') && running(e) === 0, 'and it rests again after: ' + s);
    QJZ.layouts._brain().poke(t);
    e.tick(t + 250);
    eq(petState(e), 'petted');
    ok(!svg(e).classList.contains('rest') && running(e) > 0, 'a reaction plays');
    e.tick(t + 3000);
    QJZ.app.saveSettings({ display: { powerSaver: false } });
    ok(!svg(e).classList.contains('rest') && running(e) > 0, 'off: typing moves');
    done();
    var f = mk(at(12, 17, 30, 0), { first: 'U7', settings: { display: { opaque: false, powerSaver: true } } });
    f.tick(at(12, 18, 0, 1));
    eq(petState(f), 'celebrate');
    ok(!svg(f).classList.contains('rest') && running(f) > 0, '可以下班 still celebrates');
    done();
  });
  // ---------- 1.1.1 ----------
  // Item 7: fullscreen {on, here}. here: the full-screen window is on the pet window's monitor and the host has stepped
  // the window behind it, so nothing is said at all (a speech bubble, a banner, chatter, an event or milestone line, the
  // drank line), and no jingle or coin. Nothing is replayed after it; chatter starts again 7–15 s later.
  test('layouts DOM: full screen on the pet\'s monitor says nothing at all; another monitor does; nothing is replayed', function () {
    sounds(function (n) {
      var e = shown(mk(at(12, 10, 3), { care: true })), b = $(e, '[data-bubble]');   // no reminder: nothing else asks
      QJZ.layouts.say('吱！');
      ok(b.classList.contains('show'), 'a bubble shows');
      e.bridge.emit({ type: 'fullscreen', on: true, here: true });
      ok(!b.classList.contains('show'), 'and goes at once');
      eq(QJZ.layouts.say('吱！'), false, 'a line from anyone is not said');
      C.drink();
      eq(C.state.health.cups, 1, 'a cup from the tray still counts');
      e.tick(at(12, 10, 3, 22));
      eq(QJZ.app.state.snacks, 3, 'a milestone still counts');
      steps(e, at(12, 10, 3, 23), at(12, 10, 3, 59));
      ok(!b.classList.contains('show'), 'no drank line, milestone line or chatter');
      eq(e.root.querySelectorAll('.banner, .confetti').length, 0, 'no banner, no confetti');
      eq(n.coin, 0, 'no coin');
      e.bridge.emit({ type: 'fullscreen', on: false });
      steps(e, at(12, 10, 4, 0), at(12, 10, 4, 5));
      ok(!b.classList.contains('show') && !e.root.querySelector('.banner'), 'nothing replayed');
      var talked = false;
      for (var t = at(12, 10, 4, 6); t <= at(12, 10, 4, 22); t += 1000) { e.tick(t); talked = talked || b.classList.contains('show'); }
      ok(talked, 'chatter again, 7–15 s after');
      e.bridge.emit({ type: 'fullscreen', on: true, here: false });
      eq(QJZ.layouts.say('吱！'), true, 'a full-screen window on another monitor: lines are said');
      e.bridge.emit({ type: 'fullscreen', on: true, here: true });
      e.clock.ms = at(12, 18, 0, 5);   // 可以下班 at 18:00
      QJZ.app.tickNow();
      eq(petState(e), 'celebrate', '可以下班');
      eq(n.jingle, 0, 'without its jingle');
      e.menu('layout:U5B');
      eq(QJZ.layouts.say('吱！'), false);
      eq(e.root.querySelectorAll('.banner').length, 0, 'U5-B: no banner either');
    });
  });

  // Item 4: 少記一杯 (menu undrink): the counts and the bubble's 「今天 N/8 杯」 follow at once; it pops no 「+1」.
  test('layouts DOM: 少記一杯 from the menu: the counts and the bubble\'s count at once, no 「+1」', function () {
    var e = shown(mk(at(12, 9, 0), { care: true, settings: { health: BOTH }, rec: today(3, 0, 0) }));
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    ok($(e, '.u1').classList.contains('prompting'));
    eq(text(e, '.u1 [data-prompt] .rb-s'), '已經坐 50 分鐘囉・今天 3/8 杯');
    e.menu('undrink');
    eq(shownText(e.root.querySelectorAll('.u1 .mpills [data-cups]')), ['2/8 杯']);
    eq(text(e, '.u1 [data-prompt] .rb-s'), '已經坐 50 分鐘囉・今天 2/8 杯', 'the bubble\'s count');
    eq(e.root.querySelectorAll('[data-cups] .plus').length, 0, 'no 「+1」');
    e.menu('layout:U12');
    eq(text(e, '.u12 [data-gauge=cups] b'), '2/8');
    done();
  });

  // Item 6: 下次起來動 in U1, U3, U5-B and U7, compact (🧍 N 分), by U10/U12/U13's rule: while working, with 起來動 on,
  // not while its own reminder asks; and not during a focus (its break is the next stand-up, and the ring counts down to
  // it). M3 has none. care's standIn changes once a minute; only the text changes, nothing animates.
  test('layouts: the next stand-up shows only with 起來動 on (U10, U12, U13 and the compact one alike)', function () {
    var e = shown(mk(at(12, 9, 0), { care: true, settings: { health: BOTH } }));
    e.tick(at(12, 9, 18));
    var m = U.model(QJZ.app.state, at(12, 9, 18), C.state);
    eq([m.showStand, m.standIn, m.standMin, m.showStandC], [true, '32 分後', '32 分', true]);
    done();
    e = shown(mk(at(12, 9, 0), { care: true, settings: { health: WATER_ON } }));
    e.tick(at(12, 9, 18));
    eq(C.state.standIn, 32, 'care\'s timer runs for the water reminder');
    m = U.model(QJZ.app.state, at(12, 9, 18), C.state);
    eq([m.showStand, m.standIn, m.standMin, m.showStandC], [false, '', '', false], 'water only: no stand-up to count down to');
    done();
  });

  var STANDC = { U1: '.u1 .row-top [data-show=standC]', U3: '.u3 .hud-top [data-show=standC]', U5B: '.u5b .mtop [data-show=standC]',
    U7: '.u7 .hline [data-show=standC]' };
  test('layouts DOM: U1, U3, U5-B and U7 show 🧍 N 分 (M3 does not), once a minute, without animation', function () {
    var e = shown(mk(at(12, 9, 0), { care: true, settings: { health: BOTH } }));
    e.tick(at(12, 9, 18));
    ['U1', 'U3', 'U5B', 'U7'].forEach(function (name) {
      e.menu('layout:' + name);
      var n = $(e, STANDC[name]);
      ok(n && drawn(n), name + ' shows it');
      eq(seen(n), '32 分', name);
      ok(n.querySelector('svg.ic-stand'), name + ': with the stand-up icon');
      var cs = getComputedStyle(n);
      eq([cs.animationName, cs.transitionDuration], ['none', '0s'], name + ': nothing moves');
      eq(n.hasAttribute('data-act'), false, name + ': it only shows');
    });
    eq(shownText(e.root.querySelectorAll('.u7 .hline')), ['0/8・32 分'], 'U7: on the tag line, after the cups');
    e.menu('mini');
    eq(e.root.querySelectorAll('[data-show=standC]').length, 0, 'M3: none');
    e.menu('layout:U1');
    var n = $(e, STANDC.U1), texts = [];
    for (var t = at(12, 9, 18, 1); t <= at(12, 9, 19, 59); t += 1000) {
      e.tick(t);
      if (texts[texts.length - 1] !== seen(n)) texts.push(seen(n));
    }
    eq(texts, ['32 分', '31 分'], 'once a minute');
    e.tick(at(12, 9, 49, 59));
    e.tick(at(12, 9, 50));
    ok($(e, '.u1').classList.contains('prompting') && getComputedStyle(n).visibility === 'hidden', 'not while it asks (its room kept)');
    clickOn($(e, '[data-answer=up]'));
    eq(seen(n), '50 分', 'answered: the next one');
    C.toggleFocus();
    ok(!drawn(n), 'not during a focus');
    C.toggleFocus();
    ok(drawn(n));
    e.tick(at(12, 12, 30));
    ok(!drawn(n), 'not at lunch');
    e.tick(at(12, 18, 30));
    ok(!drawn(n), 'not after work');
    done();
  });

  test('layouts DOM: the compact countdown fits its line in U1, U3, U5-B and U7, three digits and every count shown', function () {
    var e = shown(mk(at(12, 9, 0), { care: true, settings: { health: { asked: true, every: 120, sit: { on: true }, water: { on: true, goal: 12 } } },
      rec: today(10, 12, 0) }));
    C.toggleFocus();
    C.toggleFocus();   // a stopped focus: ▶ 番茄鐘 again, the tomatoes shown
    e.tick(at(12, 9, 1));
    function box(n) { return n.getBoundingClientRect(); }
    function row(list) {   // one line, side by side, none on another
      for (var i = 1; i < list.length; i++) {
        var a = box(list[i - 1]), b = box(list[i]);
        ok(Math.abs(a.top + a.bottom - b.top - b.bottom) < 6 && a.right <= b.left + 0.5, QJZ.layouts.current() + ' one line, item ' + i + ': ' +
          JSON.stringify([a.left, a.top, a.right, b.left, b.top, b.right].map(Math.round)));
      }
    }
    e.menu('layout:U1');
    var pills = Array.prototype.filter.call($(e, '.u1 .mpills').children, drawn);
    eq(pills.map(seen), ['10/12 杯', '▶ 番茄鐘', '×12'], '1.1.2: the button in the middle');
    row(pills);
    ok(box(pills[0]).left >= box($(e, '.u1 .body')).left + 15 && box(pills[2]).right <= box($(e, '.u1 .body')).right - 15, 'inside the card: ' +
      JSON.stringify(pills.map(function (p) { return Math.round(box(p).width * 10) / 10; })) + ' in ' + box($(e, '.u1 .body')).width);
    var topRow = Array.prototype.filter.call($(e, '.u1 .row-top').children, drawn);
    eq(topRow.map(seen), ['09:01:00', '119 分', '上班中'], 'the countdown beside the status');
    row(topRow);
    ok(box(topRow[2]).right <= box($(e, '.u1 .body')).right - 15, 'inside the card');
    e.menu('layout:U3');
    var top = Array.prototype.filter.call($(e, '.u3 .hud-top').children, drawn);
    row(top);
    ok(box(top[top.length - 1]).right <= box($(e, '.u3')).right - 12);
    e.menu('layout:U5B');
    var line = [$(e, '.u5b [data-b=hm]'), $(e, STANDC.U5B), $(e, '.u5b .mtop .feed'), $(e, '.u5b .mtop .x')];
    row(line);
    ok(box(line[3]).right <= box($(e, '.u5b .mid')).right + 0.5, 'U5-B: the ⋯ still in its column');
    e.menu('layout:U7');
    eq(shownText(e.root.querySelectorAll('.u7 .hline')), ['10/12・×12・119 分']);
    ok(box($(e, '.u7 .hline')).width <= box($(e, '.u7 .mtag')).width, 'U7: inside the tag');
    done();
  });

  // ---------- 1.1.2 item 4: one pomodoro button, in one place ----------
  // Start and stop are one button ([data-act=pomo], the only one) in every layout that has one (U7, M3 and U12 start it
  // from the menu), and nothing moves it: not the cups or the tomatoes appearing or going, not the countdown, not its
  // own label (▶ / ■), not the worst-case counts.
  test('layouts DOM: one pomodoro button, and counts coming and going never move it (U1, U3, U5-B, U10, U13)', function () {
    var OFF = { asked: true, every: 120, sit: { on: false }, water: { on: false, goal: 12 } };
    ['U1', 'U3', 'U5B', 'U10', 'U13'].forEach(function (name) {
      var e = shown(mk(at(12, 9, 0), { first: name, care: true, settings: { health: OFF } }));
      function btns() { return Array.prototype.filter.call(e.root.querySelectorAll('[data-act=pomo]'), drawn); }
      function where(label) {
        if (name === 'U10' && !$(e, '.isl').classList.contains('hover')) hoverOn($(e, '.isl'));
        var b = btns();
        eq(b.length, 1, name + ' ' + label + ': one button');
        var r = b[0].getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map(function (v) { return Math.round(v * 2) / 2; });
      }
      var at0 = where('nothing shown'), steps = [
        ['a cup', function () { C._dev({ cups: 3 }); }],
        ['water on', function () { QJZ.app.saveSettings({ health: { water: { on: true } } }); }],
        ['a tomato', function () { C._dev({ tomatoes: 2 }); }],
        ['a focus (■)', function () { C.toggleFocus(); }],
        ['stopped (▶)', function () { C.toggleFocus(); }],
        ['the countdown', function () { QJZ.app.saveSettings({ health: { sit: { on: true } } }); e.tick(at(12, 9, 1)); }],
        ['the worst case', function () { C._dev({ cups: 10, tomatoes: 12 }); e.tick(at(12, 9, 2)); }],
        ['a focus again', function () { C.toggleFocus(); }],
        ['water off, no cup', function () { C.toggleFocus(); QJZ.app.saveSettings({ health: { water: { on: false } } }); C._dev({ cups: 0, tomatoes: 0 }); }]
      ];
      steps.forEach(function (s) { s[1](); eq(where(s[0]), at0, name + ': ' + s[0] + ' moved it'); });
      done();
    });
  });

  // ---------- 1.1.2 item 7: the countdown chip ----------
  // A long press (HOLD_MS, about 1.2 s, by the app's clock) on the 🧍 countdown, in every layout that shows one, is
  // 我剛起來動過了: a ring fills around the chip while it is held (that animation runs only then), and the release
  // after it counts (care.stoodUp; the pet says 收到！). A short click, or a press that slides off it, does nothing: no
  // stand-up, no window drag, no poke, no mask. During 等一下 the chip shows 💤 N 分 until the snooze ends.
  var HOLD_CHIP = { U1: '.u1 .row-top [data-hold]', U3: '.u3 .hud-top [data-hold]', U5B: '.u5b .mtop [data-hold]', U7: '.u7 .hline [data-hold]',
    U10: '.u10 .iv-x [data-hold]', U13: '.u13 .pline [data-hold]' };
  function holdAnims() { return document.getAnimations().filter(function (a) { return a.animationName === 'qjz-hold'; }); }
  function chipFor(e, name) {
    if (name === 'U10') { mouse($(e, '.u10 [data-hover]'), 'mouseover', 0, 0, { buttons: 0 }); capDone($(e, '.u10 [data-hover]')); }
    return $(e, HOLD_CHIP[name]);
  }
  test('layouts DOM: a long press on the countdown is 我剛起來動過了 (U1, U3, U5-B, U7, U10, U13); a short one does nothing', function () {
    ok(U.HOLD_MS >= 1000 && U.HOLD_MS <= 1500, 'about 1.2 s: ' + U.HOLD_MS);
    ['U1', 'U3', 'U5B', 'U7', 'U10', 'U13'].forEach(function (name) {
      var e = shown(mk(at(12, 9, 0), { first: name, care: true, settings: { health: BOTH } }));
      e.tick(at(12, 9, 18));
      var chip = chipFor(e, name), T = at(12, 9, 18);
      ok(chip && drawn(chip), name + ': the chip shows');
      ok(chip.querySelector('svg.ic-stand') && /32 分/.test(seen(chip)), name + ': 🧍 32 分');
      eq(holdAnims().length, 0, name + ': nothing runs before it is held');
      var pets = 0, pet = QJZ.app.pet, masked = !!QJZ.app.state.settings.privacy.maskMoney;
      QJZ.app.pet = function () { pets++; return pet.apply(this, arguments); };
      // a short press: nothing
      e.clock.ms = T;
      mouse(chip, 'mousedown', 10, 10, { detail: 1 });
      ok(chip.classList.contains('holding'), name + ': held');
      var run = holdAnims();
      eq(run.length, 1, name + ': the ring fills while it is held');
      eq([run[0].effect.getComputedTiming().iterations, Math.round(run[0].effect.getComputedTiming().duration)], [1, U.HOLD_MS], name + ': once, over the hold');
      mouse(chip, 'mousemove', 30, 10);
      e.clock.ms = T + 500;
      mouse(chip, 'mouseup', 30, 10, { buttons: 0 });
      mouse(chip, 'click', 30, 10, { buttons: 0, detail: 1 });
      eq([C.state.health.standups, C.state.standIn], [0, 32], name + ': a short press counts nothing');
      ok(!chip.classList.contains('holding') && holdAnims().length === 0, name + ': and the ring is gone');
      // slid off before the release: nothing
      e.clock.ms = T;
      mouse(chip, 'mousedown', 10, 10, { detail: 1 });
      mouse(document.body, 'mousemove', 300, 300);
      e.clock.ms = T + 1500;
      mouse(chip, 'mouseup', 10, 10, { buttons: 0 });
      eq(C.state.health.standups, 0, name + ': slid off: nothing');
      // held long enough: a stand-up and the timer restarts
      e.clock.ms = T;
      mouse(chip, 'mousedown', 10, 10, { detail: 1 });
      e.clock.ms = T + U.HOLD_MS;
      mouse(chip, 'mouseup', 10, 10, { buttons: 0 });
      mouse(chip, 'click', 10, 10, { buttons: 0, detail: 1 });
      eq([C.state.health.standups, C.state.standIn], [1, 50], name + ': 我剛起來動過了');
      eq(of(e.sent, 'dragStart').length, 0, name + ': never a window drag');
      QJZ.app.pet = pet;
      eq(pets, 0, name + ': never a poke');
      eq(!!QJZ.app.state.settings.privacy.maskMoney, masked, name + ': never the money mask');
      eq(holdAnims().length, 0, name + ': nothing runs after it');
      done();
    });
  });

  test('layouts DOM: 我剛起來動過了 from the menu or the chip: the pet says 收到！; 等一下 says when, and the chip shows 💤 N 分', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U5B', care: true, settings: { health: BOTH } }));
    e.tick(at(12, 9, 18));
    e.menu('stoodUp');
    var b = e.root.querySelectorAll('.banner');
    eq([C.state.health.standups, b.length && b[b.length - 1].textContent], [1, '收到！'], 'U5-B: a banner');
    done();
    e = shown(mk(at(12, 9, 0), { first: 'U1', care: true, settings: { health: BOTH } }));
    e.tick(at(12, 9, 18));
    e.menu('stoodUp');
    eq(QJZ.layouts._brain().state, 'petted', 'U1: the pet is pleased');
    ok($(e, '[data-bubble]').classList.contains('show'), 'and says it in its bubble');
    // 等一下
    e.tick(at(12, 10, 7, 59));
    e.tick(at(12, 10, 8));
    ok($(e, '.u1').classList.contains('prompting'));
    e.menu('layout:U5B');
    clickOn($(e, '[data-answer=later]'));
    b = e.root.querySelectorAll('.banner');
    eq(b[b.length - 1].textContent, '好，5 分鐘後再叫你～');
    ['U5B', 'U1', 'U3', 'U7', 'U10', 'U13'].forEach(function (name) {
      e.menu('layout:' + name);
      var chip = chipFor(e, name);
      ok(drawn(chip), name + ': the chip shows during 等一下');
      ok(chip.classList.contains('snz') && drawn(chip.querySelector('.zz')) && !drawn(chip.querySelector('svg.ic-stand')), name + ': 💤, not 🧍');
      eq(chip.querySelector('.zz').textContent, '💤');
      ok(/^5 分/.test(chip.querySelector('[data-b]').textContent), name + ': ' + chip.querySelector('[data-b]').textContent);
    });
    e.menu('layout:U1');
    var chip = $(e, HOLD_CHIP.U1);
    e.tick(at(12, 10, 11));
    eq([chip.querySelector('[data-b]').textContent, drawn(chip.querySelector('.zz'))], ['2 分', true]);
    e.tick(at(12, 10, 13));
    ok($(e, '.u1').classList.contains('prompting'), 'the snooze ends: it asks again');
    ok(!chip.classList.contains('snz'), 'and the 💤 is gone');
    clickOn($(e, '[data-answer=up]'));
    eq([seen(chip), drawn(chip.querySelector('svg.ic-stand')), drawn(chip.querySelector('.zz'))], ['50 分', true, false], '🧍 again');
    done();
  });

  // Item 2: every main window with a title bar (U1, U12, U13) has three small icon buttons on it, in the sticker style
  // (round, outlined, a hard shadow): 縮小 (to the mini badge), 設定 (opens 設定) and 關閉 (hides). PANEL keeps 縮小 and 關閉.
  test('layouts DOM: U1, U12 and U13 have 縮小, 設定 and 關閉 on their title bar; 設定 opens 設定', function () {
    ['U1', 'U12', 'U13'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true });
      var bar = $(e, '.bar'), bs = Array.prototype.slice.call(bar.querySelectorAll('[data-act]'));
      eq(bs.map(function (b) { return b.getAttribute('data-act'); }), ['mini', 'settings', 'hide'], name);
      eq(bs.map(function (b) { return [b.tagName, b.getAttribute('aria-label'), b.title]; }),
        [['BUTTON', '縮小', '縮小'], ['BUTTON', '設定', '設定'], ['BUTTON', '關閉', '關閉']], name + ': labelled buttons');
      var br = bar.getBoundingClientRect();
      bs.forEach(function (b) {
        var r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        ok(b.querySelector('svg.ic') && b.textContent.trim() === '', name + ': an icon, no text');
        ok(r.width >= 18 && r.width <= 26 && Math.abs(r.width - r.height) < 0.5, name + ': small and round ' + r.width);
        ok(r.top >= br.top && r.bottom <= br.bottom && r.right <= br.right - 8, name + ': on the bar');
        ok(parseFloat(cs.borderTopWidth) >= 2 && cs.boxShadow !== 'none', name + ': outlined, with its hard shadow');
        mouse(b, 'mousedown', r.left + 5, r.top + 5);
        mouse(b, 'mousemove', r.left + 40, r.top + 5);
        mouse(b, 'mouseup', r.left + 40, r.top + 5, { buttons: 0 });
      });
      eq(of(e.sent, 'dragStart').length, 0, name + ': they never drag');
      bs[1].click();
      eq([QJZ.layouts.current(), text(e, '[data-b=title]')], ['PANEL', '錢進中 · 設定'], name + ': 設定 opens 設定');
      eq(Array.prototype.map.call(e.root.querySelectorAll('.bar [data-act]'), function (b) { return b.getAttribute('data-act'); }),
        ['mini', 'hide'], 'PANEL: 縮小 and 關閉');
      QJZ.layouts.closePanel();
      eq(QJZ.layouts.current(), name, 'back');
      $(e, '.bar [data-act=hide]').click();
      eq(of(e.sent, 'hide').length, 1, name + ': 關閉 hides');
      $(e, '.bar [data-act=mini]').click();
      eq(QJZ.layouts.current(), 'M3', name + ': 縮小 goes to the mini badge');
      done();
    });
  });

  // Item 1: bubble tails and banners (the user: 「箭頭部分重疊到框」). A tail is a turned square with two borders (the V);
  // only its outer half is drawn (clip-path), with its centre on the inner edge of the bubble's border, so its white
  // covers the border where it joins and nothing of it reaches inside the bubble; its base sits on a straight part of the
  // border, clear of the rounded corners. side: where the tail is: 'bottom', 'left' (near the bottom), 'leftTop'.
  function tailCheck(el, side, what) {
    var t = getComputedStyle(el, '::after'), b = getComputedStyle(el), sz = parseFloat(t.width), half = sz * Math.SQRT1_2;
    function r(v) { return parseFloat(v) || 0; }
    var r0 = r;
    eq(t.clipPath.replace(/\s+/g, '').split('0px').join('0%'), 'polygon(100%0%,100%100%,0%100%)', what + ': only the outer half');
    eq([t.boxSizing, t.height], ['border-box', t.width], what + ': a square of its own size');
    eq(t.backgroundClip, 'padding-box', what + ': its white stops inside its borders (no light seam on them)');
    // under its mouth a white patch from 1 px inside the bubble into the border, so the edge where the half is cut off
    // lies on white at any scale (at 150 % it falls mid-pixel, and the border showed through as a hairline)
    var pa = getComputedStyle(el, '::before'), bw = side === 'bottom' ? r0(b.borderBottomWidth) : r0(b.borderLeftWidth);
    eq([pa.content !== 'none', pa.backgroundColor], [true, b.backgroundColor], what + ': the patch, in the bubble own fill');
    var inward = side === 'bottom' ? r0(pa.bottom) + r0(pa.height) : r0(pa.left) + r0(pa.width), out = side === 'bottom' ? -r0(pa.bottom) : -r0(pa.left);
    ok(inward >= 0.9 && out > 0 && out < bw, what + ': 1 px into the bubble, into the border but not past it ' + [inward, out, bw]);
    var tx = new DOMMatrix(t.transform).e, px = pa.transform === 'none' ? 0 : new DOMMatrix(pa.transform).e;   // a translateX(-50%)
    var along = side === 'bottom' ? [r0(pa.left) + px, r0(pa.left) + px + r0(pa.width), r0(t.left) + tx + sz / 2] :
      side === 'leftTop' ? [r0(pa.top), r0(pa.top) + r0(pa.height), r0(t.top) + sz / 2] : [r0(pa.bottom), r0(pa.bottom) + r0(pa.height), r0(t.bottom) + sz / 2];
    near((along[0] + along[1]) / 2, along[2], 0.01, what + ': centred on the tail');
    ok(along[1] - along[0] < 2 * (half - bw * Math.SQRT2), what + ': inside the mouth, between the arms');
    var m = new DOMMatrix(t.transform), deg = Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI);
    if (side === 'bottom') {
      eq(deg, 45, what + ': points down');
      near(r(t.bottom), -sz / 2, 0.01, what + ': centred on the inner edge of the bottom border');
      var c = r(t.left) + tx + sz / 2, bl = r(b.borderBottomLeftRadius) - r(b.borderLeftWidth), br = r(b.borderBottomRightRadius) - r(b.borderRightWidth);
      ok(c - half >= bl - 0.5 && c + half <= el.clientWidth - br + 0.5, what + ': on the straight bottom ' + [c - half, c + half, bl, el.clientWidth - br]);
      return;
    }
    eq(deg, 135, what + ': points left');
    near(r(t.left), -sz / 2, 0.01, what + ': centred on the inner edge of the left border');
    // near: the inner radius of the corner the tail is near, far: of the other one; c: the centre's distance from the
    // near end. 1.2 px of slack at the far end: a one-line bubble, where that curve has bent by under 0.1 px.
    var top = side === 'leftTop', near0 = top ? r(b.borderTopLeftRadius) - r(b.borderTopWidth) : r(b.borderBottomLeftRadius) - r(b.borderBottomWidth);
    var far = top ? r(b.borderBottomLeftRadius) - r(b.borderBottomWidth) : r(b.borderTopLeftRadius) - r(b.borderTopWidth);
    var c2 = (top ? r(t.top) : r(t.bottom)) + sz / 2;
    ok(c2 - half >= near0 - 0.5 && c2 + half <= el.clientHeight - far + 1.2, what + ': on the straight left side ' +
      [c2 - half, c2 + half, near0, el.clientHeight - far]);
  }
  test('layouts DOM: every tail stops at its bubble\'s border and sits on a straight part of it (prompts and speech)', function () {
    var TAIL = { U1: 'bottom', U3: 'bottom', U7: 'left', M3: 'left', U12: 'left' };
    Object.keys(TAIL).forEach(function (name) {
      ['both', 'sit', 'breakEnd'].forEach(function (kind) {
        var e = shown(mk(at(12, 10, 0), { first: name, care: true, settings: { health: BOTH } }));
        C._dev({ prompt: kind });
        tailCheck($(e, '[data-prompt] .rbub'), TAIL[name], name + ' ' + kind);
        done();
      });
    });
    [['U1', 'left'], ['U7', 'left'], ['U3', 'leftTop']].forEach(function (x) {
      ['吱！', MID, LONG].forEach(function (line) {
        var e = mk(at(12, 10, 0), { first: x[0] }), b = speak(e, line);
        ok(b.classList.contains('side'), x[0] + ': beside the head');
        tailCheck(b, x[1], x[0] + ' speech ' + line.length);
        b.classList.remove('side');
        tailCheck(b, 'bottom', x[0] + ' speech without a pet');
        done();
      });
    });
    // the final review's I-1 and I-2: U7's money tag points down at the pet, the early-leave question's bubble left at it
    ['hamster:p0', 'cat:p4'].forEach(function (id) {
      var e = mk(at(12, 10, 0), { first: 'U7', settings: petOf(id).settings });
      tailCheck($(e, '.u7 .mtag'), 'bottom', 'U7 money tag ' + id);
      QJZ.layouts.openPanel('question');
      $(e, '.q-bubble b').textContent = '昨天是不是 16:02 就下班了？';   // (no question is pending here: its copy, as panels.js writes it)
      $(e, '.q-bubble small').textContent = '最後一次鎖定螢幕是 16:02，原本會算到 18:05。';
      tailCheck($(e, '.q-bubble'), 'left', 'the question bubble');
      done();
    });
  });

  var BANNER = ['好喝～今天第 4 杯了，繼續保持喔！', '還沒有零食耶～再賺 NT$ 100.00 就有了！再加油一下下吧～'];
  var ASK = { both: BOTH, sit: { asked: true, sit: { on: true }, water: { on: false } }, water: { asked: true, sit: { on: false }, water: { on: true } },
    break: BOTH, breakEnd: BOTH, none: { asked: true } };
  // The banner said last, held where it rests (its pop-in and fade-out are only the first and last 15 %).
  function bannerBox(e) {
    var all = e.root.querySelectorAll('.banner'), b = all[all.length - 1];
    b.getAnimations().forEach(function (a) { a.pause(); a.currentTime = 1000; });
    return b.getBoundingClientRect();
  }
  function union(list) {
    var r = null;
    list.forEach(function (n) {
      if (!n || !drawn(n)) return;
      var q = n.getBoundingClientRect();
      r = r ? { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) } :
        { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
    });
    return r;
  }
  function promptBox(e, name) {
    if (name === 'U5B') return union([$(e, '.pline')].concat(Array.prototype.slice.call(e.root.querySelectorAll('.pline > *'))));
    if (name === 'U13') return union([$(e, '.bigring')]);
    return union([$(e, '[data-prompt] .rbub'), $(e, '[data-prompt] .rb-ic')]);
  }
  function rect4(r) { return JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round)); }
  test('layouts DOM: a banner stays inside its window, under the title bar and clear of the prompt, in every layout', function () {
    ['U1', 'U3', 'U5B', 'U7', 'M3', 'U12', 'U13'].forEach(function (name) {
      ['none', 'both', 'sit', 'water', 'break', 'breakEnd'].forEach(function (kind) {
        if (kind === 'none' && /^(U1|U3|U7)$/.test(name)) return;   // they say it in the speech bubble
        var e = shown(mk(at(12, 10, 0), { first: name, care: true, settings: { health: ASK[kind] }, rec: today(3, 2, 1) }));
        if (kind !== 'none') C._dev({ prompt: kind, water: kind === 'break' });
        eq(!!C.state.prompt, kind !== 'none', name + ' ' + kind + ': the prompt');
        BANNER.forEach(function (text, i) {
          QJZ.layouts.say(text);
          var r = bannerBox(e), sl = last(e.sent, 'setLayout'), at2 = name + ' ' + kind + ' ' + i + ': ';
          ok(r.left >= 0 && r.top >= 0 && r.right <= sl.width - 4 && r.bottom <= sl.height - 4, at2 + 'inside the window ' + rect4(r) +
            ' in ' + sl.width + 'x' + sl.height);
          var win = $(e, '.win');
          if (win) {
            var w = win.getBoundingClientRect(), bar = $(e, '.bar');
            ok(r.left >= w.left + 3 && r.right <= w.right - 3 && r.bottom <= w.bottom - 3, at2 + 'inside the card, not cut by its edge ' + rect4(r));
            if (bar) ok(r.top >= bar.getBoundingClientRect().bottom + 2, at2 + 'under the title bar and its buttons ' + rect4(r));
          }
          var p = kind === 'none' ? null : promptBox(e, name);
          if (p) ok(apart(r, p), at2 + 'clear of the prompt ' + rect4(r) + ' / ' + rect4(p));
        });
        done();
      });
    });
  });

  // The other overlaps the screenshots showed: U7's bubble and its icon on the money tag, M3's icon on the tomato
  // sticker, and U5-B's call cut short (its last characters on a hidden third line) and against the card's top border.
  test('layouts DOM: a prompt touches nothing else: U7 clear of the money tag, M3 of its stickers, U5-B whole and inside its card', function () {
    ['both', 'sit', 'water', 'break', 'breakEnd'].forEach(function (kind) {
      var e = shown(mk(at(12, 17, 0), { first: 'U7', care: true, settings: { health: ASK[kind] }, rec: today(3, 2, 1) }));
      C._dev({ prompt: kind, water: kind === 'break' });
      ok(apart(promptBox(e, 'U7'), $(e, '.mtag').getBoundingClientRect()), 'U7 ' + kind + ': clear of the money tag ' +
        rect4(promptBox(e, 'U7')) + ' / ' + rect4($(e, '.mtag').getBoundingClientRect()));
      e.menu('mini');
      var p = promptBox(e, 'M3');
      Array.prototype.forEach.call(e.root.querySelectorAll('.m3 .mb'), function (s) {
        if (drawn(s)) ok(apart(p, s.getBoundingClientRect()), 'M3 ' + kind + ': clear of the sticker ' + rect4(p) + ' / ' + rect4(s.getBoundingClientRect()));
      });
      e.menu('layout:U5B');
      var ct = $(e, '.u5b .pline .ct'), call = $(e, '.u5b .pline .call'), card = $(e, '.u5b').getBoundingClientRect();
      ok(ct.scrollHeight <= ct.clientHeight + 1, 'U5-B ' + kind + ': the whole title shows ' + ct.scrollHeight + ' > ' + ct.clientHeight);
      ok(call.getBoundingClientRect().top >= card.top + 5, 'U5-B ' + kind + ': inside its card, clear of its border ' +
        call.getBoundingClientRect().top + ' / ' + card.top);
      done();
    });
  });

  // Item 8: U10's capsule folds about 0.3 s after the pointer leaves: 100 ms, then 200 ms of shrinking (it was a 300 ms
  // wait and then a jump). Growing and shrinking animate inside the fixed window, the hit rect follows the capsule as it
  // shows on every frame of it, and nothing runs once it has ended. U7's tools keep their 300 ms.
  function capAnims(isl) { return isl.getAnimations({ subtree: true }).filter(function (a) { return a.id === 'qjz-cap'; }); }
  test('layouts DOM: U10 starts folding 0.1 s after the pointer leaves; U7\'s tools keep 0.3 s', function () {
    eq([U.hoverOutMs('U10'), U.hoverOutMs('U7'), U.CAP_MS], [100, 300, 200]);
    ['U10', 'U7'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true }), h = $(e, '[data-hover]'), delays = [], st = window.setTimeout;
      mouse(h, 'mouseover', 0, 0, { buttons: 0 });
      window.setTimeout = function (fn, ms) { delays.push(ms); return st.apply(window, arguments); };
      try { mouse(h, 'mouseout', 0, 0, { relatedTarget: document.body, buttons: 0 }); } finally { window.setTimeout = st; }
      eq(delays, [name === 'U10' ? 100 : 300], name);
      done();
    });
  });

  test('layouts DOM: U10 grows and shrinks over 0.2 s inside its window; the hit rect follows the capsule every frame', function () {
    var raf = [], orig = window.requestAnimationFrame;
    window.requestAnimationFrame = function (f) { raf.push(f); return raf.length; };
    function frame() { var f = raf.shift(); if (f) f(performance.now()); }
    try {
      var e = mk(at(12, 10, 0), { first: 'U10', care: true }), isl = $(e, '.isl'), size = sizeOf(e), small = isl.getBoundingClientRect();
      mouse(isl, 'mouseover', 0, 0, { buttons: 0 });
      var anims = capAnims(isl);
      ok(anims.length >= 3, 'the capsule, its avatar and the view it shows now: ' + anims.length);
      ok(anims.every(function (a) { var t = a.effect.getComputedTiming(); return t.duration === 200 && t.iterations === 1; }), '0.2 s, once');
      eq(sizeOf(e), size, 'the window keeps its size');
      near(isl.getBoundingClientRect().width, small.width, 0.5, 'it starts where it was');
      eq(hitsOf(e), [U.outer(isl.getBoundingClientRect())], 'the hit rect is the capsule as it shows');
      eq(raf.length, 1, 'a frame is asked for');
      anims.forEach(function (a) { a.currentTime = 100; });
      var mid = isl.getBoundingClientRect();
      frame();
      ok(mid.width > small.width + 40 && mid.height > small.height + 15, 'half way it is bigger ' + mid.width + 'x' + mid.height);
      eq(hitsOf(e), [U.outer(mid)], 'and the hit rect with it');
      eq(raf.length, 1, 'the next frame');
      anims.forEach(function (a) { a.finish(); });
      frame();
      var big = isl.getBoundingClientRect();
      eq(hitsOf(e), [U.outer(big)], 'at the end: the expanded capsule');
      ok(big.width > mid.width && big.height > mid.height);
      eq([raf.length, capAnims(isl).length], [0, 0], 'then nothing runs');
      eq(sizeOf(e), size);

      // it folds from wherever it is
      mouse(isl, 'mouseover', 0, 0, { buttons: 0 });
      leave(isl);   // (ends the fold at once)
      raf.splice(0).forEach(function (f) { f(performance.now()); });
      near(isl.getBoundingClientRect().width, small.width, 0.5, 'folded');
      eq(hitsOf(e), [U.outer(isl.getBoundingClientRect())]);
      mouse(isl, 'mouseover', 0, 0, { buttons: 0 });
      capAnims(isl).forEach(function (a) { a.currentTime = 100; });
      mid = isl.getBoundingClientRect();
      var st = window.setTimeout, run = [];
      window.setTimeout = function (fn, ms) { if (ms === 100) { run.push(fn); return 0; } return st.apply(window, arguments); };
      try { mouse(isl, 'mouseout', 0, 0, { relatedTarget: document.body, buttons: 0 }); } finally { window.setTimeout = st; }
      run.forEach(function (f) { f(); });
      near(isl.getBoundingClientRect().width, mid.width, 0.5, 'a fold half way through growing starts from there, no jump');
      raf.splice(0).forEach(function (f) { f(performance.now()); });
      eq(hitsOf(e), [U.outer(isl.getBoundingClientRect())]);
      done();
    } finally { window.requestAnimationFrame = orig; }
  });

  test('layouts DOM: U10 under reduced motion changes size at once, with no animation', function () {
    var html = document.documentElement, was = html.classList.contains('calm');
    html.classList.add('calm');
    try {
      var e = mk(at(12, 10, 0), { first: 'U10', care: true }), isl = $(e, '.isl'), small = isl.getBoundingClientRect().width;
      mouse(isl, 'mouseover', 0, 0, { buttons: 0 });
      eq(capAnims(isl).length, 0);
      ok(isl.getBoundingClientRect().width > small + 100, 'expanded at once');
      eq(hitsOf(e), [U.outer(isl.getBoundingClientRect())]);
      done();
    } finally { html.classList.toggle('calm', was); }
  });

  // pointer {inside} from the host's hit poll (1.1.1, after the review): off every hit rect, U10's capsule folds as after
  // a mouseout (100 ms, then its 200 ms), even when no mouseout came; back on before the fold began, it stays. The 4 s
  // fallback stays. U7 does not use it: its tools are reached across click-through gaps between the pet and them.
  test('layouts DOM: U10 folds on the host\'s pointer {inside:false}, without a mouseout; back on before it began, it stays', function () {
    var e = mk(at(12, 10, 0), { first: 'U10', care: true }), isl = $(e, '.isl'), pend = [], n = 0, st = window.setTimeout, ct = window.clearTimeout;
    function fake(fn) {   // the hover timers (100 / 300 ms) held here, the rest real
      window.setTimeout = function (f, ms) { if (ms === 100 || ms === 300) { pend.push({ id: 1e6 + ++n, f: f, ms: ms }); return 1e6 + n; } return st.apply(window, arguments); };
      window.clearTimeout = function (id) { pend = pend.filter(function (p) { return p.id !== id; }); return ct.apply(window, arguments); };
      try { fn(); } finally { window.setTimeout = st; window.clearTimeout = ct; }
    }
    function fire() { pend.splice(0).forEach(function (p) { p.f(); }); capDone(isl); }
    function ms() { return pend.map(function (p) { return p.ms; }); }
    hoverOn(isl);
    fake(function () { e.bridge.emit({ type: 'pointer', inside: false }); });
    eq(ms(), [100], 'the fold starts 100 ms later, as after a mouseout');
    ok(isl.classList.contains('hover'), 'not yet');
    fire();
    ok(!isl.classList.contains('hover'), 'folded, though no mouseout came');
    eq(hitsOf(e), [U.outer(isl.getBoundingClientRect())], 'and the hit rect with it');
    fake(function () { e.bridge.emit({ type: 'pointer', inside: false }); });
    eq(ms(), [], 'folded already: nothing to do');
    hoverOn(isl);
    fake(function () {
      e.bridge.emit({ type: 'pointer', inside: false });
      e.bridge.emit({ type: 'pointer', inside: true });
    });
    eq(ms(), [], 'back on before the fold began: it stays');
    ok(isl.classList.contains('hover'));
    fake(function () {
      mouse(isl, 'mouseout', 0, 0, { relatedTarget: document.body, buttons: 0 });
      e.bridge.emit({ type: 'pointer', inside: false });
    });
    eq(ms(), [100], 'a mouseout and the host\'s word: one fold');
    fire();
    ok(!isl.classList.contains('hover'));
    fake(function () { e.bridge.emit({ type: 'pointer' }); e.bridge.emit({ type: 'pointer', inside: 'no' }); });
    eq(ms(), [], 'junk is ignored');
    done();

    var f = mk(at(12, 10, 0), { first: 'U7' }), dp = $(f, '[data-hover]');
    mouse(dp, 'mouseover', 0, 0, { buttons: 0 });
    fake(function () { f.bridge.emit({ type: 'pointer', inside: false }); });
    eq(ms(), [], 'U7 does not use it');
    ok(dp.classList.contains('hover'), 'its tools stay');
    done();
  });

  // ---------- 1.1.1 final review ----------
  // M-1: U10's banner in every dock, the capsule folded, expanded (its grow ended) and as the call: in its lane, on one
  // line (a longer one is cut short with …), inside the window, clear of the capsule and its shadow.
  test('layouts DOM: U10\'s banner keeps to its lane on one line: every dock, folded, expanded and the call', function () {
    var LONGER = BANNER[1] + '再加油一下下吧～再加油一下下吧～再加油一下下吧～';
    QJZ.settings.DOCKS.forEach(function (dock) {
      ['folded', 'expanded', 'call'].forEach(function (state) {
        var e = shown(mk(at(12, 10, 0), { first: 'U10', care: true, rec: today(3, 2, 1),
          settings: { health: ASK[state === 'call' ? 'both' : 'none'], layout: { capsule: dock } } }));
        var isl = $(e, '.isl'), at2 = dock + ' ' + state + ': ';
        if (state === 'call') C._dev({ prompt: 'both' });
        if (state === 'expanded') hoverOn(isl);
        eq([isl.classList.contains('hover'), $(e, '.u10').classList.contains('prompting')], [state === 'expanded', state === 'call'], at2 + 'the state');
        [BANNER[0], LONGER].forEach(function (text, i) {
          QJZ.layouts.say(text);
          var r = bannerBox(e), sl = last(e.sent, 'setLayout'), c = isl.getBoundingClientRect();
          var cap = { left: c.left, top: c.top, right: c.right, bottom: c.bottom + 5 };   // with its shadow
          ok(r.left >= 0 && r.top >= 0 && r.right <= sl.width && r.bottom <= sl.height, at2 + i + ' inside the window ' + rect4(r));
          ok(r.height < 40, at2 + i + ' one line: ' + r.height);
          ok(apart(r, cap), at2 + i + ' clear of the capsule ' + rect4(r) + ' / ' + rect4(cap));
        });
        var b = e.root.querySelectorAll('.banner');
        b = b[b.length - 1];
        ok(b.scrollWidth > b.clientWidth && getComputedStyle(b).textOverflow === 'ellipsis', dock + ' ' + state + ': the longer one is cut short with …');
        done();
      });
    });
  });

  // M-2: while working with 起來動 on, the compact countdown only hides (visibility) while its own reminder asks, so the
  // U7 tag and U1's pills keep their size and places; real status changes (lunch, 下班, a focus) still take it away.
  test('layouts DOM: the countdown keeps its room while its own reminder asks: U7\'s tag, the pet and U1\'s pills stay put', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U7', care: true, settings: { health: ASK.sit } }));   // 起來動 alone, nothing logged
    e.tick(at(12, 9, 49, 59));
    var n = $(e, STANDC.U7), tag = $(e, '.u7 .mtag').getBoundingClientRect(), pet = $(e, '[data-pet]').getBoundingClientRect();
    eq(shownText(e.root.querySelectorAll('.u7 .hline')), ['1 分'], 'the tag\'s third line is the countdown alone');
    e.tick(at(12, 9, 50));
    ok($(e, '.u7').classList.contains('prompting'), 'it asks');
    eq([getComputedStyle(n).visibility, drawn(n)], ['hidden', true], 'hidden, its room kept');
    eq($(e, '.u7 .mtag').getBoundingClientRect().height, tag.height, 'the tag keeps its height');
    eq($(e, '[data-pet]').getBoundingClientRect().top, pet.top, 'the pet does not jump');
    clickOn($(e, '[data-answer=up]'));
    eq([getComputedStyle(n).visibility, seen(n)], ['visible', '50 分'], 'answered: back, the next one');
    e.menu('layout:U1');
    var pills = function () { return Array.prototype.filter.call($(e, '.u1 .row-top').children, drawn).map(function (p) { return Math.round(p.getBoundingClientRect().left); }); };
    e.tick(at(12, 10, 39, 59));
    var before = pills();
    eq(before.length, 3, 'U1: the clock, the countdown and the status');
    e.tick(at(12, 10, 40));
    ok($(e, '.u1').classList.contains('prompting'));
    eq(pills(), before, 'U1: the top row stays where it was');
    eq(getComputedStyle($(e, STANDC.U1)).visibility, 'hidden');
    done();
  });

  // M-4: while a test reminder waits (a focus holds it) the timer says 0, which no countdown shows (U10's 「0 分後」).
  test('layouts: while a test reminder waits, no countdown reads 0', function () {
    var e = shown(mk(at(12, 9, 0), { first: 'U10', care: true, settings: { health: BOTH } }));
    e.tick(at(12, 9, 10));
    C.toggleFocus();
    C.remindNow();
    eq([C.state.standIn, C.state.prompt], [0, null], 'due, held by the focus');
    var m = U.model(QJZ.app.state, at(12, 9, 10), C.state);
    eq([m.showStand, m.showStandC, m.standIn], [false, false, '']);
    hoverOn($(e, '.isl'));
    ok(!/(^|[^0-9])0 分後/.test(e.root.textContent), 'U10: no 「0 分後」');
    done();
  });

  // M-5: the title-bar buttons take no keyboard focus: after 關閉 and a 顯示, Space or Enter must not hide it again.
  test('layouts DOM: a title-bar button keeps no keyboard focus', function () {
    ['U1', 'U12', 'U13'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name, care: true }), x = $(e, '.bar [data-act=hide]');
      ok(mouse(x, 'mousedown', 5, 5).defaultPrevented, name + ': a press does not move the focus to it');
      x.focus();   // however it got there
      x.click();
      eq(of(e.sent, 'hide').length, 1, name + ': 關閉 hides');
      ok(document.activeElement !== x && !(e.root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'),
        name + ': no button keeps the focus');
      done();
    });
  });
})();
