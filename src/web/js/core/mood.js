window.QJZ = window.QJZ || {};
// 心情 / 體力 (spec §4.6): energy drains while working (100 -> 40 over 8 h) and comes back at lunch; mood drifts
// towards 50 and goes up with petting and feeding. Pure: every function returns a new {energy, mood}, 0..100.
//   tick(m, dtSec, status)  status 'working' | 'lunch' moves energy; every status drifts the mood
//   advance(m, fromMs, toMs, day)  the same over a stretch of the wall clock, split at the lunch edges so work and
//        lunch apply in order; how much of it was work or lunch comes from the day's record (QJZ.earn), so a window
//        that was hidden for hours catches up exactly. day = {day, startMs, endMs, hoursPerDay, lunch}.
QJZ.mood = (function () {
  var DRAIN = 60 / 28800, REST = 30 / 3600, DRIFT = 10 / 3600, CALM = 50;

  function clamp(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }
  function initial() { return { energy: 100, mood: 70 }; }

  function tick(m, dtSec, status) {
    if (!(dtSec > 0)) return m;
    var e = m.energy;
    if (status === 'working') e -= DRAIN * dtSec;
    else if (status === 'lunch') e += REST * dtSec;
    var d = DRIFT * dtSec, md = m.mood;
    md = md > CALM ? Math.max(CALM, md - d) : Math.min(CALM, md + d);
    return { energy: clamp(e), mood: clamp(md) };
  }

  function pet(m) { return { energy: m.energy, mood: clamp(m.mood + 5) }; }
  function annoy(m) { return { energy: m.energy, mood: clamp(m.mood - 5) }; }
  function feed(m) { return { energy: clamp(m.energy + 10), mood: clamp(m.mood + 15) }; }
  function five(v) { return Math.max(0, Math.min(5, Math.round(v / 20))); }
  function hearts(m) { return five(m.mood); }
  function bolts(m) { return five(m.energy); }

  // Seconds worked and seconds of lunch break (taken while the day was running) from the start to t.
  function worked(day, t) {
    if (typeof day.startMs !== 'number' || !(t > day.startMs)) return 0;
    var until = typeof day.endMs === 'number' ? Math.min(t, day.endMs) : t;
    return Math.min(QJZ.earn.workedSeconds(day.startMs, until, day.day, day.lunch), day.hoursPerDay * 3600);
  }
  function lunchTaken(day, t) {
    if (typeof day.startMs !== 'number') return 0;
    var until = Math.min(t, QJZ.earn.endAtMs(day.startMs, day.day, day.hoursPerDay, day.lunch));
    if (typeof day.endMs === 'number') until = Math.min(until, day.endMs);
    if (!(until > day.startMs)) return 0;
    return Math.max(0, (until - day.startMs) / 1000 - QJZ.earn.workedSeconds(day.startMs, until, day.day, day.lunch));
  }

  function advance(m, fromMs, toMs, day) {
    if (!(toMs > fromMs)) return m;
    var cuts = [fromMs], l = QJZ.earn.lunchRange(day.day, day.lunch);
    if (l) [l.s, l.e].forEach(function (c) { if (c > fromMs && c < toMs) cuts.push(c); });
    cuts.push(toMs);
    for (var i = 1; i < cuts.length; i++) {
      var a = cuts[i - 1], b = cuts[i];
      var w = Math.max(0, worked(day, b) - worked(day, a)), lu = Math.max(0, lunchTaken(day, b) - lunchTaken(day, a));
      m = tick(m, w, 'working');
      m = tick(m, lu, 'lunch');
      m = tick(m, Math.max(0, (b - a) / 1000 - w - lu), 'other');
    }
    return m;
  }

  return { initial: initial, tick: tick, pet: pet, annoy: annoy, feed: feed, hearts: hearts, bolts: bolts, advance: advance };
})();
