window.QJZ = window.QJZ || {};
// 設定 → 健康 (spec §4.6 D 方案 1 as simplified by §4.9 #6 #7, §5.4), onboarding step 3 and the one-time reminder question
// after the 1.0 upgrade (§4.6, §5.5), drawn with QJZ.panels.kit inside panels.js's PANEL (c: the mounted panel).
//   section() / update(c)  the 健康 tab: the 休息提醒 card (起來動 and 喝水 switches, 每隔 N 分鐘, 一天幾杯 N 杯 and the
//       automatic 起來動目標, and 1.1.1's 「現在提醒我一次」: QJZ.care.remindNow, off with a hint when nothing would be
//       asked; 設定 holds the reminder (Ruling C1), so its hint says it comes once the panel closes), the 番茄鐘 card (專心 N 分鐘) and 進階, closed at first (短休息, 長休息, 每幾顆番茄長休息一次
//       with the automatic 番茄每日目標, 今天已喝). The numbers step by QJZ.settings.HEALTH_RANGES and stop at its ends;
//       今天已喝 corrects today's cups (QJZ.care.setCups), never below 0. A switch shows what runs (both off until the
//       reminder question is answered, QJZ.reminders.ask); pressing one answers it: both are saved as they show.
//   onboardingStep()  onboarding's step 3 (hidden; panels.js shows it): 起來動 and 喝水, both ticked, the 番茄鐘 note
//       and a preview of the bubble.
//   readStep(c) -> {sit, water}  its two ticks (step 3, or healthAsk).
//   askBuild(c) / askUpdate(c)  the healthAsk panel: step 3 alone, answered by 確定 (panels.js saves it). askUpdate
//       keeps the pet (in onboarding the one picked on step 2) and the preview in step with the ticks.
//   click(c, el) -> true  a click handled here (a switch, a stepper button, a tick), before panels.js's own.
//   calendarCard() / calendarUpdate(c)  the 紀錄 health calendar (Task 14).
// Only numbers from the sanitized settings and fixed copy go into markup.
QJZ.panelsHealth = (function () {
  var K = QJZ.panels.kit;
  // The numbers, by their path under settings.health (QJZ.settings.HEALTH_RANGES has their [min, max, step]):
  // [label, unit].
  var NUMS = {
    'every': ['每隔', '分鐘'], 'water.goal': ['一天幾杯', '杯'], 'pomodoro.focus': ['專心', '分鐘'],
    'pomodoro.short': ['短休息', '分鐘'], 'pomodoro.long': ['長休息', '分鐘'], 'pomodoro.longEvery': ['每幾顆番茄長休息一次', '顆']
  };
  var CUPS = ['今天已喝', '杯'];
  var BTN = { drink: 'drink', up: 'ok' };   // the preview's buttons, coloured as QJZ.promptView colours them
  // 「現在提醒我一次」's hint: it can be pressed; both switches off (or not answered yet); water only and the goal reached.
  var REMIND = { ok: '關掉設定就會跳出來。', off: '先打開一個提醒。', full: '今天水喝滿了，明天再提醒。' };

  function icon(name) { return QJZ.icons.svg(name); }
  function valueAt(health, path) { return path.split('.').reduce(function (o, k) { return o[k]; }, health); }
  function patchAt(path, v) {
    var keys = path.split('.'), p = {}, o = p;
    for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]] = {};
    o[keys[keys.length - 1]] = v;
    return { health: p };
  }
  function cups() { return QJZ.health.of(K.st().today).cups; }

  // ================= 設定 → 健康 =================
  function num(key) {
    var n = key === 'cups' ? CUPS : NUMS[key];
    return K.row(n[0], K.stepper(' data-num="' + key + '"', function (d) { return 'data-dir="' + d + '"'; }, 'num.' + key, n[1],
      n[0] + '少一點', n[0] + '多一點'));
  }
  function section() {
    return '<div class="card">' +
        K.line('<span class="ttl">' + icon('stand') + '休息提醒</span>') +
        K.line(K.row('起來動', K.tgl('sit', '起來動'))) +
        K.line(K.row('喝水', K.tgl('water', '喝水'))) +
        K.line(num('every') + K.hint('', 'standGoal')) +
        K.line(num('water.goal')) +
        K.line('<button type="button" class="btn sm remind" data-remind>現在提醒我一次</button>' + K.hint('', 'remindHint'), ' data-o="remindLine"') +
      '</div><div class="card">' +
        K.line(K.row('<span class="ttl">' + icon('tom') + '番茄鐘</span>', '<span class="aside">按 🍅 開始</span>')) +
        K.line(num('pomodoro.focus') + K.hint('專心時寵物不聊天，提醒延到休息。')) +
      '</div>' +
      K.disclosure('adv', '進階', K.line(num('pomodoro.short')) + K.line(num('pomodoro.long')) +
        K.line(num('pomodoro.longEvery') + K.hint('', 'roundGoal')) + K.line(num('cups')));
  }
  function update(c) {
    var s = K.st().settings, h = s.health, R = QJZ.settings.HEALTH_RANGES;
    K.tglOn(c, 'sit', h.asked && h.sit.on);
    K.tglOn(c, 'water', h.asked && h.water.on);
    Object.keys(NUMS).forEach(function (k) { showNum(c, k, valueAt(h, k), R[k][0], R[k][1]); });
    showNum(c, 'cups', cups(), 0, Infinity);
    K.out(c, 'standGoal', '每天目標 ' + QJZ.settings.standGoal(s) + ' 次（番茄鐘的休息也算）');
    K.out(c, 'roundGoal', '每天目標一輪 ' + QJZ.settings.tomatoGoal(s) + ' 顆');
    var a = QJZ.reminders.ask(h, cups()), can = a.sit || a.water, rb = K.q(c, '[data-remind]');
    if (rb && rb.disabled === can) rb.disabled = !can;
    K.out(c, 'remindHint', can ? REMIND.ok : h.asked && h.water.on && !h.sit.on ? REMIND.full : REMIND.off);
  }
  // A stepper's number; its − and ＋ are off at the ends.
  function showNum(c, key, v, min, max) {
    K.out(c, 'num.' + key, String(v));
    var sp = K.q(c, '[data-num="' + key + '"]');
    if (!sp) return;
    atEnd(sp.firstChild, v <= min);
    atEnd(sp.lastChild, v >= max);
  }
  function atEnd(b, end) { if (b && b.disabled !== end) b.disabled = end; }

  function step(key, dir) {
    if (key === 'cups') {
      var n = cups() + dir;
      if (n >= 0) QJZ.care.setCups(n);
      return;
    }
    var r = QJZ.settings.HEALTH_RANGES[key];
    if (!r) return;
    var v = valueAt(K.st().settings.health, key), next = Math.max(r[0], Math.min(r[1], v + dir * r[2]));
    if (next !== v) K.save(patchAt(key, next));
  }
  // A switch shows what runs; pressing one answers the reminder question, so both are saved as they show.
  function toggle(name) {
    var h = K.st().settings.health, on = { sit: h.asked && h.sit.on, water: h.asked && h.water.on };
    on[name] = !on[name];
    K.save({ health: { asked: true, sit: { on: on.sit }, water: { on: on.water } } });
  }

  // ================= the reminder question: onboarding step 3, healthAsk =================
  function checkRow(name, label, sub) {
    return '<div class="ckrow" data-ck="' + name + '"><button type="button" class="ck" role="checkbox" aria-checked="true" aria-label="' +
      K.esc(label) + '"></button><div><span class="lbl">' + label + '</span>' + K.hint(sub) + '</div></div>';
  }
  function askBody() {
    var h = K.st().settings.health, p = h.pomodoro;
    return '<div class="hero"><span class="av" data-o="askAv"></span><div><h2 class="ptitle">要不要提醒你起來動、喝水？</h2>' +
        '<p>上班一坐就是一整天，我可以幫你記著。</p></div></div>' +
      '<div class="card">' +
        K.line(checkRow('sit', '每 ' + h.every + ' 分鐘提醒我起來動一動', '我會跳起來揮手，按「起來了」或「等一下」。')) +
        K.line(checkRow('water', '順便提醒我喝水', '我會捧著水杯來，一天目標 ' + h.water.goal + ' 杯，喝了就按「喝了」記一杯。')) +
      '</div>' +
      '<p class="pnote">🍅 想專心的時候，可以從右鍵選單開始番茄鐘（' + p.focus + ' 分鐘專心、' + p.short + ' 分鐘休息）。這些都能在 設定 → 健康 裡改。</p>' +
      '<div class="ob-prev" aria-hidden="true"><span class="cap2">時間到會像這樣：</span><div class="ob-row" data-o="askPrev"></div></div>';
  }
  function onboardingStep() {
    return '<div class="ob-step" data-step="3" hidden>' + askBody() +
      '<div class="pfoot"><button type="button" class="btn ghost" data-pa="prev">← 上一步</button>' +
      '<span class="stepdots"><i></i><i></i><i class="on"></i></span>' +
      '<button type="button" class="btn go" data-pa="go">開始！</button></div></div>';
  }
  function askBuild(c) {
    c.body.innerHTML = K.WARN + '<div class="ob-step">' + askBody() +
      '<div class="pfoot"><button type="button" class="btn go" data-pa="askOk">確定</button></div></div>';
  }
  function readStep(c) {
    function on(k) { var b = K.q(c, '[data-ck="' + k + '"] .ck'); return !!b && b.getAttribute('aria-checked') === 'true'; }
    return { sit: on('sit'), water: on('water') };
  }
  function tick(c, row) {
    var b = row.querySelector('.ck');
    b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
    askUpdate(c);
  }
  // The preview asks what the ticks ask (起來動 alone: the wave, without a cup, Ruling C8); nothing ticked, no preview.
  function askUpdate(c) {
    var id = c.ob ? c.ob.pet : K.petId(K.st().settings), a = readStep(c);
    var kind = a.sit && a.water ? 'both' : a.sit ? 'sit' : a.water ? 'water' : null, key = id + '|' + kind;
    if (c.cache.ask === key) return;
    c.cache.ask = key;
    var av = K.q(c, '[data-o=askAv]'), box = K.q(c, '[data-o=askPrev]');
    if (av) av.innerHTML = K.avatar(id, 'wave');
    if (!box) return;
    K.show(box.parentNode, !!kind);
    box.innerHTML = kind ? '<div class="po">' + petOnly(id, kind === 'sit' ? 'wave' : 'holdCup') + '</div>' + bubble(kind) : '';
  }
  function petOnly(id, state) {
    if (!QJZ.pets || !QJZ.pets.get || !QJZ.pets.get(id)) return '';
    try { return QJZ.pets.compose(id, 'petonly', { state: state }); }
    catch (e) { if (window.console) console.error('[panelsHealth] pet ' + id + ' failed', e); return ''; }
  }
  // The reminder bubble as a picture: QJZ.prompt.view's title and buttons (its sub left out, as in the mockup); the
  // buttons answer nothing (no data-answer) and take no focus.
  function bubble(kind) {
    var v = QJZ.prompt.view({ kind: kind, water: false }, { turn: 0 }), btns = '';
    v.buttons.forEach(function (b) { btns += '<button type="button" tabindex="-1" class="' + (BTN[b.id] || '') + '">' + K.esc(b.label) + '</button>'; });
    return '<div class="rbub t-l sm"><span class="rb-ic' + (v.icon === 'drop' ? ' w' : '') + '">' + icon(v.icon) + '</span>' +
      '<b class="rb-t">' + K.esc(v.title) + '</b><div class="rb-btns">' + btns + '</div></div>';
  }

  // ================= clicks =================
  function click(c, t) {
    var rn = t.closest('[data-remind]');
    if (rn) { if (!rn.disabled && QJZ.care) QJZ.care.remindNow(); return true; }
    var ck = t.closest('[data-ck]');
    if (ck) { tick(c, ck); return true; }
    var tg = t.closest('[data-tgl="sit"],[data-tgl="water"]');
    if (tg) { toggle(tg.getAttribute('data-tgl')); return true; }
    var b = t.closest('[data-num] [data-dir]');
    if (b) {
      if (!b.disabled) step(b.closest('[data-num]').getAttribute('data-num'), b.getAttribute('data-dir') === '+' ? 1 : -1);
      return true;
    }
    return false;
  }

  // ================= 紀錄 → 健康月曆 (spec §4.7, §5.6): Task 14 =================
  // A month grid under 統計 (QJZ.panelsStats; 1.0 had the income chart there; mockup E 方案 3): the bluer, the more cups; the darkest blue with a ✓ is the
  // goal; the bottom-right corner is the day's tomatoes. The current month only (1.0's 紀錄 has no month switcher);
  // QJZ.health.calendar takes the month for a later switcher. The cells are drawn only when something changed.
  var WEEK = '日一二三四五六';
  function calendarCard() {
    var wh = '';
    for (var i = 0; i < 7; i++) wh += '<span class="wh">' + WEEK.charAt(i) + '</span>';
    return '<div class="card" data-o="cal"><div class="hist-top"><b>' + icon('drop') + ' 健康月曆</b>' +
      '<span class="legend">' + icon('tom') + ' = 當天番茄</span></div>' +
      '<div class="cal">' + wh + '</div><div class="cal" data-o="calGrid"></div>' +
      '<div class="calleg" data-o="calLegend"></div>' +
      '<div class="hist-sum"><small data-o="calSum"></small></div></div>';
  }
  function calendarUpdate(c) {
    var s = K.st(), cal = QJZ.health.calendar(s.history, s.today.day.slice(0, 7), s.today, s.settings);
    var key = JSON.stringify([cal.weeks, cal.goal]), grid = K.q(c, '[data-o=calGrid]');
    if (!grid || c.cache.cal === key) return;
    c.cache.cal = key;
    var h = '';
    cal.weeks.forEach(function (w) {
      w.forEach(function (d) {
        if (!d) { h += '<span class="nil"></span>'; return; }
        h += '<div class="cc ' + (d.blank ? 'bl' : d.full ? 'full' : 'l' + d.level) + (d.today ? ' today' : '') + '"><span class="dn">' + d.d + '</span>' +
          (d.tomatoes ? '<span class="ct">' + icon('tom') + d.tomatoes + '</span>' : '') + (d.full ? '<span class="star">✓</span>' : '') + '</div>';
      });
    });
    grid.innerHTML = h;
    K.q(c, '[data-o=calLegend]').innerHTML = '少 <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> 多（✓ = 喝滿 ' + cal.goal + ' 杯）';
    K.out(c, 'calSum', '本月 ' + cal.totals.cups + ' 杯 ・ ' + cal.totals.tomatoes + ' 顆');
  }

  return {
    section: section, update: update, onboardingStep: onboardingStep, readStep: readStep, askBuild: askBuild, askUpdate: askUpdate,
    click: click, calendarCard: calendarCard, calendarUpdate: calendarUpdate
  };
})();
