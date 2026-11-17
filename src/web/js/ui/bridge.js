window.QJZ = window.QJZ || {};
// Host <-> page messages. Every message is {type, ...fields}.
// In WebView2 this wraps window.chrome.webview; in a normal browser it is a dev mock that answers
// the host's `init` from localStorage (keys qjz.settings / qjz.history) and logs every send.
// dev.html may define window.QJZ_DEV = {nowHM:'14:32:07', start:'09:12', settings:{...}} before this script.
QJZ.bridge = (function () {
  var wv = window.chrome && window.chrome.webview ? window.chrome.webview : null;
  var mock = !wv;
  var handlers = {};     // type -> [fn]
  var pending = {};      // type -> [msg] that arrived before any handler existed (host may send init early)

  function dispatch(msg) {
    if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
    if (!msg || typeof msg.type !== 'string') return;
    var list = handlers[msg.type];
    if (!list || !list.length) {
      (pending[msg.type] = pending[msg.type] || []).push(msg);
      return;
    }
    list = list.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](msg); } catch (e) { if (window.console) console.error('[bridge] handler for ' + msg.type + ' failed', e); }
    }
  }

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
    var queued = pending[type];
    if (queued) { delete pending[type]; for (var i = 0; i < queued.length; i++) dispatch(queued[i]); }
    return function off() {
      var l = handlers[type] || [], at = l.indexOf(fn);
      if (at >= 0) l.splice(at, 1);
    };
  }

  function lsGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, text) { try { window.localStorage.setItem(key, text); } catch (e) {} }

  function send(type, payload) {
    var msg = {};
    if (payload) for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k];
    msg.type = type;
    if (!mock) { wv.postMessage(msg); return; }
    if (window.console) console.log('[bridge] send', type, payload || {});
    if (type === 'saveSettings') lsSet('qjz.settings', msg.text);
    else if (type === 'saveHistory') lsSet('qjz.history', msg.text);
    else if (type === 'checkUpdate') {
      // 1.1.5: the dev mock never goes online; QJZ_DEV.update ('latest' | 'newer' | 'unknown', default unknown) answers.
      // 1.1.6 一鍵更新: 'install' is newer with 更新 (pressed, it counts to 100 % and restarts); 'downloading' (stays at
      // 42 %), 'restarting' and 'failed' are newer with 更新 too, and pressing it shows that state.
      var u = (window.QJZ_DEV || {}).update, inst = u === 'install' || u === 'downloading' || u === 'restarting' || u === 'failed';
      setTimeout(function () {
        dispatch(u === 'latest' ? { type: 'updateResult', kind: 'latest', version: DEV_VERSION } :
          u === 'newer' ? { type: 'updateResult', kind: 'newer', version: '1.2.0', install: false } :
          inst ? { type: 'updateResult', kind: 'newer', version: '1.2.0', install: true } : { type: 'updateResult', kind: 'unknown', version: null });
      }, 300);
    }
    else if (type === 'installUpdate') {
      var w = (window.QJZ_DEV || {}).update;
      if (w === 'downloading' || w === 'restarting' || w === 'failed') {
        setTimeout(function () { dispatch({ type: 'updateState', phase: w, percent: w === 'downloading' ? 42 : w === 'restarting' ? 100 : 0 }); }, 100);
      } else {
        var pct = 0, iv = setInterval(function () {
          pct += 10;
          dispatch(pct < 100 ? { type: 'updateState', phase: 'downloading', percent: pct } : { type: 'updateState', phase: 'restarting', percent: 100 });
          if (pct >= 100) clearInterval(iv);
        }, 200);
      }
    }
  }

  // Dev mock: build the init message the host would send. 1.1.7: QJZ_DEV.afterUpdate (dev.html ?updated=1) is the first
  // init after 一鍵更新, from DEV_VERSION (the pet says 「已更新到 1.1.7」).
  var DEV_VERSION = '1.1.7';
  function buildMockInit() {
    var dev = window.QJZ_DEV || {};
    var now = Date.now();
    if (dev.nowHM) {
      var p = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(dev.nowHM);
      if (p) { var d = new Date(); d.setHours(+p[1], +p[2], p[3] ? +p[3] : 0, 0); now = d.getTime(); }
    }
    var settings = lsGet('qjz.settings');
    if (settings === null && dev.settings) settings = JSON.stringify(dev.settings);
    var history = lsGet('qjz.history');
    var startHM = null;
    var q = /[?&]start=([^&]*)/.exec(window.location.search);
    if (q) startHM = decodeURIComponent(q[1]);
    else if (dev.start) startHM = dev.start;
    if (startHM && QJZ.time && QJZ.day) {
      var mins = QJZ.time.parseHM(startHM);
      if (!isNaN(mins)) {
        var key = QJZ.time.dayKey(now), h = null;
        if (history === null || history.replace(/\s+/g, '') === '') h = {};
        else { try { h = JSON.parse(history); } catch (e) { h = null; } }   // corrupt text is passed through untouched
        if (h && typeof h === 'object' && !Array.isArray(h)) {
          h.version = 1;
          if (!h.days || typeof h.days !== 'object') h.days = {};
          if (q || !h.days[key] || typeof h.days[key].startMs !== 'number') {
            var rec = QJZ.day.manualStart(QJZ.day.empty(key), QJZ.time.atMinutes(key, mins));
            rec.startSource = 'auto';
            h.days[key] = rec;
          }
          history = JSON.stringify(h);
        }
      }
    }
    var upd = dev.afterUpdate === true;
    return { type: 'init', settings: settings, history: history, probeMs: null, nowMs: now, version: upd ? DEV_VERSION : 'dev', afterUpdate: upd };
  }

  // Called by the app once its handlers are registered. The real host sends init by itself.
  function boot() {
    if (mock) setTimeout(function () { dispatch(buildMockInit()); }, 0);
  }

  if (wv) wv.addEventListener('message', function (e) { dispatch(e.data); });

  return { send: send, on: on, boot: boot, mock: mock, _dispatch: dispatch };
})();
