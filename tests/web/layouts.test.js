// QJZ.layouts: pure helpers, then the real DOM (fixture at the page's top-left, layouts.css loaded by run.html)
// driven by QJZ.app with a fake bridge and a fake clock. 2026-11-12 is a Thursday, 11-14 a Saturday.
(function () {
  var U = QJZ.layouts.util;
  function at(d, h, m, s) { return new Date(2026, 10, d, h, m, s || 0, 0).getTime(); }
  var SETTINGS = { salary: { mode: 'monthly', amount: 50000, divisor: 22 } };

  // ---------- pure helpers ----------
  test('layouts: date and clock text', function () {
    eq(U.dateText(at(11, 9, 0)), '2026/11/11（三）');
    eq(U.dateText(at(15, 23, 59)), '2026/11/15（日）');
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
    eq(QJZ.layouts.MAIN, ['U1', 'U3', 'U5B', 'U7']);
    ok(U.isMain('U5B') && !U.isMain('M3') && !U.isMain('PANEL') && !U.isMain('U5-B'));
    eq(U.backTarget({ layout: { current: 'U3' } }), 'U3');
    eq(U.backTarget({ layout: { current: 'M3' } }), 'U1', 'a stored temporary layout would loop');
    eq(U.backTarget(null), 'U1');
  });

  test('layouts: item rotates every 4 s by the wall clock', function () {
    var items = QJZ.settings.DEFAULTS.items;
    eq([0, 3999, 4000, 8000, 12000].map(function (ms) { return U.itemAt(items, ms).name; }), ['珍奶', '珍奶', '便當', '拿鐵', '珍奶']);
    eq(U.itemAt([], 0), null);
  });

  test('layouts: rate line, remaining phrases, hearts', function () {
    eq(U.rateText({ mode: 'monthly', amount: 50000, divisor: 22 }, 50000 / 22 / 8 / 3600), '每秒 +NT$ 0.079 ・ 月薪 50,000 ÷ 22 天');
    eq(U.rateText({ mode: 'hourly', amount: 183.5, divisor: 22 }, 183.5 / 3600), '每秒 +NT$ 0.051 ・ 時薪 183.50');
    eq(U.rateText({ mode: 'monthly', amount: 0, divisor: 22 }, 0), '還沒設定薪資（右鍵 → 設定）');
    eq(U.remainPhrase('working', 3600 * 2 + 59), '還有 02:00 下班');
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
    eq(m.date, '2026/11/12（四）');
    eq(m.clock, '10:00:00');
    eq(m.hm, '10:00');
    eq(m.money, '284.09');
    eq(m.worked, '01:00:00');
    eq(m.remain, '07:00:00');
    eq(m.pct, '12.5%');
    eq(m.month, '1,284.09', 'closed days of this month + today, not October');
    eq(m.rate, '每秒 +NT$ 0.079 ・ 月薪 50,000 ÷ 22 天');
    eq(m.snacks, 2);
    eq(m.snack, '🌻×2');
    eq(m.plus, '+0.08');
    eq(m.petState, 'typing');
    eq(m.hearts, '♥♥♥♥♡');
    ok(m.bolts >= 0 && m.bolts <= 5);
    var it = U.itemAt(QJZ.settings.DEFAULTS.items, at(12, 10, 0));
    eq(m.itemLabel, '可以買' + it.name);
    eq(m.item, it.icon + ' ×' + QJZ.rewards.itemCount(284.0909, it));
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
  // 2.50 % -> 1.71 % of the machine with U7 shown. The stripes must move by transform on their own layer.
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
  function mk(nowMs, o) {
    o = o || {};
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
    QJZ.layouts.start(root, { bridge: bridge, first: o.first });
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    var settings = JSON.parse(JSON.stringify(SETTINGS));
    for (var k in (o.settings || {})) settings[k] = o.settings[k];
    var day = QJZ.time.dayKey(nowMs), h = { version: 1, days: {} };
    if (o.start !== null) {
      var rec = QJZ.day.manualStart(QJZ.day.empty(day), o.start === undefined ? at(12, 9, 0) : o.start);
      for (var x in (o.rec || {})) rec[x] = o.rec[x];
      h.days[day] = rec;
    }
    bridge.emit({ type: 'init', settings: JSON.stringify(settings), history: JSON.stringify(h), probeMs: null, nowMs: nowMs, version: 't' });
    return { bridge: bridge, sent: sent, clock: clock, root: root,
      menu: function (a) { bridge.emit({ type: 'menu', action: a }); },
      tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  function done() { QJZ.layouts._reset(); QJZ.app._reset(); }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }); }
  function last(sent, type) { var l = of(sent, type); return l.length ? l[l.length - 1].p : null; }
  function types(sent) { return sent.map(function (s) { return s.type; }); }
  function $(e, sel) { return e.root.querySelector(sel); }
  function text(e, sel) { var n = $(e, sel); return n ? n.textContent : null; }
  function mouse(el, type, x, y, extra) {
    var o = { bubbles: true, cancelable: true, button: 0, buttons: 1, screenX: x || 0, screenY: y || 0, clientX: x || 0, clientY: y || 0 };
    for (var k in (extra || {})) o[k] = extra[k];
    var ev = new MouseEvent(type, o);
    el.dispatchEvent(ev);
    return ev;
  }

  test('layouts DOM: init shows settings.layout.start (U1) at once with setLayout, hitRects, setTopmost', function () {
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
    eq(text(e, '[data-b=date]'), '2026/11/12（四）');
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
    eq(text(e, '[data-b=worked]'), '02:00:00');
    eq($(e, '[data-odo]').getAttribute('aria-label'), '568.18');
    ok($(e, '[data-plus] .plus'), '+0.08 floats');
    done();
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
    eq(last(e.sent, 'hitRects').rects.length, 3, 'ring, money tag, status line');
    eq(text(e, '[data-b=m3sub]'), '上班中 · 還有 07:00:00');
    mouse($(e, '.ring'), 'dblclick');
    eq(QJZ.layouts.current(), 'U3');
    QJZ.app.flush();
    var saved = JSON.parse(last(e.sent, 'saveSettings').text);
    eq(saved.layout.current, 'U3');
    done();
  });

  test('layouts DOM: U7 hit rects are tight (tag + pet), hover tools and bubbles join them', function () {
    var e = mk(at(12, 10, 0));
    e.menu('layout:U7');
    var sl = last(e.sent, 'setLayout'), rects = last(e.sent, 'hitRects').rects;
    eq(sl.layout, 'U7');
    eq(last(e.sent, 'setTopmost'), { on: true });
    eq(rects.length, 2);
    var area = 0;
    rects.forEach(function (r) {
      area += r[2] * r[3];
      ok(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= sl.width && r[1] + r[3] <= sl.height, 'inside the window: ' + r);
    });
    ok(area < sl.width * sl.height * 0.7, 'not the whole window');
    var n = of(e.sent, 'hitRects').length;
    mouse($(e, '.mtag'), 'mouseover');
    ok($(e, '.dpet').classList.contains('hover'));
    eq(of(e.sent, 'hitRects').length, n + 1);
    eq(last(e.sent, 'hitRects').rects.length, 3, '+ the ⚙ ✕ tools');
    QJZ.layouts.say('吱！');
    eq(last(e.sent, 'hitRects').rects.length, 4, '+ the bubble while it shows');
    done();
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
      var pet = $(e, '[data-pet]'), m0 = QJZ.app.state.mood.mood;
      pet.click();
      eq(petState(e), 'petted');
      eq(n.squeak, 1, 'hamster squeaks');
      eq(n.meow, 0);
      ok(e.root.querySelectorAll('.heart').length > 0, 'hearts');
      near(QJZ.app.state.mood.mood, m0 + 5, 0.01);
      for (var i = 0; i < 4; i++) pet.click();
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
      $(e, '[data-pet]').click();
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
})();
