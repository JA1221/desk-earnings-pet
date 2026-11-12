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

  return { of: of, sanitize: sanitize, has: has, add: add, withHealth: withHealth, seal: seal };
})();
