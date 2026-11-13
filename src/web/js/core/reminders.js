window.QJZ = window.QJZ || {};
// The reminder timer (spec §4.9, §5.1): one timer of working minutes shared by the 久坐 and 喝水 reminders. Pure: every
// function returns a new object and never reads the clock. Only working time counts (QJZ.earn.snapshot: not lunch, not
// before the start, not past the 8 h, not after a 下班, not on 今天休假), so a long gap is exact whatever happened in it.
//   R = {day, lastMs, ms, away, awayMs, awayWorking, msBeforeBreak, snoozeUntil, forced}
//   forced (1.1.1, 設定 →「現在提醒我一次」): the reminder is due now, whatever ms says. 等一下 snoozes it like any other;
//   whatever restarts the timer (an answer, a break, a lock of 5 min, the end of lunch, a new day) ends it.
//   health = {asked, every, sit:{on}, water:{on, goal}, pomodoro:{...}}  (settings.health; the caller sanitises it)
QJZ.reminders = (function () {
  var AWAY_STANDUP_MS = 300000, SNOOZE_MS = 600000;

  function snap(rec, settings, t) {
    var ended = rec && typeof rec.endMs === 'number' && rec.endMs <= t;
    return QJZ.earn.snapshot({
      startMs: rec ? rec.startMs : null, endMs: ended ? rec.endMs : null, nowMs: t, day: rec ? rec.day : null,
      salary: settings.salary, hoursPerDay: settings.hoursPerDay, lunch: settings.lunch, offDay: !!(rec && rec.offDay)
    });
  }
  function workMs(rec, settings, fromMs, toMs) {
    if (!rec || !(toMs > fromMs)) return 0;
    var d = snap(rec, settings, toMs).workedSec - snap(rec, settings, fromMs).workedSec;
    return d > 0 ? Math.round(d * 1000) : 0;
  }
  function copy(r, o) { var n = {}; for (var k in r) n[k] = r[k]; for (var j in o) n[j] = o[j]; return n; }

  function initial(day, nowMs) {
    return { day: day, lastMs: nowMs, ms: 0, away: false, awayMs: 0, awayWorking: false, msBeforeBreak: 0, snoozeUntil: null, forced: false };
  }

  function advance(r, nowMs, rec, settings) {
    if (!(nowMs > r.lastMs)) return nowMs < r.lastMs ? copy(r, { lastMs: nowMs }) : r;   // clock set back: no negative time
    var ms = r.ms, snoozeUntil = r.snoozeUntil, forced = !!r.forced;
    var l = rec ? QJZ.earn.lunchRange(rec.day, settings.lunch) : null;
    if (l && l.e > r.lastMs && l.e <= nowMs && typeof rec.startMs === 'number' && rec.startMs < l.e) {
      ms = r.away ? 0 : workMs(rec, settings, l.e, nowMs);   // the end of lunch restarts the timer
      snoozeUntil = null;
      forced = false;
    } else if (!r.away) {
      ms += workMs(rec, settings, r.lastMs, nowMs);
    }
    return copy(r, { lastMs: nowMs, ms: ms, snoozeUntil: snoozeUntil, forced: forced });
  }

  function goAway(r, ms, rec, settings) {
    if (r.away) return r;
    var a = advance(r, ms, rec, settings);
    return copy(a, { away: true, awayMs: ms, awayWorking: snap(rec, settings, ms).status === 'working' });
  }

  function comeBack(r, ms, rec, settings) {
    if (!r.away) return { r: r, standup: false };
    var a = copy(advance(r, ms, rec, settings), { away: false });
    if (ms - r.awayMs >= AWAY_STANDUP_MS && r.awayWorking) return { r: copy(a, { ms: 0, snoozeUntil: null, forced: false }), standup: true };
    return { r: a, standup: false };
  }

  function reset(r) { return copy(r, { ms: 0, snoozeUntil: null, forced: false }); }
  function breakStarted(r) { return copy(r, { msBeforeBreak: r.ms, ms: 0, forced: false }); }
  function breakSkipped(r) { return copy(r, { ms: r.ms + r.msBeforeBreak }); }
  function snooze(r, nowMs) { return copy(r, { snoozeUntil: nowMs + SNOOZE_MS }); }
  function force(r) { return copy(r, { forced: true, snoozeUntil: null }); }

  function ask(health, cups) {
    var on = !!health.asked;
    return { sit: on && !!health.sit.on, water: on && !!health.water.on && cups < health.water.goal };
  }
  function due(r, nowMs, health, cups) {
    var a = ask(health, cups);
    var d = (a.sit || a.water) && (r.ms >= health.every * 60000 || !!r.forced) && !(r.snoozeUntil > nowMs);
    return { due: d, sit: a.sit, water: a.water };
  }
  function minutesToNext(r, health, cups) {
    var a = ask(health, cups);
    if (!a.sit && !a.water) return null;
    if (r.forced) return 0;
    return Math.max(0, Math.ceil((health.every * 60000 - r.ms) / 60000));
  }

  return {
    AWAY_STANDUP_MS: AWAY_STANDUP_MS, SNOOZE_MS: SNOOZE_MS, workMs: workMs, initial: initial, advance: advance,
    goAway: goAway, comeBack: comeBack, reset: reset, breakStarted: breakStarted, breakSkipped: breakSkipped,
    snooze: snooze, force: force, ask: ask, due: due, minutesToNext: minutesToNext
  };
})();
