window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// compose(id, view, opts) -> SVG string. Views match the prototype sceneSVG / petOnlySVG / avatarSVG:
//   scene   — the whole office room (viewBox 0 0 300 200, or opts.viewBox), pet typing at the desk
//   petonly — the pet at a small desk strip, no room (viewBox 38 18 160 154)
//   avatar  — portrait cropped to the skin's crop: back + pre + post layers, no desk and no typing paws
// opts: {state:'typing', expression:'open', mouth:'neutral', props:[], viewBox}. Task 9 draws the typing state;
// Task 12 adds the other states and props. Every call gets a fresh uid, so ids never collide between SVGs.
QJZ.pets.compose = (function () {
  var P = QJZ.pets, C = P.common, seq = 0;
  var OPEN = '<svg xmlns="http://www.w3.org/2000/svg" class="pet-svg" ';

  // skin render wrapper around each pet layer (prototype PW): crayon skins get grain + wobble
  function wrap(mode, uid, layer) {
    if (!layer) return '';
    return mode === 'crayon' ? '<g filter="url(#' + uid + '-crayon)">' + layer + '</g>' : layer;
  }

  function fill(layer, eyes, mouth) {
    return layer.replace('<!--EYES-->', function () { return eyes; }).replace('<!--MOUTH-->', function () { return mouth; });
  }

  return function compose(id, view, opts) {
    var def = P.get(id);
    if (!def) throw new Error('unknown pet: ' + id);
    if (view !== 'scene' && view !== 'petonly' && view !== 'avatar') throw new Error('unknown view: ' + view);
    opts = opts || {};
    var uid = 'pet' + (seq++);
    var b = def.build(uid), face = b.face;
    // eyes-open shows the chosen expression; eyes-happy is what .pet-svg.happy switches to
    var eyes = '<g class="look"><g class="eyes-open">' + P.expr.eyes(face, opts.expression || 'open', uid) +
      '</g><g class="eyes-happy">' + P.expr.eyes(face, 'happy', uid) + '</g></g>';
    var mouth = P.expr.mouth(face, opts.mouth || 'neutral');
    function layer(name) { return wrap(def.wrap, uid, fill(b.layers[name] || '', eyes, mouth)); }
    function seed(L) { return b.seed ? wrap(def.wrap, uid, C.seed(L)) : ''; }
    var defs = b.defs || '';

    if (view === 'avatar') {
      return OPEN + 'viewBox="' + b.crop + '" style="width:100%;height:100%"><defs>' + C.defs(uid) + defs + '</defs>' +
        layer('back') + layer('pre') + layer('post') + '</svg>';
    }
    if (view === 'petonly') {
      return OPEN + 'viewBox="38 18 160 154"><defs>' + C.defs(uid) + defs + '</defs>' +
        layer('back') + layer('pre') + P.room.miniDesk(uid, def.room) + seed(P.room.line(def.room)[0]) + layer('front') + layer('post') + '</svg>';
    }
    var r = P.room.build(uid, def.room);
    return OPEN + 'viewBox="' + (opts.viewBox || '0 0 300 200') + '" preserveAspectRatio="xMidYMid slice"><defs>' + C.defs(uid) + r.defs + defs + '</defs>' +
      r.before + layer('back') + layer('pre') + r.desk + seed(r.L) + layer('front') + layer('post') + r.paper + '</svg>';
  };
})();
