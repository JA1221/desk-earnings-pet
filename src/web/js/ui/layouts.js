window.QJZ = window.QJZ || {};
// The visible layouts, built after docs/prototypes/converge.html: main windows U1 經典直式, U3 遊戲畫面,
// U5B 橫向極簡, U7 桌面寵物, and 1.1's U10 頂端小膠囊, U12 健康儀表板, U13 番茄鐘優先 (docs/prototypes/v1.1, G);
// the temporary mini badge M3 and PANEL. PANEL is the window frame (title bar, size, hit rects); its content is
// QJZ.panels (onboarding / settings / history / question, 'adjust' = settings at 起算),
// mounted when PANEL is built and updated on every render. The first layout is a panel when QJZ.panels.initial
// asks for one (onboarding, an early-leave question); closing it goes to the start layout.
//
// Host protocol (page -> host; sizes and rects in CSS px, dpr = window.devicePixelRatio):
//   setLayout {layout, width, height, dpr, dock?}  width / height reach the layout root's right / bottom edge plus
//                                           the 7px hard shadow (U10: the root is the whole window). Sent
//                                           synchronously after rendering (the window is still hidden at start and
//                                           rAF does not run there), again whenever the size or the DPR changes.
//                                           U10's always carries dock (settings.layout.capsule: top | bottomLeft |
//                                           bottomCenter | bottomRight), and goes again when it changes.
//   hitRects {rects:[[x,y,w,h],...], dpr}   one rect per visible [data-hit] element; everything else clicks
//                                           through. Sent with every setLayout and whenever the rects change
//                                           (hover tools, text growing, resize, the pet's pose). Speech bubbles
//                                           are never interactive: no rect of their own, pointer-events none.
//                                           Two elements give several rects that follow their shape: the U7 pet
//                                           (data-hit="pet": bands along the painted pet and its desk, measured
//                                           over its animation, see petRects) and the M3 ring
//                                           (data-hit-shape="disc": DISC_BANDS bands along the disc).
//   setTopmost {on}                         after every layout change, from settings.layout.topmost (and when the
//                                           menu's 永遠在最上層 toggles it: for PANEL, the layout it came from).
//   dragStart {grab?}  primary button pressed on a non-button area and moved DRAG_PX (a plain click stays a click,
//                 so pets can be poked and M3 double-clicked). U7 sends grab: [x, y], page CSS px, where the
//                 lifted pet's scruff tip is (QJZ.pets.grabAt): the host should move the window so that point sits
//                 under the cursor before its move loop starts, and the pet then hangs from the cursor by it.
//   contextMenu {} right-click anywhere (and the ⋯ button).    hide {}  the close dot / ✕ button.
//   menuState {work, snacks}  for the menu (simplification #2), whenever either changes: work 'before' (the item
//                 reads 開始上班), 'working' (下班; also at lunch and 可以下班) or 'ended' (繼續上班); snacks to feed.
//                 Checked on every render and on QJZ.app's refresh (hidden: every minute, and when the host's
//                 menuOpening asks), so the menu never shows an old day or old snacks.
// Host -> page: menu {action} (TrayMenu ids; capsule:<dock> is the 膠囊位置 item), dragEnd {}, capsuleDock {dock} (a
// dropped U10 snapped to that dock: saved, and setLayout goes again with it even when it is the same, so an older
// setLayout still on its way cannot undo the snap).
//
// settings.layout.current is the last MAIN layout (U1/U3/U5B/U7/U10/U12/U13); M3 and PANEL never go there.
// settings.layout.mini says the app was left as the mini badge (M3). The first layout after init is the one used last (simplification
// #12): M3 when mini, else current (a first run: U1). Dev pages may override it with opts.first. After a reload of the
// page (the host reloads it after a renderer crash) the layout shown last (PANEL: the layout it came from) is kept in
// sessionStorage, which only lives as long as this WebView, and comes back. 1.0's settings.layout.start is not read.
// Rendering: the odometer follows the app's tick (100 ms; 250 ms with 省電模式); every other text changes at most once a
// second (or on a record / settings change), computed from the wall clock, and is only written when it changed.
// 省電模式 (§5.9, html.saver from QJZ.app): the CSS stops every decorative loop outside the pet; the pet is drawn with
// compose's saver option, rests between idle actions (.rest: its loops paused, the room's in U3 too) and its Brain
// idles less often (setSaver), all following the setting at once.
// The markup is QJZ.templates. 1.1 (spec §4.3, §4.4, §4.9 #8): the cups, the tomatoes, the 番茄鐘 buttons (data-act
// drink / pomo) and the countdown rings (QJZ.ring) read QJZ.care.state (model's cs); a care change re-renders at once,
// and the countdowns follow the app's second.
// The pet: QJZ.behavior's Brain decides the state from the wall clock on every app tick (base state per status,
// idle actions, reactions); the holder node stays and the SVG is swapped only when the state or the skin changes.
// Reactions: a plain click on the pet is a poke (petted / angry), 餵食 plays eat when the snack lands, a milestone
// hops (with confetti and the coin sound; quietly, one bubble at most, when it was crossed while hidden), U7 dangles
// from dragStart until dragEnd (hanging in front of its tag), a live 可以下班 plays the jingle. Only a click on the
// animal's own painted shape pets it (compose's .pa, not .prop): not the desk, the room, the empty space around it
// or a bubble. Speech: QJZ.lines, in the bubble (U1, U3, U7) every 7–15 s after the last one and on events; bubble
// timers run only while a bubble shows. Bubble ranks: chatter < pet events < the user's own actions and anything
// other modules say (those always show).
// 1.1 prompts (Task 11, spec §4.2, §5.1-5.3): QJZ.care's prompt events draw its bubble through QJZ.promptView (show /
// update: render, show also knocks once; hide: clear; wave: the pet's knock and one more knock), a layout switch
// draws the one that shows, and a care change redraws it only when its view changed (a cup logged elsewhere: its
// 「今天 N/8 杯」); care.setPanel follows PANEL. Its cue is the Brain's cue (the SVG is redrawn on a knock
// while it holds the cup, which replays the wave). drank plays sip (the cup that reaches the goal: petted and hearts),
// 「+1」 on the cups and a line; standup from 起來了 plays petted 2 s and a line (from 喝了, a break or a lock, nothing:
// 喝了 already sips, Ruling M9). While a prompt shows the speech bubble is hidden and says nothing (chatter and pet
// events wait; the user's own lines become banners). During a focus (§4.3 「不講話、不打擾」, §5.2) the pet keeps
// quiet: no chatter, no event lines, a milestone only hops (no confetti, coin or line), and a poke gets 「專心中～」
// once per focus and nothing else. A double press on an answer answers once: its second press does nothing (no M3
// expand, no act, poke or drag under it), and for DBL_MS the window keeps its size and the button's spot stays a hit
// rect, so that press never reaches the window underneath (final review m-3).
// 1.1 layouts (Task 12, spec §4.5, §5.7; G_U10_*, G_U12_*, G_U13_*). U10 is one fixed window whose capsule sits at its
// dock (class d-<dock>) and expands while the pointer is on it ([data-hover], as U7's tools); a prompt makes it the call,
// a pomodoro its countdown; only the capsule takes clicks, and it shows no odometer (it changes at most once a second).
// U12's rings and U13's big ring are [data-gauge]s (--p, hot for the prompt that asks for them, rest in a break), U13's
// tomato slots [data-tslots]. None of them has a speech bubble: their lines are banners, and they never chatter.
QJZ.layouts = (function () {
  var MAIN = ['U1', 'U3', 'U5B', 'U7', 'U10', 'U12', 'U13'];
  var ALL = ['U1', 'U3', 'U5B', 'U7', 'U10', 'U12', 'U13', 'M3', 'PANEL'];
  var SHADOW = 7;
  var DRAG_PX = 4;
  var PETONLY_VB = [30, 4, 176, 170];    // QJZ.pets.compose 'petonly' viewBox
  var PET_HIT = [38, 24, 160, 148];      // the pet and its desk inside that viewBox, every skin and base state
  // Reactions that leave PET_HIT, measured over the first 8 skins and the whole animation (normal motion), clipped to
  // the viewBox: hop rises up to 12.7 above it (cat P0) and squashes 3.4 left / 5.6 right on landing; dangle swings to
  // both viewBox sides (hamster P0, S5) and up to its top (cat P0). Only while they play. Cat H2 and S4 (measured by
  // their painted pixels over every state's whole animation) fit inside both, and inside PET_HIT in every other state
  // but for cat H2's tail tip: up to 4 units left of it while the mochi squashes (celebrate, angry), as cat P4's does.
  var PET_HIT_BY_STATE = { hop: [34, 11, 170, 161], dangle: [30, 4, 176, 168] };
  // States whose head rises above PET_HIT's top (measured over every skin, N-1 of the d9bba4f re-review): cat P0 13
  // units while it stretches or celebrates and 6 waiting with the bag, cat S5 6 stretching or celebrating, cat P0 1
  // yawning. Their bands may reach up to the viewBox top (they still follow the painted pet), and so does the box that
  // serves until the bands are measured. The 1.1 poses (Task 17, all 10 skins, 0–8 s): wave jumps 9.6 above it (cat P0
  // 14.4, cat S5 21.0), as its stand-in celebrate does; holdCup, sip and focus stay inside PET_HIT.
  var PET_REACH = { stretch: 1, celebrate: 1, waitBag: 1, yawn: 1, wave: 1 };
  var PET_HIT_TALL = [38, 4, 160, 168];
  // The pose skin id shows for state (QJZ.pets.poseFor): a 1.1 pose the skin does not draw yet shows its 1.0 stand-in.
  // Everything here that is keyed by the pet's state goes by that pose, not by the Brain's state (Ruling M11): the hit
  // box (petHit), the measured bands (bandKey) and the bubble anchor (anchorBubble). So a 'wave' drawn as celebrate
  // gets celebrate's tall box and anchor.
  function poseOf(id, state) { return QJZ.pets && QJZ.pets.poseFor ? QJZ.pets.poseFor(id, state) : state; }
  function petHit(state, id) {
    var pose = poseOf(id, state);
    if (PET_HIT_BY_STATE.hasOwnProperty(pose)) return PET_HIT_BY_STATE[pose];
    return PET_REACH.hasOwnProperty(pose) ? PET_HIT_TALL : PET_HIT;
  }
  // hop and dangle move too much for bands: their box serves the whole time.
  function boxOnly(state, id) { return PET_HIT_BY_STATE.hasOwnProperty(poseOf(id, state)); }
  var HUD_VB = '0 -4 300 236';           // U3 room crop (prototype)
  var STATUS = { working: '上班中', lunch: '午休中', done: '可以下班', ended: '已下班', before: '還沒上班', off: '休假日' };
  var SNACK = { cat: '🐟', hamster: '🌻' };
  var CHAT_GAP = [7000, 15000], GAP_MS = 5000, SNACK_FLY_MS = 800, DRAG_SAFETY_MS = 60000;
  var DBL_MS = 600;   // a double press's second press comes within this (Windows' double-click time is 500 ms by default)
  var SHOWN_KEY = 'qjz.layout';   // sessionStorage: the layout to come back to after a reload
  var RANK = { chat: 1, event: 2, user: 3 };
  var WORK = { working: 'working', lunch: 'working', done: 'working', ended: 'ended' };   // menuState work; else 'before'
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
  // The layout the app starts in: the one used last. M3 too: whoever shrank it to the mini badge wants the small
  // badge back after a restart (it floats on top and never takes focus; a double-click goes back to current).
  function lastLayout(settings) {
    return settings && settings.layout && settings.layout.mini === true ? 'M3' : backTarget(settings);
  }
  // The item shown by the 可以買 chip: rotates every 4 s, from the wall clock.
  function itemAt(items, ms) {
    if (!items || !items.length) return null;
    return items[Math.floor(ms / 4000) % items.length];
  }
  // U3's one card (simplification #13): 可以買 and 本月累計 in turn, CARD_MS each, from the wall clock; the item
  // moves on once a round (every 2 x CARD_MS), so the card changes calmly. -> {month: bool, item: item | null}
  var CARD_MS = 10000;
  function cardAt(items, ms) {
    var n = Math.floor(ms / CARD_MS);
    if (n % 2) return { month: true, item: null };
    return { month: false, item: items && items.length ? items[Math.floor(n / 2) % items.length] : null };
  }
  function itemText(it, earned) { return it ? (it.icon ? it.icon + ' ' : '') + '×' + QJZ.rewards.itemCount(earned, it) : ''; }
  function money(n) { return QJZ.odometer.format(n); }
  // Only the rate (simplification #4): the salary itself is never on screen, where anyone walking by can read it.
  function rateText(salary, perSec) {
    if (!salary || !(salary.amount > 0)) return '還沒設定薪資（右鍵 → 設定）';
    return '每秒 +NT$ ' + perSec.toFixed(3);
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

  // ---- 1.1: what QJZ.care adds (spec §4.4, §4.9 #8, §5.2) ----
  var POMO_STATUS = { focus: '專心中', break: '休息中' };
  // A share as a ring's --p: 0..100, one decimal ('37.5', '75').
  function pct1(n, of) { return String(of > 0 ? Math.round(Math.min(Math.max(n / of, 0), 1) * 1000) / 10 : 0); }
  // cs = QJZ.care.state, key = the work status (statusKey). A missing or not-ready care (Ruling S11) is zero counts, an
  // idle pomodoro and nothing shown. What shows is care's to decide (cs.show, Ruling R4), and so are the time to the next
  // stand-up (cs.standIn) and the running focus's 第 N 顆 (cs.nth, its start day's count); here they are only read. The
  // stand-up time shows only while its timer runs, the work status working (the sprint included): not at lunch, where
  // the timer stands still and starts again at its end (§5.1), so the number would never come true; and not while the
  // reminder itself is asking. The pomodoro readouts are taken at the whole second, so however often a layout renders,
  // the rings and the countdown change at most once a second.
  function careModel(cs, s, ms, key) {
    var on = !!(cs && cs.ready && cs.p), p = on ? cs.p : null;
    var h = on && cs.health ? cs.health : { cups: 0, tomatoes: 0, standups: 0 }, hs = s.health;
    var phase = p && POMO_STATUS.hasOwnProperty(p.phase) ? p.phase : null;   // idle / breakOver: nothing counts down
    var sec = Math.floor(ms / 1000) * 1000, P = QJZ.pomodoro;
    var goals = on && cs.goals ? cs.goals : hs ?
      { cups: hs.water.goal, tomatoes: QJZ.settings.tomatoGoal(s), standups: QJZ.settings.standGoal(s) } : { cups: 0, tomatoes: 0, standups: 0 };
    var cups = on ? cs.cupsText : '0/' + goals.cups;
    var asks = on && cs.prompt ? cs.prompt.kind : null;   // the prompt that shows: its ring glows (U12)
    var stand = on && typeof cs.standIn === 'number' && key === 'working' &&
      asks !== 'both' && asks !== 'sit' && asks !== 'water' ? cs.standIn : null;   // (not while it is the one asking)
    var nth = phase === 'focus' && on && cs.nth > 0 ? '第 ' + cs.nth + ' 顆' : '';
    var frac = phase ? P.fraction(p, sec) : 0, left = 1 - frac;
    var focusMin = hs ? hs.pomodoro.focus : 25;
    return {
      phase: phase,
      cups: cups, cupsLong: cups + ' 杯', tomatoes: '×' + h.tomatoes,
      showCups: !!(on && cs.show && cs.show.cups), showTomatoes: !!(on && cs.show && cs.show.tomatoes), showStand: stand !== null,
      pomoBtn: phase ? '■ 停止' : '▶ 番茄鐘', pomoGlyph: phase ? '■' : '▶',
      ring: { phase: phase, fraction: frac, label: phase ? '還剩 ' + P.minutesLeft(p, sec) + ' 分' : '' },
      mmss: phase ? P.mmss(p, sec) : '',
      nth: nth,
      standIn: stand === null ? '' : stand + ' 分後',
      // U10 / U12 / U13
      cupsNum: String(h.cups), tomNum: String(h.tomatoes), standups: String(h.standups),
      gauge: { cups: pct1(h.cups, goals.cups), tom: phase ? pct1(left, 1) : pct1(h.tomatoes, goals.tomatoes),
        stand: pct1(h.standups, goals.standups), pomo: pct1(left, 1) },
      hot: { cups: asks === 'both' || asks === 'water', tom: asks === 'break' || asks === 'breakEnd', stand: asks === 'both' || asks === 'sit' },
      tomLabel: phase ? '番茄倒數' : '番茄（顆）',
      standLabel: asks === 'both' || asks === 'sit' ? '該起來了！' : '起來動（次）',
      phaseShort: phase === 'focus' ? '專心' : phase === 'break' ? '休息' : '',
      phaseNote: phase === 'focus' ? nth : phase === 'break' ? '休息中' : '',
      dsay: stand === null ? '' : phase === 'focus' ? '專心中～提醒等休息再說' : '再 ' + stand + ' 分鐘起來動～',
      standLine: stand === null ? '' : phase === 'focus' ? '提醒等休息再說' : stand + ' 分後起來動',
      nextFocus: '下一顆 ' + focusMin + ' 分鐘', focusFull: focusMin + ':00',
      tslots: { done: Math.min(h.tomatoes, goals.tomatoes), of: goals.tomatoes },
      tslotText: '今天 ×' + h.tomatoes + '・每 ' + (hs ? hs.pomodoro.longEvery : goals.tomatoes) + ' 顆長休息'
    };
  }

  // Everything a layout displays, from the app state at wall-clock time ms and care's state cs (QJZ.care.state).
  function model(st, ms, cs) {
    var s = st.settings, snap = st.snap, today = st.today;
    var key = statusKey(snap, today, s);
    var hc = careModel(cs, s, ms, key);
    var perSec = st.rates ? st.rates.perSecond : 0;
    var pct = Math.max(0, Math.min(1, snap.pct || 0));
    var it = itemAt(s.items, ms);
    var kind = s.pet && s.pet.kind === 'cat' ? 'cat' : 'hamster';
    var v = vitals(st, pct);
    var snacks = st.snacks > 0 ? st.snacks : 0;
    var clock = clockText(ms), month = money(QJZ.history.monthTotal(st.history, today.day.slice(0, 7), today, snap.earned));
    var card = cardAt(s.items, ms);
    var m = {
      key: key, kind: kind, status: hc.phase ? POMO_STATUS[hc.phase] : STATUS[key],
      petState: QJZ.behavior ? QJZ.behavior.base(snap.status, snap.remainingSec / 60) : 'typing',   // base state
      clock: clock, hm: clock.slice(0, 5),
      money: money(snap.earned), moneyWhole: 'NT$ ' + money(snap.earned).slice(0, -3),
      pct: (pct * 100).toFixed(1) + '%', pctNum: pct * 100,
      remain: hms(snap.remainingSec), remainPhrase: remainPhrase(key, snap.remainingSec),
      m3sub: hc.phase ? POMO_STATUS[hc.phase] + ' · ' + hc.ring.label : m3Sub(key, snap.remainingSec),
      itemLabel: it ? '可以買' + it.name : '',
      item: itemText(it, snap.earned),
      month: month,
      card: card.month ? '📅 ' + month : itemText(card.item, snap.earned), cardMonth: card.month,
      rate: rateText(s.salary, perSec),
      hearts: heartsText(v.hearts), bolts: v.bolts,
      snacks: snacks, snack: SNACK[kind] + '×' + snacks,
      plus: key === 'working' && perSec > 0 ? '+' + perSec.toFixed(2) : null
    };
    for (var k in hc) if (k !== 'phase') m[k] = hc[k];
    return m;
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
  // Puts bubble b beside the pet's head: --tx / --ty = where its tail ends (QJZ.pets.speechAt for pet id in the pose
  // it shows for state, just right of the head at eye height), --clear = 6 px below the [data-bubble-clear] elements
  // in scope (a bubble that grows downwards stays under them), all in px of the bubble's own box (its offsetParent,
  // the .fx layer); layouts.css lays the bubble out from them (.side). Without a drawn pet it keeps its plain corner
  // place. -> {x, y, clear} or null.
  function anchorBubble(b, holder, petView, id, state, scope) {
    var box = b ? b.offsetParent : null, svg = holder ? holder.querySelector('svg') : null;
    var pt = svg && box && VIEWBOX[petView] && QJZ.pets && QJZ.pets.speechAt ? QJZ.pets.speechAt(id, poseOf(id, state)) : null;
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

  function panels() { return QJZ.panels || null; }
  function panelTitle(kind) { return panels() ? panels().title(kind) : ''; }

  // ================= runtime =================
  var root = null, bridge = null, first = null, session = null, resumeAt = null;
  var cur = null, panelKind = 'settings', panelFrom = null, shown = false;
  var view = null;
  var sent = { size: '', hits: '', menu: '', dims: null };   // dims: the last setLayout's {width, height}
  var drag = null;       // {x, y} while the primary button is down on a draggable spot
  var dragging = false;  // dragStart sent, and neither dragEnd nor the button going up seen yet
  var dragged = false;   // this press turned into a drag (its click, if any, is not a poke)
  var dragAt = 0;        // wall clock of the last dragStart (a missing dragEnd ends the dangle after a minute)
  var answerRun = false; // the run of presses under way (a click, its double, …) began on a prompt's answer button
  var held = null;       // {rect, width, height} for DBL_MS after an answer: kept in setLayout and hitRects (holdSpot)
  var timers = { say: 0, type: 0, hover: 0, idle: 0, held: 0 };
  var hoverUntil = 0;    // U7 tools: Date.now() after which they hide (refreshed by every mouse move)
  var offs = [];
  var docBound = false;
  var brain = null;      // QJZ.behavior.Brain: lives across layout switches
  var bubbleRank = 0;    // RANK of the bubble showing, 0 = none
  var chatAt = null;     // wall clock of the next chatter line (null: schedule on the next tick)
  var lastTick = null;   // wall clock of the last app tick seen (a gap = the window was hidden)
  var lunchCache = { key: null, s: null };
  var focusPoked = null; // the start of the focus whose poke was answered (「專心中～」 once per focus)
  var cupPlus = false;   // a cup was logged: pop 「+1」 on the cups once care's change has them on screen
  var drawnView = '';    // the prompt view drawn last (JSON), '' for none: a care change redraws it only when it differs

  function app() { return QJZ.app; }
  function ready() { return !!(QJZ.app && QJZ.app.state.ready); }
  function careState() { return QJZ.care ? QJZ.care.state : null; }
  // A prompt bubble shows (QJZ.care decides; it is set before its prompt event goes out).
  function prompting() { var cs = careState(); return !!(cs && cs.ready && cs.prompt); }
  // A pomodoro focus runs: the pet keeps quiet.
  function focusing() { var cs = careState(); return !!(cs && cs.ready && cs.p && cs.p.phase === 'focus'); }
  function send(type, payload) { if (bridge) bridge.send(type, payload); }
  function all(el, sel) {
    var list = Array.prototype.slice.call(el.querySelectorAll(sel));
    if (el.matches(sel)) list.unshift(el);
    return list;
  }

  function build(name) {
    root.innerHTML = QJZ.templates[name]();
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
    v.alts = all(el, '[data-alt]');
    v.shows = all(el, '[data-show]');
    v.prings = all(el, '[data-pring]');
    v.gauges = all(el, '[data-gauge]');
    v.tslots = all(el, '[data-tslots]');
    var p = el.querySelector('[data-pet]');
    if (p) v.pet = { el: p, view: p.getAttribute('data-pet') };
    v.bubble = el.querySelector('[data-bubble]');
    v.fx = el.querySelector('[data-fx]') || el.querySelector('[data-fxwin]');
    v.fxWin = el.querySelector('[data-fxwin]') || v.fx;
    v.dpet = el.querySelector('.dpet');
    v.hover = el.querySelector('[data-hover]');
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
  // 省電模式 (§5.9): the pet is drawn with compose's saver option (a crayon skin's still grain) and its Brain idles less.
  function saverOn() { return !!app().state.settings.display.powerSaver; }
  // ... and between idle actions it rests (Task 15's CPU step b): its base state, but for the 8 s celebration, is drawn
  // with every loop paused (pets.css .rest), so nothing is drawn again until the next idle action, reaction or cue.
  // (Step a, the loops at half speed, measured no gain: a slower loop still draws every frame. It is not kept.)
  function resting(state) { return !!brain && state === brain.base && state !== 'celebrate'; }
  // holdCup stays the state across care's re-wave: the drawing is keyed by the last knock too, so a knock redraws it and
  // its wave plays again (brain.waveAt). 省電模式 and resting are in the key: a change redraws it at once.
  function updatePet(state) {
    var h = view ? view.pet : null;
    if (!h || !state || !QJZ.pets || !QJZ.pets.compose) return;
    var id = petId(app().state.settings), saver = saverOn(), rest = saver && resting(state);
    var key = id + '|' + state + (state === 'holdCup' && brain ? '|' + brain.waveAt : '') + (saver ? '|saver' : '') +
      (rest ? '|rest' : '');
    if (view.petKey === key) return;
    view.petKey = key;
    view.petState = state;
    var opts = { state: state, saver: saver }, svgText = '';
    if (h.view === 'hud') opts.viewBox = HUD_VB;
    try { svgText = QJZ.pets.compose(id, h.view === 'hud' ? 'scene' : h.view, opts); }
    catch (e) { if (window.console) console.error('[layouts] pet ' + key + ' failed', e); }
    h.el.innerHTML = svgText;
    var svg = h.el.firstElementChild;
    if (svg) svg.style.setProperty('--bd', (-Math.random() * 4.6).toFixed(2) + 's');   // blinks out of step
    if (svg && rest) svg.classList.add('rest');   // before the first style pass: its loops never start
    if (view.bubble && view.bubble.classList.contains('show')) placeBubble();   // the head moved (dangle, lie, sit up)
    if (view.live && h.el.getAttribute('data-hit') === 'pet') sync(false);   // the hit area follows the pose at once
  }

  function renderMoney(snap) {
    var t = money(snap.earned);
    if (t === view.money) return;
    view.money = t;
    for (var i = 0; i < view.odos.length; i++) view.odos[i].set(t);
  }

  function render() {
    if (!view || !ready()) return;
    var st = app().state, m = model(st, app().nowMs(), careState()), i;
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
    if (view.name === 'U10' && view.cache.dock !== dockOf()) {
      if (view.cache.dock) view.el.classList.remove('d-' + view.cache.dock);
      view.cache.dock = dockOf();
      view.el.classList.add('d-' + view.cache.dock);
    }
    var w = m.pctNum.toFixed(2);
    if (view.cache.fill !== w) {
      view.cache.fill = w;
      for (i = 0; i < view.fills.length; i++) view.fills[i].style.width = w + '%';
    }
    renderHealth(m, w);
    if (view.cache.bolts !== m.bolts) {
      view.cache.bolts = m.bolts;
      var h = '';
      for (i = 0; i < 5; i++) h += i < m.bolts ? '<i></i>' : '<i class="off"></i>';
      for (i = 0; i < view.bolts.length; i++) view.bolts[i].innerHTML = h;
    }
    for (i = 0; i < view.feeds.length; i++) view.feeds[i].classList.toggle('none', m.snacks === 0);
    if (view.alts.length && view.cache.cardMonth !== m.cardMonth) {
      view.cache.cardMonth = m.cardMonth;
      view.alts.forEach(function (a) {
        var d = a.querySelectorAll('.alt-dots i');
        if (d.length === 2) { d[0].classList.toggle('on', !m.cardMonth); d[1].classList.toggle('on', m.cardMonth); }
      });
    }
    renderMoney(st.snap);
    sendMenu(m);
    petTick(app().nowMs());
    if (cupPlus) popCup();
    return m;
  }
  // 「+1」 on the cups the layout shows (a cup logged anywhere: the bubble's 喝了, the menu, the tray, a cups button):
  // the first drawn one (U10 has its cups twice, folded and expanded).
  function popCup() {
    cupPlus = false;
    var c = all(view.el, '[data-cups]').filter(function (n) { return n.getClientRects().length > 0; })[0];
    if (c && QJZ.fx) QJZ.fx.plus(c, '+1');
  }
  // [data-show] by the §4.9 #8 rule, the pomodoro phase (p-foc / p-brk on the layout and the M3 ring), the M3 ring's
  // --p (the day's progress w, or the pomodoro's time left) and the countdown rings.
  var SHOW = {
    cups: function (m) { return m.showCups; }, tomatoes: function (m) { return m.showTomatoes; },
    both: function (m) { return m.showCups && m.showTomatoes; }, any: function (m) { return m.showCups || m.showTomatoes; },
    stand: function (m) { return m.showStand; }, cupsStand: function (m) { return m.showCups && m.showStand; }
  };
  function renderHealth(m, w) {
    var i, ph = m.ring.phase, shows = (m.showCups ? 'c' : '') + (m.showTomatoes ? 't' : '') + (m.showStand ? 's' : '');
    if (view.cache.shows !== shows) {
      view.cache.shows = shows;
      view.shows.forEach(function (n) { var f = SHOW[n.getAttribute('data-show')]; n.hidden = !(f && f(m)); });
    }
    if (view.cache.phase !== ph) {
      view.cache.phase = ph;
      [view.el].concat(view.rings).forEach(function (n) {
        n.classList.toggle('p-foc', ph === 'focus');
        n.classList.toggle('p-brk', ph === 'break');
      });
    }
    var p = ph ? ((1 - m.ring.fraction) * 100).toFixed(2) : w;
    if (view.cache.ringP !== p) {
      view.cache.ringP = p;
      for (i = 0; i < view.rings.length; i++) view.rings[i].style.setProperty('--p', p);
    }
    for (i = 0; i < view.prings.length; i++) QJZ.ring.update(view.prings[i], m.ring);
    renderGauges(m);
  }
  // The 1.1 layouts' rings ([data-gauge]): --p, hot while the prompt that shows asks for it, rest while the pomodoro ones
  // count a break down; and U13's tomato slots. Written only when they changed.
  function renderGauges(m) {
    var i;
    for (i = 0; i < view.gauges.length; i++) {
      var g = view.gauges[i], type = g.getAttribute('data-gauge'), p = m.gauge[type], hot = !!m.hot[type];
      var k = p + ' ' + hot + ' ' + m.ring.phase;
      if (view.cache['g' + i] === k) continue;
      view.cache['g' + i] = k;
      g.style.setProperty('--p', p);
      g.classList.toggle('hot', hot);
      g.classList.toggle('rest', m.ring.phase === 'break' && (type === 'tom' || type === 'pomo'));   // the countdowns
    }
    var ts = m.tslots.done + '/' + m.tslots.of;
    if (view.tslots.length && view.cache.tslots !== ts) {
      view.cache.tslots = ts;
      var h = '';
      for (i = 0; i < m.tslots.of; i++) h += QJZ.icons.svg('tom', i < m.tslots.done ? '' : 'e');   // static markup
      for (i = 0; i < view.tslots.length; i++) {
        view.tslots[i].innerHTML = h;
        view.tslots[i].classList.toggle('many', m.tslots.of > 5);
      }
    }
  }
  // menuState for the host's menu, when the work status or the snack count changed.
  function sendMenu(m) {
    var work = WORK[m.key] || 'before', k = work + ' ' + m.snacks;
    if (sent.menu === k) return;
    sent.menu = k;
    send('menuState', { work: work, snacks: m.snacks });
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
    brain.setSaver(saverOn());
    var s = brain.update(ms, petInfo(app().state, ms));
    if (brain.change) onPetChange(brain.change);
    updatePet(s);
    return s;
  }
  // A new base state: a line about it, and the jingle when 可以下班 happens while the user is looking.
  function onPetChange(ch) {
    if (ch.from === null) return;
    if (ch.to === 'celebrate' && !ch.quiet && QJZ.sound) QJZ.sound.jingle();
    petSay(ch.to, null, 0, RANK.event);
  }

  function lineCtx(ms) {
    var st = app().state, s = st.settings, snap = st.snap, kind = kindOf(), working = snap.status === 'working';
    var ls = working ? lunchStart(st) : null;
    return {
      name: s.pet.names[kind], kind: kind, earned: snap.earned, items: s.items, step: s.milestone,
      minutesToLunch: ls !== null && ms < ls ? (ls - ms) / 60000 : undefined,
      minutesToEnd: working ? snap.remainingSec / 60 : undefined,
      hour: new Date(ms).getHours(), off: statusKey(snap, st.today, s) === 'off',
      energy: st.mood ? st.mood.energy : undefined, mood: st.mood ? st.mood.mood : undefined,
      goal: s.health && s.health.water ? s.health.water.goal : undefined
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
  // Pet speech by rank, a line about state (QJZ.lines, with extra context): the user's own actions always show (a
  // banner where there is no bubble, or while a prompt shows); events and chatter only in a bubble, never over the
  // user's or another module's bubble, never while a prompt shows or a focus runs; chatter only when none shows. The
  // line is picked only when it will be said.
  function petSay(state, extra, ms, rank) {
    if (!view) return false;
    if (rank < RANK.user && (!view.bubble || bubbleRank >= RANK.user || (rank === RANK.chat && bubbleRank) || prompting() || focusing())) return false;
    return say(line(state, extra), ms, rank);
  }
  // Chatter: 7–15 s after the last bubble went away, about what the pet is doing (not over a reaction); none while a
  // prompt shows or a focus runs, and 7–15 s again after they end.
  function chatter(ms) {
    var gap = lastTick !== null && (ms - lastTick > GAP_MS || ms < lastTick);
    lastTick = ms;
    if (!view || !view.bubble || bubbleRank || dragging) return;
    if (prompting() || focusing()) { chatAt = null; return; }
    if (chatAt === null || gap) { chatAt = nextChat(ms); return; }
    if (ms < chatAt) return;
    chatAt = null;
    var s = brain && brain.state;
    if (s && !REACTIONS[s]) petSay(s, null, 0, RANK.chat);
  }

  // ---- size and hit rects ----
  // The layout root, and a prompt bubble that reaches past it (U7 / M3: a long one), with its 4px shadow. U10's root is
  // the whole window (its capsule's own shadow is inside it): no room for the hard shadow.
  function measure() {
    var r = view.el.getBoundingClientRect(), right = r.right, bottom = r.bottom, pad = view.name === 'U10' ? 0 : SHADOW;
    var p = view.el.classList.contains('prompting') ? view.el.querySelector('[data-prompt] .rbub') : null;
    if (p) {
      var b = layoutBox(p);
      right = Math.max(right, b.left + b.width + 4);
      bottom = Math.max(bottom, b.top + b.height + 4);
    }
    return { width: Math.ceil(right) + pad, height: Math.ceil(bottom) + pad };
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
      if (el.getAttribute('data-hit') === 'pet') petRects(el, r).forEach(function (q) { out.push(outer(q)); });
      else if (el.getAttribute('data-hit-shape') === 'disc') discRects(r, DISC_BANDS).forEach(function (q) { out.push(outer(q)); });
      else out.push(outer(r));
    });
    return out;
  }

  // ---- hit areas that follow a shape (the transparent space next to it clicks through to the desktop) ----
  // A disc (the M3 ring) as n horizontal bands, each as wide as the disc gets inside it, so the disc stays covered.
  var DISC_BANDS = 8;
  function discRects(r, n) {
    var R = Math.min(r.width, r.height) / 2, cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = 2 * R / n, out = [];
    for (var i = 0; i < n; i++) {
      var y0 = cy - R + i * h, y1 = y0 + h, d = y0 > cy ? y0 - cy : y1 < cy ? cy - y1 : 0, hw = Math.sqrt(Math.max(0, R * R - d * d));
      out.push({ left: cx - hw, top: y0, width: 2 * hw, height: h });
    }
    return out;
  }

  // The U7 pet: rects along the painted pet and its desk (petonly viewBox units) instead of one box. They are measured
  // once per skin and state on a hidden copy of the pet whose animations are paused and stepped through their loop, so
  // every lift, squash, tilt and swing is in. The work runs a frame at a time while the page is idle (BAND_SLICE_MS);
  // until a state's bands are ready, and in hop and dangle (they move too much), the measured box (petHit) serves.
  // Bands stay inside that box.
  var BAND = 10, BAND_STEP = 2, BAND_PAD = 3, BAND_MERGE = 4, BAND_GAP = 14, BAND_SLICE_MS = 8, BAND_MAX = 30;
  var bandCache = {}, bandJobs = [], bandTimer = null;
  // by the shown pose (poseOf): a stand-in pose shares its bands
  function bandKey(id, state) {
    return id + '|' + poseOf(id, state) + (document.documentElement.classList.contains('calm') ? '|calm' : '');
  }
  function petRects(el, box) {
    var state = view.petState, id = petId(app().state.settings), lim = petHit(state, id);
    if (boxOnly(state, id)) return [subRect(box, PETONLY_VB, lim)];
    var bands = bandCache[bandKey(id, state)];
    if (!bands) { queueBands(id, state); return [subRect(box, PETONLY_VB, lim)]; }
    return bandRects(bands, state, box, id);
  }
  // Bands -> page rects inside box: padded by BAND_PAD (not towards a band they touch), kept inside petHit(state, id).
  function bandRects(bands, state, box, id) {
    var lim = petHit(state, id), L = lim[0], T = lim[1], R = lim[0] + lim[2], B = lim[1] + lim[3], out = [];
    if (!bands || !bands.length || bands.length > BAND_MAX) return [subRect(box, PETONLY_VB, lim)];   // (the host takes 64)
    function touches(b, edge, side) {
      return bands.some(function (c) { return c !== b && c[side] === edge && c[0] < b[2] && c[2] > b[0]; });
    }
    bands.forEach(function (b) {
      var x0 = Math.max(L, b[0] - BAND_PAD), x1 = Math.min(R, b[2] + BAND_PAD);
      var y0 = Math.max(T, b[1] - (touches(b, b[1], 3) ? 0 : BAND_PAD)), y1 = Math.min(B, b[3] + (touches(b, b[3], 1) ? 0 : BAND_PAD));
      if (x1 > x0 && y1 > y0) out.push(subRect(box, PETONLY_VB, [x0, y0, x1 - x0, y1 - y0]));
    });
    return out.length ? out : [subRect(box, PETONLY_VB, lim)];
  }

  function queueBands(id, state) {
    var key = bandKey(id, state);
    if (bandCache[key] || bandJobs.some(function (j) { return j.key === key; })) return;
    bandJobs.push({ key: key, id: id, state: state });
    scheduleBands();
  }
  function scheduleBands() {
    if (bandTimer || !bandJobs.length) return;
    bandTimer = window.requestIdleCallback ? { idle: window.requestIdleCallback(bandWork, { timeout: 1500 }) } :
      { timeout: setTimeout(bandWork, 80) };
  }
  function cancelBands() {
    if (bandTimer) {
      if (bandTimer.idle && window.cancelIdleCallback) window.cancelIdleCallback(bandTimer.idle);
      if (bandTimer.timeout) clearTimeout(bandTimer.timeout);
    }
    bandTimer = null;
    bandJobs.forEach(function (j) { if (j.host) j.host.remove(); });
    bandJobs = [];
  }
  // One idle slice: work on the queued jobs until BAND_SLICE_MS is spent (a frame stops between two shapes).
  function bandWork() {
    bandTimer = null;
    var until = Date.now() + BAND_SLICE_MS;
    while (bandJobs.length && Date.now() < until) {
      if (bandStep(bandJobs[0], until)) bandDone(bandJobs.shift());
    }
    scheduleBands();
  }
  // Runs every queued job to the end (tests).
  function flushBands() {
    while (bandJobs.length) { var j = bandJobs[0]; while (!bandStep(j, Infinity)) {} bandDone(bandJobs.shift()); }
  }
  function bandDone(job) {
    bandCache[job.key] = job.bands || [];
    if (view && view.pet && view.live && view.pet.el.getAttribute('data-hit') === 'pet' &&
      bandKey(petId(app().state.settings), view.petState) === job.key) sync(false);
  }
  // Measures the bands of one skin and state at once (tests), in steps of sliceMs (default: whole frames).
  // bandStats(): {frames, steps, maxStepMs} of the last such measurement.
  var bandStats = { frames: 0, steps: 0, maxStepMs: 0 };
  function measureBands(id, state, sliceMs) {
    var job = { id: id, state: state }, t;
    bandStats = { frames: 0, steps: 0, maxStepMs: 0 };
    do {
      t = Date.now();
      var done = bandStep(job, sliceMs ? t + sliceMs : Infinity);
      bandStats.steps++;
      bandStats.maxStepMs = Math.max(bandStats.maxStepMs, Date.now() - t);
    } while (!done);
    bandStats.frames = job.times ? job.times.length : 0;
    return job.bands;
  }

  // A job: set up the hidden copy (first step), then the animation frames, each until `until` (ms) or its end
  // (job.f the frame, job.si the next shape in it); true when done (job.bands).
  function bandStep(job, until) {
    try {
      if (!job.svg) {
        if (startBands(job)) return false;
      } else {
        if (!job.si) job.anims.forEach(function (a) { a.currentTime = job.times[job.f]; });
        if (!bandFrame(job, until)) return false;
        job.f++;
        job.si = 0;
        if (job.f < job.times.length) return false;
        job.bands = bandsOf(job);
      }
    } catch (e) { job.bands = null; }
    if (job.host) job.host.remove();
    job.host = job.svg = null;
    return true;
  }
  // false when there is nothing to measure (then the job is done, with no bands: the box serves)
  function startBands(job) {
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:176px;height:170px;overflow:hidden;pointer-events:none';
    host.innerHTML = QJZ.pets.compose(job.id, 'petonly', { state: job.state });
    document.body.appendChild(host);
    var svg = host.firstElementChild;
    job.host = host;
    if (!svg || !svg.getAnimations) { job.bands = null; return false; }
    job.svg = svg;
    job.anims = svg.getAnimations({ subtree: true });
    job.anims.forEach(function (a) { a.pause(); });
    job.times = bandTimes(job.anims);
    job.f = job.si = 0;
    job.wob = (QJZ.pets.get(job.id) || {}).wrap === 'crayon' ? 1.5 : 0;   // the crayon grain moves edges by up to 1.2
    var vb = PETONLY_VB;
    job.cols = Math.floor(vb[2] / BAND_STEP) + 1;
    job.rows = [];
    for (var by = vb[1]; by < vb[1] + vb[3]; by += BAND) job.rows.push(new Uint8Array(job.cols));
    // the pet's painted shapes: not the flying props (.tops), not what a clip keeps inside another shape
    job.shapes = [];
    Array.prototype.forEach.call(svg.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line'), function (el) {
      if (el.closest('defs,clipPath,mask,pattern,.tops')) return;
      for (var p = el.parentNode; p && p !== svg; p = p.parentNode) if (p.getAttribute && p.getAttribute('clip-path')) return;
      var tag = el.tagName.toLowerCase(), fill = el.getAttribute('fill'), stroke = el.getAttribute('stroke');
      var stroked = !!stroke && stroke !== 'none', sw = stroked ? parseFloat(el.getAttribute('stroke-width') || '1') || 1 : 0;
      var open = tag === 'polyline' || tag === 'path' && !/z/i.test(el.getAttribute('d') || '');
      job.shapes.push({ el: el, box: tag === 'rect' || tag === 'line', fill: fill !== 'none' && tag !== 'line' && tag !== 'polyline',
        stroke: stroked, sw: sw, dense: open && stroked && sw <= 3 });   // thin open lines (whiskers): every row
    });
    return true;
  }
  // Times to sample (ms, the same for every animation, as on screen): one loop of the longest moving animation
  // (alternate ones count twice), at most 4.8 s, every 150 ms (100 ms up to 2.4 s, 50 ms up to 1.3 s).
  function bandTimes(anims) {
    var T = 0;
    anims.forEach(function (a) {
      var tm = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null, kf = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
      if (!tm || !isFinite(tm.duration) || !kf.some(function (k) { return k.transform && k.transform !== 'none'; })) return;
      T = Math.max(T, tm.duration * (/alternate/.test(tm.direction) ? 2 : 1));
    });
    T = Math.min(T, 4800);
    var step = T <= 1300 ? 50 : T <= 2400 ? 100 : 150, out = [];
    for (var t = 0; t <= T; t += step) out.push(t);
    return out;
  }
  // Marks what the frame paints into job.rows (one row of cells per band of BAND units, a cell every BAND_STEP).
  // Small or thin shapes and rects count by their box (stroke included); big ones by their left and right edge on
  // three lines through each band (every line for thin open strokes such as whiskers), stepping in from their box.
  // Goes on from shape job.si; true when the frame is done, false when `until` came first.
  function bandFrame(job, until) {
    var svg = job.svg, M = svg.getScreenCTM(), Mi = M.inverse(), vb = PETONLY_VB, pt = svg.createSVGPoint();
    function mark(bi, xa, xb) {
      var row = job.rows[bi];
      if (!row) return;
      var c0 = Math.max(0, Math.floor((xa - vb[0]) / BAND_STEP)), c1 = Math.min(job.cols - 1, Math.ceil((xb - vb[0]) / BAND_STEP));
      for (var c = c0; c <= c1; c++) row[c] = 1;
    }
    if (!job.sorted) {   // biggest first, so the parts inside them find their bands already marked
      job.shapes.forEach(function (sh) { var r = sh.el.getBoundingClientRect(); sh.area = r.width * r.height; });
      job.shapes.sort(function (a, b) { return b.area - a.area; });
      job.sorted = true;
    }
    while (job.si < job.shapes.length) {
      try { shape(job.shapes[job.si]); } catch (e) {}   // (a part squashed flat this frame: skipped)
      job.si++;
      if (job.si < job.shapes.length && Date.now() >= until) return false;
    }
    return true;
    function covered(bi, xa, xb) {
      var row = job.rows[bi];
      if (!row) return true;
      var c0 = Math.max(0, Math.floor((xa - vb[0]) / BAND_STEP)), c1 = Math.min(job.cols - 1, Math.ceil((xb - vb[0]) / BAND_STEP));
      for (var c = c0; c <= c1; c++) if (!row[c]) return false;
      return true;
    }
    function shape(sh) {
      var r = sh.el.getBoundingClientRect();
      if (!(r.width > 0 || r.height > 0)) return;
      var ctm = null;
      if (!sh.sc) {   // the shape's scale against the viewBox, taken once (it only matters for the stroke width)
        ctm = sh.el.getScreenCTM();
        var loc = Mi.multiply(ctm);
        sh.sc = Math.sqrt(Math.abs(loc.a * loc.d - loc.b * loc.c)) || 1;
      }
      var hs = (sh.stroke ? sh.sw * sh.sc / 2 : 0) + job.wob;
      var x0 = (r.left - M.e) / M.a - hs, x1 = (r.right - M.e) / M.a + hs, y0 = (r.top - M.f) / M.d - hs, y1 = (r.bottom - M.f) / M.d + hs;
      var b0 = Math.max(0, Math.floor((y0 - vb[1]) / BAND)), b1 = Math.min(job.rows.length - 1, Math.floor((y1 - vb[1]) / BAND));
      if (sh.box || x1 - x0 <= 16 && y1 - y0 <= 16 || Math.min(x1 - x0, y1 - y0) <= 5) {
        for (var bb = b0; bb <= b1; bb++) mark(bb, x0, x1);
        return;
      }
      var inv = (ctm || sh.el.getScreenCTM()).inverse();
      function on(vx, vy) {
        pt.x = M.a * vx + M.e; pt.y = M.d * vy + M.f;
        var q = pt.matrixTransform(inv);
        return (sh.fill && sh.el.isPointInFill(q)) || (sh.stroke && sh.el.isPointInStroke(q));
      }
      for (var bi = b0; bi <= b1; bi++) {
        if (covered(bi, x0, x1)) continue;   // nothing this shape could add here
        var by = vb[1] + bi * BAND, lo = Infinity, hi = -Infinity, lines = [by + 1, by + BAND / 2, by + BAND - 1];
        if (sh.dense) { lines = []; for (var ly = by + 0.5; ly < by + BAND; ly += 1) lines.push(ly); }
        lines.forEach(function (vy) {
          if (vy < y0 || vy > y1) return;
          var a, b;
          for (a = x0; a <= x1; a += BAND_STEP) if (on(a, vy)) break;
          if (a > x1) return;
          for (b = x1; b > a; b -= BAND_STEP) if (on(b, vy)) break;
          lo = Math.min(lo, a - BAND_STEP - job.wob); hi = Math.max(hi, b + BAND_STEP + job.wob);
        });
        if (hi >= lo) mark(bi, lo, hi);
      }
    }
  }
  // job.rows -> bands [[x0, y0, x1, y1], ...]: runs of marked cells (a gap of BAND_GAP or more splits them), and runs
  // of neighbouring bands whose sides line up merged into one.
  function bandsOf(job) {
    var vb = PETONLY_VB, segs = [], merged = [];
    job.rows.forEach(function (row, bi) {
      var by = vb[1] + bi * BAND, run = null;
      for (var c = 0; c < job.cols; c++) {
        if (!row[c]) continue;
        var x = vb[0] + c * BAND_STEP;
        if (run && x - run[2] < BAND_GAP) run[2] = x;
        else { run = [x, by, x, by + BAND]; segs.push(run); }
      }
    });
    segs.forEach(function (b) {
      for (var i = merged.length - 1; i >= 0; i--) {
        var m = merged[i];
        if (m[3] === b[1] && Math.abs(m[0] - b[0]) <= BAND_MERGE && Math.abs(m[2] - b[2]) <= BAND_MERGE) {
          m[0] = Math.min(m[0], b[0]); m[2] = Math.max(m[2], b[2]); m[3] = b[3];
          return;
        }
      }
      merged.push(b.slice());
    });
    return merged;
  }
  // Where the lifted pet's scruff tip is in U7, page CSS px (dragStart's grab).
  function grabPoint() {
    var h = view && view.pet, g = QJZ.pets && QJZ.pets.grabAt ? QJZ.pets.grabAt(petId(app().state.settings)) : null;
    if (!h || h.view !== 'petonly' || !g) return null;
    var r = boxOf(h.el), p = vbPoint(r, PETONLY_VB, g, false);
    return [Math.round((r.left + p.x) * 10) / 10, Math.round((r.top + p.y) * 10) / 10];
  }
  // Sends setLayout when the size (or DPR, or U10's dock) changed and hitRects when the rects changed or setLayout went
  // out. force: send both anyway (layout switch, DPR change, U10's capsuleDock); forceHits: hitRects anyway (resize).
  // U10's setLayout always carries its dock (the host would take a missing one for the top). Just after an answer
  // (holdSpot) the size is at least the one sent before it, and the answered button's spot stays a hit rect.
  function sync(force, forceHits) {
    if (!view) return;
    var dpr = window.devicePixelRatio || 1, dock = view.name === 'U10' ? dockOf() : null;
    var size = measure(), rects = hitRects();
    if (held) {
      size = { width: Math.max(size.width, held.width), height: Math.max(size.height, held.height) };
      rects.push(held.rect);
    }
    var sk = view.name + ' ' + size.width + 'x' + size.height + '@' + dpr + (dock ? ' ' + dock : '');
    var hk = JSON.stringify(rects) + '@' + dpr;
    if (force || sk !== sent.size) {
      sent.size = sk;
      sent.dims = { width: size.width, height: size.height };
      var msg = { layout: view.name, width: size.width, height: size.height, dpr: dpr };
      if (dock) msg.dock = dock;
      send('setLayout', msg);
      forceHits = true;
    }
    if (forceHits || hk !== sent.hits) {
      sent.hits = hk;
      send('hitRects', { rects: rects, dpr: dpr });
    }
  }

  // U10's dock (spec §5.7): settings.layout.capsule, one of QJZ.settings.DOCKS (the settings parser keeps it so).
  function dockOf() { return app().state.settings.layout.capsule; }

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
    unhold(false);   // a new layout: its own size and rects
    chatAt = nextChat(app().nowMs());   // a new layout: no line at once, whenever the old schedule fell due
    cur = name;
    view = build(name);
    try {
      if (name === 'PANEL' && panels()) panels()._mount(view.el, panelKind);
      render();
      drawPrompt();   // the prompt that shows, in this layout's slot, before the size goes out
    } catch (e) {
      if (window.console) console.error('[layouts] render ' + name + ' failed', e);   // still size and show the window
    }
    sync(true);   // synchronous: the first one is what shows the window
    view.live = true;
    remember(name === 'PANEL' ? panelFrom : name);
    send('setTopmost', { on: topmostFor(name) });
    var s = app().state.settings;
    if (isMain(name) && (s.layout.current !== name || s.layout.mini)) app().saveSettings({ layout: { current: name, mini: false } });
    else if (name === 'M3' && !s.layout.mini) app().saveSettings({ layout: { mini: true } });
    if (QJZ.care) QJZ.care.setPanel(cur === 'PANEL');   // bubbles wait while the panel is open (Ruling C1)
    return true;
  }
  function drawPrompt() { drawView(prompting() && QJZ.care.view ? QJZ.care.view() : null); }
  // The prompt view v (null: none) in this layout's slot.
  function drawView(v) {
    drawnView = v ? JSON.stringify(v) : '';
    if (!QJZ.promptView || !view) return;
    if (v) QJZ.promptView.render(view.el, view.name, v); else QJZ.promptView.clear(view.el);
  }
  function current() { return cur; }
  // The first layout, and where a panel shown first (nothing before it) goes back to: opts.first (dev), the layout
  // shown before a reload, else the one used last (lastLayout).
  function startLayout() {
    if (first && first !== 'PANEL' && ALL.indexOf(first) >= 0) return first;
    return resumeAt || lastLayout(app().state.settings);
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
  // A click's own line (a poke, a lift) only where it can be said in the bubble: never a banner for every click, so
  // none while a prompt shows either; none during a focus (§4.3 「不講話」: a poke has its one 「專心中～」).
  function clickSays() { return !!(view && view.bubble) && !prompting() && !focusing(); }
  // The speech bubble goes away at once (a prompt shows).
  function hideSay() {
    stopSay();
    if (view && view.bubble) view.bubble.classList.remove('show');
  }
  // A speech bubble where the layout has one (U1, U3, U7), else a short banner; a banner too while a prompt shows (one
  // bubble at a time). Never interactive (no hit rect).
  // rank (layouts-internal): RANK of the line; other modules' lines rank with the user's own actions.
  function say(text, ms, rank) {
    if (!view || !text) return false;
    var v = view, b = v.bubble;
    if (!b || prompting()) { if (QJZ.fx) QJZ.fx.banner(v.fxWin, text); return true; }
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
  // quick poke, angry for 4 s (mood -5, no sound, no hearts). During a focus: 「專心中～」 once per focus (a bubble, or
  // a banner where there is none), and nothing else (§5.2 「被點的時候只回一次」, Ruling: once per focus).
  function poke(e) {
    if (!petSvg() || !brain) return;
    if (focusing()) {
      var startMs = careState().p.startMs;
      if (focusPoked !== startMs) { focusPoked = startMs; say(line('focusPoke')); }
      return;
    }
    var now = app().nowMs(), r = brain.poke(now);
    if (r === 'angry') {
      if (!brain.angered) return;
      app().annoy();
      if (clickSays()) petSay('angry', null, 3500, RANK.user);
    } else {
      app().pet();
      petSound();
      if (QJZ.fx && view.fx) {
        var b = view.fx.getBoundingClientRect();
        QJZ.fx.hearts(view.fx, e.clientX - b.left, e.clientY - b.top, 7);
      }
      if (clickSays()) petSay('petted', null, 0, RANK.user);
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
  // most one bubble, only if nothing else is being said. During a focus (§4.3 「不講話、不打擾」) only the hop plays:
  // no confetti, coin or line; the snack is counted all the same, so nothing is replayed after it.
  function onMilestone(ev) {
    if (!view) return;
    if (ev && ev.quiet) {
      if (!bubbleRank) petSay('missed', { gained: ev.gained || 1 }, 0, RANK.event);
      return;
    }
    var hush = focusing();
    if (QJZ.fx && view.fxWin && !hush) {
      var c = petCenter(view.fxWin);
      QJZ.fx.confetti(view.fxWin, c.x, c.y);
    }
    if (QJZ.sound && !hush) QJZ.sound.coin();
    if (brain) {
      var now = app().nowMs();
      brain.show('hop', now, QJZ.behavior.HOP_MS);
      petTick(now);
    }
    petSay('hop', null, 0, RANK.event);
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
      case 'drink': if (QJZ.care) QJZ.care.drink(); break;
      case 'pomo': if (QJZ.care) QJZ.care.toggleFocus(); break;
    }
  }

  // ---- host messages ----
  function onMenu(msg) {
    var a = msg && msg.action;
    if (a === 'quit') { app().quit(); return; }   // even if init never got through: the host is waiting for quit {}
    if (typeof a !== 'string' || !ready()) return;
    if (a.indexOf('layout:') === 0) { if (isMain(a.slice(7))) show(a.slice(7)); return; }
    if (a.indexOf('capsule:') === 0) { setDock(a.slice(8)); return; }
    switch (a) {
      case 'mini': show(cur === 'M3' ? backTarget(app().state.settings) : 'M3'); break;   // in M3 (checked): back
      case 'feed': feed(); break;
      case 'start': startWork(); break;
      case 'end': endWork(); break;
      case 'adjust': case 'settings': case 'history': openPanel(a); break;
      case 'topmost': toggleTopmost(); break;
      // toggleVisible is handled by the host; anything else is ignored
    }
  }

  // U10's dock, from the menu's 膠囊位置 (capsule:<dock>) or the host's capsuleDock after a drop snapped it: saved, and
  // U10 sends setLayout with it. A new dock re-renders through the save's change (sync sees the dock changed); the same
  // one is sent again all the same, so an older setLayout still on its way to the host cannot undo a snap.
  function setDock(d) {
    if (!ready() || QJZ.settings.DOCKS.indexOf(d) < 0) return;
    if (dockOf() !== d) app().saveSettings({ layout: { capsule: d } });
    else if (cur === 'U10') sync(true);
  }
  function onCapsuleDock(msg) { setDock(msg && msg.dock); }

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
  // Every app tick (100 ms while visible, 250 ms with 省電模式): the odometer, the pet's state and the chatter clock.
  // Pure arithmetic unless something changed.
  function onTick(snap) {
    if (!view || !snap) return;
    renderMoney(snap);
    var ms = app().nowMs();
    petTick(ms);
    chatter(ms);
  }
  // QJZ.app caught up while hidden (or the menu is opening): only the menu needs it now, the rest renders on re-show.
  function onRefresh() {
    if (ready() && app().state.snap) sendMenu(model(app().state, app().nowMs(), careState()));
  }
  // QJZ.care changed what it shows (a cup, a tomato, a phase, from a button, the menu or the tray): at once, not at the
  // next second. Its countdowns do not fire this; they follow onSecond.
  function onCare() {
    if (!view || !ready()) return;
    if (prompting()) {   // a cup logged elsewhere while it shows: its 「今天 N/8 杯」 (Review Focus #5)
      var v = QJZ.care.view();
      if (v && JSON.stringify(v) !== drawnView) drawView(v);
    }
    render();
    sync(false);
  }
  function onSecond() {
    if (!view) return;
    var m = render();
    sync(false);   // text can change sizes (M3 tag, fonts arriving)
    if (m && m.plus && QJZ.fx) for (var i = 0; i < view.plus.length; i++) QJZ.fx.plus(view.plus[i], m.plus);
  }

  // ---- QJZ.care events (Task 11) ----
  // prompt {type: show | update | hide | wave, view}. A hide is also what an answer sends (quiet or not, it clears).
  function onPrompt(ev) {
    if (!ev || !view || !ready()) return;
    var pv = QJZ.promptView, now = app().nowMs();
    if (ev.type === 'hide') {
      drawView(null);
    } else if (ev.type === 'wave') {
      if (brain) brain.knock(now);   // the pet waves again (holdCup: redrawn, updatePet)
      petTick(now);
      if (pv) pv.wave(view.el, view.name);
      return;
    } else {
      hideSay();
      drawView(ev.view);
      if (pv && ev.type === 'show') pv.wave(view.el, view.name);
    }
    sync(false);   // U7 and M3 grow right while it shows; its buttons join the hit rects
  }
  // cue: 'focus' | 'wave' | 'holdCup' | 'stretch' | null (QJZ.behavior's Brain.cue).
  function onCue(name) {
    if (!brain || !ready()) return;
    var now = app().nowMs();
    brain.cue(name, now);
    if (view) petTick(now);
  }
  // A cup logged anywhere: the pet sips with you (the cup that reaches the goal: petted, hearts and praise instead),
  // the cups pop 「+1」 once care shows the new count, and a line (the user's own act: a banner where there is no bubble).
  function onDrank(ev) {
    if (!brain || !view || !ready()) return;
    var now = app().nowMs();
    cupPlus = true;
    if (ev && ev.goalReached) {
      brain.show('petted', now, QJZ.behavior.PET_MS);
      if (QJZ.fx && view.fx) { var c = petCenter(view.fx); QJZ.fx.hearts(view.fx, c.x, c.y, 7); }
      say(line('waterGoal'));
    } else {
      brain.show('sip', now, QJZ.behavior.SIP_MS);
      say(line('drank'));
    }
    petTick(now);
  }
  // standup {count, source}: only 起來了 ('up') plays here; 喝了 ('drink') sips through drank, a break or a lock is quiet.
  function onStandup(ev) {
    if (!ev || ev.source !== 'up' || !brain || !view || !ready()) return;
    var now = app().nowMs();
    brain.show('petted', now, QJZ.behavior.PET_MS);
    say(line('standOk'));
    petTick(now);
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
    // A run of presses (detail 1, 2, …) that began on an answer: the later ones do nothing (answer).
    if (e.detail <= 1) answerRun = !!(e.target && e.target.closest && e.target.closest('[data-answer]'));
    else if (answerRun) return;
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
    var grab = cur === 'U7' ? grabPoint() : null;
    send('dragStart', grab ? { grab: grab } : {});
    if (cur === 'U7' && brain) {   // picked up by the scruff
      var now = app().nowMs();
      dragAt = now;
      brain.drag(true);
      if (view.dpet) view.dpet.classList.add('held');   // the lifted pet hangs in front of its tag
      petTick(now);
      if (clickSays()) petSay('dangle', null, 0, RANK.user);
    }
  }
  // dragEnd from the host (its move loop ended), or the page saw the button go up (released before the move loop
  // started: then the host sends no dragEnd).
  function endDrag() {
    dragging = false;
    if (view && view.dpet) view.dpet.classList.remove('held');
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
    if (answerRun && e.detail > 1) return;   // the second click of a double press on an answer (answer)
    var ans = e.target.closest('[data-answer]');
    if (ans) { answer(ans, e.detail > 0); return; }
    var a = e.target.closest('[data-act]');
    if (a) { act(a.getAttribute('data-act')); return; }
    if (dragged) { dragged = false; return; }   // the end of a drag, not a poke
    if (isPetPart(e.target)) poke(e);
  }
  // An answer button (final review m-3). The bubble goes at once, so the second press of a double click lands on
  // whatever was under the button: that press, its click and its dblclick do nothing (answerRun: onDown, onClick,
  // onDbl). And it must stay ours: U7 and M3 shrink back and U10's capsule folds, so for DBL_MS the window keeps its
  // size and the button's spot stays a hit rect (holdSpot, sync); else the second press goes to the window underneath.
  // Held before care answers, so the setLayout and hitRects of the bubble going already carry it; only for a press
  // (pressed: the click has a detail, a keyboard or scripted click has none and no second press). A stale answer does
  // nothing and holds nothing.
  function answer(btn, pressed) {
    if (!QJZ.care) return;
    if (pressed) holdSpot(outer(boxOf(btn)));
    if (!QJZ.care.answer(btn.getAttribute('data-answer'))) unhold(true);
  }
  function holdSpot(rect) {
    var d = sent.dims || { width: 0, height: 0 };
    held = { rect: rect, width: d.width, height: d.height };
    clearTimeout(timers.held);
    timers.held = setTimeout(function () { timers.held = 0; unhold(true); }, DBL_MS);
  }
  // resync: send the size and rects without the hold now (a layout switch sends its own).
  function unhold(resync) {
    clearTimeout(timers.held);
    timers.held = 0;
    if (!held) return;
    held = null;
    if (resync) sync(false);
  }
  // The animal's own painted shape (compose's .pa, not a .prop it holds): what a click pets.
  function isPetPart(t) {
    return !!(t && t.closest && t.closest('[data-pet] .pa') && !t.closest('.prop'));
  }
  // A double click on the badge expands M3, unless its run of presses began on an answer button (answer).
  function onDbl(e) {
    if (answerRun) return;
    if (cur === 'M3' && inRoot(e.target)) show(backTarget(app().state.settings));
  }
  // [data-hover] gets .hover while the pointer is on it: U7's pet and tag show the ⚙ ✕ tools, U10's capsule its full
  // view; either way the hit rects follow.
  function setHover(on) {
    if (!view || !view.hover || view.hover.classList.contains('hover') === on) return;
    view.hover.classList.toggle('hover', on);
    sync(false);
  }
  // mouseover and mousemove: entering shows them, moving keeps them (they also go 4 s after the last move, in
  // case the pointer left without a mouseout when the window turned click-through). A move while they show only
  // pushes the deadline; the one idle timer re-arms itself for the rest when it fires early.
  var HOVER_IDLE_MS = 4000;
  function onOver(e) {
    if (!view || !view.hover || !view.hover.contains(e.target)) return;
    hoverUntil = Date.now() + HOVER_IDLE_MS;
    if (timers.hover) { clearTimeout(timers.hover); timers.hover = 0; }   // back in before the mouseout delay ran out
    if (timers.idle && view.hover.classList.contains('hover')) return;
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
    if (!view || !view.hover || !view.hover.contains(e.target) || view.hover.contains(e.relatedTarget)) return;
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

  // opts: {bridge (default QJZ.bridge), first: layout to show first instead of the one used last (dev),
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
    offs.push(A.on('change', onChange), A.on('tick', onTick), A.on('second', onSecond), A.on('milestone', onMilestone),
      A.on('refresh', onRefresh));
    if (QJZ.care) {
      offs.push(QJZ.care.on('change', onCare), QJZ.care.on('prompt', onPrompt), QJZ.care.on('cue', onCue),
        QJZ.care.on('drank', onDrank), QJZ.care.on('standup', onStandup));
    }
    [bridge.on('menu', onMenu), bridge.on('dragEnd', endDrag), bridge.on('capsuleDock', onCapsuleDock)].forEach(function (off) {
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
    panelKind = 'settings'; shown = false; dragging = false; sent = { size: '', hits: '', menu: '', dims: null };
    answerRun = false; held = null;
    brain = null; bubbleRank = 0; chatAt = null; lastTick = null; dragged = false; dragAt = 0; hoverUntil = 0;
    lunchCache = { key: null, s: null }; focusPoked = null; cupPlus = false; drawnView = '';
    cancelBands();
  }

  return {
    show: show, current: current, start: start, say: say, openPanel: openPanel, closePanel: closePanel, _reset: reset,
    _bands: { flush: flushBands, pending: function () { return bandJobs.length; }, clear: function () { cancelBands(); bandCache = {}; } },
    dragging: function () { return dragging; },
    _brain: function () { return brain; },   // tests only (Ruling R3, like _reset and _bands): the pet's Brain
    MAIN: MAIN, ALL: ALL,
    util: {
      hms: hms, hm: hm, clockText: clockText, statusKey: statusKey, STATUS: STATUS,
      isMain: isMain, backTarget: backTarget, lastLayout: lastLayout, itemAt: itemAt, cardAt: cardAt, CARD_MS: CARD_MS, rateText: rateText, remainPhrase: remainPhrase, m3Sub: m3Sub,
      DBL_MS: DBL_MS,
      heartsText: heartsText, model: model, subRect: subRect, outer: outer, layoutBox: layoutBox, discRects: discRects,
      DISC_BANDS: DISC_BANDS, measureBands: measureBands, bandRects: bandRects, bandStats: function () { return bandStats; },
      PETONLY_VB: PETONLY_VB, PET_HIT: PET_HIT, PET_HIT_TALL: PET_HIT_TALL, petHit: petHit, bandKey: bandKey, vbPoint: vbPoint,
      anchorBubble: anchorBubble, VIEWBOX: VIEWBOX
    }
  };
})();
