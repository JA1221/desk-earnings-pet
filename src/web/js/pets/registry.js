window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Skin registry. Skin files call register(def) when they load; list(kind) keeps registration order
// (hamster p0,p4,h2,s4,s5 then cat p0,p4,h2,s4,s5 — the order the skin scripts are included).
// def = {id:'kind:skin', kind, skin, name, room:'sticker'|'flat'|'crayon', wrap:null|'crayon',
//        poses11: the 1.1 poses the skin draws (optional; see below),
//        build(uid) -> {defs, crop, seed, layers:{back, pre, front, post}, face}}  (face: see expressions.js)
//
// The 1.1 poses (spec §5.8): NEW_POSES. Until a skin declares one in its poses11, it shows its 1.0 stand-in, FALLBACK.
//   poseFor(id, state, preview) -> the state skin id shows for state: a new pose is itself only when QJZ.pets.states
//       has it and the skin declares it (or preview === true: the review page, Ruling R3), else its stand-in; any other
//       state is itself. compose draws this pose, and layouts keys the hit box, the bands and the bubble anchor by it.
//   missingPoses() -> 'kind:skin pose' for every hamster and cat skin and every new pose it does not declare.
(function (P) {
  var defs = [];
  P.NEW_POSES = ['wave', 'holdCup', 'sip', 'focus'];
  P.FALLBACK = { wave: 'celebrate', holdCup: 'coffee', sip: 'coffee', focus: 'typing' };

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

  function declares(def, pose) { return !!def && Array.isArray(def.poses11) && def.poses11.indexOf(pose) >= 0; }

  P.poseFor = function (id, state, preview) {
    if (!Object.prototype.hasOwnProperty.call(P.FALLBACK, state)) return state;
    var drawn = !!(P.states && P.states.get(state));
    return drawn && (preview === true || declares(P.get(id), state)) ? state : P.FALLBACK[state];
  };

  // The release check (Ruling R5): build.ps1 -Release refuses to build while any skin file lacks a poses11 line naming
  // all four, by a regex over src/web/js/pets/skins/*.js, since the build cannot run this. Keep the two in step.
  P.missingPoses = function () {
    var out = [];
    P.list('hamster').concat(P.list('cat')).forEach(function (d) {
      P.NEW_POSES.forEach(function (pose) { if (!declares(d, pose)) out.push(d.id + ' ' + pose); });
    });
    return out;
  };
})(QJZ.pets);
