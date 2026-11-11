window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Eye and mouth slots. Skins describe their face (where the eyes/mouth sit and how they look); these
// renderers draw the eyes and mouth into the <!--EYES--> / <!--MOUTH--> slots of the skin's head group.
//
// face = {
//   eyes: [[x,y],[x,y]],   eye centres
//   eyeR: number,          eye size: horizontal radius for 'q'/'ham', radius for the round styles
//   eyeStyle: 'q'|'ham'|'gloss'|'dot'|'flat'|'crayon',
//   mouth: [x,y],          top centre of the mouth
//   ink: string,           line colour of eyes/mouth
//   arc: [w, sw],          happy ^^ arc half-width and stroke width
//   mouthStyle: 'w'|'y',   ω mouth, or the P0 hamster's Y mouth
//   mouthSize: [w, h],     ω: half-width and curve control depth ('y' draws its own fixed shape; size is its extent)
//   mouthSW: number,       mouth stroke width
//   iris: string,          'q' only: iris colour
//   hl: number             'flat'/'crayon' only: highlight radius (also its offset)
// }
// Expressions: 'open' (the skin's own eyes) and 'happy'; mouths: 'neutral' (the skin's own mouth).
// Task 12 adds closed/sleepy/angry/surprised and smile/open/chew/yawn/pout; until then unknown names fall back.
QJZ.pets.expr = (function () {
  var C = QJZ.pets.common;

  function n(v) { return Math.round(v * 1000) / 1000; }   // keep coordinates free of float noise

  // P0 cat: big anime eye with coloured iris
  function qEye(cx, cy, s, iris) {
    return `<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${n(8.5 * s)}" ry="${n(10.5 * s)}" fill="#2E2220"/><ellipse cx="${cx}" cy="${n(cy + 3.8 * s)}" rx="${n(6 * s)}" ry="${n(5.4 * s)}" fill="${iris}" opacity=".92"/><ellipse cx="${n(cx + 2.6 * s)}" cy="${n(cy - 4.2 * s)}" rx="${n(3.6 * s)}" ry="${n(3.2 * s)}" fill="#fff"/><circle cx="${n(cx - 3.2 * s)}" cy="${n(cy + 4.6 * s)}" r="${n(1.6 * s)}" fill="#fff"/><circle cx="${n(cx + 4.2 * s)}" cy="${n(cy + 2.4 * s)}" r="${n(0.9 * s)}" fill="#fff" opacity=".9"/></g>`;
  }

  // P0 hamster: black glossy eye with sparkle
  function hamEye(cx, cy, uid, s) {
    return `<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${n(7.6 * s)}" ry="${n(8.6 * s)}" fill="url(#${uid}-geye)"/><ellipse cx="${n(cx + 2.4 * s)}" cy="${n(cy - 3.2 * s)}" rx="${n(3.1 * s)}" ry="${n(2.8 * s)}" fill="#fff"/><circle cx="${n(cx - 2.8 * s)}" cy="${n(cy + 3.6 * s)}" r="${n(1.4 * s)}" fill="#fff"/><path d="${C.star4(n(cx + 3.6 * s), n(cy + 2.4 * s), n(1.5 * s))}" fill="#fff" opacity=".9"/></g>`;
  }

  // H2 hamster: small glossy round eye
  function glossy(cx, cy, r, uid) {
    return `<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}-geye)"/><ellipse cx="${n(cx + r * 0.32)}" cy="${n(cy - r * 0.36)}" rx="${n(r * 0.38)}" ry="${n(r * 0.33)}" fill="#fff"/><circle cx="${n(cx - r * 0.4)}" cy="${n(cy + r * 0.42)}" r="${n(r * 0.16)}" fill="#fff" opacity=".85"/></g>`;
  }

  // P4 skins: tiny dot eye
  function dot(cx, cy, r, ink) {
    return `<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/><circle cx="${n(cx + r * 0.35)}" cy="${n(cy - r * 0.35)}" r="${n(r * 0.34)}" fill="#fff"/></g>`;
  }

  // S4 / S5 skins: solid round eye with one highlight
  function solid(cx, cy, r, hl, ink) {
    return `<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/><circle cx="${n(cx + hl)}" cy="${n(cy - hl)}" r="${hl}" fill="#fff"/></g>`;
  }

  function openEye(face, p, uid) {
    var x = p[0], y = p[1], r = face.eyeR;
    switch (face.eyeStyle) {
      case 'q': return qEye(x, y, r / 8.5, face.iris);
      case 'ham': return hamEye(x, y, uid, r / 7.6);
      case 'gloss': return glossy(x, y, r, uid);
      case 'dot': return dot(x, y, r, face.ink);
      default: return solid(x, y, r, face.hl, face.ink);   // 'flat', 'crayon'
    }
  }

  // ^^ closed happy arc (prototype happyArc, drawn 1 unit below the eye centre)
  function happyEye(face, p) {
    var w = face.arc[0], cx = p[0], cy = p[1] + 1;
    return `<path d="M${n(cx - w)},${n(cy + 2)} q${w},${n(-w * 1.25)} ${n(w * 2)},0" fill="none" stroke="${face.ink}" stroke-width="${face.arc[1]}" stroke-linecap="round"/>`;
  }

  // both eyes for an expression
  function eyes(face, expression, uid) {
    var one = expression === 'happy' ? function (p) { return happyEye(face, p); } : function (p) { return openEye(face, p, uid); };
    return one(face.eyes[0]) + one(face.eyes[1]);
  }

  // the mouth for a mouth name
  function mouth(face, name) {
    var x = face.mouth[0], y = face.mouth[1], d;
    if (face.mouthStyle === 'y') {
      var y2 = n(y + 2.6);
      d = `M${x},${y} v2.6 M${x},${y2} q-2.6,2.8 -5.4,1.2 M${x},${y2} q2.6,2.8 5.4,1.2`;
    } else {
      var w = face.mouthSize[0], h = face.mouthSize[1], a = n(w / 2);
      d = `M${n(x - w)},${y} q${a},${h} ${w},0 q${a},${h} ${w},0`;
    }
    // S4 flat art draws its lines without round joins
    var line = face.eyeStyle === 'flat' ? `stroke="${face.ink}" stroke-width="${face.mouthSW}" stroke-linecap="round"` : C.ST(face.mouthSW, face.ink);
    return `<path d="${d}" fill="none" ${line}/>`;
  }

  return { eyes: eyes, mouth: mouth };
})();
