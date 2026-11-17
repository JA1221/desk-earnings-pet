window.QJZ = window.QJZ || {};
// The reminder timer (spec §4.9, §5.1): one timer of working minutes shared by the 久坐 and 喝水 reminders. Pure: every
// function returns a new object and never reads the clock. Only working time counts (QJZ.earn.snapshot: not lunch, not
// before the start, not past the 8 h, not after a 下班, not on 今天休假), so a long gap is exact whatever happened in it.
//   R = {day, lastMs, ms, msBeforeBreak, snoozeUntil, forced, waterDone}
//   forced (1.1.1, 設定 →「現在提醒我一次」): the reminder is due now, whatever ms says. 等一下 snoozes it like any other;
//   whatever restarts the timer (an answer, a break, the end of lunch, a new day) ends it.
//   1.1.2: a lock is not a stand-up (item 9): there is no away state, and locked working time counts as sitting time.
//   等一下 is 5 minutes (item 8). waterDone (item 7): 喝了 on a bubble that asks both answered this round's water, so
//   until the timer restarts it asks 起來動 alone (while 起來動 is on; 等一下 keeps it).
//   health = {asked, every, sit:{on}, water:{on, goal}, pomodoro:{...}}  (settings.health; the caller sanitises it)
QJZ.reminders = (function () {
  var SNOOZE_MS = 300000;

  function snap(rec, settings, t) {
    var ended = rec && typeof rec.endMs === 'number' && rec.endMs <= t;
    return QJZ.earn.snapshot({
      startMs: rec ? rec.startMs : null, endMs: ended ? rec.endMs : null, nowMs: t, day: rec ? rec.day : null,
      salary: settings.salary, hoursPerDay: QJZ.settings.hours(settings), lunch: settings.lunch, offDay: !!(rec && rec.offDay)
    });
  }
  function workMs(rec, settings, fromMs, toMs) {
    if (!rec || !(toMs > fromMs)) return 0;
    var d = snap(rec, settings, toMs).workedSec - snap(rec, settings, fromMs).workedSec;
    return d > 0 ? Math.round(d * 1000) : 0;
  }
  function copy(r, o) { var n = {}; for (var k in r) n[k] = r[k]; for (var j in o) n[j] = o[j]; return n; }

  function initial(day, nowMs) {
    return { day: day, lastMs: nowMs, ms: 0, msBeforeBreak: 0, snoozeUntil: null, forced: false, waterDone: false };
  }

  function advance(r, nowMs, rec, settings) {
    if (!(nowMs > r.lastMs)) return nowMs < r.lastMs ? copy(r, { lastMs: nowMs }) : r;   // clock set back: no negative time
    var ms = r.ms, snoozeUntil = r.snoozeUntil, forced = !!r.forced, wd = !!r.waterDone;
    var l = rec ? QJZ.earn.lunchRange(rec.day, settings.lunch) : null;
    if (l && l.e > r.lastMs && l.e <= nowMs && typeof rec.startMs === 'number' && rec.startMs < l.e) {
      ms = workMs(rec, settings, l.e, nowMs);   // the end of lunch restarts the timer
      snoozeUntil = null;
      forced = wd = false;
    } else {
      ms += workMs(rec, settings, r.lastMs, nowMs);
    }
    return copy(r, { lastMs: nowMs, ms: ms, snoozeUntil: snoozeUntil, forced: forced, waterDone: wd });
  }

  function reset(r) { return copy(r, { ms: 0, snoozeUntil: null, forced: false, waterDone: false }); }
  function breakStarted(r) { return copy(r, { msBeforeBreak: r.ms, ms: 0, forced: false, waterDone: false }); }
  function breakSkipped(r) { return copy(r, { ms: r.ms + r.msBeforeBreak }); }
  function snooze(r, nowMs) { return copy(r, { snoozeUntil: nowMs + SNOOZE_MS }); }
  function force(r) { return copy(r, { forced: true, snoozeUntil: null, waterDone: false }); }
  function waterDone(r) { return copy(r, { waterDone: true }); }

  function ask(health, cups) {
    var on = !!health.asked;
    return { sit: on && !!health.sit.on, water: on && !!health.water.on && cups < health.water.goal };
  }
  // the water part already answered this round (waterDone) is not asked again while 起來動 is asked
  function due(r, nowMs, health, cups) {
    var a = ask(health, cups), water = a.water && !(r.waterDone && a.sit);
    var d = (a.sit || water) && (r.ms >= health.every * 60000 || !!r.forced) && !(r.snoozeUntil > nowMs);
    return { due: d, sit: a.sit, water: water };
  }
  function minutesToNext(r, health, cups) {
    var a = ask(health, cups);
    if (!a.sit && !a.water) return null;
    if (r.forced) return 0;
    return Math.max(0, Math.ceil((health.every * 60000 - r.ms) / 60000));
  }

  return {
    SNOOZE_MS: SNOOZE_MS, workMs: workMs, initial: initial, advance: advance, reset: reset, breakStarted: breakStarted,
    breakSkipped: breakSkipped, snooze: snooze, force: force, waterDone: waterDone, ask: ask, due: due, minutesToNext: minutesToNext
  };
})();
