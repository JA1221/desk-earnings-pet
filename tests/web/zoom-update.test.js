// 1.1.5 item 1 (縮放比例: the setting, 設定 → 畫面, Ctrl+wheel and Ctrl+± / Ctrl+0, the 「110%」 tip) and item 4 (檢查更新 in
// 設定 → 其他). The host's side (ZoomFactor, the window sizes, the one request) is tested in tests/host.
// 2026-11-12 is a Thursday.
(function () {
  function at(d, h, m) { return new Date(2026, 10, d, h, m, 0, 0).getTime(); }
  var SET_UP = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true, health: { asked: true } };
  var Z = QJZ.zoomKeys;

  // ---------- pure ----------
  test('zoom: the setting is 50–150 % in 10 % steps, default 100', function () {
    function z(v) { return QJZ.settings.parse(JSON.stringify({ zoom: v })).settings.zoom; }
    eq(QJZ.settings.DEFAULTS.zoom, 100);
    eq(QJZ.settings.parse(null).settings.zoom, 100, 'missing');
    eq([z(50), z(150), z(130)], [50, 150, 130]);
    eq([z(10), z(-5), z(44.9), z(400)], [50, 50, 50, 150], 'clamped: below 50 reads as 50');
    eq([z(74), z(75), z(104.9)], [70, 80, 100], 'snapped to the nearest step, a half step up (as the host does)');
    eq([z('120'), z(true), z(null)], [100, 100, 100], 'not a number');
    eq(QJZ.settings.ZOOM, [50, 150, 10]);
  });

  test('zoom: one step in / out, clamped; reset is 100', function () {
    eq([Z.next(100, 1), Z.next(100, -1), Z.next(100, 0)], [110, 90, 100]);
    eq([Z.next(150, 1), Z.next(50, -1)], [150, 50], 'clamped');
    eq([Z.next(140, 1), Z.next(60, -1)], [150, 50]);
    eq([Z.next(130, 0), Z.next(50, 0)], [100, 100], 'reset');
    eq(Z.next(105, 1), 120, 'an off-step value snaps first (105 -> 110), then steps');
  });

  test('zoom: Ctrl + = / numpad + in, Ctrl + - / numpad - out, Ctrl + 0 resets; nothing else', function () {
    function k(o) { o.ctrlKey = o.ctrlKey !== false; return Z.keyStep(o); }
    eq([k({ key: '=', code: 'Equal' }), k({ key: '+', code: 'Equal', shiftKey: true }), k({ key: '+', code: 'NumpadAdd' })], [1, 1, 1], 'in');
    eq([k({ key: '-', code: 'Minus' }), k({ key: '_', code: 'Minus', shiftKey: true }), k({ key: '-', code: 'NumpadSubtract' })], [-1, -1, -1], 'out');
    eq([k({ key: '0', code: 'Digit0' }), k({ key: '0', code: 'Numpad0' })], [0, 0], 'reset');
    eq(k({ key: '=', code: 'Equal', ctrlKey: false }), null, 'without Ctrl');
    eq(k({ key: '=', code: 'Equal', altKey: true }), null, 'Ctrl+Alt is a hotkey, not zoom');
    eq(k({ key: '=', code: 'Equal', metaKey: true }), null, 'Win');
    eq([k({ key: 'h', code: 'KeyH' }), k({ key: '1', code: 'Digit1' }), k({ key: 'Control', code: 'ControlLeft' })], [null, null, null], 'other keys');
    eq(k({ key: '+', code: '' }), 1, 'by key when there is no code');
    eq(Z.keyStep(null), null);
  });

  test('zoom: Ctrl + wheel, one step per notch; small deltas (a touchpad) add up', function () {
    var w = Z.wheeler();
    eq([w(-100), w(100), w(-120)], [1, -1, 1], 'a notch each');
    eq([w(-20), w(-20), w(-20)], [0, 0, 1], '60 in all is a step');
    eq([w(30), w(-30)], [0, 0], 'they cancel');
    eq(w(0), 0);
  });

  // ---------- DOM ----------
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
  function mk(o) {
    o = o || {};
    QJZ.zoomKeys._reset();
    QJZ.panels._reset();
    QJZ.layouts._reset();
    QJZ.app._reset();
    var sent = [], handlers = {}, clock = { ms: at(12, 10, 0) };
    var bridge = {
      send: function (t, p) { sent.push({ type: t, p: p }); },
      on: function (t, f) {
        (handlers[t] = handlers[t] || []).push(f);
        return function () { var l = handlers[t], i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
      },
      emit: function (m) { (handlers[m.type] || []).slice().forEach(function (f) { f(m); }); }
    };
    var root = fixture();
    QJZ.layouts.start(root, { bridge: bridge, first: o.first || 'U1' });
    QJZ.panels.start();
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    QJZ.zoomKeys.start({ target: root });
    var day = QJZ.time.dayKey(clock.ms), h = { version: 1, days: {} };
    h.days[day] = QJZ.day.manualStart(QJZ.day.empty(day), at(12, 9, 0));
    var s = JSON.parse(JSON.stringify(SET_UP));
    if (o.zoom !== undefined) s.zoom = o.zoom;
    bridge.emit({ type: 'init', settings: JSON.stringify(s), history: JSON.stringify(h), probeMs: null, nowMs: clock.ms, version: o.version || '1.1.5' });
    return { bridge: bridge, sent: sent, root: root, menu: function (a) { bridge.emit({ type: 'menu', action: a }); } };
  }
  function done() { QJZ.zoomKeys._reset(); QJZ.panels._reset(); QJZ.layouts._reset(); QJZ.app._reset(); }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }).map(function (s) { return s.p; }); }
  function $(e, sel) { return e.root.querySelector(sel); }
  function text(e, sel) { var n = $(e, sel); return n ? n.textContent : null; }
  function visible(n) { return !!n && !n.hidden && n.offsetParent !== null; }
  function key(target, o) {
    var ev = new KeyboardEvent('keydown', { key: o.key, code: o.code, ctrlKey: true, shiftKey: !!o.shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  }
  function wheel(target, dy, mode) {
    var ev = new WheelEvent('wheel', { deltaY: dy, deltaMode: mode || 0, ctrlKey: true, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  }
  function tipText(e) { var t = e.root.querySelector('.tip.ztip'); return t ? t.textContent : null; }

  test('zoom DOM: Ctrl + = / - / 0 change the one setting, save it, tell the host and show the tip', function () {
    var e = mk();
    var ev = key(document.body, { key: '=', code: 'Equal' });
    ok(ev.defaultPrevented, 'the browser does not zoom too');
    eq(QJZ.app.state.settings.zoom, 110);
    eq(of(e.sent, 'setZoom'), [{ percent: 110 }], 'the host applies it');
    ok(of(e.sent, 'saveSettings').length > 0 && JSON.parse(of(e.sent, 'saveSettings').pop().text).zoom === 110, 'saved at once');
    eq(tipText(e), '110%', 'the tip');
    key(document.body, { key: '+', code: 'NumpadAdd' });
    eq(QJZ.app.state.settings.zoom, 120);
    eq(e.root.querySelectorAll('.tip.ztip').length, 1, 'one tip at a time');
    eq(tipText(e), '120%');
    key(document.body, { key: '-', code: 'NumpadSubtract' });
    key(document.body, { key: '-', code: 'Minus' });
    eq(QJZ.app.state.settings.zoom, 100);
    key(document.body, { key: '+', code: 'Equal', shiftKey: true });
    key(document.body, { key: '0', code: 'Digit0' });
    eq(QJZ.app.state.settings.zoom, 100, 'Ctrl + 0');
    eq(tipText(e), '100%');
    eq(of(e.sent, 'setZoom').map(function (p) { return p.percent; }), [110, 120, 110, 100, 110, 100]);
    done();
  });

  test('zoom DOM: a held Ctrl + = is one step, its auto-repeats ignored (review M-7)', function () {
    var e = mk();
    key(document.body, { key: '=', code: 'Equal' });
    var rep = new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true, repeat: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(rep);
    ok(rep.defaultPrevented, 'the browser does not zoom on a repeat either');
    eq([QJZ.app.state.settings.zoom, of(e.sent, 'setZoom').length], [110, 1]);
    done();
  });

  test('zoom DOM: a wheel in lines or pages is one step per event (review M-3)', function () {
    var e = mk();
    wheel(e.root.querySelector('.lay'), -3, 1);
    eq(QJZ.app.state.settings.zoom, 110, '3 lines up: one step in');
    wheel(e.root.querySelector('.lay'), -3, 1);
    eq(QJZ.app.state.settings.zoom, 120, 'each event a step');
    wheel(e.root.querySelector('.lay'), 1, 2);
    eq(QJZ.app.state.settings.zoom, 110, 'a page down: one step out');
    wheel(e.root.querySelector('.lay'), -3, 0);
    eq(QJZ.app.state.settings.zoom, 110, 'but 3 px is still only part of a notch');
    done();
  });

  // review M-6: the tall panels are sized by the zoom the host really applied (zoomApplied), which is lower than the
  // setting where the setting does not fit
  test('zoom DOM: the tall panels take the zoom the host applied, not only the chosen one', function () {
    var had = Object.getOwnPropertyDescriptor(window.screen, 'availHeight');
    Object.defineProperty(window.screen, 'availHeight', { configurable: true, get: function () { return 700; } });
    try {
      var e = mk({ zoom: 150, first: 'U5B' });   // (a panel beside it: its own height, not the layout's window)
      e.menu('settings');
      eq($(e, '.panel').style.height, '440px', 'chosen 150 %, none applied yet: 700 / 1.5 - 32, at least 440');
      $(e, '[data-act=back]').click();
      e.bridge.emit({ type: 'zoomApplied', factor: 1 });
      eq(QJZ.app.state.zoomApplied, 1);
      e.menu('settings');
      eq($(e, '.panel').style.height, '633px', 'the host fitted 100 %: the full 633');
      e.bridge.emit({ type: 'zoomApplied', factor: 'x' });
      eq(QJZ.app.state.zoomApplied, null, 'a bad factor is none');
      done();
    } finally {
      if (had) Object.defineProperty(window.screen, 'availHeight', had); else delete window.screen.availHeight;
    }
  });

  test('zoom DOM: at 150 % Ctrl + = stays and only shows the tip; at 50 % Ctrl + - too', function () {
    var e = mk({ zoom: 150 });
    key(document.body, { key: '=', code: 'Equal' });
    eq(QJZ.app.state.settings.zoom, 150);
    eq(of(e.sent, 'setZoom'), [], 'nothing changes');
    eq(tipText(e), '150%', 'the tip says where it is');
    done();
    e = mk({ zoom: 50 });
    key(document.body, { key: '-', code: 'Minus' });
    eq([QJZ.app.state.settings.zoom, of(e.sent, 'setZoom').length, tipText(e)], [50, 0, '50%']);
    done();
  });

  test('zoom DOM: Ctrl + wheel over the window, one step per notch; a plain wheel scrolls as before', function () {
    var e = mk();
    var ev = wheel($(e, '.lay') || e.root, -100);
    ok(ev.defaultPrevented, 'no browser zoom');
    eq(QJZ.app.state.settings.zoom, 110);
    wheel(e.root, 100);
    wheel(e.root, 100);
    eq(QJZ.app.state.settings.zoom, 90);
    eq(tipText(e), '90%');
    var plain = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    e.root.dispatchEvent(plain);
    ok(!plain.defaultPrevented, 'without Ctrl: untouched');
    eq(QJZ.app.state.settings.zoom, 90);
    done();
  });

  test('zoom DOM: the hotkey field keeps Ctrl + 0 and Ctrl + - for itself', function () {
    var e = mk();
    e.menu('settings');
    $(e, '[data-tab=other]').click();
    var hk = $(e, '[data-f=hotkey]');
    ok(hk, 'the hotkey field');
    key(hk, { key: '0', code: 'Digit0' });
    key(hk, { key: '-', code: 'Minus' });
    eq(of(e.sent, 'setZoom'), [], 'not zoomed');
    done();
  });

  test('zoom DOM: 設定 → 畫面 has 縮放比例 (50–150 %); a pick changes the same setting; keys move the pick', function () {
    var e = mk();
    e.menu('settings');
    $(e, '[data-tab=display]').click();
    var sel = $(e, 'select[data-f=zoom]');
    ok(visible(sel), 'a select');
    eq(Array.prototype.map.call(sel.options, function (o) { return o.textContent; }),
      ['50%', '60%', '70%', '80%', '90%', '100%', '110%', '120%', '130%', '140%', '150%']);
    eq(sel.value, '100');
    ok($(e, '[data-sec=zoom]').textContent.indexOf('Ctrl') >= 0, 'the hint names the shortcuts');
    sel.value = '130';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    eq(QJZ.app.state.settings.zoom, 130);
    eq(of(e.sent, 'setZoom'), [{ percent: 130 }]);
    key(document.body, { key: '-', code: 'Minus' });
    QJZ.panels._update();
    eq(sel.value, '120', 'the pick follows a key');
    done();
  });

  test('zoom DOM: the tip is inside the window, near its top, and not a hit rect', function () {
    ['U1', 'U7', 'U10', 'M3'].forEach(function (name) {
      var e = mk({ first: name });
      key(document.body, { key: '=', code: 'Equal' });
      var t = e.root.querySelector('.tip.ztip'), lay = e.root.querySelector('.lay'), box = lay ? lay.getBoundingClientRect() : null;
      ok(t, name + ': a tip');
      var r = t.getBoundingClientRect();
      ok(r.width > 0 && getComputedStyle(t).pointerEvents === 'none', name + ': shown, never a hit');
      ok(box && r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1, name + ': inside the window');
      done();
    });
  });

  // ---------- 檢查更新 ----------
  function openAbout(e) {
    e.menu('settings');
    $(e, '[data-tab=other]').click();
  }

  test('update DOM: nothing goes out until 檢查更新 is pressed; then one request', function () {
    var e = mk();
    openAbout(e);
    eq(of(e.sent, 'checkUpdate').length, 0, 'opening 關於 asks nothing');
    var b = $(e, '[data-pa=checkUpdate]');
    ok(visible(b), 'the button');
    ok(b.closest('.line') === $(e, '[data-o=version]').closest('.line'), 'next to the version');
    eq(b.textContent, '檢查更新');
    b.click();
    eq(of(e.sent, 'checkUpdate'), [{}], 'one request, nothing in it');
    eq(text(e, '[data-o=updText]'), '檢查中…');
    ok(b.disabled, 'no second request while one is out');
    b.click();
    eq(of(e.sent, 'checkUpdate').length, 1);
    done();
  });

  test('update DOM: the three results', function () {
    var e = mk();
    openAbout(e);
    $(e, '[data-pa=checkUpdate]').click();
    e.bridge.emit({ type: 'updateResult', kind: 'latest', version: '1.1.5' });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '已是最新版（1.1.5）');
    ok(!visible($(e, '[data-pa=openUpdate]')), 'no link');
    ok(!$(e, '[data-pa=checkUpdate]').disabled, 'can ask again');

    $(e, '[data-pa=checkUpdate]').click();
    e.bridge.emit({ type: 'updateResult', kind: 'newer', version: '1.2.0' });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '有新版 1.2.0');
    var link = $(e, '[data-pa=openUpdate]');
    ok(visible(link), 'a link');
    eq(link.textContent, '前往下載');
    link.click();
    eq(of(e.sent, 'openUpdate'), [{}], 'the host opens the release page');

    $(e, '[data-pa=checkUpdate]').click();
    e.bridge.emit({ type: 'updateResult', kind: 'unknown', version: null });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '查不到更新資訊');
    eq($(e, '[data-pa=openUpdate]').textContent, '開啟發布頁面');
    ok(visible($(e, '[data-pa=openUpdate]')));
    done();
  });

  test('update DOM: an odd answer is 查不到更新資訊; a version is shown as text only', function () {
    var e = mk();
    openAbout(e);
    $(e, '[data-pa=checkUpdate]').click();
    e.bridge.emit({ type: 'updateResult', kind: 'what' });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '查不到更新資訊');
    $(e, '[data-pa=checkUpdate]').click();
    e.bridge.emit({ type: 'updateResult', kind: 'newer', version: '<b>9.9.9</b>' });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '查不到更新資訊', 'not a version');
    e.bridge.emit({ type: 'updateResult', kind: 'latest' });
    QJZ.panels._update();
    eq(text(e, '[data-o=updText]'), '已是最新版（1.1.5）', 'no version given: the app\'s');
    done();
  });
})();
