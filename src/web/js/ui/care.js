window.QJZ = window.QJZ || {};
// The health runtime (spec §4.9, §5.1-5.3): the reminder timer (QJZ.reminders), the pomodoro (QJZ.pomodoro) and the
// one-bubble arbiter (QJZ.prompt) wired to QJZ.app, the host and the session. Counts go to history.json through
// QJZ.app.setHealth / setPomodoro, both saved at once.
//
// It steps on the app's second event and on a 10 s heartbeat; the heartbeat keeps the pomodoro counting and saved while
// the page is hidden or locked (the app tick is paused then). It also steps on the app's refresh, which the host's
// menuOpening asks for, so the menu opens with the healthMenu of now (cups, 停止番茄鐘) even on a hidden page.
// Each step, in order:
//  0. after 04:00 the app's day is rolled over if it has not been yet (QJZ.app.refresh; hidden, it refreshes once a
//     minute);
//  1. a new day restarts the timer;
//  2. the pomodoro walks every phase that has ended: a tomato on the day it started; a break start is a stand-up on its
//     own day and restarts the timer, after the timer was brought up to the break's start, so a reminder that came due
//     during the focus adds its water line to the break bubble (Ruling M3); a break or 休息結束 left from an earlier
//     day then ends quietly;
//  3. the timer runs to now;
//  4. the arbiter decides the bubble: blocked while hidden, fullscreen or the panel is open (Ruling C1); a reminder
//     asked for with remindNow (the timer's forced) shows outside work time too;
//  5. prompt events, raise {on} to the host, then the pet's cue.
// A fresh 開始上班 (the app's started event) restarts the timer; 繼續上班 and 調整起算時間 do not (§5.1).
// Saved and sent only on change (Ruling R7): the pomodoro when it changed, healthMenu when its payload changed.
// A clock set back moves the arbiter's times and 等一下 with it, so no bubble waits for the size of the jump.
//
// Host messages: visibility {visible} (false until the first one), fullscreen {on, here}, menu {action} ('drink',
// 'undrink', 'pomodoro', 'stoodUp'). To the host: raise {on}, healthMenu {cups, pomodoro:{phase, endsMs}, sitOn}
// (sitOn, 1.1.2: the 起來動 reminder is on, for the menu's 我剛起來動過了).
// 1.1.2 item 9: the session (lock, unlock, suspend, resume) means nothing here any more: a lock is no stand-up and the
// timer runs on through it (the locked time is sat time). A reminder that comes due meanwhile waits for the window
// (the host sends visibility false while locked) and shows 3 s after it is back; nothing is said about the lock.
// fullscreen (1.1.1 item 7): on holds the bubbles (state.fullscreen, the gate above); here says the full-screen window
// is on the pet window's monitor and the host has stepped the window behind it: state.here, and the layouts then say
// nothing at all (no chatter, event or milestone line, banner or drank line). Nothing is replayed after it; only a
// queued bubble comes, 3 s after on ends.
// state also carries standIn (minutesToStand(): null when nothing is asked), nth (the running focus's 第 N 顆 on its
// start day, else 0), here and forced (a reminder asked for waits: the timer reads 0, which no countdown shows), and
// snoozed (1.1.2: 等一下 runs, standIn counts to its end; the countdown shows 💤), for the layouts.
// Events (on): change (state); prompt {type:'show'|'update'|'wave'|'hide', prompt, view, quiet}; cue ('focus' | 'wave'
// | 'holdCup' | 'stretch' | null); drank {cups, goalReached}; standup {count, source:'up'|'drink'|'break'|'manual'}
// ('manual': 我剛起來動過了, stoodUp); snooze {minutes} (等一下 on a reminder that will come back: the pet says when).
QJZ.care = (function () {
  var HEARTBEAT_MS = 10000, MIN = 60000;
  var R = QJZ.reminders, P = QJZ.pomodoro, Q = QJZ.prompt;

  var state = {
    ready: false, visible: false, fullscreen: false, here: false, panel: false, forced: false, snoozed: false,
    r: null, p: null, q: null, prompt: null, breakWater: false,
    health: QJZ.health.of(null), goals: { cups: 0, tomatoes: 0, standups: 0 }, show: { cups: false, tomatoes: false },
    cupsText: '', turn: 0, standIn: null, nth: 0
  };
  var listeners = { change: [], prompt: [], cue: [], drank: [], standup: [], snooze: [] };
  var started = false, bridge = null, nowFn = null, heartbeat = null, offs = [];
  var seenHistory = null;   // QJZ.app.state.history as of the last init: a new object means a new init
  var seenRec = null;       // today's {day, startMs, endMs} at the last step: tells a 繼續上班
  var busy = 0, stepping = false, lastNow = null, lineTurn = 0;
  var lastSig = null, lastMenu = null, lastCue = null;

  function emit(name, arg) {
    var l = listeners[name].slice();
    for (var i = 0; i < l.length; i++) {
      try { l[i](arg); } catch (e) { if (window.console) console.error('[care] ' + name + ' handler failed', e); }
    }
  }
  function on(name, fn) {
    if (!listeners[name]) return function () {};
    listeners[name].push(fn);
    return function () { var at = listeners[name].indexOf(fn); if (at >= 0) listeners[name].splice(at, 1); };
  }

  function app() { return QJZ.app.state; }
  function settings() { return app().settings; }
  function today() { return app().today; }
  function recOf(day) { return day === today().day ? today() : app().history.days[day]; }
  function healthOn(day) { return QJZ.health.of(typeof day === 'string' ? recOf(day) : null); }
  function finite(v, def) { return typeof v === 'number' && isFinite(v) ? v : def; }
  function withR(o) { var n = {}, k; for (k in state.r) n[k] = state.r[k]; for (k in o) n[k] = o[k]; return n; }
  function isNotice(pr) { return pr.kind === 'break' || pr.kind === 'breakEnd'; }

  // Everything that changes care runs in a batch; listeners hear one change at the end.
  function batch(fn) {
    busy++;
    try { fn(); } finally { busy--; }
    if (!busy) publish();
  }

  // ---- counts (saved at once) ----
  // A day's count changed by delta; returns the new count. Today also carries the cup goal it is played against (§5.6).
  function addHealth(day, field, delta) {
    var h = QJZ.health.add(healthOn(day), field, delta);
    if (day === today().day) h.cupGoal = settings().health.water.goal;
    QJZ.app.setHealth(day, h);
    return h[field];
  }
  function savePomodoro() { QJZ.app.setPomodoro(state.p.phase === 'idle' ? null : state.p); }

  // ---- the timer ----
  function catchUp(now) {
    if (state.r.day === today().day) state.r = R.advance(state.r, now, today(), settings());
  }
  // A new day starts its own timer.
  function followDay(rec, now) {
    if (state.r.day === rec.day) return;
    state.r = R.initial(rec.day, now);
    seenRec = null;
  }
  // 繼續上班 makes the time since the 下班 working time again, as for the money. The steps in between counted none of it,
  // so the timer goes back to the 下班 and counts it on this step.
  function followResume(rec) {
    var s = seenRec;
    if (s && s.day === rec.day && s.startMs === rec.startMs && typeof s.endMs === 'number' &&
        (rec.endMs === null || rec.endMs === undefined) && s.endMs < state.r.lastMs) state.r = withR({ lastMs: s.endMs });
  }
  // The clock went back: the arbiter's gates, its re-wave and 等一下 move with it, so a gate 3 s away is still 3 s
  // away. The timer itself never counts negative time (QJZ.reminders.advance).
  function followClock(now) {
    if (lastNow !== null && now < lastNow) {
      var d = now - lastNow, q = state.q, pr = q.prompt, r = state.r;
      state.q = {
        prompt: pr ? { kind: pr.kind, water: pr.water, shownMs: pr.shownMs + d } : null,
        noticeReadyAt: q.noticeReadyAt === null ? null : q.noticeReadyAt + d,
        remindReadyAt: q.remindReadyAt === null ? null : q.remindReadyAt + d,
        waveAt: q.waveAt + d
      };
      state.r = withR({ snoozeUntil: typeof r.snoozeUntil === 'number' ? r.snoozeUntil + d : r.snoozeUntil });
    }
    lastNow = now;
  }

  // ---- the step ----
  function working(rec, s, now) {
    return QJZ.earn.snapshot({
      startMs: rec.startMs, endMs: rec.endMs, nowMs: now, day: rec.day, salary: s.salary,
      hoursPerDay: s.hoursPerDay, lunch: s.lunch, offDay: !!rec.offDay
    }).status === 'working';
  }
  function onBreakStart(ev, rec, s) {
    var same = state.r.day === ev.day;
    if (same && ev.atMs > state.r.lastMs) state.r = R.advance(state.r, ev.atMs, rec, s);
    var due = same ? R.due(state.r, ev.atMs, s.health, QJZ.health.of(today()).cups) : null;
    state.breakWater = !!(due && due.due && due.water);
    emit('standup', { count: addHealth(ev.day, 'standups', 1), source: 'break' });
    if (same) state.r = R.breakStarted(state.r);
  }
  // A break or 休息結束 left from an earlier day ends quietly at 04:00, or at the next start: nothing more is counted
  // and its bubble closes (Review Focus #2). A focus is never stale: it counts on the day it started, even across 04:00
  // or overnight while the app was closed (§5.2 照算), and only its break can be stale.
  function isStale(p, day) {
    return (p.phase === 'break' || p.phase === 'breakOver') && QJZ.time.dayKey(p.startMs) < day;
  }
  function step() {
    if (!state.ready || stepping) return;
    var now = nowFn();
    if (typeof now !== 'number' || !isFinite(now)) return;
    stepping = true;
    try {
      batch(function () {
        // Hidden, the app catches up only once a minute (its refresh) and this steps every 10 s, so after 04:00 the
        // app's today can still be yesterday: roll it over first, so nothing below goes to a day it does not have yet
        // (final review m-1). Its refresh event finds this step running and does not step again.
        if (QJZ.time.dayKey(now) > today().day) QJZ.app.refresh();
        var s = settings(), rec = today();
        followClock(now);
        followDay(rec, now);
        followResume(rec);
        var adv = P.advance(state.p, now, s.health.pomodoro, healthOn(state.p.day).tomatoes);
        state.p = adv.p;
        adv.events.forEach(function (ev) {
          if (ev.type === 'focusDone') addHealth(ev.day, 'tomatoes', 1);
          else if (ev.type === 'breakStart') onBreakStart(ev, rec, s);
        });
        rec = today();   // the counts above replaced today's record
        var stale = isStale(state.p, rec.day);
        if (stale) state.p = P.stop();
        if (adv.events.length || stale) savePomodoro();
        state.r = R.advance(state.r, now, rec, s);
        seenRec = { day: rec.day, startMs: rec.startMs, endMs: rec.endMs };
        var cups = QJZ.health.of(rec).cups, asks = R.ask(s.health, cups);
        // a reminder asked for (現在提醒我一次) ends once nothing would be asked (both switches off, or water alone and the
        // goal reached), so it never pops up later when a switch comes back on or a cup is taken off (final review M-4)
        if (state.r.forced && !asks.sit && !asks.water) state.r = withR({ forced: false });
        var res = Q.step(state.q, {
          nowMs: now, blocked: !state.visible || state.fullscreen || state.panel, focus: state.p.phase === 'focus',
          working: working(rec, s, now), forced: !!state.r.forced, due: R.due(state.r, now, s.health, cups), notice: state.p.notice,
          noticeWater: state.breakWater && R.ask(s.health, cups).water
        });
        state.q = res.q;
        state.prompt = res.q.prompt;
        res.events.forEach(announce);
      });
    } finally { stepping = false; }
  }
  function announce(ev) {
    if (ev.type === 'hide') { hidden(ev.quiet); return; }
    if (ev.type === 'show' && !isNotice(ev.prompt)) lineTurn = state.turn++;
    emit('prompt', { type: ev.type, prompt: ev.prompt, view: view() });
    if (ev.type === 'show') bridge.send('raise', { on: true });
  }
  function hidden(quiet) {
    emit('prompt', { type: 'hide', quiet: !!quiet, prompt: null, view: null });
    bridge.send('raise', { on: false });
  }

  // The view of the showing bubble, with every number filled in (QJZ.prompt.view prints what it is given).
  function view() {
    var pr = state.ready && state.q ? state.q.prompt : null;
    if (!pr) return null;
    var s = settings(), p = state.p, cfg = s.health.pomodoro;
    var rest = p.phase === 'break' || p.phase === 'breakOver' ? Math.round((p.endMs - p.startMs) / MIN) : NaN;
    return Q.view(pr, {
      turn: lineTurn, min: finite(Math.floor(state.r.ms / MIN), 0), cups: QJZ.health.of(today()).cups,
      cupGoal: s.health.water.goal, breakMin: finite(rest, p.long ? cfg.long : cfg.short), done: finite(p.done, 0), long: p.long
    });
  }

  // ---- what others read ----
  function cueNow() {
    if (state.p.phase === 'focus') return 'focus';
    var pr = state.q.prompt;
    if (!pr) return null;
    if (pr.kind === 'both' || pr.kind === 'water') return 'holdCup';
    if (pr.kind === 'sit') return 'wave';
    return pr.kind === 'break' ? 'stretch' : null;
  }
  // Derived state (the §4.9 #8 rule lives here only), then cue, change and healthMenu, each only when it changed.
  // standIn: minutesToStand(), so a change (a working minute gone by) is a change. nth: the running focus's place on the
  // day it started (第 N 顆), so a focus across 04:00 keeps its number; 0 without a focus.
  function publish() {
    if (!state.ready) return;
    followGoal();
    var s = settings(), h = QJZ.health.of(today()), p = state.p;
    state.health = h;
    state.goals = { cups: s.health.water.goal, tomatoes: QJZ.settings.tomatoGoal(s), standups: QJZ.settings.standGoal(s) };
    state.show = { cups: !!s.health.water.on || h.cups > 0, tomatoes: h.tomatoes > 0 || p.phase === 'focus' };
    state.cupsText = h.cups + '/' + state.goals.cups;
    state.prompt = state.q.prompt;
    state.standIn = minutesToStand();
    state.forced = !!state.r.forced;
    state.snoozed = typeof state.r.snoozeUntil === 'number' && state.r.snoozeUntil > nowFn();
    state.nth = p.phase === 'focus' ? healthOn(p.day).tomatoes + 1 : 0;
    var cue = cueNow();
    if (cue !== lastCue) { lastCue = cue; emit('cue', cue); }
    var sig = JSON.stringify([h, state.goals, state.show, p, state.prompt, state.visible, state.fullscreen, state.here, state.panel,
      state.standIn, state.nth, state.forced, state.snoozed]);
    if (sig !== lastSig) { lastSig = sig; emit('change', state); }
    var menu = { cups: state.show.cups ? state.cupsText : null,
      pomodoro: { phase: p.phase, endsMs: p.phase === 'focus' || p.phase === 'break' ? p.endMs : null },
      sitOn: R.ask(s.health, h.cups).sit };
    var text = JSON.stringify(menu);
    if (text !== lastMenu) { lastMenu = text; bridge.send('healthMenu', menu); }
  }
  // §5.6: today carries the cup goal it is played against, and the calendar judges today by the current goal. So a goal
  // changed during the day re-stamps today's (final review m-2): the day closes with the goal it showed, and its cell
  // is the same before and after 04:00. Written only when it differs, on a day that has counts (a stamped goal).
  function followGoal() {
    var rec = today(), h = QJZ.health.of(rec), goal = settings().health.water.goal;
    if (h.cupGoal === null || h.cupGoal === goal) return;
    h.cupGoal = goal;
    busy++;   // its change event publishes nothing: the publish that called this goes on with the new record
    try { QJZ.app.setHealth(rec.day, h); } finally { busy--; }
  }
  // Minutes to the next reminder (null: nothing is asked). After 等一下 it is the time until the snooze ends, not 0.
  function minutesToStand() {
    if (!state.ready) return null;
    var m = R.minutesToNext(state.r, settings().health, QJZ.health.of(today()).cups), until = state.r.snoozeUntil;
    if (m === null || typeof until !== 'number') return m;
    return Math.max(m, Math.ceil((until - nowFn()) / MIN));
  }

  // ---- app events ----
  // A new history object is a new init (the first, or the host's repeated one): start from what it holds.
  function onAppChange() {
    if (!app().ready) return;
    if (app().history !== seenHistory) init();
    else if (!busy) publish();
  }
  function init() {
    if (state.q && state.q.prompt) hidden(true);
    seenHistory = app().history;
    state.r = R.initial(today().day, nowFn());
    state.p = P.sanitize(app().history.pomodoro) || P.idle();
    state.q = Q.initial();
    state.prompt = null;
    state.breakWater = false;
    seenRec = null; lastNow = null; lastMenu = null;
    state.ready = true;
    step();
  }
  function onStarted() {
    if (!state.ready) return;
    batch(function () {
      var rec = today();
      state.r = R.initial(rec.day, nowFn());
      seenRec = { day: rec.day, startMs: rec.startMs, endMs: rec.endMs };
    });
  }

  // ---- host messages ----
  function onVisibility(msg) { state.visible = !!(msg && msg.visible); step(); }
  function onFullscreen(msg) {
    state.fullscreen = !!(msg && msg.on);
    state.here = state.fullscreen && msg.here === true;
    step();
  }
  function onMenu(msg) {
    var a = msg && msg.action;
    if (a === 'drink') drink();
    else if (a === 'undrink') undrink();
    else if (a === 'pomodoro') toggleFocus();
    else if (a === 'stoodUp') stoodUp();
  }

  // ---- actions ----
  // One cup today, any time (§5.3). Only 喝水 on: any cup restarts the timer (§5.1).
  function drink() {
    if (!state.ready) return false;
    batch(function () {
      var s = settings(), goal = s.health.water.goal, before = QJZ.health.of(today()).cups;
      var cups = addHealth(today().day, 'cups', 1);
      if (!s.health.sit.on) { catchUp(nowFn()); state.r = R.reset(state.r); }
      emit('drank', { cups: cups, goalReached: before < goal && cups >= goal });
    });
    return true;
  }
  // 設定 → 健康 → 進階「今天已喝」: a correction, not a cup.
  function setCups(n) {
    if (!state.ready || typeof n !== 'number' || !isFinite(n) || n < 0) return false;
    batch(function () {
      var h = QJZ.health.of(today());
      h.cups = Math.floor(n);
      h.cupGoal = settings().health.water.goal;
      QJZ.app.setHealth(today().day, h);
    });
    return true;
  }
  // 少記一杯 (1.1.1 item 4, the menu's undrink): 今天已喝 −, one cup off today; at 0 nothing (false). Nothing else
  // changes: not the timer, no stand-up, no line. The bubble's count, the layouts, the calendar and healthMenu follow
  // the change; a bubble that stopped asking water at the goal asks it again on the next step.
  function undrink() {
    if (!state.ready) return false;
    var n = QJZ.health.of(today()).cups;
    return n > 0 && setCups(n - 1);
  }
  // 設定 → 健康 →「現在提醒我一次」(1.1.1 item 5): the reminder is due now (QJZ.reminders.force), a real one: it asks
  // what the switches say, 喝了 / 起來了 / 等一下 answer it as always. The gates still hold it: hidden, full screen, a
  // focus (its break takes it in), the open panel (Ruling C1: pressed in 設定, it shows 3 s after the panel closes).
  // It shows outside work time too, since it was asked for. false when nothing would be asked (both switches off, not
  // answered yet, or water only and the goal reached).
  function remindNow() {
    if (!state.ready) return false;
    var a = R.ask(settings().health, QJZ.health.of(today()).cups);
    if (!a.sit && !a.water) return false;
    batch(function () {
      catchUp(nowFn());
      state.r = R.force(state.r);
      step();
    });
    return true;
  }
  // 「我剛起來動過了」 (1.1.2 item 7: the menu's stoodUp, or a long press on the countdown): a stand-up, and the timer
  // restarts (as 起來了 does, with or without a bubble; a 等一下 that runs ends with it). A bubble it answers goes first
  // (quietly, on the step), so the pet's 收到 (standup source 'manual') is said in its own bubble, not over the prompt.
  function stoodUp() {
    if (!state.ready) return false;
    batch(function () {
      catchUp(nowFn());
      var n = addHealth(today().day, 'standups', 1);
      state.r = R.reset(state.r);
      step();
      emit('standup', { count: n, source: 'manual' });
    });
    return true;
  }
  // The pomodoro buttons: idle or after a break, start a focus; during a focus or a break, stop.
  function toggleFocus() {
    if (!state.ready) return false;
    batch(function () {
      step();   // a focus that has just ended counts first
      var p = state.p, cfg = settings().health.pomodoro;
      state.p = p.phase === 'idle' || p.phase === 'breakOver' ? P.start(p, nowFn(), cfg) : P.stop();
      savePomodoro();
      step();   // a reminder bubble goes back to its queue at once
    });
    return true;
  }
  // A button on the bubble. An answer that does something closes the bubble (hide, not quiet) and lowers the window;
  // 喝了 on the both bubble keeps it up instead, now asking 起來動 alone (an update). A stale or repeated one does
  // nothing (false).
  function answer(id) {
    if (!state.ready) return false;
    var done = false;
    batch(function () {
      var now = nowFn();
      followClock(now);
      var res = Q.answer(state.q, id, now);
      if (!res.effects.length) return;
      done = true;
      state.q = res.q;
      state.prompt = res.q.prompt;
      if (!res.stays) hidden(false);
      catchUp(now);
      var cfg = settings().health.pomodoro, pomo = false, snoozed = false;
      res.effects.forEach(function (fx) {
        if (fx === 'standup') {
          var n = addHealth(today().day, 'standups', 1);
          state.r = R.reset(state.r);
          emit('standup', { count: n, source: id === 'drink' ? 'drink' : 'up' });
        } else if (fx === 'drink') drink();
        else if (fx === 'waterDone') state.r = R.waterDone(state.r);
        else if (fx === 'snooze') { state.r = R.snooze(state.r, now); snoozed = true; }
        else if (fx === 'skipBreak' && state.p.phase === 'break') {
          // Ruling C3: skipping the break means you did not get up; the timer gets back what it had (§5.1).
          var breakDay = QJZ.time.dayKey(state.p.startMs);
          state.p = P.skipBreak(state.p, now, cfg);
          state.r = R.breakSkipped(state.r);
          addHealth(breakDay, 'standups', -1);
          pomo = true;
        } else if (fx === 'nextFocus') { state.p = P.start(state.p, now, cfg); pomo = true; }
        else if (fx === 'stopPomodoro') { state.p = P.stop(); pomo = true; }
        else if (fx === 'ackNotice') { state.p = P.ack(state.p); pomo = true; }
      });
      if (pomo) savePomodoro();
      if (res.stays) { announce({ type: 'update', prompt: state.q.prompt }); return; }
      // outside work time an answer ends a reminder asked for: 等一下 would bring it back every 5 minutes after 下班,
      // where a real one never shows (final review M-3); during work it comes back like any other
      var back = working(today(), settings(), now);
      if (state.r.forced && !back) state.r = withR({ forced: false });
      if (snoozed && back) emit('snooze', { minutes: R.SNOOZE_MS / MIN });
    });
    return done;
  }
  // Ruling C1: while the settings panel is open, bubbles wait (3 s after it closes).
  function setPanel(open) {
    open = !!open;
    if (state.panel === open) return;
    state.panel = open;
    step();
  }

  // opts: {bridge (default QJZ.bridge), now (default QJZ.app.nowMs), heartbeat (default true)}. Call before
  // QJZ.app.start(), so the app's first change (its init) is heard.
  function start(opts) {
    if (started) return;
    started = true;
    opts = opts || {};
    bridge = opts.bridge || QJZ.bridge;
    nowFn = opts.now || function () { return QJZ.app.nowMs(); };
    offs.push(QJZ.app.on('change', onAppChange), QJZ.app.on('second', function () { step(); }), QJZ.app.on('started', onStarted),
      QJZ.app.on('refresh', function () { step(); }));
    [bridge.on('visibility', onVisibility), bridge.on('fullscreen', onFullscreen), bridge.on('menu', onMenu)].forEach(function (off) { if (typeof off === 'function') offs.push(off); });
    if (opts.heartbeat !== false) heartbeat = setInterval(step, HEARTBEAT_MS);
  }

  // Tests only: back to the state before start().
  function reset() {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    offs.forEach(function (f) { try { f(); } catch (e) {} });
    offs = [];
    for (var k in listeners) listeners[k] = [];
    started = false; bridge = null; nowFn = null; seenHistory = null; seenRec = null;
    busy = 0; stepping = false; lastNow = null; lineTurn = 0; lastSig = null; lastMenu = null; lastCue = null;
    state.ready = state.visible = state.fullscreen = state.here = state.panel = state.breakWater = state.forced = state.snoozed = false;
    state.r = state.p = state.q = state.prompt = null;
    state.health = QJZ.health.of(null); state.goals = { cups: 0, tomatoes: 0, standups: 0 };
    state.show = { cups: false, tomatoes: false }; state.cupsText = ''; state.turn = 0; state.standIn = null; state.nth = 0;
  }

  // Dev only (dev.html, Ruling R3), like reset: index.html never calls it. o = {cups, tomatoes, standups (today's counts),
  // pomo: 'focus' (13 min left) | 'break' | 'breakOver', prompt: 'both' | 'sit' | 'water' (the reminder is due; its
  // switches must be on) | 'break' | 'breakEnd' (that bubble), shown at once, water: the break bubble asks water too (as
  // when a reminder came due during the focus; 喝水 must be on), turn: which line of the reminder's copy it shows
  // (QJZ.prompt.LINES, from 0)}. dev.html has no host, so the window counts as shown.
  function dev(o) {
    if (!state.ready) return;
    o = o || {};
    if (typeof o.turn === 'number' && o.turn >= 0) state.turn = Math.floor(o.turn);
    batch(function () {
      var now = nowFn(), s = settings(), cfg = s.health.pomodoro, key = today().day, h = QJZ.health.of(today());
      ['cups', 'tomatoes', 'standups'].forEach(function (k) { if (typeof o[k] === 'number' && o[k] >= 0) h[k] = o[k]; });
      h.cupGoal = s.health.water.goal;
      QJZ.app.setHealth(key, h);
      var notice = o.prompt === 'break' || o.prompt === 'breakEnd' ? o.prompt : null;
      var phase = notice === 'break' ? 'break' : notice === 'breakEnd' ? 'breakOver' : o.pomo;
      if (phase === 'focus') state.p = P.start(P.idle(), now - 12 * MIN, cfg);
      else if (phase === 'break' || phase === 'breakOver') {
        var from = now - (phase === 'break' ? 2 : cfg.short + 1) * MIN;
        state.p = P.sanitize({ phase: phase, startMs: from, endMs: from + cfg.short * MIN, day: key, done: h.tomatoes, notice: notice });
      }
      if (phase) savePomodoro();
      if (notice === 'break') state.breakWater = o.water === true;
      if (o.prompt === 'both' || o.prompt === 'sit' || o.prompt === 'water') state.r = withR({ ms: s.health.every * MIN, snoozeUntil: null });
      if (o.prompt) {   // shown now, not after the 3 s gate
        if (state.q.prompt) hidden(true);
        state.q = Q.initial();
      }
      state.visible = true;
      step();
    });
  }

  return {
    state: state, start: start, stepNow: step, on: on, drink: drink, undrink: undrink, setCups: setCups, toggleFocus: toggleFocus,
    remindNow: remindNow, stoodUp: stoodUp, answer: answer, setPanel: setPanel, minutesToStand: minutesToStand, view: view, _reset: reset, _dev: dev
  };
})();
