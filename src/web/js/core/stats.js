window.QJZ = window.QJZ || {};
// 紀錄 → 統計 (1.1.5 item 2): one item over this week or this month, a value per day, from the history as it is stored.
// Pure: the caller passes today's live record and amount.
//   PERIODS  'week' (Monday to Sunday, the week of today) | 'month' (the 1st to the last day of today's month).
//   METRICS  'earned' (收入: a closed day's earned; today the live amount), 'cups' (喝水), 'standups' (起來動),
//            'tomatoes' (番茄) — the counts of the day's health record (QJZ.health), today's live ones.
//   series(history, today, todayEarned, period, metric, offset) -> {period, metric, offset, from, to, current, days,
//     total, avg, avgDays, max}. offset (1.1.5 review: ◀ ▶) is how many weeks / months back from today's (0, -1, …; a
//     positive one counts as 0); current: the period holds today. A past period has no today and nothing in the future.
//     days: one per date of the period, {day, d (date), wd (0 = Sunday), v, today, future}. v is null where nothing was
//     recorded (no record, an open record for 收入, no health record for a count) and on the days after today; today is
//     always a number (0 before anything happens).
//     total: the sum of every v, today included (the 本月累計 chip's sum for 收入).
//     avg: the mean over the days with data, i.e. v > 0, today left out while it is still going; avgDays how many
//     there are. null when there are none.
//     max: the biggest v (0 when none).
//   earliest(history, period, todayKey) -> the offset (0 or less) of the earliest period with any record in history.
//   top(max, metric)  the round top of the chart's scale: 收入 as QJZ.panels' niceMax; a count an even whole number,
//     so its middle line is a whole number too.
QJZ.stats = (function () {
  var PERIODS = ['week', 'month'], METRICS = ['earned', 'cups', 'standups', 'tomatoes'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateOf(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  // The day offset periods from the one that holds todayKey: its Monday (week) or its 1st (month).
  function anchor(period, todayKey, offset) {
    var t = dateOf(todayKey), n = Math.min(0, Math.floor(offset || 0));
    if (period === 'week') return keyOf(new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getDay() + 6) % 7 + 7 * n));
    return keyOf(new Date(t.getFullYear(), t.getMonth() + n, 1));
  }
  function earliest(history, period, todayKey) {
    var days = (history && history.days) || {}, first = null;
    for (var k in days) if (Object.prototype.hasOwnProperty.call(days, k) && /^\d{4}-\d{2}-\d{2}$/.test(k) && (first === null || k < first)) first = k;
    if (first === null || first >= todayKey) return 0;
    var a = dateOf(range(period, first)[0]), b = dateOf(range(period, todayKey)[0]);
    if (period === 'week') return -Math.round((b - a) / (7 * 86400000));
    return (a.getFullYear() * 12 + a.getMonth()) - (b.getFullYear() * 12 + b.getMonth());
  }

  // The dates of the period that holds todayKey, in order.
  function range(period, todayKey) {
    var t = dateOf(todayKey), first, n;
    if (period === 'week') {
      first = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getDay() + 6) % 7);
      n = 7;
    } else {
      first = new Date(t.getFullYear(), t.getMonth(), 1);
      n = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    }
    var out = [];
    for (var i = 0; i < n; i++) out.push(keyOf(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)));
    return out;
  }

  function pastValue(rec, metric) {
    if (!rec) return null;
    if (metric === 'earned') return isNum(rec.earned) ? rec.earned : null;
    return isObj(rec.health) ? QJZ.health.of(rec)[metric] : null;
  }
  function todayValue(today, todayEarned, metric) {
    if (metric === 'earned') return isNum(todayEarned) && todayEarned > 0 ? todayEarned : 0;
    return QJZ.health.of(today)[metric];
  }

  function series(history, today, todayEarned, period, metric, offset) {
    period = PERIODS.indexOf(period) >= 0 ? period : 'month';
    metric = METRICS.indexOf(metric) >= 0 ? metric : 'earned';
    offset = Math.min(0, Math.floor(isNum(offset) ? offset : 0));
    var days = (history && history.days) || {}, todayKey = today.day, keys = range(period, anchor(period, todayKey, offset));
    var list = [], total = 0, max = 0, sum = 0, avgDays = 0;
    keys.forEach(function (key) {
      var isToday = key === todayKey, future = key > todayKey, v = null;
      if (isToday) v = todayValue(today, todayEarned, metric);
      else if (!future) v = pastValue(Object.prototype.hasOwnProperty.call(days, key) ? days[key] : null, metric);
      var dt = dateOf(key);
      list.push({ day: key, d: dt.getDate(), wd: dt.getDay(), v: v, today: isToday, future: future });
      if (v === null) return;
      total += v;
      if (v > max) max = v;
      if (!isToday && v > 0) { sum += v; avgDays++; }
    });
    return { period: period, metric: metric, offset: offset, from: keys[0], to: keys[keys.length - 1], current: offset === 0,
      days: list, total: total,
      avg: avgDays ? sum / avgDays : null, avgDays: avgDays, max: max };
  }

  function niceMax(v) {
    if (!(v > 0)) return 100;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10 + 1e-9)), steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v - 1e-9) return steps[i] * p;
    return 10 * p;
  }
  function top(max, metric) {
    if (metric === 'earned') return niceMax(max);
    if (!(max > 0)) return 4;
    var t = niceMax(Math.max(max, 2));
    while (t % 2) t = niceMax(t + 1e-6);
    return t;
  }

  return { PERIODS: PERIODS, METRICS: METRICS, range: range, series: series, earliest: earliest, top: top, niceMax: niceMax };
})();
