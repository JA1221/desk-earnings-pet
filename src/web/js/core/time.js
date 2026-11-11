window.QJZ = window.QJZ || {};
QJZ.time = (function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // "HH:MM" -> minutes since midnight; NaN when malformed.
  function parseHM(s) {
    var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s));
    if (!m) return NaN;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return NaN;
    return h * 60 + mi;
  }

  // Local "YYYY-MM-DD"; times before boundaryHour belong to the previous date.
  function dayKey(ms, boundaryHour) {
    var b = boundaryHour === undefined ? 4 : boundaryHour;
    var d = new Date(ms);
    var y = d.getFullYear(), mo = d.getMonth(), da = d.getDate();
    if (d.getHours() < b) {
      var p = new Date(y, mo, da - 1);
      y = p.getFullYear(); mo = p.getMonth(); da = p.getDate();
    }
    return y + '-' + pad(mo + 1) + '-' + pad(da);
  }

  function parseDay(day) {
    var p = String(day).split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10) - 1, d: parseInt(p[2], 10) };
  }

  // Epoch ms of local midnight of `day` plus `minutes`.
  function atMinutes(day, minutes) {
    var p = parseDay(day);
    return new Date(p.y, p.m, p.d, 0, minutes).getTime();
  }

  // 0 = Sunday.
  function weekday(day) {
    var p = parseDay(day);
    return new Date(p.y, p.m, p.d).getDay();
  }

  return { parseHM: parseHM, dayKey: dayKey, atMinutes: atMinutes, weekday: weekday };
})();
