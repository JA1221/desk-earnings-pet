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
    layout: { start: 'U1', current: 'U1', topmost: { U1: false, U3: false, U5B: false, U7: true, M3: true } },
    milestone: 100,
    items: [{ name: '珍奶', price: 65, icon: '🧋' }, { name: '便當', price: 100, icon: '🍱' }, { name: '拿鐵', price: 120, icon: '☕' }],
    sound: { enabled: false, volume: 0.6 },
    autostart: true,
    privacy: { hideFromCapture: true, hotkey: 'Ctrl+Alt+H' },
    display: { opaque: false },   // 相容模式: paint the whole window (page-owned; the host has init.forceOpaque)
    onboarded: false
  };
  var LAYOUTS = ['U1', 'U3', 'U5B', 'U7', 'M3'];
  var SKINS = { hamster: ['p0', 'p4', 'h2', 's4', 's5'], cat: ['p0', 'p4', 's5'] };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v, def) { return typeof v === 'string' && v.replace(/\s+/g, '') !== '' ? v : def; }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }
  function oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function hm(v, def) { return typeof v === 'string' && !isNaN(QJZ.time.parseHM(v)) ? v : def; }

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
    var disp = isObj(s.display) ? s.display : {};
    out.display.opaque = bool(disp.opaque, d.display.opaque);
    out.onboarded = bool(s.onboarded, d.onboarded);
    return out;
  }

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

  return { DEFAULTS: DEFAULTS, parse: parse, validateSalary: validateSalary, skinsFor: skinsFor };
})();
