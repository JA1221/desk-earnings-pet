window.QJZ = window.QJZ || {};
QJZ.history = (function () {
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function emptyHistory() { return { version: 1, days: {} }; }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // Same rules as settings.parse: empty / "null" / non-object JSON -> empty, not corrupted; invalid JSON -> corrupted.
  function parse(text) {
    if (text === null || text === undefined || String(text).replace(/\s+/g, '') === '') {
      return { history: emptyHistory(), corrupted: false };
    }
    var raw;
    try { raw = JSON.parse(String(text)); }
    catch (e) { return { history: emptyHistory(), corrupted: true }; }
    var h = emptyHistory();
    if (isObj(raw) && isObj(raw.days)) {
      for (var k in raw.days) {
        if (k === '__proto__' || !Object.prototype.hasOwnProperty.call(raw.days, k) || !DAY_RE.test(k) || !isObj(raw.days[k])) continue;
        var rec = {};
        for (var f in raw.days[k]) if (f !== '__proto__' && Object.prototype.hasOwnProperty.call(raw.days[k], f)) rec[f] = raw.days[k][f];
        rec.day = k;
        if (typeof rec.earned !== 'number' || !isFinite(rec.earned)) rec.earned = null;
        h.days[k] = rec;
      }
    }
    return { history: h, corrupted: false };
  }

  // Fill `earned` (rounded to cents) from the record's end: manual/confirmed end, else the planned end (8 h cap).
  function closeDay(rec, settings) {
    var out = {};
    for (var k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) out[k] = rec[k];
    var earned = 0;
    if (typeof rec.startMs === 'number') {
      var planned = QJZ.earn.endAtMs(rec.startMs, rec.day, settings.hoursPerDay, settings.lunch);
      var snap = QJZ.earn.snapshot({
        startMs: rec.startMs, endMs: rec.endMs === undefined ? null : rec.endMs,
        nowMs: planned, day: rec.day, salary: settings.salary,
        hoursPerDay: settings.hoursPerDay, lunch: settings.lunch
      });
      earned = Math.round(snap.earned * 100) / 100;
    }
    out.earned = earned;
    return out;
  }

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  function monthDays(history, month) {
    var list = [];
    for (var k in history.days) {
      if (Object.prototype.hasOwnProperty.call(history.days, k) && k.slice(0, 7) === month) {
        list.push({ day: k, earned: num(history.days[k].earned) });
      }
    }
    list.sort(function (a, b) { return a.day < b.day ? -1 : (a.day > b.day ? 1 : 0); });
    return list;
  }

  // Closed days of the month plus today's live amount (today is never double counted).
  function monthTotal(history, month, today, todayEarned) {
    var total = 0, list = monthDays(history, month);
    for (var i = 0; i < list.length; i++) {
      if (today && list[i].day === today.day) continue;
      total += list[i].earned;
    }
    if (today && typeof today.day === 'string' && today.day.slice(0, 7) === month) total += num(todayEarned);
    return total;
  }

  function monthTotals(history) {
    var sums = {}, months = [];
    for (var k in history.days) {
      if (!Object.prototype.hasOwnProperty.call(history.days, k)) continue;
      var m = k.slice(0, 7);
      if (!(m in sums)) { sums[m] = 0; months.push(m); }
      sums[m] += num(history.days[k].earned);
    }
    months.sort().reverse();
    return months.map(function (m) { return { month: m, total: sums[m] }; });
  }

  return { parse: parse, closeDay: closeDay, monthTotal: monthTotal, monthDays: monthDays, monthTotals: monthTotals };
})();
