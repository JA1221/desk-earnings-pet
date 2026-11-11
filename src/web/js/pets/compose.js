window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// compose(id, view, opts) -> SVG string. Views match the prototype sceneSVG / petOnlySVG / avatarSVG:
//   scene   — the whole office room (viewBox 0 0 300 200, or opts.viewBox)
//   petonly — the pet at a small desk strip, no room (viewBox PETONLY: the prototype's 38 18 160 154 widened
//             so jumps, coins, hearts and the dangling pose stay inside, the same for every skin and state)
//   avatar  — portrait cropped to the skin's crop: back + pre + post layers, no desk and no front paws;
//             shows the state's face, head motion and head props but no whole-body pose
// opts: {state:'typing', expression, mouth, props, viewBox}
//   state      — a name from QJZ.pets.states (unknown names fall back to 'typing'); picks pose, face, arms, props
//   expression — eyes, overrides the state's (and drops its second-frame eyes); mouth likewise
//   props      — array of prop names, replaces the state's props ([] for none); a held prop brings holding paws
// The root <svg> carries .pet-svg and .st-<state>, plus per-skin pivots --hx/--hy (head) and --gx/--gy (dangle).
// Every call gets a fresh uid, so ids never collide between SVGs.
QJZ.pets.compose = (function () {
  var P = QJZ.pets, C = P.common, seq = 0;
  var PETONLY = '30 4 176 170';
  var SLOT = /<!--(EYES|MOUTH|OVER)-->/g;

  // skin render wrapper around each pet layer (prototype PW): crayon skins get grain + wobble
  function wrap(mode, uid, layer) {
    if (!layer) return '';
    return mode === 'crayon' ? '<g filter="url(#' + uid + '-crayon)">' + layer + '</g>' : layer;
  }

  function fill(layer, slots) {
    return layer ? layer.replace(SLOT, function (m, k) { return slots[k]; }) : '';
  }

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  function bod(m) { return m ? '<g class="bod">' + m + '</g>' : ''; }

  return function compose(id, view, opts) {
    var def = P.get(id);
    if (!def) throw new Error('unknown pet: ' + id);
    if (view !== 'scene' && view !== 'petonly' && view !== 'avatar') throw new Error('unknown view: ' + view);
    opts = opts || {};
    var name = P.states.get(opts.state) ? opts.state : 'typing', st = P.states.get(name), alt = st.alt || {};
    var uid = 'pet' + (seq++);
    var b = def.build(uid), face = b.face, rig = b.rig;
    var line = P.room.line(def.room);
    var pose = view === 'avatar' ? 'desk' : (st.pose || 'desk');
    var pl = pose === 'desk' ? null : b.poses[pose];

    // face: the state's eyes (+ an optional second frame), the happy eyes for .happy, and the mouth
    var ex = opts.expression || st.eyes, mo = opts.mouth || st.mouth;
    var altEx = opts.expression ? null : alt.eyes, altMo = opts.mouth ? null : alt.mouth;
    function E(x) { return P.expr.eyes(face, x, uid); }
    var eyes = '<g class="look"><g class="eyes-open">' + E(ex) + '</g>' + (altEx ? '<g class="eyes-alt">' + E(altEx) + '</g>' : '') +
      '<g class="eyes-happy">' + E('happy') + '</g></g>';
    var mouth = altMo ? '<g class="mouth-a">' + P.expr.mouth(face, mo) + '</g><g class="mouth-b" style="transform-origin:' + face.mouth[0] + 'px ' + face.mouth[1] + 'px">' +
      P.expr.mouth(face, altMo) + '</g>' :
      P.expr.mouth(face, mo);

    // props, sorted into their slots
    var names = Array.isArray(opts.props) ? opts.props : st.props;
    var ctx = { uid: uid, mode: def.room, L: line[0], kind: def.kind, rig: pl && pl.anchors ? merge(rig, pl.anchors) : rig, face: face };
    var pr = { back: '', desk: '', held: '', over: '', face: '', top: '' }, held = false;
    names.forEach(function (nm) {
      var d = P.props.draw(nm, ctx);
      for (var k in d) pr[k] += d[k];
      if (P.props.HELD.indexOf(nm) >= 0) held = true;
    });

    // arms (desk pose only: the lying and dangling drawings bring their own)
    var arms = { back: '', front: '', over: '' }, mode = held ? 'hold' : st.arms;
    if (pose === 'desk') {
      var a = P.rig.arms(rig, mode), z = alt.arms ? P.rig.arms(rig, alt.arms) : null;
      ['back', 'front', 'over'].forEach(function (k) {
        if (!z) arms[k] = a[k] || '';
        else arms[k] = (a[k] ? '<g class="pose-a">' + a[k] + '</g>' : '') + (z[k] ? '<g class="pose-b">' + z[k] + '</g>' : '');
      });
    }
    var over = pr.over + (mode === 'hold' && pose === 'desk' ? '<g class="held" style="transform-origin:' + rig.hold[0] + 'px ' + rig.hold[1] + 'px">' + pr.held + arms.over + '</g>' : arms.over);
    var slots = { EYES: eyes, MOUTH: mouth + pr.face, OVER: over };
    function layer(s) { return wrap(def.wrap, uid, fill(s, slots)); }
    function extra(m) { return wrap(def.wrap, uid, m); }

    var style = '--hx:' + rig.pivot[0] + 'px;--hy:' + rig.pivot[1] + 'px;--gx:' + rig.grab[0] + 'px;--gy:' + rig.grab[1] + 'px';
    var open = '<svg xmlns="http://www.w3.org/2000/svg" class="pet-svg st-' + name + '" ';
    var defs = C.defs(uid) + (b.defs || '');
    var L = b.layers;

    if (view === 'avatar') {
      return open + 'viewBox="' + b.crop + '" style="width:100%;height:100%;' + style + '"><defs>' + defs + '</defs>' +
        layer(pr.back + arms.back + (L.back || '')) + layer(L.pre) + layer(L.post) + extra(pr.top) + '</svg>';
    }

    var seed = b.seed ? wrap(def.wrap, uid, C.seed(line[0])) : '';
    var behind, front;   // pet parts behind the desk / in front of it
    if (pl) {
      behind = '';
      front = layer(pr.back + (pl.back || '')) + layer(pl.pre) + layer(pl.front) + layer(pl.post);
    } else {
      behind = bod(layer(pr.back + arms.back + (L.back || '')) + layer(L.pre));
      front = bod(layer(arms.front) + layer(L.post));
    }
    var desk = seed + extra(pr.desk);

    if (view === 'petonly') {
      return open + 'viewBox="' + PETONLY + '" style="' + style + '"><defs>' + defs + '</defs>' +
        behind + P.room.miniDesk(uid, def.room) + desk + front + extra(pr.top) + '</svg>';
    }
    var r = P.room.build(uid, def.room);
    return open + 'viewBox="' + (opts.viewBox || '0 0 300 200') + '" preserveAspectRatio="xMidYMid slice" style="' + style + '"><defs>' + defs + r.defs + '</defs>' +
      r.before + behind + r.desk + desk + front + extra(pr.top) + r.paper + '</svg>';
  };
})();
