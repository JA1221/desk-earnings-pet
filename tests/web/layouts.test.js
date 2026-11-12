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
    QJZ.layouts.start(root, { bridge: bridge, first: o.first, seed: o.seed, session: o.session });
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
  function all(el) { return [el].concat(Array.prototype.slice.call(el.querySelectorAll('*'))); }
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
    eq(last(e.sent, 'hitRects').rects.length, 7, 'the ring as five bands along the disc, money tag, status line');
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
    mk(at(12, 10, 0), { session: store() });   // a new start: a fresh session
    eq(QJZ.layouts.current(), 'U1', 'layout.start');
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
  });

  test('layouts DOM: U7 widens the pet hit rect at once while it dangles and narrows it again after dragEnd', function () {
    var U = QJZ.layouts.util, e = mk(at(12, 10, 0), { first: 'U7' });
    var box = $(e, '[data-hit=pet]').getBoundingClientRect();
    function petRect(state) { return JSON.stringify(U.outer(U.subRect(box, U.PETONLY_VB, U.petHit(state)))); }
    function has(rects, r) { return rects.map(function (x) { return JSON.stringify(x); }).indexOf(r) >= 0; }
    function inBox(r, state) { var b = JSON.parse(petRect(state)); return r[0] >= b[0] && r[1] >= b[1] && r[0] + r[2] <= b[0] + b[2] && r[1] + r[3] <= b[1] + b[3]; }
    function petBands(rects) { var tag = $(e, '.mtag').getBoundingClientRect(); return rects.filter(function (r) { return r[1] >= tag.bottom - 1; }); }
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

  test('layouts: a disc hit area is covered by its bands and leaves its corners out', function () {
    var U = QJZ.layouts.util, r = { left: 10, top: 20, width: 100, height: 100 }, bands = U.discRects(r, 5);
    eq(bands.length, 5);
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
})();
