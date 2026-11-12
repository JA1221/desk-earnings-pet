window.QJZ = window.QJZ || {};
// The visible layouts, built after docs/prototypes/converge.html: main windows U1 經典直式, U3 遊戲畫面,
// U5B 橫向極簡, U7 桌面寵物; the temporary mini badge M3 and PANEL. PANEL is the window frame (title bar, size,
// hit rects); its content is QJZ.panels (onboarding / settings / history / question, 'adjust' = settings at 起算),
// mounted when PANEL is built and updated on every render. The first layout is a panel when QJZ.panels.initial
// asks for one (onboarding, an early-leave question); closing it goes to the start layout.
//
// Host protocol (page -> host; sizes and rects in CSS px, dpr = window.devicePixelRatio):
//   setLayout {layout, width, height, dpr}  width / height reach the layout root's right / bottom edge plus the 7px
//                                           hard shadow. Sent synchronously after rendering (the window is still
//                                           hidden at start and rAF does not run there), again whenever the size
//                                           or the DPR changes.
//   hitRects {rects:[[x,y,w,h],...], dpr}   one rect per visible [data-hit] element; everything else clicks
//                                           through. Sent with every setLayout and whenever the rects change
//                                           (hover tools, text growing, resize). Speech bubbles are never
//                                           interactive: no rect of their own, pointer-events none.
//   setTopmost {on}                         after every layout change, from settings.layout.topmost (and when the
//                                           settings panel changes the setting of the layout PANEL came from).
//   dragStart {}  primary button pressed on a non-button area and moved DRAG_PX (a plain click stays a click, so
//                 pets can be poked and M3 double-clicked).
//   contextMenu {} right-click anywhere (and the ⋯ button).    hide {}  the close dot / ✕ button.
// Host -> page: menu {action} (TrayMenu ids), dragEnd {}.
//
// settings.layout.current is the last MAIN layout (U1/U3/U5B/U7); M3 and PANEL never go there. The first layout
// after init is settings.layout.start (dev pages may override it with opts.first), except after a reload of the
// page (the host reloads it after a renderer crash): the layout shown last (M3 included; PANEL: the layout it came
// from) is kept in sessionStorage, which only lives as long as this WebView, and comes back.
// Rendering: the odometer follows the 100 ms tick; every other text changes at most once a second (or on a
// record / settings change), computed from the wall clock, and is only written when it changed.
// The pet: QJZ.behavior's Brain decides the state from the wall clock on every app tick (base state per status,
// idle actions, reactions); the holder node stays and the SVG is swapped only when the state or the skin changes.
// Reactions: a plain click on the pet is a poke (petted / angry), 餵食 plays eat when the snack lands, a milestone
// hops (with confetti and the coin sound; quietly, one bubble at most, when it was crossed while hidden), U7 dangles
// from dragStart until dragEnd, a live 可以下班 plays the jingle. Speech: QJZ.lines, in the bubble (U1, U3, U7)
// every 7–15 s after the last one and on events; bubble timers run only while a bubble shows. Bubble ranks: chatter
// < pet events < the user's own actions and anything other modules say (those always show).
QJZ.layouts = (function () {
  var MAIN = ['U1', 'U3', 'U5B', 'U7'];
  var ALL = ['U1', 'U3', 'U5B', 'U7', 'M3', 'PANEL'];
  var SHADOW = 7;
  var DRAG_PX = 4;
  var PETONLY_VB = [30, 4, 176, 170];    // QJZ.pets.compose 'petonly' viewBox
  var PET_HIT = [38, 24, 160, 148];      // the pet and its desk inside that viewBox, every skin and base state
  // Reactions that leave PET_HIT, measured over all 8 skins and the whole animation (normal motion), clipped to the
  // viewBox: hop rises up to 12.7 above it (cat P0) and squashes 3.4 left / 5.6 right on landing; dangle swings to
  // both viewBox sides (hamster P0, S5) and up to its top (cat P0). Only while they play.
  var PET_HIT_BY_STATE = { hop: [34, 11, 170, 161], dangle: [30, 4, 176, 168] };
  function petHit(state) { return PET_HIT_BY_STATE.hasOwnProperty(state) ? PET_HIT_BY_STATE[state] : PET_HIT; }
  var HUD_VB = '0 -4 300 236';           // U3 room crop (prototype)
  var STATUS = { working: '上班中', lunch: '午休中', done: '可以下班', ended: '已下班', before: '還沒上班', off: '休假日' };
  var SNACK = { cat: '🐟', hamster: '🌻' };
  var WD = '日一二三四五六';
  var CHAT_GAP = [7000, 15000], GAP_MS = 5000, SNACK_FLY_MS = 800, DRAG_SAFETY_MS = 60000;
  var SHOWN_KEY = 'qjz.layout';   // sessionStorage: the layout to come back to after a reload
  var RANK = { chat: 1, event: 2, user: 3 };
  var REACTIONS = { petted: 1, angry: 1, eat: 1, hop: 1, dangle: 1 };

  // ================= pure helpers (tests: QJZ.layouts.util) =================
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hms(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
  }
  // hh:mm of a remaining duration, counted UP to the next whole minute: with whole-minute start and end times, 17:36:30
  // reads 還有 00:01, and 可以下班 comes exactly at 17:37:00 (never 還有 00:00 while the status is still working).
  function hm(sec) { return hms(Math.ceil(Math.max(0, sec || 0) / 60) * 60).slice(0, 5); }
  function dateText(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '（' + WD.charAt(d.getDay()) + '）';
  }
  function clockText(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // working | lunch | done | ended | before | off. 'off' = not started on a day off (休假 marker or not a work day).
  function statusKey(snap, today, settings) {
    var st = snap && STATUS[snap.status] ? snap.status : 'before';
    if (st === 'before' && today) {
      var workday = settings && settings.workDays ? settings.workDays.indexOf(QJZ.time.weekday(today.day)) >= 0 : true;
      if (today.offDay || !workday) return 'off';
    }
    return st;
  }
  function isMain(name) { return MAIN.indexOf(name) >= 0; }
  // Where M3 / PANEL go back to: the stored main layout (a hand-edited 'M3' there would loop, so U1).
  function backTarget(settings) {
    var c = settings && settings.layout ? settings.layout.current : null;
    return isMain(c) ? c : 'U1';
  }
  // The item shown by the 可以買 chip: rotates every 4 s, from the wall clock.
  function itemAt(items, ms) {
    if (!items || !items.length) return null;
    return items[Math.floor(ms / 4000) % items.length];
  }
  function money(n) { return QJZ.odometer.format(n); }
  function amountText(n) {
    return n % 1 === 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : money(n);
  }
  function rateText(salary, perSec) {
    if (!salary || !(salary.amount > 0)) return '還沒設定薪資（右鍵 → 設定）';
    return '每秒 +NT$ ' + perSec.toFixed(3) + ' ・ ' + (salary.mode === 'hourly' ? '時薪 ' + amountText(salary.amount)
      : '月薪 ' + amountText(salary.amount) + ' ÷ ' + salary.divisor + ' 天');
  }
  function remainPhrase(key, sec) {
    if (key === 'done') return '可以下班囉！';
    if (key === 'ended') return '今天辛苦了！';
    if (key === 'off') return '今天休假';
    if (key === 'before') return '還沒開始上班';
    return '還有 ' + hm(sec) + ' 下班';
  }
  function m3Sub(key, sec) {
    return key === 'working' || key === 'lunch' ? STATUS[key] + ' · 還有 ' + hms(sec) : STATUS[key];
  }
  function heartsText(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '♥' : '♡';
    return s;
  }
  function clamp5(n) { return Math.max(0, Math.min(5, Math.round(n))); }
  // 心情 / 體力 (0..5) from QJZ.mood (app.state.mood); without one (pure model tests) the start values: mood 70 ->
  // 4 hearts, energy draining with the day's progress (100 -> 40 over a full day).
  function vitals(st, pct) {
    if (st.mood && QJZ.mood && QJZ.mood.hearts) return { hearts: QJZ.mood.hearts(st.mood), bolts: QJZ.mood.bolts(st.mood) };
    return { hearts: clamp5(70 / 20), bolts: clamp5((100 - 60 * pct) / 20) };
  }

  // Everything a layout displays, from the app state at wall-clock time ms.
  function model(st, ms) {
    var s = st.settings, snap = st.snap, today = st.today;
    var key = statusKey(snap, today, s);
    var perSec = st.rates ? st.rates.perSecond : 0;
    var pct = Math.max(0, Math.min(1, snap.pct || 0));
    var it = itemAt(s.items, ms);
    var kind = s.pet && s.pet.kind === 'cat' ? 'cat' : 'hamster';
    var v = vitals(st, pct);
    var snacks = st.snacks > 0 ? st.snacks : 0;
    var clock = clockText(ms);
    return {
      key: key, kind: kind, status: STATUS[key],
      petState: QJZ.behavior ? QJZ.behavior.base(snap.status, snap.remainingSec / 60) : 'typing',   // base state
      date: dateText(ms), clock: clock, hm: clock.slice(0, 5),
      money: money(snap.earned),
      pct: (pct * 100).toFixed(1) + '%', pctNum: pct * 100,
      remain: hms(snap.remainingSec), remainPhrase: remainPhrase(key, snap.remainingSec), m3sub: m3Sub(key, snap.remainingSec),
      worked: hms(snap.workedSec),
      itemLabel: it ? '可以買' + it.name : '',
      item: it ? (it.icon ? it.icon + ' ' : '') + '×' + QJZ.rewards.itemCount(snap.earned, it) : '',
      month: money(QJZ.history.monthTotal(st.history, today.day.slice(0, 7), today, snap.earned)),
      rate: rateText(s.salary, perSec),
      hearts: heartsText(v.hearts), bolts: v.bolts,
      snacks: snacks, snack: SNACK[kind] + '×' + snacks,
      plus: key === 'working' && perSec > 0 ? '+' + perSec.toFixed(2) : null
    };
  }

  // The part of a box that a viewBox region covers (the box shows the whole viewBox, same aspect ratio).
  function subRect(r, vb, region) {
    var sx = r.width / vb[2], sy = r.height / vb[3];
    return { left: r.left + (region[0] - vb[0]) * sx, top: r.top + (region[1] - vb[1]) * sy, width: region[2] * sx, height: region[3] * sy };
  }
  // Whole CSS px that cover r: [x, y, w, h].
  function outer(r) {
    var x = Math.floor(r.left), y = Math.floor(r.top);
    return [x, y, Math.ceil(r.left + r.width) - x, Math.ceil(r.top + r.height) - y];
  }

  // ---- speech bubble beside the pet ----
  // The viewBox of each pet holder view; the room views fill their box (slice), petonly fits it (meet).
  var VIEWBOX = { petonly: PETONLY_VB, scene: [0, 0, 300, 200], hud: HUD_VB.split(' ').map(Number) };
  // Where point pt of viewBox vb lands in a box {width, height} that shows it centred: px from the box's left / top.
  function vbPoint(box, vb, pt, slice) {
    var sx = box.width / vb[2], sy = box.height / vb[3], s = slice ? Math.max(sx, sy) : Math.min(sx, sy);
    return { x: (box.width - vb[2] * s) / 2 + (pt[0] - vb[0]) * s, y: (box.height - vb[3] * s) / 2 + (pt[1] - vb[1]) * s };
  }
  // Puts bubble b beside the pet's head: --tx / --ty = where its tail ends (QJZ.pets.speechAt for pet id in state,
  // just right of the head at eye height), --clear = 6 px below the [data-bubble-clear] elements in scope (a bubble
  // that grows downwards stays under them), all in px of the bubble's own box (its offsetParent, the .fx layer);
  // layouts.css lays the bubble out from them (.side). Without a drawn pet it keeps its plain corner place.
  // -> {x, y, clear} or null.
  function anchorBubble(b, holder, petView, id, state, scope) {
    var box = b ? b.offsetParent : null, svg = holder ? holder.querySelector('svg') : null;
    var pt = svg && box && VIEWBOX[petView] && QJZ.pets && QJZ.pets.speechAt ? QJZ.pets.speechAt(id, state) : null;
    if (!pt) { if (b) b.classList.remove('side'); return null; }
    var br = box.getBoundingClientRect(), hr = holder.getBoundingClientRect();
    var p = vbPoint(hr, VIEWBOX[petView], pt, petView !== 'petonly');
    var at = { x: Math.round(hr.left - br.left + p.x), y: Math.round(hr.top - br.top + p.y), clear: 0 };
    Array.prototype.forEach.call((scope || box.parentNode).querySelectorAll('[data-bubble-clear]'), function (el) {
      var r = el.getBoundingClientRect();
      if (r.height > 0) at.clear = Math.max(at.clear, Math.ceil(r.bottom - br.top) + 6);
    });
    b.style.setProperty('--tx', at.x + 'px');
    b.style.setProperty('--ty', at.y + 'px');
    b.style.setProperty('--clear', at.clear + 'px');
    b.classList.add('side');
    return at;
  }

  // ================= markup =================
  var BAR = '<div class="bar"><span class="logo">$</span><span data-b="title">錢進中</span><div class="dots">' +
    '<i data-act="mini" title="縮成迷你"></i><i data-act="hide" title="隱藏"></i></div></div>';
  var MONEY = '<div class="money"><span class="cur">NT$</span><span class="odo" data-odo></span></div>';
  var PILL = '<div class="status"><i></i><span data-b="status"></span></div>';
  function feedBtn(cls) {
    return '<button type="button" class="' + cls + '" data-act="feed" data-feed title="餵食"><span data-b="snack"></span> 餵食</button>';
  }
  var TEMPLATES = {
    U1: function () {
      return '<div class="win u1 lay" data-hit>' + BAR + '<div class="body">' +
        '<div class="row-top"><div><div class="date" data-b="date"></div><div class="clock" data-b="clock"></div></div>' + PILL + '</div>' +
        '<div class="scene-wrap"><div class="scene" data-pet="scene"></div><div class="fx" data-fx><div class="bubble" data-bubble></div></div></div>' +
        '<div class="money-box" data-plus><div class="money-label">今天已經賺到</div>' + MONEY + '<div class="rate" data-b="rate"></div></div>' +
        '<div><div class="prog-top"><span>今日進度 <b data-b="pct"></b></span><span>距離下班 <b data-b="remain"></b></span></div>' +
          '<div class="track"><div class="fill" data-fill></div></div></div>' +
        '<div class="chips"><div class="chip"><small>已上班</small><b data-b="worked"></b></div>' +
          '<div class="chip"><small data-b="itemLabel"></small><b data-b="item"></b></div>' +
          '<div class="chip"><small>本月累計</small><b data-b="month"></b></div></div>' +
        '<div class="vitals"><span>心情 <span class="hearts" data-b="hearts"></span></span><span>體力 <span class="bolt" data-bolts></span></span>' +
          feedBtn('feed') + '</div>' +
        '</div><div class="fx" data-fxwin></div></div>';
    },
    U3: function () {
      return '<div class="win u3 lay" data-hit><div class="scene" data-pet="hud"></div><div class="hud">' +
        '<div class="hud-top">' + PILL + '<div class="pill"><span data-b="clock"></span></div>' + feedBtn('pill feed') +
          '<button type="button" class="pill gear" data-act="settings" title="設定">⚙</button></div>' +
        '<div class="side" data-bubble-clear><div class="pill">⏱ <span data-b="worked"></span></div><div class="pill"><span data-b="item"></span></div>' +
          '<div class="pill">📅 <span data-b="month"></span></div></div>' +
        '<div class="hud-bottom money-box" data-plus><div class="coin">$</div>' + MONEY +
          '<div class="xp"><span data-b="pct"></span><div class="track"><div class="fill" data-fill></div></div><span>下班 <b data-b="remain"></b></span></div></div>' +
        '</div><div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    U5B: function () {
      return '<div class="win u5b lay" data-hit><div class="po" data-pet="petonly"></div><div class="mid">' +
        '<div class="mtop"><span class="dot"></span><span data-b="status"></span> ・ <span data-b="hm"></span>' + feedBtn('feed') +
          '<button type="button" class="x" data-act="menu" title="選單">⋯</button></div>' +
        '<div class="money-box" data-plus>' + MONEY + '</div>' +
        '<div class="thin"><div class="fill" data-fill></div></div>' +
        '<div class="meta2"><span data-b="pct"></span><span data-b="remainPhrase"></span></div>' +
        '</div><div class="fx" data-fx data-fxwin></div></div>';
    },
    U7: function () {
      return '<div class="u7 lay"><div class="dpet">' +
        '<div class="mtag money-box" data-plus data-hit>' + MONEY + '<div class="thin"><div class="fill" data-fill></div></div></div>' +
        '<div class="po" data-pet="petonly" data-hit="pet"></div>' +
        '<div class="tools" data-hit data-hit-if=".hover .tools"><button type="button" data-act="settings" title="設定">⚙</button>' +
          '<button type="button" data-act="hide" title="隱藏">✕</button></div>' +
        '</div><div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    M3: function () {
      return '<div class="m3 lay"><div class="ring" data-ring data-hit><div class="av" data-pet="avatar"></div></div>' +
        '<div class="tagm" data-hit><div class="mmoney"><small>NT$</small> <span class="odo" data-odo></span></div></div>' +
        '<div class="sub" data-hit data-b="m3sub"></div><div class="fx" data-fx data-fxwin></div></div>';
    },
    PANEL: function () {
      return '<div class="win panel lay" data-hit>' + BAR + '<div class="pbody" data-panel></div>' +
        '<div class="fx" data-fx data-fxwin></div></div>';
    }
  };
  function panels() { return QJZ.panels || null; }
  function panelTitle(kind) { return panels() ? panels().title(kind) : ''; }

  // ================= runtime =================
  var root = null, bridge = null, first = null, session = null, resumeAt = null;
  var cur = null, panelKind = 'settings', panelFrom = null, shown = false;
  var view = null;
  var sent = { size: '', hits: '' };
  var drag = null;       // {x, y} while the primary button is down on a draggable spot
  var dragging = false;  // dragStart sent, and neither dragEnd nor the button going up seen yet
  var dragged = false;   // this press turned into a drag (its click, if any, is not a poke)
  var dragAt = 0;        // wall clock of the last dragStart (a missing dragEnd ends the dangle after a minute)
  var timers = { say: 0, type: 0, hover: 0, idle: 0 };
  var hoverUntil = 0;    // U7 tools: Date.now() after which they hide (refreshed by every mouse move)
  var offs = [];
  var docBound = false;
  var brain = null;      // QJZ.behavior.Brain: lives across layout switches
  var bubbleRank = 0;    // RANK of the bubble showing, 0 = none
  var chatAt = null;     // wall clock of the next chatter line (null: schedule on the next tick)
  var lastTick = null;   // wall clock of the last app tick seen (a gap = the window was hidden)
  var lunchCache = { key: null, s: null };

  function app() { return QJZ.app; }
  function ready() { return !!(QJZ.app && QJZ.app.state.ready); }
  function send(type, payload) { if (bridge) bridge.send(type, payload); }
  function all(el, sel) {
    var list = Array.prototype.slice.call(el.querySelectorAll(sel));
    if (el.matches(sel)) list.unshift(el);
    return list;
  }

  function build(name) {
    root.innerHTML = TEMPLATES[name]();
    var el = root.firstElementChild;
    var v = { name: name, el: el, b: {}, cache: {}, odos: [], money: null, statusKey: null, petKey: null, pet: null };
    all(el, '[data-b]').forEach(function (n) {
      var k = n.getAttribute('data-b');
      (v.b[k] = v.b[k] || []).push(n);
    });
    v.odos = all(el, '[data-odo]').map(function (n) { return QJZ.odometer.create(n); });
    v.plus = all(el, '[data-plus]');
    v.fills = all(el, '[data-fill]');
    v.rings = all(el, '[data-ring]');
    v.bolts = all(el, '[data-bolts]');
    v.feeds = all(el, '[data-feed]');
    var p = el.querySelector('[data-pet]');
    if (p) v.pet = { el: p, view: p.getAttribute('data-pet') };
    v.bubble = el.querySelector('[data-bubble]');
    v.fx = el.querySelector('[data-fx]') || el.querySelector('[data-fxwin]');
    v.fxWin = el.querySelector('[data-fxwin]') || v.fx;
    v.dpet = el.querySelector('.dpet');
    return v;
  }

  function setText(k, val) {
    if (!view.b[k] || view.cache[k] === val) return;
    view.cache[k] = val;
    for (var i = 0; i < view.b[k].length; i++) view.b[k][i].textContent = val;
  }

  function petId(settings) {
    var id = settings.pet.kind + ':' + settings.pet.skin;
    return QJZ.pets && QJZ.pets.get(id) ? id : 'hamster:p0';
  }
  function updatePet(state) {
    var h = view ? view.pet : null;
    if (!h || !state || !QJZ.pets || !QJZ.pets.compose) return;
    var id = petId(app().state.settings), key = id + '|' + state;
    if (view.petKey === key) return;
    view.petKey = key;
    var hitBefore = petHit(view.petState);
    view.petState = state;
    var opts = { state: state }, svgText = '';
    if (h.view === 'hud') opts.viewBox = HUD_VB;
    try { svgText = QJZ.pets.compose(id, h.view === 'hud' ? 'scene' : h.view, opts); }
    catch (e) { if (window.console) console.error('[layouts] pet ' + key + ' failed', e); }
    h.el.innerHTML = svgText;
    var svg = h.el.firstElementChild;
    if (svg) svg.style.setProperty('--bd', (-Math.random() * 4.6).toFixed(2) + 's');   // blinks out of step
    if (view.bubble && view.bubble.classList.contains('show')) placeBubble();   // the head moved (dangle, lie, sit up)
    if (view.live && h.view === 'petonly' && petHit(state) !== hitBefore) sync(false);   // hop / dangle: the hit area follows at once
  }

  function renderMoney(snap) {
    var t = money(snap.earned);
    if (t === view.money) return;
    view.money = t;
    for (var i = 0; i < view.odos.length; i++) view.odos[i].set(t);
  }

  function render() {
    if (!view || !ready()) return;
    var st = app().state, m = model(st, app().nowMs()), i;
    for (var k in view.b) if (Object.prototype.hasOwnProperty.call(view.b, k) && k in m) setText(k, m[k]);
    if (view.name === 'PANEL') {
      setText('title', '錢進中 · ' + panelTitle(panelKind));
      if (panels()) panels()._update();
    }
    if (view.statusKey !== m.key) {
      if (view.statusKey) view.el.classList.remove('s-' + view.statusKey);
      view.el.classList.add('s-' + m.key);
      view.statusKey = m.key;
    }
    var w = m.pctNum.toFixed(2);
    if (view.cache.fill !== w) {
      view.cache.fill = w;
      for (i = 0; i < view.fills.length; i++) view.fills[i].style.width = w + '%';
      for (i = 0; i < view.rings.length; i++) view.rings[i].style.setProperty('--p', w);
    }
    if (view.cache.bolts !== m.bolts) {
      view.cache.bolts = m.bolts;
      var h = '';
      for (i = 0; i < 5; i++) h += i < m.bolts ? '<i></i>' : '<i class="off"></i>';
      for (i = 0; i < view.bolts.length; i++) view.bolts[i].innerHTML = h;
    }
    for (i = 0; i < view.feeds.length; i++) view.feeds[i].classList.toggle('none', m.snacks === 0);
    renderMoney(st.snap);
    petTick(app().nowMs());
    return m;
  }

  // ================= the pet's behaviour =================
  function lunchStart(st) {
    var t = st.today, l = st.settings.lunch, key = t.day + ' ' + l.start + ' ' + l.end;
    if (lunchCache.key !== key) {
      var r = QJZ.earn.lunchRange(t.day, l);
      lunchCache = { key: key, s: r ? r.s : null };
    }
    return lunchCache.s;
  }
  function petInfo(st, ms) {
    var snap = st.snap, ls = snap.status === 'lunch' ? lunchStart(st) : null;
    return {
      status: snap.status, minutesToEnd: snap.remainingSec / 60, mood: st.mood,
      lunchMin: ls === null ? null : (ms - Math.max(ls, st.today.startMs)) / 60000
    };
  }
  // Runs the Brain at wall-clock ms and shows its state; cheap when nothing changed (no compose, no DOM).
  function petTick(ms) {
    if (!brain || !ready() || !app().state.snap) return null;
    if (dragging && brain.held && ms - dragAt > DRAG_SAFETY_MS) endDrag();
    var s = brain.update(ms, petInfo(app().state, ms));
    if (brain.change) onPetChange(brain.change);
    updatePet(s);
    return s;
  }
  // A new base state: a line about it, and the jingle when 可以下班 happens while the user is looking.
  function onPetChange(ch) {
    if (ch.from === null) return;
    if (ch.to === 'celebrate' && !ch.quiet && QJZ.sound) QJZ.sound.jingle();
    petSay(line(ch.to), 0, RANK.event);
  }

  function lineCtx(ms) {
    var st = app().state, s = st.settings, snap = st.snap, kind = kindOf(), working = snap.status === 'working';
    var ls = working ? lunchStart(st) : null;
    return {
      name: s.pet.names[kind], kind: kind, earned: snap.earned, items: s.items, step: s.milestone,
      minutesToLunch: ls !== null && ms < ls ? (ls - ms) / 60000 : undefined,
      minutesToEnd: working ? snap.remainingSec / 60 : undefined,
      hour: new Date(ms).getHours(), off: statusKey(snap, st.today, s) === 'off',
      energy: st.mood ? st.mood.energy : undefined, mood: st.mood ? st.mood.mood : undefined
    };
  }
  // The pet's own rng (seeded by ?rng=), so chatter timing and lines are reproducible.
  function rnd() { return brain ? brain.rng() : Math.random(); }
  function nextChat(ms) { return ms + CHAT_GAP[0] + rnd() * (CHAT_GAP[1] - CHAT_GAP[0]); }
  function line(state, extra) {
    if (!QJZ.lines || !ready()) return '';
    var c = lineCtx(app().nowMs());
    if (brain) c.rng = brain.rng;
    for (var k in (extra || {})) c[k] = extra[k];
    return QJZ.lines.pick(state, c);
  }
  // Pet speech by rank: the user's own actions always show (a banner where there is no bubble); events and
  // chatter only in a bubble, never over the user's or another module's bubble; chatter only when none shows.
  function petSay(text, ms, rank) {
    if (!view || !text) return false;
    if (rank < RANK.user && (!view.bubble || bubbleRank >= RANK.user || (rank === RANK.chat && bubbleRank))) return false;
    return say(text, ms, rank);
  }
  // Chatter: 7–15 s after the last bubble went away, about what the pet is doing (not over a reaction).
  function chatter(ms) {
    var gap = lastTick !== null && (ms - lastTick > GAP_MS || ms < lastTick);
    lastTick = ms;
    if (!view || !view.bubble || bubbleRank || dragging) return;
    if (chatAt === null || gap) { chatAt = nextChat(ms); return; }
    if (ms < chatAt) return;
    chatAt = null;
    var s = brain && brain.state;
    if (s && !REACTIONS[s]) petSay(line(s), 0, RANK.chat);
  }

  // ---- size and hit rects ----
  function measure() {
    var r = view.el.getBoundingClientRect();
    return { width: Math.ceil(r.right) + SHADOW, height: Math.ceil(r.bottom) + SHADOW };
  }
  // The element's border box in page px without its own CSS transform (an element in the middle of a transform
  // transition: its hit rect is where it ends up). Offsets are whole px; the chain stops at body, whose
  // children's offsets are already page coordinates.
  function layoutBox(el) {
    var x = 0, y = 0, n = el;
    while (n) {
      x += n.offsetLeft; y += n.offsetTop;
      n = n.offsetParent;
      if (!n || n === document.body) break;
      x += n.clientLeft; y += n.clientTop;
    }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  }
  function boxOf(el) {
    return getComputedStyle(el).transform === 'none' ? el.getBoundingClientRect() : layoutBox(el);
  }
  function hitRects() {
    var out = [];
    all(view.el, '[data-hit]').forEach(function (el) {
      var cond = el.getAttribute('data-hit-if');
      if (el.hidden || (cond && !el.matches(cond))) return;
      var r = boxOf(el);
      if (!(r.width > 0 && r.height > 0)) return;
      if (el.getAttribute('data-hit') === 'pet') r = subRect(r, PETONLY_VB, petHit(view.petState));
      out.push(outer(r));
    });
    return out;
  }
  // Sends setLayout when the size (or DPR) changed and hitRects when the rects changed or setLayout went out.
  // force: send both anyway (layout switch, DPR change); forceHits: hitRects anyway (resize).
  function sync(force, forceHits) {
    if (!view) return;
    var dpr = window.devicePixelRatio || 1;
    var size = measure(), sk = view.name + ' ' + size.width + 'x' + size.height + '@' + dpr;
    var rects = hitRects(), hk = JSON.stringify(rects) + '@' + dpr;
    if (force || sk !== sent.size) {
      sent.size = sk;
      send('setLayout', { layout: view.name, width: size.width, height: size.height, dpr: dpr });
      forceHits = true;
    }
    if (forceHits || hk !== sent.hits) {
      sent.hits = hk;
      send('hitRects', { rects: rects, dpr: dpr });
    }
  }

  function topmostFor(name) {
    if (name === 'PANEL') name = panelFrom || backTarget(app().state.settings);
    var t = app().state.settings.layout.topmost;
    return !!(t && t[name]);
  }

  // ================= layouts =================
  function show(name) {
    if (ALL.indexOf(name) < 0 || !root || !ready()) return false;
    if (name === 'PANEL' && cur !== 'PANEL') panelFrom = cur || startLayout();
    stopSay();
    chatAt = nextChat(app().nowMs());   // a new layout: no line at once, whenever the old schedule fell due
    cur = name;
    view = build(name);
    try {
      if (name === 'PANEL' && panels()) panels()._mount(view.el, panelKind);
      render();
    } catch (e) {
      if (window.console) console.error('[layouts] render ' + name + ' failed', e);   // still size and show the window
    }
    sync(true);   // synchronous: the first one is what shows the window
    view.live = true;
    remember(name === 'PANEL' ? panelFrom : name);
    send('setTopmost', { on: topmostFor(name) });
    var s = app().state.settings;
    if (isMain(name) && s.layout.current !== name) app().saveSettings({ layout: { current: name } });
    return true;
  }
  function current() { return cur; }
  // The first layout, and where a panel shown first (nothing before it) goes back to: opts.first (dev), the layout
  // shown before a reload, else settings.layout.start.
  function startLayout() {
    if (first && first !== 'PANEL' && ALL.indexOf(first) >= 0) return first;
    return resumeAt || app().state.settings.layout.start;
  }
  // sessionStorage can be missing or throw (and is only for the reload): never fatal.
  function remember(name) {
    if (!session || !name || name === 'PANEL') return;
    try { session.setItem(SHOWN_KEY, name); } catch (e) {}
  }
  function recalled() {
    var v = null;
    try { v = session ? session.getItem(SHOWN_KEY) : null; } catch (e) {}
    return isMain(v) || v === 'M3' ? v : null;
  }
  function openPanel(kind) {
    panelKind = panels() && panels().has(kind) ? kind : 'settings';
    return show('PANEL');
  }
  function closePanel() {
    var to = panelFrom && panelFrom !== 'PANEL' ? panelFrom : backTarget(app().state.settings);
    return show(to);
  }
  // A topmost setting changed in the settings panel: PANEL follows the layout it came from.
  function refreshTopmost() { if (cur) send('setTopmost', { on: topmostFor(cur) }); }

  // ================= reactions =================
  function stopSay() {
    clearInterval(timers.type); clearTimeout(timers.say);
    timers.type = timers.say = 0;
    bubbleRank = 0;
  }
  // The bubble beside the current pet's head (anchorBubble).
  function placeBubble() {
    if (!view || !view.bubble || !view.pet || !ready()) return null;
    return anchorBubble(view.bubble, view.pet.el, view.pet.view, petId(app().state.settings), view.petState, view.el);
  }
  // A speech bubble where the layout has one (U1, U3, U7), else a short banner. Never interactive (no hit rect).
  // rank (layouts-internal): RANK of the line; other modules' lines rank with the user's own actions.
  function say(text, ms, rank) {
    if (!view || !text) return false;
    var v = view, b = v.bubble;
    if (!b) { if (QJZ.fx) QJZ.fx.banner(v.fxWin, text); return true; }
    stopSay();
    bubbleRank = rank || RANK.user;
    b.textContent = '';
    placeBubble();
    b.classList.add('show');
    var chars = Array.from(text), i = 0;   // code points: an emoji never shows half drawn
    timers.type = setInterval(function () {
      b.textContent = chars.slice(0, ++i).join('');
      if (i >= chars.length) { clearInterval(timers.type); timers.type = 0; }
    }, 55);
    timers.say = setTimeout(function () {
      timers.say = 0;
      b.classList.remove('show');
      if (view !== v) return;
      bubbleRank = 0;
      chatAt = nextChat(app().nowMs());
    }, ms || 4200);
    return true;
  }

  function petSvg() { return view && view.pet ? view.pet.el.querySelector('svg') : null; }
  function petSound() {
    if (!QJZ.sound) return;
    if (kindOf() === 'cat') QJZ.sound.meow();
    else QJZ.sound.squeak();
  }
  // Where the pet is inside each compose view (fractions of the holder): the room views have it left of centre.
  var PET_AT = { scene: [0.39, 0.55], hud: [0.39, 0.5], avatar: [0.5, 0.5], petonly: [0.5, 0.45] };
  function petCenter(host) {
    var hr = host.getBoundingClientRect(), pr = view.pet ? view.pet.el.getBoundingClientRect() : hr;
    var at = (view.pet && PET_AT[view.pet.view]) || [0.5, 0.5];
    if (view.pet && view.pet.view === 'petonly') pr = subRect(pr, PETONLY_VB, PET_HIT);
    return { x: pr.left + pr.width * at[0] - hr.left, y: pr.top + pr.height * at[1] - hr.top };
  }
  // A plain click on the pet: petted (sound, hearts, mood +5, a line where there is a bubble) or, at the fifth
  // quick poke, angry for 4 s (mood -5, no sound, no hearts).
  function poke(e) {
    if (!petSvg() || !brain) return;
    var now = app().nowMs(), r = brain.poke(now);
    if (r === 'angry') {
      if (!brain.angered) return;
      app().annoy();
      if (view.bubble) petSay(line('angry'), 3500, RANK.user);
    } else {
      app().pet();
      petSound();
      if (QJZ.fx && view.fx) {
        var b = view.fx.getBoundingClientRect();
        QJZ.fx.hearts(view.fx, e.clientX - b.left, e.clientY - b.top, 7);
      }
      if (view.bubble) petSay(line('petted'), 0, RANK.user);   // no banner over a small badge for every click
    }
    render();   // the pose and the hearts now
  }
  function kindOf() { return app().state.settings.pet.kind === 'cat' ? 'cat' : 'hamster'; }

  // 餵食: one snack; the pet eats it when it lands (eat for 3 s, from the wall clock), happy and full.
  function feed() {
    if (!ready()) return false;
    if (!app().feed()) {
      var st = app().state, step = st.settings.milestone, earned = st.snap.earned;
      say(st.snap.status === 'working' && st.rates.perSecond > 0 ?
        '還沒有零食耶～再賺 NT$ ' + money(step - earned % step) + ' 就有了！' : '還沒有零食耶～');
      return false;
    }
    var v = view, host = v.fx, now = app().nowMs(), fly = host && host.animate ? SNACK_FLY_MS : 0;
    if (brain) brain.show('eat', now, QJZ.behavior.EAT_MS, fly);
    if (!fly) { petTick(now); petSound(); say(line('eat')); return true; }
    var c = petCenter(host), f = document.createElement('span');
    f.className = 'snack';
    f.textContent = SNACK[kindOf()];
    host.appendChild(f);
    f.animate([
      { left: '95%', top: '-10%', transform: 'rotate(0)' },
      { left: c.x + 'px', top: c.y + 'px', transform: 'rotate(540deg) scale(.6)' }
    ], { duration: SNACK_FLY_MS, easing: 'cubic-bezier(.3,.1,.5,1)' }).addEventListener('finish', function () {
      f.remove();
      if (view !== v) return;
      petTick(app().nowMs());
      petSound();
      say(line('eat'));
      QJZ.fx.hearts(host, c.x, c.y, 5);
    });
    return true;
  }

  // ev.quiet: crossed while the window was hidden. The snack is already counted; no coin, confetti or hop, and at
  // most one bubble, only if nothing else is being said.
  function onMilestone(ev) {
    if (!view) return;
    if (ev && ev.quiet) {
      if (!bubbleRank) petSay(line('missed', { gained: ev.gained || 1 }), 0, RANK.event);
      return;
    }
    if (QJZ.fx && view.fxWin) {
      var c = petCenter(view.fxWin);
      QJZ.fx.confetti(view.fxWin, c.x, c.y);
    }
    if (QJZ.sound) QJZ.sound.coin();
    if (brain) {
      var now = app().nowMs();
      brain.show('hop', now, QJZ.behavior.HOP_MS);
      petTick(now);
    }
    petSay(line('hop'), 0, RANK.event);
  }

  // 開始上班: starts the day (an off day too: that ends 今天休假); after 下班 it is 繼續上班 (the end is cleared).
  function startWork() {
    var t = app().state.today;
    if (typeof t.startMs === 'number' && !t.offDay) {
      if (t.endMs !== null && t.endMs !== undefined) { app().resumeWork(); say('繼續上班！金額接著算。'); }
      else say('已經在算錢囉！');
      return;
    }
    app().startWork();
    say('開始上班！今天也加油！');
  }
  function endWork() {
    var t = app().state.today;
    if (t.offDay) { say('今天休假喔～'); return; }
    if (typeof t.startMs !== 'number') { say('還沒開始上班喔～'); return; }
    if (t.endMs !== null && t.endMs !== undefined) return;
    app().endWork();
    say('下班啦！今天辛苦了！');
  }
  function toggleTopmost() {
    var name = cur === 'PANEL' ? (panelFrom || backTarget(app().state.settings)) : cur;
    if (!name) return;
    var on = !topmostFor(name), patch = { layout: { topmost: {} } };
    patch.layout.topmost[name] = on;
    app().saveSettings(patch);
    send('setTopmost', { on: on });
  }

  function act(a) {
    switch (a) {
      case 'feed': feed(); break;
      case 'settings': openPanel('settings'); break;
      case 'mini': show('M3'); break;
      case 'hide': send('hide', {}); break;
      case 'menu': send('contextMenu', {}); break;
      case 'back': if (panels()) panels().close(); else closePanel(); break;
    }
  }

  // ---- host messages ----
  function onMenu(msg) {
    var a = msg && msg.action;
    if (a === 'quit') { app().quit(); return; }   // even if init never got through: the host is waiting for quit {}
    if (typeof a !== 'string' || !ready()) return;
    if (a.indexOf('layout:') === 0) { if (isMain(a.slice(7))) show(a.slice(7)); return; }
    switch (a) {
      case 'mini': show('M3'); break;
      case 'feed': feed(); break;
      case 'start': startWork(); break;
      case 'end': endWork(); break;
      case 'adjust': case 'settings': case 'history': openPanel(a); break;
      case 'topmost': toggleTopmost(); break;
      // toggleVisible is handled by the host; anything else is ignored
    }
  }

  // ---- app events ----
  function onChange() {
    if (!ready()) return;
    if (!shown) {
      shown = true;
      var p = !first && panels() ? panels().initial(app().state) : null;
      if (p) openPanel(p);
      else show(first === 'PANEL' ? first : startLayout());
      return;
    }
    render();
    sync(false);
  }
  // Every app tick (100 ms while visible): the odometer, the pet's state and the chatter clock. Pure arithmetic
  // unless something changed.
  function onTick(snap) {
    if (!view || !snap) return;
    renderMoney(snap);
    var ms = app().nowMs();
    petTick(ms);
    chatter(ms);
  }
  function onSecond() {
    if (!view) return;
    var m = render();
    sync(false);   // text can change sizes (M3 tag, fonts arriving)
    if (m && m.plus && QJZ.fx) for (var i = 0; i < view.plus.length; i++) QJZ.fx.plus(view.plus[i], m.plus);
  }

  // ---- pointer ----
  function inRoot(t) { return root && t && t.nodeType === 1 && root.contains(t); }
  // [data-nodrag]: a panel's scrolling area (its scrollbar must stay a scrollbar).
  function isButton(t) { return !!t.closest('[data-act],button,input,select,textarea,a,label,[data-nodrag]'); }
  function onDown(e) {
    drag = null;
    if (e.button !== 0) return;
    if (dragging) endDrag();   // a new press: whatever drag there was is over
    dragged = false;
    if (!inRoot(e.target) || isButton(e.target)) return;
    drag = { x: e.screenX, y: e.screenY };
    e.preventDefault();   // no text selection / native drag; click and dblclick still fire
  }
  function onMove(e) {
    if (dragging && !(e.buttons & 1)) { endDrag(); return; }   // the button is up: no dragEnd is coming
    if (!drag) return;
    if (!(e.buttons & 1)) { drag = null; return; }
    if (Math.abs(e.screenX - drag.x) + Math.abs(e.screenY - drag.y) < DRAG_PX) return;
    drag = null;
    dragging = dragged = true;
    send('dragStart', {});
    if (cur === 'U7' && brain) {   // picked up by the scruff
      var now = app().nowMs();
      dragAt = now;
      brain.drag(true);
      petTick(now);
      if (view.bubble) petSay(line('dangle'), 0, RANK.user);
    }
  }
  // dragEnd from the host (its move loop ended), or the page saw the button go up (released before the move loop
  // started: then the host sends no dragEnd).
  function endDrag() {
    dragging = false;
    if (brain && brain.held) {
      brain.drag(false);
      if (view && ready()) petTick(app().nowMs());
    }
  }
  function onUp() {
    drag = null;
    if (dragging) endDrag();
  }
  function onContext(e) {
    e.preventDefault();
    send('contextMenu', {});
  }
  function onClick(e) {
    if (!view || !inRoot(e.target)) return;
    var a = e.target.closest('[data-act]');
    if (a) { act(a.getAttribute('data-act')); return; }
    if (dragged) { dragged = false; return; }   // the end of a drag, not a poke
    if (e.target.closest('[data-pet],.scene-wrap')) poke(e);
  }
  function onDbl(e) {
    if (cur === 'M3' && inRoot(e.target)) show(backTarget(app().state.settings));
  }
  // U7: the ⚙ ✕ tools show while the pointer is over the pet or its tag (and join the hit rects meanwhile).
  function setHover(on) {
    if (!view || !view.dpet || view.dpet.classList.contains('hover') === on) return;
    view.dpet.classList.toggle('hover', on);
    sync(false);
  }
  // mouseover and mousemove: entering shows them, moving keeps them (they also go 4 s after the last move, in
  // case the pointer left without a mouseout when the window turned click-through). A move while they show only
  // pushes the deadline; the one idle timer re-arms itself for the rest when it fires early.
  var HOVER_IDLE_MS = 4000;
  function onOver(e) {
    if (!view || !view.dpet || !view.dpet.contains(e.target)) return;
    hoverUntil = Date.now() + HOVER_IDLE_MS;
    if (timers.hover) { clearTimeout(timers.hover); timers.hover = 0; }   // back in before the mouseout delay ran out
    if (timers.idle && view.dpet.classList.contains('hover')) return;
    setHover(true);
    clearTimeout(timers.idle);
    timers.idle = setTimeout(hoverIdle, HOVER_IDLE_MS);
  }
  function hoverIdle() {
    var left = hoverUntil - Date.now();
    timers.idle = left > 20 ? setTimeout(hoverIdle, left) : 0;
    if (!timers.idle) setHover(false);
  }
  function onOut(e) {
    if (!view || !view.dpet || !view.dpet.contains(e.target) || view.dpet.contains(e.relatedTarget)) return;
    clearTimeout(timers.hover);
    timers.hover = setTimeout(function () { timers.hover = 0; setHover(false); }, 300);
  }

  function onTransitionEnd(e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-hit')) sync(false); }

  function watchDpr() {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
    if (!mq.addEventListener) return;
    mq.addEventListener('change', function () { sync(true); watchDpr(); }, { once: true });
  }

  // opts: {bridge (default QJZ.bridge), first: layout to show first instead of settings.layout.start (dev),
  //        seed: a number to make the pet's idle actions reproducible (dev),
  //        session: a Storage for the layout to come back to after a reload (default window.sessionStorage)}.
  // Call before QJZ.app.start(); nothing shows until the host's init has arrived.
  function start(rootEl, opts) {
    opts = opts || {};
    root = rootEl;
    bridge = opts.bridge || QJZ.bridge;
    first = opts.first || null;
    session = opts.session;
    if (session === undefined) { try { session = window.sessionStorage; } catch (e) { session = null; } }
    resumeAt = recalled();
    brain = QJZ.behavior ? new QJZ.behavior.Brain(typeof opts.seed === 'number' ? QJZ.behavior.rng(opts.seed) : null) : null;
    var A = app();
    offs.push(A.on('change', onChange), A.on('tick', onTick), A.on('second', onSecond), A.on('milestone', onMilestone));
    [bridge.on('menu', onMenu), bridge.on('dragEnd', endDrag)].forEach(function (off) {
      if (typeof off === 'function') offs.push(off);
    });
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', onDbl);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mousemove', onOver);
    root.addEventListener('mouseout', onOut);
    root.addEventListener('transitionend', onTransitionEnd);
    if (!docBound) {
      docBound = true;
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      document.addEventListener('contextmenu', onContext);
      window.addEventListener('resize', function () { sync(false, true); });
      watchDpr();
      if (document.fonts) {
        // Fredoka changes text metrics: start loading it now (the page loads hidden, before init) and re-measure.
        try { document.fonts.load('700 16px Fredoka'); } catch (e) {}
        document.fonts.addEventListener('loadingdone', function () { sync(false); });
      }
    }
  }

  // Tests only.
  function reset() {
    offs.forEach(function (f) { try { f(); } catch (e) {} });
    offs = [];
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('dblclick', onDbl);
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mousemove', onOver);
      root.removeEventListener('mouseout', onOut);
      root.removeEventListener('transitionend', onTransitionEnd);
      root.innerHTML = '';
    }
    for (var k in timers) { clearTimeout(timers[k]); clearInterval(timers[k]); timers[k] = 0; }
    try { window.sessionStorage.removeItem(SHOWN_KEY); } catch (e) {}
    root = bridge = first = view = cur = panelFrom = drag = session = resumeAt = null;
    panelKind = 'settings'; shown = false; dragging = false; sent = { size: '', hits: '' };
    brain = null; bubbleRank = 0; chatAt = null; lastTick = null; dragged = false; dragAt = 0; hoverUntil = 0;
    lunchCache = { key: null, s: null };
  }

  return {
    show: show, current: current, start: start, say: say, openPanel: openPanel, closePanel: closePanel, _reset: reset,
    refreshTopmost: refreshTopmost,
    dragging: function () { return dragging; },
    MAIN: MAIN, ALL: ALL,
    util: {
      hms: hms, hm: hm, dateText: dateText, clockText: clockText, statusKey: statusKey, STATUS: STATUS,
      isMain: isMain, backTarget: backTarget, itemAt: itemAt, rateText: rateText, remainPhrase: remainPhrase, m3Sub: m3Sub,
      heartsText: heartsText, model: model, subRect: subRect, outer: outer, layoutBox: layoutBox,
      PETONLY_VB: PETONLY_VB, PET_HIT: PET_HIT, petHit: petHit, vbPoint: vbPoint, anchorBubble: anchorBubble, VIEWBOX: VIEWBOX
    }
  };
})();
