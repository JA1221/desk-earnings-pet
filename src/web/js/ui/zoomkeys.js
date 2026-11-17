window.QJZ = window.QJZ || {};
// 1.1.5 縮放比例, the quick way: in a 錢進中 window, Ctrl + = (or numpad +) zooms in one step, Ctrl + - (or numpad -) out,
// Ctrl + 0 back to 100 %, and Ctrl + wheel over it one step per notch (no click first). It is the one setting of
// 設定 → 畫面 (settings zoom, QJZ.settings.ZOOM): saved, sent to the host (app.setZoom -> setZoom, the WebView2 ZoomFactor,
// whose own Ctrl + wheel / Ctrl + ± stay off) and shown for a moment as a tip such as 「110%」 (QJZ.layouts.zoomTip).
// Keys need the keyboard, so they work in the layouts that take it (1 經典直式, 2 遊戲畫面, 3, 4, 5 and the panels); the
// wheel works over any window's visible part (elsewhere the window clicks through). The hotkey field of 設定 → 其他 keeps
// its keys. No global hotkey, no menu item.
QJZ.zoomKeys = (function () {
  var NOTCH = 50;          // wheel delta that makes one step (a mouse notch is 100; a touchpad's small deltas add up)
  var WHEEL_IDLE_MS = 400; // a pause this long starts the sum again
  var bound = null, wheel = null;

  function range() { return QJZ.settings.ZOOM; }
  function snap(p) {
    var r = range(), c = Math.min(r[1], Math.max(r[0], p));
    return r[0] + Math.round((c - r[0]) / r[2]) * r[2];
  }
  // The zoom one step in (dir 1) or out (-1) from percent, clamped; dir 0 is the reset (100).
  function next(percent, dir) {
    if (dir === 0) return QJZ.settings.DEFAULTS.zoom;
    return snap(snap(percent) + (dir > 0 ? 1 : -1) * range()[2]);
  }
  // A keydown -> 1 (in), -1 (out), 0 (reset) or null (not a zoom key). Ctrl alone (Shift allowed: Ctrl + + is Ctrl+Shift+=).
  function keyStep(e) {
    if (!e || !e.ctrlKey || e.altKey || e.metaKey) return null;
    var c = e.code || '', k = e.key || '';
    if (c === 'Equal' || c === 'NumpadAdd' || (!c && (k === '=' || k === '+'))) return 1;
    if (c === 'Minus' || c === 'NumpadSubtract' || (!c && (k === '-' || k === '_'))) return -1;
    if (c === 'Digit0' || c === 'Numpad0' || (!c && k === '0')) return 0;
    return null;
  }
  // A wheel summer: each call takes a deltaY and gives 1 (in: the wheel turned up), -1 or 0; a step resets the sum, so
  // one notch is one step.
  function wheeler() {
    var sum = 0;
    return function (dy) {
      if (!dy) return 0;
      if ((sum < 0) !== (dy < 0)) sum = 0;   // turned the other way
      sum += dy;
      if (Math.abs(sum) < NOTCH) return 0;
      var step = sum < 0 ? 1 : -1;
      sum = 0;
      return step;
    };
  }

  function apply(dir) {
    var app = QJZ.app;
    if (!app || !app.state.ready) return;
    var p = next(app.state.settings.zoom, dir);
    app.setZoom(p);
    if (QJZ.layouts && QJZ.layouts.zoomTip) QJZ.layouts.zoomTip(p + '%');
  }
  function onKey(e) {
    var dir = keyStep(e);
    if (dir === null || (e.target && e.target.closest && e.target.closest('[data-f=hotkey]'))) return;
    e.preventDefault();
    if (e.repeat) return;   // a held key is one step, not a save and a host resize per auto-repeat (review M-7)
    apply(dir);
  }
  var wheelAt = 0;
  function onWheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    var now = Date.now();
    if (now - wheelAt > WHEEL_IDLE_MS) wheel = wheeler();
    wheelAt = now;
    // deltaMode 0 is pixels (summed to notches); lines (1) or pages (2) are one step per event, whatever their size
    // (review M-3: 3 lines would otherwise read as 3 px, and need 17 events for a step)
    var dir = e.deltaMode ? (e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0) : wheel(e.deltaY);
    if (dir) apply(dir);
  }

  // opts (tests): {target: where the wheel is listened to (default the document)}.
  function start(opts) {
    if (bound) return;
    var t = (opts && opts.target) || document;
    wheel = wheeler();
    document.addEventListener('keydown', onKey, true);
    t.addEventListener('wheel', onWheel, { passive: false });
    bound = t;
  }
  function reset() {
    if (!bound) return;
    document.removeEventListener('keydown', onKey, true);
    bound.removeEventListener('wheel', onWheel, { passive: false });
    bound = null;
    wheelAt = 0;
  }

  return { start: start, _reset: reset, next: next, keyStep: keyStep, wheeler: wheeler };
})();
