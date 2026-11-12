// QJZ.promptView in the layouts (Task 11): QJZ.app, QJZ.care and QJZ.layouts on one fake bridge and one fake clock, the
// page shown (visibility true). Work starts 09:00 (2026-11-12, at() from harness.js); both reminders are on unless a test
// says otherwise, so the first one is due at 09:50:00.
(function () {
  var C = QJZ.care, L = QJZ.layouts, MIN = 60000;
  var SETTINGS = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true };
  var BOTH = { asked: true, sit: { on: true }, water: { on: true, goal: 8 } };
  var SIT = { asked: true, sit: { on: true }, water: { on: false } };
  var WATER = { asked: true, sit: { on: false }, water: { on: true, goal: 8 } };

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
  // o: {first (default U1), health (default BOTH), cups (today's), pet ('kind:skin')}
  function mk(nowMs, o) {
    o = o || {};
    C._reset(); L._reset(); QJZ.app._reset();
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
    L.start(root, { bridge: bridge, first: o.first || 'U1', seed: 5, session: null });
    C.start({ bridge: bridge, now: function () { return clock.ms; }, heartbeat: false });
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    var s = JSON.parse(JSON.stringify(SETTINGS));
    s.health = o.health || BOTH;
    if (o.pet) s.pet = { kind: o.pet.split(':')[0], skin: o.pet.split(':')[1] };
    var day = QJZ.time.dayKey(nowMs), h = { version: 1, days: {} };
    h.days[day] = QJZ.day.manualStart(QJZ.day.empty(day), at(9, 0));
    if (o.cups) h.days[day].health = { cups: o.cups, cupGoal: 8, tomatoes: 0, standups: 0 };
    bridge.emit({ type: 'init', settings: JSON.stringify(s), history: JSON.stringify(h), probeMs: null, nowMs: nowMs, version: 't' });
    bridge.emit({ type: 'visibility', visible: true });
    return { bridge: bridge, sent: sent, clock: clock, root: root,
      menu: function (a) { bridge.emit({ type: 'menu', action: a }); },
      tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  function done() { C._reset(); L._reset(); QJZ.app._reset(); }
  // The reminder bubble of a page started at 09:00 (seconds before, then at 09:50).
  function remind(o) {
    var e = mk(at(9, 0), o);
    e.tick(at(9, 49, 59));
    e.tick(at(9, 50));
    return e;
  }
  // The break bubble with its water line: a focus from 09:40 ends at 10:05 with the reminder due meanwhile.
  function breakBubble(o) {
    var e = mk(at(9, 0), o);
    e.tick(at(9, 40));
    C.toggleFocus();
    e.tick(at(10, 4, 59));
    e.tick(at(10, 5));
    return e;
  }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }); }
  function last(sent, type) { var l = of(sent, type); return l.length ? l[l.length - 1].p : null; }
  function $(e, sel) { return e.root.querySelector(sel); }
  function $$(e, sel) { return Array.prototype.slice.call(e.root.querySelectorAll(sel)); }
  function drawn(n) { var r = n ? n.getBoundingClientRect() : null; return !!r && r.width > 0 && r.height > 0; }
  function visible(n) { return drawn(n) && getComputedStyle(n).visibility !== 'hidden'; }
  function mouse(el, type, x, y, extra) {
    var o = { bubbles: true, cancelable: true, button: 0, buttons: 1, screenX: x || 0, screenY: y || 0, clientX: x || 0, clientY: y || 0 };
    for (var k in (extra || {})) o[k] = extra[k];
    var ev = new MouseEvent(type, o);
    el.dispatchEvent(ev);
    return ev;
  }
  function clickOn(el) {
    var r = el.getBoundingClientRect();
    return mouse(el, 'click', r.left + r.width / 2, r.top + r.height / 2, { buttons: 0 });
  }
  function answer(e, id) { clickOn($(e, '[data-answer="' + id + '"]')); }
  function buttons(el) {
    return Array.prototype.map.call(el.querySelectorAll('[data-answer]'), function (b) { return b.getAttribute('data-answer') + ' ' + b.textContent; });
  }
  function petId() { var p = QJZ.app.state.settings.pet; return p.kind + ':' + p.skin; }
  function shownPose(e) {
    var svg = $(e, '[data-pet] svg'), m = svg && /\bst-(\w+)/.exec(svg.getAttribute('class'));
    return m ? m[1] : null;
  }
  function brain() { return L._brain(); }
  function bubbleShows(e) { var b = $(e, '[data-bubble]'); return !!b && b.classList.contains('show'); }
  function petPart(e) {
    var parts = e.root.querySelectorAll('[data-pet] .pa path, [data-pet] .pa ellipse, [data-pet] .pa circle');
    for (var i = 0; i < parts.length; i++) {
      var r = parts[i].getBoundingClientRect();
      if (!parts[i].closest('.prop') && parts[i].getAttribute('fill') !== 'none' && r.width > 20 && r.height > 20) return parts[i];
    }
    return null;
  }
  // r (page px) lies inside one of the rects sent with hitRects
  function inHits(e, r) {
    return last(e.sent, 'hitRects').rects.some(function (h) {
      return r.left >= h[0] - 0.5 && r.top >= h[1] - 0.5 && r.right <= h[0] + h[2] + 0.5 && r.bottom <= h[1] + h[3] + 0.5;
    });
  }
  // the box an element is laid out at, page px, without the transforms of a knock that may be running
  function box(el) {
    var r = L.util.layoutBox(el);
    return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height, width: r.width, height: r.height };
  }
  // Replaces QJZ.sound's players with counters for the duration of fn.
  function sounds(fn) {
    var names = ['coin', 'meow', 'squeak', 'jingle'], orig = {}, n = {};
    names.forEach(function (k) { orig[k] = QJZ.sound[k]; n[k] = 0; QJZ.sound[k] = function () { n[k]++; return true; }; });
    try { fn(n); } finally { names.forEach(function (k) { QJZ.sound[k] = orig[k]; }); done(); }
  }
  // Which lines the pet picks (the state asked for), for the duration of fn.
  function said(fn) {
    var pick = QJZ.lines.pick, out = [];
    QJZ.lines.pick = function (state, ctx) { out.push(state); return pick(state, ctx); };
    try { fn(out); } finally { QJZ.lines.pick = pick; }
  }
  function knocks(el) {
    return el && el.getAnimations ? el.getAnimations().filter(function (a) { return a.id === 'qjz-knock'; }) : [];
  }

  // ---------- the module itself ----------
  test('promptView: render, clear and wave on a bare layout (buttons with data-answer and data-hit, textContent only)', function () {
    var host = document.createElement('div');
    host.innerHTML = QJZ.templates.U1();
    document.body.appendChild(host);
    try {
      var lay = host.firstElementChild, slot = lay.querySelector('[data-prompt]');
      ok(slot && slot.hidden, 'an empty slot, hidden');
      var v = QJZ.prompt.view({ kind: 'break', water: true }, { breakMin: 5, done: 3 });
      v.title = '<b>x</b>' + v.title;   // markup in a text stays text
      eq(QJZ.promptView.render(lay, 'U1', v), true);
      ok(!slot.hidden && lay.classList.contains('prompting'));
      eq(slot.textContent, '<b>x</b>休息 5 分鐘！起來走走～' + '第 3 顆番茄完成' + '順便喝口水吧～' + '好喝了跳過休息', 'title, sub, water line, buttons, in order');
      eq(slot.querySelectorAll('b b').length, 0);
      eq(buttons(slot), ['ok 好', 'drink 喝了', 'skip 跳過休息']);
      slot.querySelectorAll('[data-answer]').forEach(function (b) {
        ok(b.tagName === 'BUTTON' && b.type === 'button' && b.hasAttribute('data-hit'), b.textContent);
      });
      var a = QJZ.promptView.wave(lay, 'U1');
      ok(a && a.effect && a.effect.getComputedTiming().iterations === 1, 'one knock, never a loop');
      QJZ.promptView.wave(lay, 'U1');
      eq(knocks(slot.querySelector('.rbub')).length, 1, 'a new knock replaces the last');
      eq(QJZ.promptView.render(lay, 'U1', QJZ.prompt.view({ kind: 'sit', water: false }, { min: 50 })), true, 'update');
      eq(buttons(slot), ['up 起來了', 'later 等一下']);
      QJZ.promptView.clear(lay);
      ok(slot.hidden && slot.childNodes.length === 0 && !lay.classList.contains('prompting'));
      eq(QJZ.promptView.render(lay, 'U1', null), false, 'no view: cleared');
      host.innerHTML = QJZ.templates.PANEL();
      eq(QJZ.promptView.render(host.firstElementChild, 'PANEL', v), false, 'no slot');
      ok(!host.firstElementChild.classList.contains('prompting'));
    } finally { host.remove(); }
  });

  // ---------- in the layouts ----------
  test('promptView: U1 shows the combined bubble and answers care', function () {
    var e = mk(at(9, 0));
    e.tick(at(9, 49, 59));
    var p = $(e, '.u1 [data-prompt]');
    ok(p && !drawn(p) && !p.childNodes.length, 'nothing before 09:50');
    e.tick(at(9, 50));
    ok(drawn(p), 'shown');
    eq(p.textContent, '起來動一動，順便喝口水～' + '已經坐 50 分鐘囉・今天 0/8 杯' + '喝了起來了等一下');
    eq(buttons(p), ['drink 喝了', 'up 起來了', 'later 等一下']);
    // B 方案 1: a big bubble at the top right, over the status row, inside the window
    var win = $(e, '.u1').getBoundingClientRect(), b = box($(e, '.u1 .rbub')), st = $(e, '.u1 .status').getBoundingClientRect();
    ok(b.right <= win.right - 4 && b.left > win.left + win.width / 3 && b.top < st.bottom && b.bottom > st.top && b.right >= st.right - 2,
      'top right, over the status row: ' + JSON.stringify([b.left, b.top, b.right, b.bottom]));
    ok(b.width >= 180, 'bigger than a speech bubble: ' + b.width);
    $$(e, '.u1 [data-answer]').forEach(function (n) { ok(drawn(n) && inHits(e, box(n)), n.textContent + ' clickable'); });
    answer(e, 'up');
    eq(C.state.health.standups, 1);
    eq(C.state.prompt, null);
    ok(!p.childNodes.length && !drawn(p) && !$(e, '.u1').classList.contains('prompting'), 'the slot is empty');
    done();
  });

  test('promptView: the pet holds the cup while the bubble shows; sit-only waves', function () {
    var e = remind(), id = petId();
    eq(brain().state, 'holdCup', 'both: holdCup');
    eq(shownPose(e), QJZ.pets.poseFor(id, 'holdCup'));
    var svg = $(e, '[data-pet] svg');
    e.tick(at(9, 51));
    ok($(e, '[data-pet] svg') === svg, 'held: not redrawn');
    e.tick(at(9, 52));   // the re-wave: a knock replays holdCup's own wave (a fresh drawing restarts it)
    eq(brain().waveAt, at(9, 52));
    eq(brain().state, 'holdCup');
    ok($(e, '[data-pet] svg') !== svg, 'redrawn on the knock');
    svg = $(e, '[data-pet] svg');
    e.tick(at(9, 52, 1));
    ok($(e, '[data-pet] svg') === svg, 'once');
    done();
    e = remind({ health: SIT });
    eq(buttons($(e, '[data-prompt]')), ['up 起來了', 'later 等一下']);
    eq(brain().state, 'wave', 'sit only: wave');
    eq(shownPose(e), QJZ.pets.poseFor(petId(), 'wave'));
    e.tick(at(9, 50, 4));
    eq(brain().state, 'idle', 'then waits');
    e.tick(at(9, 52));
    eq(brain().state, 'wave', 'the re-wave');
    done();
    e = remind({ health: WATER });
    eq(buttons($(e, '[data-prompt]')), ['drink 喝了', 'later 等一下']);
    eq(brain().state, 'holdCup', 'water only: holdCup');
    done();
  });

  test('promptView: U5-B uses the status line and keeps its size', function () {
    var e = mk(at(9, 0), { first: 'U5B' }), size = last(e.sent, 'setLayout');
    e.tick(at(9, 49, 59));
    var line = $(e, '.u5b .mtop [data-prompt-line]'), mid = $(e, '.u5b .mid').getBoundingClientRect();
    ok(line && !drawn(line), 'an empty line slot in the top line');
    eq($(e, '.u5b [data-prompt]'), null, 'no bubble slot');
    ok(visible($(e, '.u5b .mtop [data-b=status]')));
    var feedAt = box($(e, '.u5b .mtop .feed'));
    e.tick(at(9, 50));
    ok(drawn(line) && $(e, '.u5b').classList.contains('prompting'));
    ok(line.textContent.indexOf('起來動一動，順便喝口水～') === 0, 'the title first: ' + line.textContent);
    eq(buttons(line), ['drink 喝了', 'up 起來了', 'later 等一下'], 'the small buttons on the same line');
    ok(!visible($(e, '.u5b .mtop [data-b=status]')) && !visible($(e, '.u5b .mtop [data-b=hm]')) && !visible($(e, '.u5b .mtop .feed')),
      'the title takes the status text\'s place');
    eq(box($(e, '.u5b .mtop .feed')), feedAt, 'nothing in the line moves');
    eq(knocks(line.querySelector('.call')).length, 1, 'the title wobbles on show');
    eq([last(e.sent, 'setLayout').width, last(e.sent, 'setLayout').height], [size.width, size.height], 'the same window size');
    var lr = line.getBoundingClientRect(), top = $(e, '.u5b .money-box').getBoundingClientRect().top;
    ok(lr.left >= mid.left - 1 && lr.right <= mid.right + 1 && lr.bottom <= top + 2, 'in the top line: ' + JSON.stringify([lr.left, lr.right, lr.bottom, mid.right, top]));
    $$(e, '.u5b [data-answer]').forEach(function (n) {
      var r = box(n);
      ok(drawn(n) && r.right <= mid.right + 1 && inHits(e, r), n.textContent + ' fits and is clickable');
    });
    e.tick(at(9, 52));
    eq(knocks(line.querySelector('.call')).length, 1, 'and once on each re-wave');
    answer(e, 'later');
    ok(!drawn(line) && !line.childNodes.length && visible($(e, '.u5b .mtop [data-b=status]')), 'back to the status');
    eq([last(e.sent, 'setLayout').width, last(e.sent, 'setLayout').height], [size.width, size.height]);
    done();
    // every kind fits the line without changing the window
    [['sit', remind.bind(null, { first: 'U5B', health: SIT })], ['water', remind.bind(null, { first: 'U5B', health: WATER })],
      ['break', breakBubble.bind(null, { first: 'U5B' })]].forEach(function (k) {
      var f = k[1](), l = $(f, '.u5b [data-prompt-line]'), m = $(f, '.u5b .mid').getBoundingClientRect();
      ok(drawn(l), k[0]);
      eq([last(f.sent, 'setLayout').width, last(f.sent, 'setLayout').height], [size.width, size.height], k[0] + ': the same size');
      $$(f, '.u5b [data-answer]').forEach(function (n) { ok(drawn(n) && box(n).right <= m.right + 1, k[0] + ' ' + n.textContent); });
      if (k[0] === 'break') {
        f.tick(at(10, 5, 30));
        answer(f, 'ok');
        f.tick(at(10, 10, 3));
        eq(buttons(l), ['next 開始', 'stop 先不要'], '休息結束');
        eq([last(f.sent, 'setLayout').width, last(f.sent, 'setLayout').height], [size.width, size.height], 'breakEnd: the same size');
        $$(f, '.u5b [data-answer]').forEach(function (n) { ok(drawn(n) && box(n).right <= m.right + 1, 'breakEnd ' + n.textContent); });
      }
      done();
    });
  });

  test('promptView: U7 and M3 grow right while prompting and return after', function () {
    ['U7', 'M3'].forEach(function (name) {
      var e = mk(at(9, 0), { first: name });
      e.tick(at(9, 49, 59));
      var before = last(e.sent, 'setLayout'), pet = box($(e, name === 'U7' ? '[data-pet]' : '.m3 .ring'));
      e.tick(at(9, 50));
      var grown = last(e.sent, 'setLayout'), bub = $(e, '[data-prompt] .rbub');
      ok(bub && drawn(bub), name + ': a bubble');
      ok(grown.width >= before.width + 100, name + ': wider ' + before.width + ' -> ' + grown.width);
      var now = box($(e, name === 'U7' ? '[data-pet]' : '.m3 .ring'));
      eq([now.left, now.top], [pet.left, pet.top], name + ': the pet stays where it was (the window grows right)');
      var b = box(bub);
      ok(b.left >= pet.left + pet.width / 2 && b.right <= grown.width - 7, name + ': right of the pet, inside the window ' + JSON.stringify([b.left, b.right, grown.width]));
      ok(b.bottom <= grown.height - 7 && b.top >= 0, name + ': inside the window, top to bottom');
      ok(bub.classList.contains('t-l'), name + ': its tail points back at the pet');
      if (name === 'M3') {
        ok(bub.classList.contains('sm'), 'M3: the small bubble');
        eq(knocks($(e, '.m3 .ring')).length, 1, 'M3: the ring knocks on show');
      }
      eq(buttons(bub), ['drink 喝了', 'up 起來了', 'later 等一下']);
      $$(e, '[data-answer]').forEach(function (n) { ok(drawn(n) && inHits(e, box(n)), name + ' ' + n.textContent + ' inside the hit rects'); });
      ok(inHits(e, b), name + ': the bubble takes its clicks');
      if (name === 'M3') {
        e.tick(at(9, 52));
        eq(knocks($(e, '.m3 .ring')).length, 1, 'M3: and once on each re-wave');
      }
      answer(e, 'later');
      eq([last(e.sent, 'setLayout').width, last(e.sent, 'setLayout').height], [before.width, before.height], name + ': back');
      ok(!last(e.sent, 'hitRects').rects.some(function (h) { return h[0] + h[2] > before.width; }), name + ': no rect left out there');
      done();
    });
  });

  test('promptView: U3 shows a big bubble over the scene', function () {
    var e = remind({ first: 'U3' }), bub = $(e, '.u3 [data-prompt] .rbub');
    ok(bub && drawn(bub));
    var w = $(e, '.u3').getBoundingClientRect(), b = box(bub), hb = $(e, '.u3 .hud-bottom').getBoundingClientRect();
    ok(b.left > w.left + w.width / 3 && b.right <= w.right - 4 && b.top > w.top && b.bottom < hb.top, 'over the scene, right of the pet: ' + JSON.stringify([b.left, b.top, b.right, b.bottom]));
    eq(buttons(bub), ['drink 喝了', 'up 起來了', 'later 等一下']);
    done();
  });

  test('promptView: the bubble follows a layout switch; the settings panel holds it', function () {
    var e = remind();
    e.menu('layout:U7');
    ok(drawn($(e, '.u7 [data-prompt] .rbub')) && $(e, '.u7').classList.contains('prompting'), 'U7 shows it');
    ok(last(e.sent, 'setLayout').width > 400, 'and is sent grown at once');
    e.menu('mini');
    ok(drawn($(e, '.m3 [data-prompt] .rbub.sm')), 'M3 shows it');
    e.menu('layout:U5B');
    ok(drawn($(e, '.u5b [data-prompt-line]')), 'U5-B shows it');
    e.menu('settings');
    eq(QJZ.layouts.current(), 'PANEL');
    eq([C.state.panel, C.state.prompt], [true, null], 'care waits while the panel is open (Ruling C1)');
    QJZ.layouts.closePanel();
    eq(C.state.panel, false);
    e.tick(at(9, 50, 30));
    e.tick(at(9, 50, 33));
    ok(drawn($(e, '.u5b [data-prompt-line]')), 'back 3 s after the panel closed');
    done();
  });

  test('promptView: no chatter and no second bubble while it shows; a user-rank say becomes a banner', function () {
    var e = mk(at(9, 0));
    e.tick(at(9, 49, 59));
    QJZ.layouts.say('等一下喔', 600000);
    ok(bubbleShows(e), 'a speech bubble before');
    e.tick(at(9, 50));
    ok(!bubbleShows(e), 'the speech bubble goes when the prompt shows');
    for (var t = at(9, 50, 1); t <= at(9, 51, 30); t += 1000) {
      e.tick(t);
      ok(!bubbleShows(e), 'no chatter at ' + new Date(t).toTimeString().slice(0, 8));
    }
    e.tick(at(9, 52));   // the re-wave says nothing either
    ok(!bubbleShows(e));
    var banners = $$(e, '.banner').length;
    eq(QJZ.layouts.say('你好'), true);
    ok(!bubbleShows(e), 'not in a second bubble');
    var bn = $$(e, '.banner');
    eq(bn.length, banners + 1, 'a banner instead');
    eq(bn[bn.length - 1].textContent, '你好');
    eq($$(e, '[data-prompt] .rbub').length, 1, 'one prompt bubble');
    banners = $$(e, '.banner').length;
    clickOn(petPart(e));
    eq(brain().state, 'petted', 'a poke still pets');
    ok(!bubbleShows(e) && $$(e, '.banner').length === banners, 'but says nothing: no banner for every click');
    answer(e, 'later');
    var spoke = false;
    for (t = at(9, 52, 1); t <= at(9, 52, 17); t += 1000) { e.tick(t); spoke = spoke || bubbleShows(e); }
    ok(spoke, 'chatter again after it closed');
    done();
  });

  test('promptView: the bubble never takes the keyboard', function () {
    var input = document.createElement('input'), focus = HTMLElement.prototype.focus, calls = 0;
    document.body.appendChild(input);
    input.focus();
    HTMLElement.prototype.focus = function () { calls++; return focus.apply(this, arguments); };
    try {
      var e = mk(at(9, 0));
      e.tick(at(9, 50));
      ok(drawn($(e, '[data-prompt] .rbub')));
      eq(document.activeElement, input, 'show');
      e.tick(at(9, 52));
      eq(document.activeElement, input, 're-wave');
      C.drink();   // from the tray: the bubble updates (still both: its count)
      e.tick(at(9, 52, 1));
      ok($(e, '[data-prompt] .rb-s').textContent.indexOf('今天 1/8 杯') > 0, 'the count: ' + $(e, '[data-prompt] .rb-s').textContent);
      eq(document.activeElement, input, 'update');
      e.menu('layout:U7');
      eq(document.activeElement, input, 'a layout switch');
      e.menu('mini');
      eq(document.activeElement, input);
      eq(calls, 0, 'focus() is never called');
      $$(e, '[data-answer]').forEach(function (b) { ok(!b.hasAttribute('autofocus'), b.textContent); });
    } finally { HTMLElement.prototype.focus = focus; input.remove(); done(); }
  });

  // Review Focus #5: a cup logged while the bubble is open, from anywhere but the bubble, shows in it at once.
  test('promptView: a cup logged elsewhere updates the count in the bubble; nothing else redraws it', function () {
    ['U1', 'M3'].forEach(function (name) {
      var e = remind({ first: name });
      function sub() { return $(e, '[data-prompt] .rb-s').textContent; }
      eq(sub(), '已經坐 50 分鐘囉・今天 0/8 杯', name);
      var btn = $(e, '[data-answer=up]');
      e.tick(at(9, 50, 1));
      e.tick(at(9, 50, 2));
      ok($(e, '[data-answer=up]') === btn, name + ': not redrawn while what it shows is the same');
      if (name === 'U1') clickOn($(e, '.u1 [data-act=drink]'));   // the cups pill beside it
      else e.menu('drink');   // the menu or the tray
      eq(C.state.prompt.kind, 'both', name + ': still asks both');
      eq(sub(), '已經坐 50 分鐘囉・今天 1/8 杯', name + ': the count follows');
      e.menu('drink');
      eq(sub(), '已經坐 50 分鐘囉・今天 2/8 杯', name);
      eq(buttons($(e, '[data-prompt]')), ['drink 喝了', 'up 起來了', 'later 等一下']);
      btn = $(e, '[data-answer=up]');
      e.tick(at(9, 50, 3));
      ok($(e, '[data-answer=up]') === btn && sub() === '已經坐 50 分鐘囉・今天 2/8 杯', name + ': then left alone');
      done();
    });
  });

  test('promptView: lifting the pet during a focus says nothing (§4.3 不講話)', function () {
    said(function (lines) {
      var e = mk(at(9, 0), { first: 'U7' }), pet = $(e, '[data-pet]');
      C.toggleFocus();
      e.tick(at(9, 1));
      lines.length = 0;
      mouse(pet, 'mousedown', 100, 100);
      mouse(pet, 'mousemove', 110, 100);
      eq(of(e.sent, 'dragStart').length, 1, 'lifted');
      eq(brain().state, 'dangle', 'it still dangles');
      eq(lines, [], 'no dangle line');
      ok(!bubbleShows(e));
      e.bridge.emit({ type: 'dragEnd' });
      eq(brain().state, 'focus');
      C.toggleFocus();   // no focus: the lift speaks again
      e.tick(at(9, 2));
      lines.length = 0;   // (back to typing has its own line)
      mouse(pet, 'mousedown', 100, 100);
      mouse(pet, 'mousemove', 110, 100);
      eq(lines, ['dangle']);
      e.bridge.emit({ type: 'dragEnd' });
      done();
    });
  });

  test('promptView: a poke during focus says 專心中～ once', function () {
    sounds(function (n) {
      said(function (lines) {
        var e = mk(at(9, 0));
        C.toggleFocus();
        e.tick(at(9, 1));
        eq(brain().state, 'focus');
        var m0 = QJZ.app.state.mood.mood;
        clickOn(petPart(e));
        eq(lines, ['focusPoke'], 'its line');
        ok(bubbleShows(e), 'said in the bubble');
        eq(QJZ.lines.pick('focusPoke', {}), '專心中～');
        lines.length = 0;
        eq([brain().state, n.squeak, $$(e, '.heart').length], ['focus', 0, 0], 'no petted reaction, no sound, no hearts');
        eq(QJZ.app.state.mood.mood, m0, 'the mood is left alone');
        for (var i = 0; i < 6; i++) clickOn(petPart(e));
        e.tick(at(9, 1, 1));
        eq([lines, brain().state, n.squeak, $$(e, '.heart').length], [[], 'focus', 0, 0], 'only once: never angry either');
        e.tick(at(9, 10));
        clickOn(petPart(e));
        eq(lines, [], 'once per focus');
        e.tick(at(9, 25));   // the tomato: the break bubble
        answer(e, 'skip');   // the next focus
        e.tick(at(9, 26));
        eq(C.state.p.phase, 'focus');
        clickOn(petPart(e));
        eq(lines, ['focusPoke'], 'a new focus answers once again');
      });
    });
  });

  // The page opens just before (a jump from 09:00 would announce the earlier milestones, quietly): NT$800 falls at
  // 11:48:57.6, NT$700 at 11:27:50.4; lunch is 12:00-13:00.
  test('promptView: quiet during a focus', function () {
    sounds(function (n) {
      // the same minutes without a focus: the milestone rings, hops and speaks
      var e = mk(at(11, 48, 40)), spoke = false, hop = false, t;
      for (t = at(11, 48, 42); t <= at(11, 49, 10); t += 2000) {
        e.tick(t);
        spoke = spoke || bubbleShows(e);
        hop = hop || brain().state === 'hop';
      }
      ok(n.coin === 1 && hop && spoke, 'without a focus: coin ' + n.coin + ', hop ' + hop + ', a line ' + spoke);
      ok($$(e, '.confetti').length > 0, 'and throws confetti');
      done();
      n.coin = 0;
      // a focus from 11:47 to 12:12, over the milestone and the start of lunch: ten minutes and more of ticks
      e = mk(at(11, 46, 50));
      C.toggleFocus();
      var snacks = QJZ.app.state.snacks;
      hop = false;
      for (t = at(11, 46, 52); t <= at(12, 1, 0); t += 2000) {
        e.tick(t);
        ok(!bubbleShows(e), 'not a word at ' + new Date(t).toTimeString().slice(0, 8));
        hop = hop || brain().state === 'hop';
      }
      eq(QJZ.app.state.snacks, snacks + 1, 'the milestone was crossed');
      eq(QJZ.app.state.snap.status, 'lunch', 'and lunch began');
      ok(hop, 'the hop plays');
      eq([n.coin, n.jingle], [0, 0], 'silently');
      eq($$(e, '.confetti').length, 0, 'no confetti either (不打擾)');
      eq([C.state.p.phase, brain().base], ['focus', 'focus']);
      done();
      // a milestone crossed while hidden during a focus: no 'missed' line when the window is back
      e = mk(at(11, 20));
      C.toggleFocus();
      e.tick(at(11, 26));
      e.bridge.emit({ type: 'visibility', visible: false });
      e.clock.ms = at(11, 29);
      e.bridge.emit({ type: 'visibility', visible: true });
      eq(QJZ.app.state.snacks, 7, 'NT$700 came while hidden');
      ok(!bubbleShows(e), 'quiet on return');
    });
  });

  test('promptView: after 喝了 the cups pill shows +1 and the pet sips; no petted or standOk line', function () {
    said(function (lines) {
      var e = remind();
      lines.length = 0;   // (the milestones of the morning, said before 09:50)
      answer(e, 'drink');
      eq([C.state.health.cups, C.state.health.standups], [1, 1]);
      eq($(e, '.u1 [data-act=drink] [data-b=cupsLong]').textContent, '1/8 杯');
      var plus = $$(e, '.u1 [data-act=drink] .plus');
      eq(plus.map(function (p) { return p.textContent; }), ['+1'], 'the pill pops +1');
      eq(brain().state, 'sip');
      eq(shownPose(e), QJZ.pets.poseFor(petId(), 'sip'));
      eq(lines, ['drank'], 'a drank line, no petted or standOk (Ruling M9)');
      ok(bubbleShows(e), 'said');
      e.tick(at(9, 50, 3));
      eq(brain().state, 'typing', 'then back to work');
      done();
      // the cup that reaches the goal: petted, hearts and a waterGoal line instead
      e = remind({ cups: 7 });
      lines.length = 0;
      answer(e, 'drink');
      eq(C.state.health.cups, 8);
      eq(brain().state, 'petted');
      ok($$(e, '.heart').length > 0, 'hearts');
      eq(lines, ['waterGoal']);
      eq($$(e, '.u1 [data-act=drink] .plus').length, 1);
      done();
      // 起來了: petted for 2 s and a standOk line; no sip, no hearts
      e = remind();
      lines.length = 0;
      answer(e, 'up');
      eq(brain().state, 'petted');
      eq(lines, ['standOk']);
      eq($$(e, '.heart').length, 0);
      e.tick(at(9, 50, 2));
      eq(brain().state, 'typing');
      done();
      lines.length = 0;
      // 記一杯水 anywhere else plays the same; a lock stand-up and a break stand-up play nothing here
      e = mk(at(9, 0), { first: 'M3' });
      e.menu('drink');
      eq(brain().state, 'sip');
      eq($$(e, '.m3 .mb.l .plus').length, 1, 'M3: the cups sticker pops +1');
      eq(lines, ['drank']);
      lines.length = 0;
      e.tick(at(9, 10));
      e.bridge.emit({ type: 'session', kind: 'lock', ms: at(9, 10) });
      e.clock.ms = at(9, 20);
      e.bridge.emit({ type: 'session', kind: 'unlock', ms: at(9, 20) });
      eq(C.state.health.standups, 1, 'a lock stand-up');
      e.tick(at(9, 20, 1));
      eq(lines.filter(function (s) { return s === 'standOk' || s === 'petted'; }), []);
      ok(brain().state !== 'petted');
      done();
    });
  });

  test('promptView: the pet follows care\'s cues: focus, the break\'s stretch, then nothing; 跳過休息 back to focus', function () {
    var e = mk(at(9, 0)), cues = [];
    C.on('cue', function (c) { cues.push(c); });
    e.tick(at(9, 40));
    C.toggleFocus();
    eq(brain().cued, 'focus');
    e.tick(at(10, 5));
    eq(cues, ['focus', 'stretch'], 'the focus ends with the break bubble');
    eq([brain().cued, brain().state], ['stretch', 'stretch']);
    e.tick(at(10, 5, 4));
    e.tick(at(10, 6));
    eq(cues, ['focus', 'stretch'], 'held while the break bubble shows');
    eq(brain().state, 'typing', 'the stretch played its 4 s');
    answer(e, 'ok');
    eq(cues, ['focus', 'stretch', null]);
    eq(brain().cued, null);
    done();
    e = breakBubble();
    cues = [];
    C.on('cue', function (c) { cues.push(c); });
    e.tick(at(10, 5, 2));
    answer(e, 'skip');
    eq(cues, ['focus'], '跳過休息: from stretch straight to focus');
    eq([brain().cued, brain().state], ['focus', 'focus']);
    done();
  });
})();
