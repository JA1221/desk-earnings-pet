window.QJZ = window.QJZ || {};
// Daily health counts kept on a history record: { cups, cupGoal, tomatoes, standups }. Pure.
QJZ.health = (function () {
  var FIELDS = ['cups', 'tomatoes', 'standups'];

  function count(v) {
    return typeof v === 'number' && isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), 999) : 0;
  }
  function goal(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) >= 1 && Math.floor(v) <= 20 ? Math.floor(v) : null;
  }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function sanitize(raw) {
    if (!isObj(raw)) return null;
    return { cups: count(raw.cups), cupGoal: goal(raw.cupGoal), tomatoes: count(raw.tomatoes), standups: count(raw.standups) };
  }
  function of(rec) {
    var h = rec && sanitize(rec.health);
    return h || { cups: 0, cupGoal: null, tomatoes: 0, standups: 0 };
  }
  function has(rec) {
    var h = of(rec);
    return h.cups > 0 || h.tomatoes > 0 || h.standups > 0;
  }
  function add(h, field, delta) {
    var out = sanitize(h) || of(null);
    if (FIELDS.indexOf(field) >= 0) out[field] = count(out[field] + (typeof delta === 'number' && isFinite(delta) ? delta : 0));
    return out;
  }
  function withHealth(rec, h) {
    var out = {};
    for (var k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) out[k] = rec[k];
    out.health = sanitize(h) || of(null);
    return out;
  }
  // A closed day keeps the goal it was played against: set it once, never overwrite.
  function seal(rec, g) {
    if (!rec || !isObj(rec.health)) return rec;
    var h = sanitize(rec.health);
    if (h.cupGoal !== null) return rec;
    h.cupGoal = goal(g);
    return withHealth(rec, h);
  }

  // The month grid of the 紀錄 health calendar (spec §4.7, §5.6). month 'YYYY-MM'; history {days}; today the live record
  // (its day key, its health); settings the sanitized settings. A cell is null outside the month, else
  // {day, d, blank, level 0..4, full, tomatoes, today}. A past day is judged against the goal it was sealed with, or
  // the current one when it has none (a 1.0 record), so a level is never NaN. Today always uses the current goal and
  // its live counts, and is never blank.
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function calendar(history, month, today, settings) {
    var y = parseInt(month.slice(0, 4), 10), mo = parseInt(month.slice(5, 7), 10), n = new Date(y, mo, 0).getDate();
    var cur = settings.health.water.goal, days = (history && history.days) || {};
    var todayKey = today && today.day, cells = [], cups = 0, tomatoes = 0;
    for (var i = new Date(y, mo - 1, 1).getDay(); i > 0; i--) cells.push(null);
    for (var d = 1; d <= n; d++) {
      var key = month + '-' + pad(d), isToday = key === todayKey;
      var rec = isToday ? today : Object.prototype.hasOwnProperty.call(days, key) ? days[key] : null;
      var cell = { day: key, d: d, blank: true, level: 0, full: false, tomatoes: 0, today: isToday };
      if (isToday || (rec && isObj(rec.health))) {
        var h = of(rec), g = isToday ? cur : (h.cupGoal || cur);
        cell.blank = false;
        cell.tomatoes = h.tomatoes;
        cell.full = h.cups >= g;
        cell.level = cell.full ? 4 : h.cups === 0 ? 0 : Math.min(3, 1 + Math.floor(3 * h.cups / g));
        cups += h.cups; tomatoes += h.tomatoes;
      }
      cells.push(cell);
    }
    while (cells.length % 7) cells.push(null);
    var weeks = [];
    for (var j = 0; j < cells.length; j += 7) weeks.push(cells.slice(j, j + 7));
    return { title: y + ' 年 ' + mo + ' 月', weeks: weeks, totals: { cups: cups, tomatoes: tomatoes }, goal: cur };
  }

  return { calendar: calendar, of: of, sanitize: sanitize, has: has, add: add, withHealth: withHealth, seal: seal };
})();
