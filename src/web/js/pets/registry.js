window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Skin registry. Skin files call register(def) when they load; list(kind) keeps registration order
// (hamster p0,p4,h2,s4,s5 then cat p0,p4,s5 — the order the skin scripts are included).
// def = {id:'kind:skin', kind, skin, name, room:'sticker'|'flat'|'crayon', wrap:null|'crayon',
//        build(uid) -> {defs, crop, seed, layers:{back, pre, front, post}, face}}  (face: see expressions.js)
(function (P) {
  var defs = [];

  P.register = function (def) {
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].id === def.id) { defs[i] = def; return; }
    }
    defs.push(def);
  };

  P.list = function (kind) {
    return defs.filter(function (d) { return d.kind === kind; });
  };

  P.get = function (id) {
    for (var i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i];
    return null;
  };
})(QJZ.pets);
