window.QJZ = window.QJZ || {};
QJZ.earn = (function () {
  function rates(salary, hoursPerDay) {
    var h = hoursPerDay > 0 ? hoursPerDay : 8;
    var amount = salary.amount > 0 ? salary.amount : 0;
    var divisor = salary.divisor > 0 ? salary.divisor : 22;
    var daily, hourly;
    if (salary.mode === 'hourly') { hourly = amount; daily = amount * h; }
    else { daily = amount / divisor; hourly = daily / h; }
    return { daily: daily, hourly: hourly, perSecond: hourly / 3600 };
  }

  // Lunch window in epoch ms, or null when malformed / empty / reversed.
  function lunchRange(day, lunch) {
    if (!lunch) return null;
    var s = QJZ.time.parseHM(lunch.start), e = QJZ.time.parseHM(lunch.end);
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    return { s: QJZ.time.atMinutes(day, s), e: QJZ.time.atMinutes(day, e) };
  }

  function workedSeconds(startMs, untilMs, day, lunch) {
    if (typeof startMs !== 'number' || typeof untilMs !== 'number' || !(untilMs > startMs)) return 0;
    var elapsed = untilMs - startMs;
    var l = lunchRange(day, lunch);
    if (l) {
      var overlap = Math.min(untilMs, l.e) - Math.max(startMs, l.s);
      if (overlap > 0) elapsed -= overlap;
    }
    return elapsed / 1000;
  }

  function endAtMs(startMs, day, hoursPerDay, lunch) {
    var end = startMs + hoursPerDay * 3600 * 1000;
    var l = lunchRange(day, lunch);
    if (l && startMs < l.e && end > l.s) end += l.e - Math.max(startMs, l.s);
    return end;
  }

  function snapshot(p) {
    var target = p.hoursPerDay * 3600;
    var r = rates(p.salary, p.hoursPerDay);
    var hasStart = typeof p.startMs === 'number';
    var ended = p.endMs !== null && p.endMs !== undefined;
    var worked = 0, status = 'before', end = null;
    if (hasStart) {
      end = endAtMs(p.startMs, p.day, p.hoursPerDay, p.lunch);
      var until = ended ? p.endMs : p.nowMs;
      worked = Math.min(workedSeconds(p.startMs, until, p.day, p.lunch), target);
      var l = lunchRange(p.day, p.lunch);
      if (ended) status = 'ended';
      else if (p.nowMs < p.startMs) status = 'before';
      else if (worked >= target) status = 'done';
      else if (l && p.nowMs >= l.s && p.nowMs < l.e) status = 'lunch';
      else status = 'working';
    }
    return {
      status: status,
      workedSec: worked,
      earned: worked * r.perSecond,
      pct: target > 0 ? worked / target : 0,
      remainingSec: !hasStart ? target : (ended ? 0 : Math.max(0, target - worked)),
      endAtMs: end
    };
  }

  return { rates: rates, lunchRange: lunchRange, workedSeconds: workedSeconds, endAtMs: endAtMs, snapshot: snapshot };
})();
