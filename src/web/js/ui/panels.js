window.QJZ = window.QJZ || {};
// The content of the PANEL layout (spec §5.3 設定, §5.4 紀錄, §4.4 忘記按下班, §4.8 first run; 1.1 §4.6, §5.5):
//   onboarding  step 1 salary (月薪/時薪, the amount checked by QJZ.settings.validateSalary, ÷22/÷30), step 2 the
//               pet (all 10 skins) and its name, step 3 whether to remind (QJZ.panelsHealth: 起來動 and 喝水, both
//               ticked); 開始 saves {salary, pet, health:{asked, sit, water}, onboarded:true}. It is the first panel
//               while settings.salary.amount is 0 or settings.onboarded is false.
//   settings    the sections of §5.3 plus 關於 (version; 使用說明 and the third-party licence texts behind a
//               disclosure button each, loaded the first time they open), in five tabs (simplification #9, 1.1 #9):
//               薪水和時間 (今天, 薪資, 工時, 起算), 寵物 (寵物, 音效), 健康 (QJZ.panelsHealth), 畫面 (版型, 動力加成),
//               其他 (開機, 隱私, 關於).
//               1.1.5: 畫面 has 縮放比例 (zoom, its own section: a select of 50–150 %, the same setting as Ctrl+wheel and
//               Ctrl+± / Ctrl+0, QJZ.zoomKeys), and 關於 a 檢查更新 button beside the version (app.checkUpdate: the app's one
//               network request) with its result and, for a new version or none found, a link (app.openUpdate).
//               今天 comes first: 今天休假 (today counts 0), after 下班 繼續上班 (app.resumeWork), and 調整今天的起算時間;
//               'adjust' (menu 調整起算時間) opens there. Every change is saved at once through QJZ.app (host
//               settings through app.setAutostart / setCaptureGuard / setHotkey). 版型 has 相容模式 (display.opaque;
//               shown on and locked while the host forces it, init.forceOpaque) and 省電模式 (display.powerSaver).
//   history     this month's bars (completed days, earned !== null, plus today's live value), 本月合計, and the
//               totals of earlier months.
//   question    the early-leave question for state.pendingQuestion -> app.answerEarlyLeave. It is the first panel
//               after onboarding, is asked when another panel closes, and when a new one comes up on a main layout.
//   healthAsk   onboarding's step 3 alone, for a 1.0 user who never saw it (§5.5, QJZ.panelsHealth): 確定 saves
//               health {asked, sit, water}. It comes after the early-leave question: first, or when that one closes;
//               once a session. Gone without 確定, nothing is saved and the next start asks again; until then both
//               reminders stay off (QJZ.reminders.ask).
// layouts.js owns the window (title bar, size, hit rects): it calls _mount(winEl, kind) when it builds PANEL and
// _update() on every render (each second and on every change). Host notices (hotkeyFailed, storageError) show on
// the panels, and as a pet line on a main layout.
// User text (pet names, item names) only ever goes into input values or textContent.
QJZ.panels = (function () {
  var TITLES = { onboarding: '歡迎', settings: '設定', history: '紀錄', question: '下班時間', adjust: '設定', healthAsk: '提醒' };
  // [id, label, its sections (SECTIONS keys, in order)]
  var TABS = [['time', '薪水和時間', ['today', 'salary', 'hours', 'start']], ['pet', '寵物', ['pet', 'sound']],
    ['health', '健康', ['health']], ['display', '畫面', ['layout', 'zoom', 'boost']], ['other', '其他', ['autostart', 'privacy', 'about']]];
  var KINDS = [['hamster', '黃金鼠'], ['cat', '貓咪']];
  var FILES = { settings: ['設定檔', 'settings.json'], history: ['紀錄檔', 'history.json'], window: ['視窗位置檔', 'window.json'] };
  // 關於 → 第三方授權: [file under the web root (build.ps1 copies both there and ships them in web.zip), title, what it
  // covers]. 關於 → 使用說明: GUIDE, the plain-text copy of docs/使用說明.md (build.ps1 ships it in web.zip too).
  // The texts load the first time their disclosure opens and only ever go into textContent.
  var LICENSES = [
    ['licenses/WebView2-SDK.txt', 'Microsoft Edge WebView2 SDK', '顯示畫面用的元件（Microsoft.Web.WebView2 的 DLL 與 WebView2Loader.dll）。'],
    ['fonts/OFL.txt', 'Fredoka 字型（SIL Open Font License 1.1）', '金額數字使用的字型。']
  ];
  var GUIDE = 'guide.txt';
  var LIC_FAIL = '（讀不到授權文字。）', GUIDE_FAIL = '（讀不到使用說明。）';
  var WD = '日一二三四五六';
  var TALL = 633;            // settings / history / onboarding: 640 with the 7px shadow
  var DAY_START_MIN = 4 * 60;
  var MAX_ITEMS = 6;
  var DEFAULT_HOTKEY = 'Ctrl+Alt+H';
  var NEED_MOD = '要按住 Ctrl 或 Alt，再加一個按鍵';
  var BAD_KEY = '這個按鍵不能用，請用英文字母、數字、F1–F24 或方向鍵';

  // ================= pure helpers (tests: QJZ.panels.util) =================
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function money(n) { return QJZ.odometer.format(n); }
  function hmOf(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function monthTitle(month) { return month.slice(0, 4) + ' 年 ' + parseInt(month.slice(5, 7), 10) + ' 月'; }

  function needsOnboarding(s) { return !s || !s.salary || !(s.salary.amount > 0) || !s.onboarded; }
  // The reminder question was never answered (a 1.0 user): asked once a session, after the early-leave question.
  function needsHealthAsk(s) { return !needsOnboarding(s) && !(s.health && s.health.asked); }
  function initialPanel(st) {
    if (!st || !st.settings) return null;
    if (needsOnboarding(st.settings)) return 'onboarding';
    if (st.pendingQuestion) return 'question';
    return needsHealthAsk(st.settings) ? 'healthAsk' : null;
  }

  // 'cat:p4' -> {kind, skin} when it is one of the skins settings accept, else null.
  function petParts(id) {
    var m = /^(cat|hamster):(\w+)$/.exec(typeof id === 'string' ? id : '');
    return m && QJZ.settings.skinsFor(m[1]).indexOf(m[2]) >= 0 ? { kind: m[1], skin: m[2] } : null;
  }
  // form: {mode, amountText, divisor, pet:'kind:skin', name, sit, water (step 3's ticks)} -> {ok, patch} |
  // {ok:false, error (validateSalary's)}. Step 3 is the answer to the reminder question: health.asked.
  function onboardingPatch(f) {
    var r = QJZ.settings.validateSalary(f.amountText);
    if (!r.ok) return { ok: false, error: r.error };
    var patch = { salary: { mode: f.mode === 'hourly' ? 'hourly' : 'monthly', amount: r.value, divisor: f.divisor === 30 ? 30 : 22 } };
    var p = petParts(f.pet);
    if (p) {
      patch.pet = { kind: p.kind, skin: p.skin };
      var name = typeof f.name === 'string' ? f.name.trim() : '';
      if (name) { patch.pet.names = {}; patch.pet.names[p.kind] = name; }
    }
    patch.health = { asked: true, sit: { on: !!f.sit }, water: { on: !!f.water } };
    patch.onboarded = true;
    return { ok: true, patch: patch };
  }
  // Any other money field: validateSalary's rules, its wording made neutral.
  var NEUTRAL = { '請輸入薪資': '請輸入金額', '薪資要大於 0': '金額要大於 0' };
  function checkAmount(text) {
    var r = QJZ.settings.validateSalary(text);
    return r.ok ? r : { ok: false, error: NEUTRAL[r.error] || r.error };
  }
  // The amount in the other pay mode (月薪 <-> 時薪, by the divisor and the hours a day), rounded to cents; null when the
  // result would not pass validateSalary (then the old amount stays).
  function convertAmount(amount, toMode, divisor, hours) {
    var h = hours > 0 ? hours : 8, d = divisor === 30 ? 30 : 22;
    var v = toMode === 'hourly' ? amount / d / h : amount * h * d;
    v = Math.round(v * 100) / 100;
    return v > 0 && QJZ.settings.validateSalary(String(v)).ok ? v : null;
  }
  function modeNote(to) { return '已切換為' + (to === 'hourly' ? '時薪' : '月薪') + '，金額已換算，請確認'; }
  // The amount could not be converted (convertAmount null): it stays as it was, now in the other mode.
  function keptNote(to) { return '已切換為' + (to === 'hourly' ? '時薪' : '月薪') + '，金額無法換算，沒有改，請確認'; }
  // 50000 -> '50,000', 183.5 -> '183.5', 0 -> '' (what an amount field shows).
  function amountInputText(n) {
    if (!(n > 0)) return '';
    var p = String(n).split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p.length > 1 ? '.' + p[1] : '');
  }
  // row: {icon, name, priceText} -> {ok, item} | {ok:false, field:'name'|'price', error}.
  function checkItem(row) {
    var name = String(row.name === null || row.name === undefined ? '' : row.name).trim();
    if (!name) return { ok: false, field: 'name', error: '請輸入名稱' };
    var r = checkAmount(row.priceText);
    if (!r.ok) return { ok: false, field: 'price', error: r.error };
    return { ok: true, item: { name: name, price: r.value, icon: String(row.icon || '').trim() } };
  }
  // '9:05', '０９：０５', '0905' -> '09:05'; null when it is not a time of day.
  function normHM(text) {
    var t = String(text === null || text === undefined ? '' : text)
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[：]/g, ':').replace(/^[\s　]+|[\s　]+$/g, '');
    if (/^\d{4}$/.test(t)) t = t.slice(0, 2) + ':' + t.slice(2);
    var m = QJZ.time.parseHM(t);
    if (isNaN(m) || m >= 24 * 60) return null;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }
  function checkLunch(start, end) {
    var a = normHM(start), b = normHM(end);
    if (a === null || b === null) return { ok: false, error: '請輸入時間' };
    if (QJZ.time.parseHM(b) <= QJZ.time.parseHM(a)) return { ok: false, error: '午休結束要晚於開始' };
    return { ok: true, start: a, end: b };
  }
  // Today's start typed as HH:MM on `day` -> {ok, ms}; never in the future or before the 04:00 day boundary.
  function startAt(day, text, nowMs) {
    var t = normHM(text);
    if (t === null) return { ok: false, error: '請輸入時間' };
    var m = QJZ.time.parseHM(t);
    if (m < DAY_START_MIN) return { ok: false, error: '起算時間要在 04:00 之後' };
    var ms = QJZ.time.atMinutes(day, m);
    if (ms > nowMs) return { ok: false, error: '不能晚於現在' };
    return { ok: true, ms: ms };
  }
  function toggleDay(days, d) {
    var out = (days || []).filter(function (x) { return x !== d; });
    if (out.length === (days || []).length) out.push(d);
    return out.sort(function (a, b) { return a - b; });
  }
  // ± half an hour, 1..16.
  function stepHours(h, dir) { return Math.max(1, Math.min(16, Math.round((h + dir * 0.5) * 2) / 2)); }

  // ---- hotkey: a keydown -> {combo:'Ctrl+Alt+H'} | {partial:'Ctrl+'} | {error} | {cancel} | {pass} ----
  // The key names and the modifier order (Ctrl, Alt, Shift, Win) are the host's (src/host/HotKey.cs).
  var CODE_KEYS = { Space: 'Space', PageUp: 'PageUp', PageDown: 'PageDown', End: 'End', Home: 'Home', ArrowLeft: 'Left',
    ArrowUp: 'Up', ArrowRight: 'Right', ArrowDown: 'Down', Insert: 'Insert', Delete: 'Delete' };
  var KEY_KEYS = { ' ': 'Space', Spacebar: 'Space', PageUp: 'PageUp', PageDown: 'PageDown', End: 'End', Home: 'Home',
    ArrowLeft: 'Left', ArrowUp: 'Up', ArrowRight: 'Right', ArrowDown: 'Down', Left: 'Left', Up: 'Up', Right: 'Right', Down: 'Down',
    Insert: 'Insert', Delete: 'Delete', Del: 'Delete' };
  var MOD_KEYS = { Control: 1, Alt: 1, Shift: 1, Meta: 1, OS: 1, AltGraph: 1 };
  var FKEY = /^F([1-9]|1[0-9]|2[0-4])$/;
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // A letter is the one on the key cap (e.key: AZERTY and Dvorak differ from the physical position); everything
  // else is the physical key (e.code: an IME does not change it), else e.key.
  function keyName(e) {
    var c = e.code || '', m;
    if (/^[a-z]$/i.test(e.key || '')) return e.key.toUpperCase();
    if (c) {
      if ((m = /^Key([A-Z])$/.exec(c))) return m[1];
      if ((m = /^Digit([0-9])$/.exec(c))) return m[1];
      if (FKEY.test(c)) return c;
      return has(CODE_KEYS, c) ? CODE_KEYS[c] : null;
    }
    var k = e.key || '';
    if (/^[a-z0-9]$/i.test(k)) return k.toUpperCase();
    if (FKEY.test(k)) return k;
    return has(KEY_KEYS, k) ? KEY_KEYS[k] : null;
  }
  function comboFromEvent(e) {
    var mods = (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.metaKey ? 'Win+' : '');
    if (has(MOD_KEYS, e.key) || /^(Control|Alt|Shift|Meta|OS)(Left|Right)$/.test(e.code || '')) return { partial: mods };
    if (!e.ctrlKey && !e.altKey) {
      if (e.key === 'Escape') return { cancel: true };
      if (e.key === 'Tab') return { pass: true };
      return { error: NEED_MOD };
    }
    var k = keyName(e);
    return k ? { combo: mods + k } : { error: BAD_KEY };
  }

  // ---- notices ----
  function hotkeyText(msg) {
    if (!msg || typeof msg.combo !== 'string') return null;
    var c = msg.combo;
    var text = msg.reason === 'taken' ? c + ' 已被其他程式使用，請換一組' :
      msg.reason === 'invalid' ? c + ' 不能當快捷鍵，請換一組' : c + ' 設定失敗，請換一組';
    var sub = typeof msg.active === 'string' && msg.active ? '目前仍然使用 ' + msg.active : '目前沒有可用的快速隱藏快捷鍵';
    return { text: text, sub: sub };
  }
  function storageText(files) {
    var list = [];
    (files || []).forEach(function (f) { if (has(FILES, f) && list.indexOf(f) < 0) list.push(f); });
    if (!list.length) return null;
    var names = list.map(function (f) { return FILES[f][0] + '（' + FILES[f][1] + '）'; });
    var joined = names.length > 1 ? names.slice(0, -1).join('、') + '和' + names[names.length - 1] : names[0];
    return '讀不到' + joined + '，為了不弄丟資料，這次不會覆寫' + (list.length > 1 ? '它們' : '它') + '。這次的變更不會存下來。';
  }

  // ---- history ----
  // Every date of today's month: completed days (earned is a number) and today's live amount; open records
  // (earned null) are no bar. total matches QJZ.history.monthTotal (the 本月累計 chip).
  function historyModel(history, today, todayEarned) {
    var month = today.day.slice(0, 7), y = parseInt(month.slice(0, 4), 10), mo = parseInt(month.slice(5, 7), 10);
    var n = new Date(y, mo, 0).getDate(), days = [], total = 0, max = 0, worked = 0;
    for (var d = 1; d <= n; d++) {
      var key = month + '-' + pad(d), rec = has(history.days, key) ? history.days[key] : null;
      var isToday = key === today.day, v = null, wd = new Date(y, mo - 1, d).getDay();
      if (isToday) v = isNum(todayEarned) && todayEarned > 0 ? todayEarned : 0;
      else if (rec && isNum(rec.earned)) v = rec.earned;
      days.push({ day: key, d: d, earned: v, today: isToday, weekend: wd === 0 || wd === 6 });
      if (v === null) continue;
      total += v;
      if (v > max) max = v;
      if (!isToday && v > 0) worked++;
    }
    return { month: month, title: monthTitle(month), days: days, total: total, max: max, worked: worked };
  }
  // Earlier months, newest first: {month, title, total, worked (days that earned something)}.
  function previousMonths(history, month) {
    return QJZ.history.monthTotals(history).filter(function (t) { return t.month < month; }).map(function (t) {
      var worked = QJZ.history.monthDays(history, t.month).filter(function (d) { return d.earned > 0; }).length;
      return { month: t.month, title: monthTitle(t.month), total: t.total, worked: worked };
    });
  }
  // A round top for the chart's scale.
  function niceMax(v) {
    if (!(v > 0)) return 100;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10 + 1e-9)), steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v - 1e-9) return steps[i] * p;
    return 10 * p;
  }

  // ---- early-leave question ----
  function dayBefore(key) {
    var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] - 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function shortDate(key) { return key.slice(5, 7) + '/' + key.slice(8, 10) + '（' + WD.charAt(QJZ.time.weekday(key)) + '）'; }
  function questionText(q, todayKey) {
    return (dayBefore(todayKey) === q.day ? '昨天' : shortDate(q.day)) + '是不是 ' + hmOf(q.lockMs) + ' 就下班了？';
  }
  // What each answer would record (rec: the open record the question is about).
  function questionModel(q, rec, settings, todayKey) {
    var m = { text: questionText(q, todayKey), lock: hmOf(q.lockMs), planned: null, yes: null, no: null };
    if (rec && isNum(rec.startMs)) {
      m.planned = hmOf(QJZ.earn.endAtMs(rec.startMs, rec.day, settings.hoursPerDay, settings.lunch));
      m.yes = money(QJZ.history.closeDay(QJZ.day.resolveEarlyLeave(rec, true), settings).earned);
      m.no = money(QJZ.history.closeDay(QJZ.day.resolveEarlyLeave(rec, false), settings).earned);
    }
    return m;
  }

  function salaryPreview(salary, hoursPerDay) {
    if (!salary || !(salary.amount > 0)) return '';
    var r = QJZ.earn.rates(salary, hoursPerDay);
    return '日薪 NT$ ' + money(r.daily) + ' ・ 每秒 +NT$ ' + r.perSecond.toFixed(3);
  }

  // ================= markup =================
  function seg(name, opts, cls) {
    var h = '<div class="' + (cls || 'seg') + '" data-seg="' + name + '">';
    for (var i = 0; i < opts.length; i++) h += '<button type="button" data-v="' + esc(opts[i][0]) + '">' + opts[i][1] + '</button>';
    return h + '</div>';
  }
  function tgl(name, label) {
    return '<button type="button" class="tgl" role="switch" aria-checked="false" aria-label="' + esc(label) + '" data-tgl="' + name + '"></button>';
  }
  function line(inner, attrs) { return '<div class="line"' + (attrs || '') + '>' + inner + '</div>'; }
  function row(label, ctrl) { return '<div class="row"><span class="lbl">' + label + '</span>' + ctrl + '</div>'; }
  // − n ＋: attrs go on the stepper, btn(d) on its − (d '-') and ＋ (d '+') buttons; n shows in data-o=out.
  function stepper(attrs, btn, out, unit, less, more) {
    return '<span class="stepper"' + (attrs || '') + '><button type="button" ' + btn('-') + ' aria-label="' + less + '">−</button>' +
      '<b data-o="' + out + '"></b><span>' + unit + '</span><button type="button" ' + btn('+') + ' aria-label="' + more + '">＋</button></span>';
  }
  function textIn(field, cls, extra) {
    return '<input type="text" class="' + cls + '" data-f="' + field + '" autocomplete="off" spellcheck="false"' + (extra || '') + '>';
  }
  function moneyIn(field, cls, extra) {
    return '<div class="money-in' + (cls ? ' ' + cls : '') + '"><span>NT$</span>' + textIn(field, 'amt', ' inputmode="decimal" maxlength="16"' + (extra || '')) + '</div>';
  }
  function err(name) { return '<div class="err" data-err="' + name + '"></div>'; }
  function hint(text, o) { return '<div class="hint"' + (o ? ' data-o="' + o + '"' : '') + '>' + (text || '') + '</div>'; }
  var WARN = '<div class="pwarn" data-pwarn hidden></div>';

  function skinList(kind) {
    var ok = QJZ.settings.skinsFor(kind);
    var defs = QJZ.pets && QJZ.pets.list ? QJZ.pets.list(kind) : [];
    var list = defs.length ? defs.map(function (d) { return { id: d.id, skin: d.skin, name: d.name }; }) :
      ok.map(function (s) { return { id: kind + ':' + s, skin: s, name: s }; });
    return list.filter(function (d) { return ok.indexOf(d.skin) >= 0; });
  }
  function avatar(id, state) {
    if (!QJZ.pets || !QJZ.pets.compose || !QJZ.pets.get || !QJZ.pets.get(id)) return '';
    try { return QJZ.pets.compose(id, 'avatar', { state: state || 'idle' }); }
    catch (e) { if (window.console) console.error('[panels] avatar ' + id + ' failed', e); return ''; }
  }
  function petId(s) {
    var id = s.pet.kind + ':' + s.pet.skin;
    return QJZ.pets && QJZ.pets.get && QJZ.pets.get(id) ? id : 'hamster:p0';
  }
  function picker() {
    var h = '';
    KINDS.forEach(function (k) {
      h += '<div class="kind"><span class="lbl">' + k[1] + '</span><div class="skins">';
      skinList(k[0]).forEach(function (d) {
        h += '<button type="button" class="skin" data-skin="' + esc(d.id) + '" title="' + esc(d.name) + '" aria-pressed="false">' +
          '<span class="avw"><span class="av">' + avatar(d.id) + '</span></span><small>' + esc(d.name.replace(/[鼠貓]$/, '')) + '</small></button>';
      });
      h += '</div></div>';
    });
    return h;
  }
  var SALARY_ROWS =
    line(row('薪資方式', seg('mode', [['monthly', '月薪'], ['hourly', '時薪']]))) +
    line('<label class="lbl" data-o="amountLabel">月薪金額</label>' + moneyIn('amount', 'big') + err('amount') + hint('', 'modeNote')) +
    line(row('日薪怎麼算', seg('divisor', [['22', '÷ 22 工作天'], ['30', '÷ 30 天']])), ' data-only="monthly"') +
    hint('', 'preview');

  var SECTIONS = {
    salary: function () {
      return '<div class="card">' + SALARY_ROWS + '</div>' +
        hint('薪資只存在這台電腦裡，不會上傳。');
    },
    hours: function () {
      return '<div class="card">' +
        line(row('每日工時', stepper('', function (d) { return 'data-hstep="' + d + '"'; }, 'hours', '小時', '少半小時', '多半小時'))) +
        line(row('午休時間', '<span class="times">' + textIn('lunchStart', 'tm', ' inputmode="numeric" maxlength="5" aria-label="午休開始"') +
          '<span>–</span>' + textIn('lunchEnd', 'tm', ' inputmode="numeric" maxlength="5" aria-label="午休結束"') + '</span>') +
          err('lunch') + hint('午休不算錢，狀態會顯示「午休中」。')) +
        '</div>' + hint('', 'endHint');
    },
    // what changes today, at the top of 薪水和時間
    today: function () {
      return '<div class="card">' +
        line(row('今天休假', tgl('offDay', '今天休假')) + hint('打開後，今天不算錢（已經開始算的也歸零），狀態顯示「休假日」；關掉就恢復。')) +
        line(row('<span data-o="endedAt"></span>', '<button type="button" class="btn sm" data-pa="resume">繼續上班</button>') +
          hint('按錯「下班」了？按「繼續上班」就接著算，中間的時間也照算。'), ' data-o="resumeLine"') +
        line('<label class="lbl">調整今天的起算時間</label><div class="adj">' +
          textIn('startAt', 'tm', ' inputmode="numeric" maxlength="5" aria-label="今天的起算時間"') +
          '<button type="button" class="btn sm" data-pa="applyStart">套用</button></div>' + err('startAt') + hint('', 'todayStart')) +
        '</div>';
    },
    start: function () {
      var days = '';
      [1, 2, 3, 4, 5, 6, 0].forEach(function (d) { days += '<button type="button" data-wd="' + d + '">' + WD.charAt(d) + '</button>'; });
      return '<div class="card">' +
        line(row('開始算錢', seg('startMode', [['auto', '自動'], ['manual', '手動']])) + hint('', 'modeHint')) +
        line('<span class="lbl">工作日</span><div class="days">' + days + '</div>' + hint('沒勾的日子不會自動開始，但可以手動開始上班。')) +
        '</div>';
    },
    pet: function () {
      return '<div class="card">' + picker() + '</div>' +
        '<div class="card">' +
        line(row('黃金鼠的名字', textIn('name.hamster', 'name', ' maxlength="8"'))) +
        line(row('貓咪的名字', textIn('name.cat', 'name', ' maxlength="8"'))) +
        '</div>';
    },
    // No start-layout picker and no topmost switches (simplification #12): the app opens in the layout used last, and
    // 永遠在最上層 is the menu's 版型 ▶ item, kept per layout. Two switches only (1.1 #12): 相容模式 and 省電模式.
    // 1.1.3 item 3: it names the layout in use as the menu does, 「N 名稱」 (QJZ.layouts.NAMES).
    layout: function () {
      return '<div class="lnow">現在的版型<b data-o="layoutName"></b></div>' +
        hint('換版型：右鍵選單 →「版型」。下次開啟會用你最後用的版型；要不要永遠在最上層，也在「版型」裡切換（每個版型各自記住）。') +
        '<div class="card">' + line(row('相容模式（不透明背景）', tgl('opaque', '相容模式（不透明背景）')) +
          hint('視窗周圍出現黑框時請開啟。') + hint('', 'opaqueNote')) +
          line(row('省電模式', tgl('powerSaver', '省電模式')) + hint('金額每秒跳 4 次、少一點動畫，比較省電；筆電建議打開。')) + '</div>';
    },
    // 1.1.5 縮放比例
    zoom: function () {
      var r = QJZ.settings.ZOOM, opts = '';
      for (var p = r[0]; p <= r[1]; p += r[2]) opts += '<option value="' + p + '">' + p + '%</option>';
      return '<div class="card">' + line(row('縮放比例', '<select class="zoom" data-f="zoom" aria-label="縮放比例">' + opts + '</select>') +
        hint('所有版型和設定視窗一起放大或縮小。也可以在錢進中上按住 Ctrl 轉滑鼠滾輪，或按 Ctrl ＋ / Ctrl − 調整，Ctrl 0 回到 100%。')) + '</div>';
    },
    health: function () { return QJZ.panelsHealth.section(); },
    boost: function () {
      return '<div class="card">' +
        line('<label class="lbl">里程碑金額</label>' + moneyIn('milestone', '') + err('milestone') +
          hint('每賺滿這個金額就慶祝一次，還會得到一個零食。')) +
        '</div><div class="card">' +
        line('<span class="lbl">換算物品</span>' + hint('「可以買幾杯珍奶」會輪流顯示這些東西。') +
          '<div class="items" data-items></div>' +
          '<button type="button" class="btn sm ghost add" data-pa="addItem">＋ 新增物品</button>') +
        '</div>';
    },
    sound: function () {
      return '<div class="card">' +
        line(row('音效', tgl('sound', '音效')) + hint('金幣叮、寵物叫聲、下班小樂句。預設關閉，不會吵到別人。')) +
        line(row('音量', '<span class="vol"><input type="range" min="0" max="100" step="5" data-f="volume" aria-label="音量"><b data-o="volume"></b></span>')) +
        '</div>';
    },
    autostart: function () {
      return '<div class="card">' +
        line(row('登入 Windows 後自動開啟', tgl('autostart', '開機自動啟動')) +
          hint('只寫入目前使用者的開機項目，不需要系統管理員權限。')) +
        '</div>';
    },
    privacy: function () {
      return '<div class="card">' +
        line(row('分享螢幕、錄影、截圖時隱形', tgl('capture', '分享螢幕、錄影、截圖時隱形')) +
          hint('自己的螢幕照樣看得到；較舊的 Windows 10 上會拍到一塊黑框。')) +
        line('<label class="lbl">快速隱藏快捷鍵</label><div class="hkrow">' +
          textIn('hotkey', 'hk', ' readonly aria-label="快速隱藏快捷鍵"') +
          '<button type="button" class="btn sm ghost" data-pa="hkDefault">還原 ' + DEFAULT_HOTKEY + '</button></div>' + err('hotkey') +
          '<div class="warn" data-o="hkFail" hidden><b data-o="hkFailText"></b><small data-o="hkFailSub"></small></div>' +
          hint('按一下隱藏，再按一下恢復；視窗被其他視窗蓋住時，第一下先把它移到最前面。要換的話，點上面的框，再按下新的組合鍵（要有 Ctrl 或 Alt）。')) +
        '</div>';
    },
    about: function () {
      var lic = '';
      LICENSES.forEach(function (l) {
        lic += line('<span class="lbl">' + esc(l[1]) + '</span>' + hint(l[2]) + '<pre class="lic" data-doc="' + l[0] + '" data-fail="' + LIC_FAIL + '"></pre>');
      });
      return '<div class="card">' +
        line(row('錢進中', '<span class="ver"><b data-o="version"></b><button type="button" class="btn sm ghost" data-pa="checkUpdate">檢查更新</button></span>') +
          '<div class="upd" data-o="updLine" hidden><span data-o="updText"></span><button type="button" class="linkbtn" data-pa="openUpdate" hidden></button></div>' +
          hint('上班時一秒一秒顯示今天賺了多少錢的桌面小寵物。')) +
        line(hint('薪資和紀錄只存在這台電腦裡，錢進中不會上傳。例外：如果公司把 Windows 設定成「漫遊設定檔」，' +
          '或把 AppData 資料夾重新導向到公司的伺服器，%AppData%\\錢進中（包含薪資）會跟著其他個人設定一起存到公司的伺服器上。不確定的話，請問公司 IT。')) +
        '</div>' + disclosure('guide', '使用說明', '<pre class="lic guide" data-doc="' + GUIDE + '" data-fail="' + GUIDE_FAIL + '"></pre>') +
        disclosure('lic', '第三方授權', lic);
    }
  };
  // A card with a title button that opens / closes body (closed at first): 使用說明, 第三方授權.
  function disclosure(name, title, body) {
    return '<div class="card disc"><button type="button" class="disc-h" data-disc="' + name + '" aria-expanded="false">' +
      '<span class="lbl">' + title + '</span><span class="chev"><span data-o="disc.' + name + '">點開</span> <i>›</i></span></button>' +
      '<div class="disc-b" data-discbody="' + name + '" hidden>' + body + '</div></div>';
  }

  var BUILD = {
    onboarding: function (c) {
      var s = st().settings;
      c.ob = { step: 1, mode: s.salary.mode, amountText: amountInputText(s.salary.amount), divisor: s.salary.divisor,
        pet: petId(s), names: { cat: s.pet.names.cat, hamster: s.pet.names.hamster } };
      var rest = '其他設定（每天 ' + s.hoursPerDay + ' 小時、午休 ' + s.lunch.start + '–' + s.lunch.end + '…）都能在設定裡改。';
      c.body.innerHTML = WARN +
        '<div class="ob-step" data-step="1">' +
          '<div class="hero"><span class="av" data-o="heroAv"></span><div><h2 class="ptitle">歡迎使用錢進中！</h2>' +
          '<p>先告訴我你的薪水，我就能一秒一秒幫你算今天賺了多少。</p></div></div>' +
          '<div class="card">' + SALARY_ROWS + '</div>' +
          '<p class="pnote">🔒 薪資只存在這台電腦裡，不會上傳。</p>' +
          '<div class="pfoot"><span class="stepdots"><i class="on"></i><i></i><i></i></span>' +
          '<button type="button" class="btn" data-pa="next">下一步 →</button></div>' +
        '</div>' +
        '<div class="ob-step" data-step="2" hidden>' +
          '<div><h2 class="ptitle">選一隻陪你上班的寵物</h2><p class="sub">之後也可以在設定裡換。</p></div>' +
          '<div class="card">' + picker() + '</div>' +
          '<div class="card">' + line(row('牠的名字', textIn('petName', 'name', ' maxlength="8"'))) + '</div>' +
          '<p class="pnote">' + esc(rest) + '</p>' +
          '<div class="pfoot"><button type="button" class="btn ghost" data-pa="prev">← 上一步</button>' +
          '<span class="stepdots"><i></i><i class="on"></i><i></i></span>' +
          '<button type="button" class="btn" data-pa="toHealth">下一步 →</button></div>' +
        '</div>' + QJZ.panelsHealth.onboardingStep();
      q(c, '[data-o=heroAv]').innerHTML = avatar(petId(s), 'celebrate');
      q(c, '[data-f=amount]').value = c.ob.amountText;
      obName(c);
      obAmountCheck(c, false);
    },
    settings: function (c) {
      var tabs = '', secs = '';
      TABS.forEach(function (t) {
        tabs += '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
        secs += '<section data-pane="' + t[0] + '" hidden>' +
          t[2].map(function (k) { return '<div class="sec" data-sec="' + k + '">' + SECTIONS[k]() + '</div>'; }).join('') + '</section>';
      });
      c.body.innerHTML = '<div class="ph"><h2 class="ptitle">設定</h2><button type="button" class="btn sm" data-act="back">完成</button></div>' +
        WARN + '<div class="tabs" role="tablist">' + tabs + '</div><div class="pscroll" data-nodrag>' + secs + '</div>';
      var s = st().settings;
      c.draft = s.items.map(function (it) { return { icon: it.icon, name: it.name, priceText: amountInputText(it.price), touched: { name: true, price: true },
        saved: { name: it.name, price: it.price, icon: it.icon } }; });
      fillInputs(c);
      renderItems(c);
    },
    history: function (c) {
      c.body.innerHTML = '<div class="ph"><h2 class="ptitle">紀錄</h2><button type="button" class="btn sm" data-act="back">關閉</button></div>' + WARN +
        '<div class="pscroll" data-nodrag>' +
          '<div class="card hist"><div class="hist-top"><b data-o="month"></b>' +
            '<span class="legend"><i class="lg"></i>每天 <i class="lg today"></i>今天</span></div>' +
            '<div class="hist-chart" data-o="chart"></div>' +
            '<div class="hist-sum"><small>本月合計</small><b class="num" data-o="total"></b><span data-o="worked"></span></div></div>' +
          QJZ.panelsHealth.calendarCard() +
          '<div class="card"><span class="lbl">之前的月份</span><ul class="months" data-o="months"></ul></div>' +
        '</div>';
    },
    question: function (c) {
      var s = st(), qn = s.pendingQuestion;
      lastQ = qn;
      c.body.innerHTML = '<div class="q"><span class="av" data-o="qav"></span>' +
          '<div class="q-bubble"><b data-o="qtext"></b><small data-o="qnote"></small></div></div>' +
        '<div class="q-btns">' +
          '<button type="button" class="btn qb" data-pa="yes"><b>對，用那個時間</b><small data-o="qyes"></small></button>' +
          '<button type="button" class="btn qb ghost" data-pa="no"><b>沒有，照原本的算</b><small data-o="qno"></small></button>' +
        '</div><p class="pnote">選了就會寫進紀錄，之後不會再問。</p>';
      q(c, '[data-o=qav]').innerHTML = avatar(petId(s.settings), 'scratch');
      if (!qn) return;
      var rec = has(s.history.days, qn.day) ? s.history.days[qn.day] : null;
      var m = questionModel(qn, rec, s.settings, s.today.day);
      out(c, 'qtext', m.text);
      out(c, 'qnote', m.planned ? '最後一次鎖定螢幕是 ' + m.lock + '，原本會算到 ' + m.planned + '。' : '');
      // the money mask (1.1.2 review M-2): this panel opens by itself, not on purpose, so its amounts are masked too
      var mask = !!(s.settings.privacy && s.settings.privacy.maskMoney);
      out(c, 'qyes', m.yes ? '算到 ' + m.lock + ' ・ NT$ ' + (mask ? '***' : m.yes) : '');
      out(c, 'qno', m.no ? '算到 ' + m.planned + ' ・ NT$ ' + (mask ? '***' : m.no) : '');
    },
    healthAsk: function (c) { QJZ.panelsHealth.askBuild(c); }
  };

  // ================= runtime =================
  var started = false, offs = [];
  var cur = null;        // the mounted panel: {kind, win, body, nodes, ...}
  var tab = 'time';      // the settings tab, kept for the session
  var lastQ = null;      // the pending question already shown
  var askShown = false;  // the reminder question (healthAsk) was shown this session

  function app() { return QJZ.app; }
  function st() { return QJZ.app.state; }
  function lay() { return QJZ.layouts; }
  function q(c, sel) { return c.body.querySelector(sel); }
  function qa(c, sel) { return Array.prototype.slice.call(c.body.querySelectorAll(sel)); }
  function node(c, name) {
    var n = c.nodes[name];
    if (n === undefined) n = c.nodes[name] = c.body.querySelector('[data-o="' + name + '"]');
    return n;
  }
  function out(c, name, text) {
    var n = node(c, name);
    if (n && n.textContent !== text) n.textContent = text;
  }
  function setErr(c, name, text) {
    var n = q(c, '[data-err="' + name + '"]');
    if (n && n.textContent !== text) n.textContent = text;
    var f = q(c, '[data-f="' + name + '"]');
    if (f) f.classList.toggle('bad', !!text);
  }
  function show(n, on) { if (n && n.hidden === !!on) n.hidden = !on; }
  function segOn(c, name, v) {
    qa(c, '[data-seg="' + name + '"] [data-v]').forEach(function (b) {
      var on = b.getAttribute('data-v') === String(v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function tglOn(c, name, on) {
    var b = q(c, '[data-tgl="' + name + '"]');
    if (b && b.getAttribute('aria-checked') !== String(!!on)) b.setAttribute('aria-checked', String(!!on));
  }
  function focused(el) { return !!el && document.activeElement === el; }
  function save(patch) { app().saveSettings(patch); }

  // window.screen is in px at zoom 100 % (WebView2 does not scale it with the ZoomFactor): over the zoom, it is CSS px.
  function tallHeight() {
    var avail = window.screen && window.screen.availHeight > 0 ? window.screen.availHeight : 0;
    var z = st().settings ? st().settings.zoom / 100 : 1;
    return avail ? Math.max(440, Math.min(TALL, Math.floor(avail / z) - 32)) : TALL;
  }
  // 1.1.5 檢查更新: the button, then 檢查中… and one of the three results (app.state.update).
  function updateCheckView(c) {
    var u = st().update, b = q(c, '[data-pa=checkUpdate]'), link = q(c, '[data-pa=openUpdate]');
    if (!b) return;
    var busy = !!(u && u.busy);
    if (b.disabled !== busy) b.disabled = busy;
    show(node(c, 'updLine'), !!u);
    if (!u) return;
    out(c, 'updText', busy ? '檢查中…' : u.kind === 'latest' ? '已是最新版（' + (u.version || '') + '）' :
      u.kind === 'newer' ? '有新版 ' + u.version : '查不到更新資訊');
    var to = busy || u.kind === 'latest' ? '' : u.kind === 'newer' ? '前往下載' : '開啟發布頁面';
    show(link, !!to);
    if (link && to && link.textContent !== to) link.textContent = to;
  }

  // ---- mount / update (called by layouts.js) ----
  function _mount(win, kind) {
    var body = win.querySelector('[data-panel]');
    if (!body) return;
    var k = kind === 'adjust' ? 'settings' : (has(BUILD, kind) ? kind : 'settings');
    if (kind === 'adjust') tab = 'time';
    cur = { kind: k, win: win, body: body, nodes: {}, cache: {} };
    if (k === 'healthAsk') askShown = true;
    win.classList.add('p-' + k);
    if (k !== 'question') { cur.tall = tallHeight(); win.style.height = cur.tall + 'px'; }
    BUILD[k](cur);
    win.addEventListener('click', onClick);
    win.addEventListener('input', onInput);
    win.addEventListener('change', onFieldChange);
    win.addEventListener('keydown', onKey);
    win.addEventListener('keyup', onKeyUp);
    win.addEventListener('focusin', onFocusIn);
    win.addEventListener('focusout', onFocusOut);
    _update();
    var f = k === 'onboarding' ? q(cur, '[data-f=amount]') : kind === 'adjust' ? q(cur, '[data-f=startAt]') : null;
    if (f) { try { f.focus(); if (f.select) f.select(); } catch (e) {} }
  }
  function _update() {
    var c = cur;
    if (!c || !c.win.isConnected || !st().ready) return;
    var w = q(c, '[data-pwarn]'), text = storageText(st().storageErrors);
    if (w) { show(w, !!text); if (text && w.textContent !== text) w.textContent = text; }
    if (UPDATE[c.kind]) UPDATE[c.kind](c);
  }

  var UPDATE = {
    onboarding: function (c) {
      var ob = c.ob;
      show(q(c, '[data-step="1"]'), ob.step === 1);
      show(q(c, '[data-step="2"]'), ob.step === 2);
      show(q(c, '[data-step="3"]'), ob.step === 3);
      if (ob.step === 3) QJZ.panelsHealth.askUpdate(c);
      segOn(c, 'mode', ob.mode);
      segOn(c, 'divisor', ob.divisor);
      show(q(c, '[data-only=monthly]'), ob.mode === 'monthly');
      out(c, 'amountLabel', ob.mode === 'hourly' ? '時薪' : '月薪');
      out(c, 'modeNote', c.modeNote || '');
      var a = q(c, '[data-f=amount]');
      if (a) a.placeholder = ob.mode === 'hourly' ? '輸入時薪' : '輸入月薪';
      var r = QJZ.settings.validateSalary(ob.amountText);
      out(c, 'preview', r.ok ? salaryPreview({ mode: ob.mode, amount: r.value, divisor: ob.divisor }, st().settings.hoursPerDay) :
        '輸入後會顯示日薪和每秒賺多少。');
      skinsOn(c, ob.pet);
    },
    settings: function (c) {
      var s = st().settings, t = st().today;
      qa(c, '[data-tab]').forEach(function (b) {
        var v = b.getAttribute('data-tab');
        b.classList.toggle('on', v === tab);
        b.setAttribute('aria-selected', v === tab ? 'true' : 'false');
        if (v === 'other') b.classList.toggle('alert', !!st().hotkeyFailed);   // 隱私 has the failure
      });
      qa(c, '[data-pane]').forEach(function (n) { show(n, n.getAttribute('data-pane') === tab); });
      // 薪資
      segOn(c, 'mode', s.salary.mode);
      segOn(c, 'divisor', s.salary.divisor);
      show(q(c, '[data-only=monthly]'), s.salary.mode === 'monthly');
      out(c, 'amountLabel', s.salary.mode === 'hourly' ? '時薪金額' : '月薪金額');
      out(c, 'modeNote', c.modeNote || '');
      out(c, 'preview', salaryPreview(s.salary, s.hoursPerDay) || '還沒設定薪資。');
      // 工時
      out(c, 'hours', String(s.hoursPerDay));
      var begun = t && isNum(t.startMs);
      out(c, 'endHint', begun ? '今天 ' + hmOf(t.startMs) + ' 開始，' + hmOf(QJZ.earn.endAtMs(t.startMs, t.day, s.hoursPerDay, s.lunch)) + ' 就可以下班。' :
        '每天上滿 ' + s.hoursPerDay + ' 小時（午休不算）就可以下班。');
      // 起算
      segOn(c, 'startMode', s.startMode);
      out(c, 'modeHint', s.startMode === 'auto' ? '每天第一次登入或解鎖 Windows 時自動開始。' : '每天要自己按「開始上班」（右鍵選單）。');
      qa(c, '[data-wd]').forEach(function (b) { b.classList.toggle('on', s.workDays.indexOf(+b.getAttribute('data-wd')) >= 0); });
      tglOn(c, 'offDay', t && t.offDay);
      var ended = begun && !t.offDay && isNum(t.endMs);
      show(node(c, 'resumeLine'), ended);
      if (ended) out(c, 'endedAt', '今天 ' + hmOf(t.endMs) + ' 已下班');
      out(c, 'todayStart', begun ? '今天從 ' + hmOf(t.startMs) + ' 開始計算' + (t.adjusted ? '（調整過）' : t.startSource === 'manual' ? '（手動）' : '（自動）') + '。' :
        '今天還沒開始。填時間按「套用」，就從那時開始算。');
      // 寵物
      skinsOn(c, petId(s));
      // 健康
      QJZ.panelsHealth.update(c);
      // 版型
      var L = QJZ.layouts;
      out(c, 'layoutName', L && L.NAMES && L.shownLayout ? L.NAMES[L.shownLayout()] || '' : '');
      var forced = !!st().forceOpaque, op = q(c, '[data-tgl=opaque]');
      tglOn(c, 'opaque', s.display.opaque || forced);
      if (op && op.disabled !== forced) op.disabled = forced;
      out(c, 'opaqueNote', forced ? '這台電腦目前無法顯示透明背景，已自動開啟。' : '');
      tglOn(c, 'powerSaver', s.display.powerSaver);
      // 音效 / 開機 / 隱私
      tglOn(c, 'sound', s.sound.enabled);
      var vol = q(c, '[data-f=volume]'), pct = Math.round(s.sound.volume * 100);
      if (vol && !focused(vol) && vol.value !== String(pct)) vol.value = String(pct);
      if (vol) show(vol.closest('.line'), s.sound.enabled);   // 1.1.3 C5: 音量 only while 音效 is on
      out(c, 'volume', (vol ? vol.value : pct) + '%');
      tglOn(c, 'autostart', s.autostart);
      tglOn(c, 'capture', s.privacy.hideFromCapture);
      var hk = q(c, '[data-f=hotkey]');
      if (hk && !c.hkCapture && !focused(hk) && hk.value !== s.privacy.hotkey) hk.value = s.privacy.hotkey;
      show(q(c, '[data-pa=hkDefault]'), s.privacy.hotkey !== DEFAULT_HOTKEY);
      var hf = hotkeyText(st().hotkeyFailed);
      show(node(c, 'hkFail'), !!hf);
      if (hf) { out(c, 'hkFailText', hf.text); out(c, 'hkFailSub', hf.sub); }
      // 縮放比例 (1.1.5); a panel beside its window takes the height that fits the screen at the new zoom
      var zs = q(c, '[data-f=zoom]');
      if (zs && !focused(zs) && zs.value !== String(s.zoom)) zs.value = String(s.zoom);
      if (c.zoom !== s.zoom) {
        if (c.zoom !== undefined && c.tall && c.win.style.height === c.tall + 'px') { c.tall = tallHeight(); c.win.style.height = c.tall + 'px'; }
        c.zoom = s.zoom;
      }
      // 關於
      out(c, 'version', '版本 ' + (st().version || '開發版'));
      updateCheckView(c);
    },
    history: function (c) {
      var s = st(), m = historyModel(s.history, s.today, s.snap.earned);
      var key = m.month + '|' + money(m.total) + '|' + m.max + '|' + m.worked;
      if (c.cache.hist !== key) {
        c.cache.hist = key;
        out(c, 'month', m.title);
        node(c, 'chart').innerHTML = chartSvg(m);
        out(c, 'total', 'NT$ ' + money(m.total));
        var begun = isNum(s.today.startMs) && !s.today.offDay;
        out(c, 'worked', m.worked ? '上班 ' + m.worked + ' 天' + (begun ? ' ＋ 今天' : '') : begun ? '只有今天' : '');
      }
      QJZ.panelsHealth.calendarUpdate(c);
      var count = Object.keys(s.history.days).length + '|' + m.month;
      if (c.cache.months !== count) {
        c.cache.months = count;
        renderMonths(c, previousMonths(s.history, m.month));
      }
    },
    healthAsk: function (c) { QJZ.panelsHealth.askUpdate(c); }
  };

  // The guide or the licence texts in el (an opened disclosure of 關於), fetched as plain text from the files beside the
  // page (https://app.qjz/...).
  function loadDocs(el) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-doc]'), function (pre) {
      var fail = function () { pre.textContent = pre.getAttribute('data-fail'); };
      pre.textContent = '讀取中…';
      try {
        window.fetch(pre.getAttribute('data-doc')).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
          .then(function (text) { pre.textContent = text; }, fail);
      } catch (e) { fail(); }
    });
  }

  function skinsOn(c, id) {
    qa(c, '[data-skin]').forEach(function (b) {
      var on = b.getAttribute('data-skin') === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // Text fields are written when the panel is built and after their own commit, never while being edited.
  function fillInputs(c) {
    var s = st().settings, t = st().today;
    var set = function (f, v) { var n = q(c, '[data-f="' + f + '"]'); if (n) n.value = v; };
    set('amount', amountInputText(s.salary.amount));
    set('lunchStart', s.lunch.start);
    set('lunchEnd', s.lunch.end);
    set('startAt', t && isNum(t.startMs) ? hmOf(t.startMs) : hmOf(app().nowMs()));
    set('name.hamster', s.pet.names.hamster);
    set('name.cat', s.pet.names.cat);
    set('milestone', amountInputText(s.milestone));
    set('hotkey', s.privacy.hotkey);
  }

  // ---- history chart ----
  function chartSvg(m) {
    var W = 340, H = 160, L = 40, R = 6, T = 10, B = 20, pw = W - L - R, ph = H - T - B;
    var top = niceMax(m.max), n = m.days.length, slot = pw / n, bw = Math.max(3, slot * 0.62);
    var y = function (v) { return T + ph - (v / top) * ph; };
    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(m.title + '每天的收入') + '">' +
      '<defs><pattern id="qjz-hist-today" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">' +
      '<rect width="6" height="6" fill="#FFC857"/><rect width="3" height="6" fill="#FFB627"/></pattern></defs>';
    m.days.forEach(function (d, i) {
      if (d.weekend) h += '<rect class="we" x="' + (L + i * slot).toFixed(1) + '" y="' + T + '" width="' + slot.toFixed(1) + '" height="' + ph + '"/>';
    });
    [top / 2, top].forEach(function (v) {
      h += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text class="yl" x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '">' + esc(amountInputText(v)) + '</text>';
    });
    var todayD = -9;
    m.days.forEach(function (d) { if (d.today) todayD = d.d; });
    m.days.forEach(function (d, i) {
      var cx = L + (i + 0.5) * slot;
      h += '<g data-bar><title>' + esc(shortDate(d.day) + (d.earned === null ? ' 沒有紀錄' : ' NT$ ' + money(d.earned)) + (d.today ? '（今天）' : '')) + '</title>';
      if (d.earned !== null && d.earned > 0) {   // 0 is no bar: a 2px stub would look like data
        var bh = Math.max(2, (Math.min(d.earned, top) / top) * ph);
        h += '<rect class="bar' + (d.today ? ' today' : '') + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + (T + ph - bh).toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="' + (d.today ? 'url(#qjz-hist-today)' : '#FFC857') +
          '" stroke="#3D2C24" stroke-width="1.6"/>';
      }
      h += '</g>';
      if (d.today || ((d.d === 1 || d.d % 5 === 0) && Math.abs(d.d - todayD) > 1)) {   // labels never touch today's
        h += '<text class="xl' + (d.today ? ' now' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 5) + '">' + d.d + '</text>';
      }
    });
    return h + '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '"/></svg>';
  }
  function renderMonths(c, list) {
    var ul = node(c, 'months');
    ul.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('li');
      e.className = 'empty';
      e.textContent = '還沒有之前的紀錄。';
      ul.appendChild(e);
      return;
    }
    list.forEach(function (m) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="mt"></span><span class="md"></span><b class="num"></b>';
      li.children[0].textContent = m.title;
      li.children[1].textContent = '上班 ' + m.worked + ' 天';
      li.children[2].textContent = 'NT$ ' + money(m.total);
      ul.appendChild(li);
    });
  }

  // ---- 動力加成: item rows (a local draft; the valid rows are saved) ----
  function renderItems(c) {
    var box = q(c, '[data-items]');
    if (!box) return;
    box.innerHTML = '';
    c.draft.forEach(function (r, i) {
      var div = document.createElement('div');
      div.className = 'item';
      div.setAttribute('data-item', String(i));
      div.innerHTML = '<div class="irow">' + textIn('item.icon', 'ic', ' maxlength="4" aria-label="圖示"') +
        textIn('item.name', 'nm', ' maxlength="10" placeholder="名稱" aria-label="名稱"') +
        '<span class="money-in sm"><span>NT$</span>' + textIn('item.price', 'pr', ' inputmode="decimal" maxlength="9" aria-label="價格"') + '</span>' +
        '<button type="button" class="x" data-pa="delItem" title="刪除" aria-label="刪除">✕</button></div><div class="err"></div>';
      div.querySelector('[data-f="item.icon"]').value = r.icon;
      div.querySelector('[data-f="item.name"]').value = r.name;
      div.querySelector('[data-f="item.price"]').value = r.priceText;
      div.querySelector('[data-pa=delItem]').disabled = c.draft.length <= 1;
      box.appendChild(div);
      itemError(c, i);
    });
    var add = q(c, '[data-pa=addItem]');
    if (add) add.disabled = c.draft.length >= MAX_ITEMS;
  }
  function itemError(c, i) {
    var r = checkItem(c.draft[i]), row = q(c, '[data-item="' + i + '"]');
    if (!row) return r;
    var text = !r.ok && c.draft[i].touched[r.field] ? r.error : '';
    row.querySelector('.err').textContent = text;
    row.querySelector('[data-f="item.name"]').classList.toggle('bad', !!text && r.field === 'name');
    row.querySelector('[data-f="item.price"]').classList.toggle('bad', !!text && r.field === 'price');
    return r;
  }
  function saveItems(c) {
    var items = [];
    c.draft.forEach(function (r) {
      var x = checkItem(r);
      if (x.ok) { r.saved = x.item; items.push(x.item); }
      else if (r.saved) items.push(r.saved);   // an invalid row keeps its last good value
    });
    if (items.length) save({ items: items });   // never empty: the sanitizer would bring the defaults back
  }

  // ---- onboarding ----
  function obAmountCheck(c, strict) {
    var t = c.ob.amountText, r = QJZ.settings.validateSalary(t);
    setErr(c, 'amount', r.ok || (!strict && String(t).replace(/[\s　]+/g, '') === '') ? '' : r.error);
    return r;
  }
  function obStep(c, n) {
    var a = document.activeElement;
    c.ob.step = n;
    _update();
    if (n === 1) { var f = q(c, '[data-f=amount]'); try { f.focus(); } catch (e) {} }
    else if (a && c.win.contains(a) && a.blur) a.blur();   // the focused 下一步 is hidden now
  }
  function obGo(c) {
    var ob = c.ob, kind = (petParts(ob.pet) || { kind: 'hamster' }).kind, a = QJZ.panelsHealth.readStep(c);
    var r = onboardingPatch({ mode: ob.mode, amountText: ob.amountText, divisor: ob.divisor, pet: ob.pet, name: ob.names[kind],
      sit: a.sit, water: a.water });
    if (!r.ok) { obStep(c, 1); setErr(c, 'amount', r.error); return; }
    save(r.patch);
    app().flush();
    close();
    if (lay().current() !== 'PANEL') {
      var s = st().settings;
      lay().say(s.pet.names[s.pet.kind] + '會陪你一起努力！今天也加油！');
    }
  }
  function obName(c) {
    var p = petParts(c.ob.pet), n = q(c, '[data-f=petName]');
    if (p && n && !focused(n)) n.value = c.ob.names[p.kind];
  }

  // ---- events ----
  function attr(el, sel, name) { var n = el.closest(sel); return n ? n.getAttribute(name) : null; }
  function onClick(e) {
    var c = cur;
    if (!c || !c.win.contains(e.target)) return;
    var t = e.target, v;
    if (QJZ.panelsHealth.click(c, t)) return;   // its switches, steppers and ticks
    if ((v = attr(t, '[data-seg] [data-v]', 'data-v')) !== null) { pickSeg(c, t.closest('[data-seg]').getAttribute('data-seg'), v); return; }
    if ((v = attr(t, '[data-skin]', 'data-skin')) !== null) { pickSkin(c, v); return; }
    if ((v = attr(t, '[data-tab]', 'data-tab')) !== null) { tab = v; _update(); var sc = q(c, '.pscroll'); if (sc) sc.scrollTop = 0; return; }
    if ((v = attr(t, '[data-tgl]', 'data-tgl')) !== null) { toggle(c, v); return; }
    if ((v = attr(t, '[data-disc]', 'data-disc')) !== null) { disclose(c, v); return; }
    if ((v = attr(t, '[data-hstep]', 'data-hstep')) !== null) { save({ hoursPerDay: stepHours(st().settings.hoursPerDay, v === '+' ? 1 : -1) }); return; }
    if ((v = attr(t, '[data-wd]', 'data-wd')) !== null) { save({ workDays: toggleDay(st().settings.workDays, +v) }); return; }
    var b = t.closest('[data-pa]');
    if (b && !b.disabled) action(c, b.getAttribute('data-pa'), b);
  }
  function pickSeg(c, name, v) {
    if (c.kind === 'onboarding') {
      if (name === 'mode') {
        var to = v === 'hourly' ? 'hourly' : 'monthly', r0 = QJZ.settings.validateSalary(c.ob.amountText);
        if (to !== c.ob.mode) {
          var cv = r0.ok ? convertAmount(r0.value, to, c.ob.divisor, st().settings.hoursPerDay) : null;
          if (cv !== null) {
            c.ob.amountText = amountInputText(cv);
            var af = q(c, '[data-f=amount]');
            if (af) af.value = c.ob.amountText;
          }
          c.modeNote = cv !== null ? modeNote(to) : '';   // an older 已換算 note must not stay on an unconverted amount
        }
        c.ob.mode = to;
      }
      if (name === 'divisor') c.ob.divisor = v === '30' ? 30 : 22;
      _update();
      return;
    }
    if (name === 'mode') {
      var s0 = st().settings, to2 = v === 'hourly' ? 'hourly' : 'monthly';
      if (to2 === s0.salary.mode) return;
      var cv2 = s0.salary.amount > 0 ? convertAmount(s0.salary.amount, to2, s0.salary.divisor, s0.hoursPerDay) : null;
      save({ salary: cv2 === null ? { mode: to2 } : { mode: to2, amount: cv2 } });
      var af2 = q(c, '[data-f=amount]');
      if (af2) af2.value = amountInputText(st().settings.salary.amount);
      c.modeNote = cv2 !== null ? modeNote(to2) : s0.salary.amount > 0 ? keptNote(to2) : '';
      setErr(c, 'amount', '');
      _update();
    }
    else if (name === 'divisor') save({ salary: { divisor: +v } });
    else if (name === 'startMode') save({ startMode: v });
  }
  // Opens or closes a disclosure of 關於; its texts load the first time it opens.
  function disclose(c, name) {
    var b = q(c, '[data-disc="' + name + '"]'), body = q(c, '[data-discbody="' + name + '"]');
    if (!b || !body) return;
    var open = body.hidden;
    body.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    out(c, 'disc.' + name, open ? '收起' : '點開');
    if (open && !body.hasAttribute('data-loaded')) { body.setAttribute('data-loaded', ''); loadDocs(body); }
  }
  function pickSkin(c, id) {
    var p = petParts(id);
    if (!p) return;
    if (c.kind === 'onboarding') { c.ob.pet = id; obName(c); _update(); return; }
    save({ pet: { kind: p.kind, skin: p.skin } });
  }
  function toggle(c, name) {
    var s = st().settings;
    if (name === 'offDay') app().setOffDay(!st().today.offDay);
    else if (name === 'sound') {
      save({ sound: { enabled: !s.sound.enabled } });
      if (st().settings.sound.enabled && QJZ.sound) QJZ.sound.coin();
    } else if (name === 'opaque') {
      if (!st().forceOpaque) save({ display: { opaque: !s.display.opaque } });
    } else if (name === 'powerSaver') save({ display: { powerSaver: !s.display.powerSaver } });
    else if (name === 'autostart') app().setAutostart(!s.autostart);
    else if (name === 'capture') app().setCaptureGuard(!s.privacy.hideFromCapture);
  }
  function action(c, a, b) {
    var s = st();
    switch (a) {
      case 'checkUpdate': app().checkUpdate(); _update(); break;
      case 'openUpdate': app().openUpdate(); break;
      case 'next':
        c.ob.amountText = q(c, '[data-f=amount]').value;
        if (obAmountCheck(c, true).ok) obStep(c, 2);
        else { var f = q(c, '[data-f=amount]'); try { f.focus(); } catch (e) {} }
        break;
      case 'toHealth': obStep(c, 3); break;
      case 'prev': obStep(c, Math.max(1, c.ob.step - 1)); break;
      case 'go': obGo(c); break;
      case 'yes': case 'no':
        app().answerEarlyLeave(a === 'yes');
        close();
        if (lay().current() !== 'PANEL') lay().say(a === 'yes' ? '收到！紀錄改好了。' : '收到！照原本的時間算。');
        break;
      case 'askOk': {
        var ans = QJZ.panelsHealth.readStep(c);
        save({ health: { asked: true, sit: { on: ans.sit }, water: { on: ans.water } } });
        app().flush();
        close();
        break;
      }
      case 'applyStart': {
        var r = startAt(s.today.day, q(c, '[data-f=startAt]').value, app().nowMs());
        setErr(c, 'startAt', r.ok ? '' : r.error);
        if (r.ok) { app().adjustStart(r.ms); q(c, '[data-f=startAt]').value = hmOf(r.ms); }
        break;
      }
      case 'addItem':
        if (c.draft.length >= MAX_ITEMS) break;
        c.draft.push({ icon: '🎁', name: '', priceText: '', touched: {} });
        renderItems(c);
        var nm = q(c, '[data-item="' + (c.draft.length - 1) + '"] [data-f="item.name"]');
        if (nm) { try { nm.focus(); } catch (e) {} }
        break;
      case 'delItem': {
        var i = +b.closest('[data-item]').getAttribute('data-item');
        if (c.draft.length <= 1) break;
        c.draft.splice(i, 1);
        renderItems(c);
        saveItems(c);
        break;
      }
      case 'hkDefault':
        setErr(c, 'hotkey', '');
        app().setHotkey(DEFAULT_HOTKEY);
        break;
      case 'resume': app().resumeWork(); break;
    }
  }

  function onInput(e) {
    var c = cur, f = e.target.getAttribute && e.target.getAttribute('data-f');
    if (!c || !f) return;
    if (c.kind === 'onboarding') {
      if (f === 'amount') { c.ob.amountText = e.target.value; c.modeNote = ''; obAmountCheck(c, false); _update(); }
      if (f === 'petName') { var p = petParts(c.ob.pet); if (p) c.ob.names[p.kind] = e.target.value; }
      return;
    }
    if (f === 'amount' || f === 'milestone') {
      var r = f === 'amount' ? QJZ.settings.validateSalary(e.target.value) : checkAmount(e.target.value);
      if (r.ok) setErr(c, f, '');
    }
    if (f === 'volume') out(c, 'volume', e.target.value + '%');
  }
  function onFieldChange(e) {
    var c = cur, el = e.target, f = el.getAttribute && el.getAttribute('data-f'), r;
    if (!c || !f || c.kind !== 'settings') return;
    var s = st().settings;
    switch (f) {
      case 'amount':
        r = QJZ.settings.validateSalary(el.value);
        setErr(c, 'amount', r.ok ? '' : r.error);
        c.modeNote = '';
        if (r.ok) { save({ salary: { amount: r.value } }); el.value = amountInputText(r.value); }
        break;
      case 'lunchStart': case 'lunchEnd':
        r = checkLunch(q(c, '[data-f=lunchStart]').value, q(c, '[data-f=lunchEnd]').value);
        setErr(c, 'lunch', r.ok ? '' : r.error);
        if (r.ok) {
          save({ lunch: { start: r.start, end: r.end } });
          q(c, '[data-f=lunchStart]').value = r.start;
          q(c, '[data-f=lunchEnd]').value = r.end;
        }
        break;
      case 'name.cat': case 'name.hamster': {
        var kind = f.slice(5), name = el.value.trim(), patch = { pet: { names: {} } };
        if (!name) { el.value = s.pet.names[kind]; break; }
        patch.pet.names[kind] = name;
        save(patch);
        el.value = st().settings.pet.names[kind];
        break;
      }
      case 'milestone':
        r = checkAmount(el.value);
        setErr(c, 'milestone', r.ok ? '' : r.error);
        if (r.ok) { save({ milestone: r.value }); el.value = amountInputText(r.value); }
        break;
      case 'zoom': app().setZoom(+el.value); break;
      case 'volume':
        save({ sound: { volume: Math.max(0, Math.min(100, +el.value || 0)) / 100 } });
        if (st().settings.sound.enabled && QJZ.sound) QJZ.sound.coin();
        break;
      case 'item.icon': case 'item.name': case 'item.price': {
        var rowEl = el.closest('[data-item]'), i = rowEl ? +rowEl.getAttribute('data-item') : -1;
        if (!c.draft[i]) break;
        var key = f === 'item.price' ? 'priceText' : f.slice(5);
        c.draft[i][key] = el.value;
        if (f !== 'item.icon') c.draft[i].touched[f.slice(5)] = true;
        if (itemError(c, i).ok) saveItems(c);
        break;
      }
    }
  }

  function isHotkeyField(el) { return !!el && el.getAttribute && el.getAttribute('data-f') === 'hotkey'; }
  function onKey(e) {
    var c = cur;
    if (!c) return;
    var el = e.target;
    if (isHotkeyField(el)) { hotkeyKey(c, el, e); return; }
    var f = el.getAttribute && el.getAttribute('data-f');
    if (e.key === 'Enter' && f) {
      if (c.kind === 'onboarding') { e.preventDefault(); action(c, f === 'petName' ? 'toHealth' : 'next'); return; }
      if (f === 'startAt') { e.preventDefault(); action(c, 'applyStart'); return; }
      if (el.type === 'text') { e.preventDefault(); el.blur(); }
      return;
    }
    if (e.key === 'Escape' && (c.kind === 'settings' || c.kind === 'history')) { e.preventDefault(); close(); }
  }
  function hotkeyKey(c, el, e) {
    var r = comboFromEvent(e);
    if (r.pass) return;
    e.preventDefault();
    e.stopPropagation();
    c.hkCapture = true;
    if (r.cancel) { el.blur(); return; }
    if (r.partial !== undefined) { el.value = r.partial ? r.partial + '…' : ''; return; }
    if (r.error) { el.value = ''; setErr(c, 'hotkey', r.error); return; }
    setErr(c, 'hotkey', '');
    el.value = r.combo;
    if (r.combo !== st().settings.privacy.hotkey || st().hotkeyFailed) app().setHotkey(r.combo);
    c.hkCapture = false;
    el.blur();
  }
  function onKeyUp(e) {
    var c = cur, el = e.target;
    if (!c || !isHotkeyField(el) || !c.hkCapture) return;
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && /…$/.test(el.value)) el.value = '';
  }
  function onFocusIn(e) {
    var c = cur, el = e.target;
    if (!c || !isHotkeyField(el)) return;
    c.hkCapture = true;
    el.value = '';
    el.placeholder = '請按下新的組合鍵…';
    el.classList.add('cap');
  }
  function onFocusOut(e) {
    var c = cur, el = e.target;
    if (!c || !isHotkeyField(el)) return;
    c.hkCapture = false;
    el.placeholder = '';
    el.classList.remove('cap');
    el.value = st().settings.privacy.hotkey;
  }

  // ---- app events ----
  function onAppChange(s) {
    if (!s.ready || !s.pendingQuestion || s.pendingQuestion === lastQ) return;
    if (lay().current() === 'PANEL' || needsOnboarding(s.settings)) return;
    open('question');
  }
  function onNotice(msg) {
    if (!st().ready) return;
    if (lay().current() === 'PANEL') { _update(); return; }
    var line = null;
    if (msg && msg.type === 'hotkeyFailed') {
      var t = hotkeyText(msg);
      if (t) line = t.text.replace('，請換一組', '，到設定換一組吧');
    } else if (msg && msg.type === 'storageError' && has(FILES, msg.file)) {
      line = '讀不到' + FILES[msg.file][0] + '，這次不會覆寫它。';
    }
    if (line) lay().say(line, 9000);
  }

  // ================= public =================
  function hasKind(kind) { return has(TITLES, kind); }
  function title(kind) { return hasKind(kind) ? TITLES[kind] : ''; }
  // The panel to show before anything else (layouts.js asks once, at the first layout); null until start().
  function initial(state) { return started ? initialPanel(state) : null; }
  function open(kind) { return lay().openPanel(kind); }
  // Back to the layout the panel came from, unless an early-leave question is waiting, or the early-leave question
  // closes before the reminder question was shown this session.
  function close() {
    var s = st();
    if (cur && cur.kind !== 'question' && s.ready && s.pendingQuestion && !needsOnboarding(s.settings)) return open('question');
    if (cur && cur.kind === 'question' && s.ready && !askShown && needsHealthAsk(s.settings)) return open('healthAsk');
    if (s.ready) app().flush();
    return lay().closePanel();
  }
  // Call after QJZ.layouts.start() and before QJZ.app.start().
  function start() {
    if (started) return;
    started = true;
    offs.push(app().on('change', onAppChange), app().on('notice', onNotice));
  }
  // Tests only.
  function reset() {
    offs.forEach(function (f) { try { f(); } catch (e) {} });
    offs = [];
    started = false; cur = null; tab = 'time'; lastQ = null; askShown = false;
  }

  return {
    start: start, open: open, close: close, initial: initial, has: hasKind, title: title,
    _mount: _mount, _update: _update, _reset: reset,
    // The markup and runtime helpers, for the sections other modules draw (QJZ.panelsHealth). c: the mounted panel.
    kit: {
      line: line, row: row, tgl: tgl, seg: seg, hint: hint, esc: esc, stepper: stepper, disclosure: disclosure, WARN: WARN,
      out: out, q: q, qa: qa, show: show, tglOn: tglOn, segOn: segOn, save: save, st: st, avatar: avatar, petId: petId
    },
    util: {
      needsOnboarding: needsOnboarding, initialPanel: initialPanel, onboardingPatch: onboardingPatch, checkAmount: checkAmount,
      amountInputText: amountInputText, checkItem: checkItem, normHM: normHM, checkLunch: checkLunch, startAt: startAt,
      toggleDay: toggleDay, stepHours: stepHours, comboFromEvent: comboFromEvent, hotkeyText: hotkeyText, storageText: storageText,
      historyModel: historyModel, previousMonths: previousMonths, niceMax: niceMax, questionText: questionText,
      questionModel: questionModel, salaryPreview: salaryPreview
    }
  };
})();
