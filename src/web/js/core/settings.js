window.QJZ = window.QJZ || {};
QJZ.settings = (function () {
  var DEFAULTS = {
    version: 1,
    salary: { mode: 'monthly', amount: 0, divisor: 22 },
    hoursPerDay: 8,
    lunch: { start: '12:00', end: '13:00' },
    startMode: 'auto',
    workDays: [1, 2, 3, 4, 5],
    pet: { kind: 'hamster', skin: 'p0', names: { cat: '小橘', hamster: '金金' } },
    // current: the last main layout; mini: it was left as the mini badge (M3). The app starts in mini ? M3 : current
    // (simplification #12). start (1.0's start-layout picker) is no longer read; it is kept so no saved value is lost.
    // capsule: U10's dock (§5.7), changed only by dragging or the menu's 膠囊位置; settings never show it.
    layout: {
      start: 'U1', current: 'U1',
      topmost: { U1: false, U3: false, U5B: false, U7: true, M3: true, U10: true, U12: false, U13: false },
      mini: false, capsule: 'top'
    },
    milestone: 100,
    items: [{ name: '珍奶', price: 65, icon: '🧋' }, { name: '便當', price: 100, icon: '🍱' }, { name: '拿鐵', price: 120, icon: '☕' }],
    sound: { enabled: false, volume: 0.6 },
    autostart: true,
    // maskMoney (1.1.2): the money on the main screens shows *** (a click on the amount toggles it; page-owned)
    privacy: { hideFromCapture: true, hotkey: 'Ctrl+Alt+H', maskMoney: false },
    // opaque: 相容模式, paint the whole window (page-owned; the host has init.forceOpaque). powerSaver: 省電模式 (§5.9).
    display: { opaque: false, powerSaver: false },
    // §4.9 #6/#7, §5.4: one reminder timer (every minutes) for 起來動 (sit) and 喝水 (water). asked: the user answered
    // the reminder question (onboarding, or the one-time question after the 1.0 upgrade, §5.5); until then neither
    // reminder runs whatever sit.on / water.on say (QJZ.reminders.ask).
    health: { asked: false, every: 50, sit: { on: false }, water: { on: false, goal: 8 }, pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4 } },
    onboarded: false
  };
  // The layouts layout.current (and the unread layout.start) and the topmost map may name. Kept in sync with
  // HostSettings.Layouts (src/host).
  var LAYOUTS = ['U1', 'U3', 'U5B', 'U7', 'M3', 'U10', 'U12', 'U13'];
  // U10's docks (§5.7): top centre, or just above the taskbar on the left, centre or right.
  var DOCKS = ['top', 'bottomLeft', 'bottomCenter', 'bottomRight'];
  // [min, max, step] per health number (§5.4), keyed by its path under health.
  var HEALTH_RANGES = {
    'every': [5, 120, 5], 'water.goal': [1, 20, 1],   // every: 5–120 since 1.1.1 (it was 20–120)
    'pomodoro.focus': [10, 90, 5], 'pomodoro.short': [1, 30, 1], 'pomodoro.long': [5, 60, 5], 'pomodoro.longEvery': [2, 8, 1]
  };
  var SKINS = { hamster: ['p0', 'p4', 'h2', 's4', 's5'], cat: ['p0', 'p4', 'h2', 's4', 's5'] };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v, def) { return typeof v === 'string' && v.replace(/\s+/g, '') !== '' ? v : def; }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }
  function oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function hm(v, def) { return typeof v === 'string' && !isNaN(QJZ.time.parseHM(v)) ? v : def; }
  // range [min, max, step]: a number is clamped, then put on the nearest step from min; anything else is def.
  function ranged(v, range, def) {
    if (!isNum(v)) return def;
    var min = range[0], c = Math.min(range[1], Math.max(min, v));
    return min + Math.round((c - min) / range[2]) * range[2];
  }

  function skinsFor(kind) { return (SKINS[kind] || ['p0']).slice(); }

  function sanitize(raw) {
    var d = DEFAULTS, s = isObj(raw) ? raw : {};
    var out = clone(d);

    var sal = isObj(s.salary) ? s.salary : {};
    out.salary.mode = oneOf(sal.mode, ['monthly', 'hourly'], d.salary.mode);
    out.salary.amount = isNum(sal.amount) && sal.amount > 0 ? sal.amount : d.salary.amount;
    out.salary.divisor = oneOf(sal.divisor, [22, 30], d.salary.divisor);

    out.hoursPerDay = isNum(s.hoursPerDay) && s.hoursPerDay > 0 && s.hoursPerDay <= 24 ? s.hoursPerDay : d.hoursPerDay;

    var lu = isObj(s.lunch) ? s.lunch : {};
    out.lunch.start = hm(lu.start, d.lunch.start);
    out.lunch.end = hm(lu.end, d.lunch.end);

    out.startMode = oneOf(s.startMode, ['auto', 'manual'], d.startMode);

    if (Array.isArray(s.workDays)) {
      var days = [];
      for (var i = 0; i < s.workDays.length; i++) {
        var w = s.workDays[i];
        if (isNum(w) && w >= 0 && w <= 6 && Math.floor(w) === w && days.indexOf(w) < 0) days.push(w);
      }
      if (days.length || !s.workDays.length) out.workDays = days.sort(function (a, b) { return a - b; });
    }

    var pet = isObj(s.pet) ? s.pet : {};
    out.pet.kind = oneOf(pet.kind, ['cat', 'hamster'], d.pet.kind);
    out.pet.skin = oneOf(pet.skin, skinsFor(out.pet.kind), d.pet.skin);
    var names = isObj(pet.names) ? pet.names : {};
    out.pet.names.cat = str(names.cat, d.pet.names.cat);
    out.pet.names.hamster = str(names.hamster, d.pet.names.hamster);

    var lay = isObj(s.layout) ? s.layout : {};
    out.layout.start = oneOf(lay.start, LAYOUTS, d.layout.start);
    out.layout.current = oneOf(lay.current, LAYOUTS, d.layout.current);
    var top = isObj(lay.topmost) ? lay.topmost : {};
    for (var j = 0; j < LAYOUTS.length; j++) out.layout.topmost[LAYOUTS[j]] = bool(top[LAYOUTS[j]], d.layout.topmost[LAYOUTS[j]]);
    // A 1.0 file has no mini: a 1.0 start layout of M3 (開啟時的版型 = 迷你徽章) keeps opening the mini badge (review M-2).
    out.layout.mini = lay.mini === undefined ? out.layout.start === 'M3' : bool(lay.mini, d.layout.mini);
    out.layout.capsule = oneOf(lay.capsule, DOCKS, d.layout.capsule);

    out.milestone = isNum(s.milestone) && s.milestone > 0 ? s.milestone : d.milestone;

    if (Array.isArray(s.items)) {
      var items = [];
      for (var k = 0; k < s.items.length; k++) {
        var it = s.items[k];
        if (isObj(it) && str(it.name, null) !== null && isNum(it.price) && it.price > 0) {
          items.push({ name: it.name, price: it.price, icon: typeof it.icon === 'string' ? it.icon : '' });
        }
      }
      if (items.length) out.items = items;
    }

    var snd = isObj(s.sound) ? s.sound : {};
    out.sound.enabled = bool(snd.enabled, d.sound.enabled);
    out.sound.volume = isNum(snd.volume) && snd.volume >= 0 && snd.volume <= 1 ? snd.volume : d.sound.volume;

    out.autostart = bool(s.autostart, d.autostart);
    var pv = isObj(s.privacy) ? s.privacy : {};
    out.privacy.hideFromCapture = bool(pv.hideFromCapture, d.privacy.hideFromCapture);
    out.privacy.hotkey = str(pv.hotkey, d.privacy.hotkey);
    out.privacy.maskMoney = bool(pv.maskMoney, d.privacy.maskMoney);
    var disp = isObj(s.display) ? s.display : {};
    out.display.opaque = bool(disp.opaque, d.display.opaque);
    out.display.powerSaver = bool(disp.powerSaver, d.display.powerSaver);

    var hs = isObj(s.health) ? s.health : {}, hd = d.health, R = HEALTH_RANGES;
    var sit = isObj(hs.sit) ? hs.sit : {}, water = isObj(hs.water) ? hs.water : {}, pom = isObj(hs.pomodoro) ? hs.pomodoro : {};
    out.health.asked = bool(hs.asked, hd.asked);
    out.health.every = ranged(hs.every, R['every'], hd.every);
    out.health.sit.on = bool(sit.on, hd.sit.on);
    out.health.water.on = bool(water.on, hd.water.on);
    out.health.water.goal = ranged(water.goal, R['water.goal'], hd.water.goal);
    out.health.pomodoro.focus = ranged(pom.focus, R['pomodoro.focus'], hd.pomodoro.focus);
    out.health.pomodoro.short = ranged(pom.short, R['pomodoro.short'], hd.pomodoro.short);
    out.health.pomodoro.long = ranged(pom.long, R['pomodoro.long'], hd.pomodoro.long);
    out.health.pomodoro.longEvery = ranged(pom.longEvery, R['pomodoro.longEvery'], hd.pomodoro.longEvery);

    out.onboarded = bool(s.onboarded, d.onboarded);
    return out;
  }

  // §5.4, derived, never stored. 起來動目標: the working minutes of a day over the reminder interval, rounded down, at
  // least 1 (8 h, 50 min -> 9). 番茄每日目標: one round, 每幾顆長休息.
  function standGoal(settings) { return Math.max(1, Math.floor(settings.hoursPerDay * 60 / settings.health.every)); }
  function tomatoGoal(settings) { return settings.health.pomodoro.longEvery; }

  // null / empty / "null" / non-object JSON (array, number, string) -> defaults, not corrupted.
  // Only text that is not valid JSON at all is flagged corrupted.
  function parse(text) {
    if (text === null || text === undefined || String(text).replace(/\s+/g, '') === '') {
      return { settings: clone(DEFAULTS), corrupted: false };
    }
    var raw;
    try { raw = JSON.parse(String(text)); }
    catch (e) { return { settings: clone(DEFAULTS), corrupted: true }; }
    return { settings: sanitize(raw), corrupted: false };
  }

  // Accepts full-width digits and surrounding spaces; returns the numeric value or a Chinese error.
  function validateSalary(text) {
    var t = String(text === null || text === undefined ? '' : text)
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-')
      .replace(/^[\s　]+|[\s　]+$/g, '');
    if (t === '') return { ok: false, error: '請輸入薪資' };
    if (!/\d/.test(t) || !/^-?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?$/.test(t)) return { ok: false, error: '請輸入數字' };
    var v = parseFloat(t.replace(/,/g, ''));
    if (!(v >= 1)) return { ok: false, error: '薪資要大於 0' };
    if (v > 10000000) return { ok: false, error: '金額太大了' };
    return { ok: true, value: v };
  }

  return {
    DEFAULTS: DEFAULTS, LAYOUTS: LAYOUTS, DOCKS: DOCKS, HEALTH_RANGES: HEALTH_RANGES,
    parse: parse, validateSalary: validateSalary, skinsFor: skinsFor, standGoal: standGoal, tomatoGoal: tomatoGoal
  };
})();
