window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Eye and mouth slots. Skins describe their face (where the eyes/mouth sit and how they look); these
// renderers draw the eyes and mouth into the <!--EYES--> / <!--MOUTH--> slots of the skin's head group.
//
// face = {
//   eyes: [[x,y],[x,y]],   eye centres (left, right)
//   eyeR: number,          eye size: horizontal radius for 'q'/'ham', radius for the round styles
//   eyeStyle: 'q'|'ham'|'gloss'|'dot'|'flat'|'crayon',
//   mouth: [x,y],          top centre of the mouth
//   ink: string,           line colour of eyes/mouth
//   arc: [w, sw],          happy ^^ arc half-width and stroke width (closed / sleepy lids use the same pen)
//   mouthStyle: 'w'|'y',   ω mouth, or the P0 hamster's Y mouth
//   mouthSize: [w, h],     ω: half-width and curve control depth ('y' draws its own fixed shape; size is its extent)
//   mouthSW: number,       mouth stroke width
//   iris: string,          'q' only: iris colour
//   hl: number             'flat'/'crayon' only: highlight radius (also its offset)
// }
// Expressions: open (the skin's own eyes), happy ^^, closed ‿‿, sleepy (half lids), angry (cut lids + brows),
// surprised (white eyes, small pupils), dazed (round blank dot eyes, a little stunned), sparkle (shining excited eyes).
// Mouths: neutral (the skin's own), smile (open happy mouth), open (small o), chew (munching, animated by .chew),
// yawn (big oval), pout (little frown), tiny (a very small o). Unknown names fall back to open / neutral.
// Flat (S4) eyes and mouths are filled shapes without outlines; crayon (S5) lines get a second pencil pass.
QJZ.pets.expr = (function () {
  var C = QJZ.pets.common;
  var EXPRESSIONS = ['open', 'happy', 'closed', 'sleepy', 'angry', 'surprised', 'dazed', 'sparkle'];
  var MOUTHS = ['neutral', 'smile', 'open', 'chew', 'yawn', 'pout', 'tiny'];
  var INSIDE = '#7A3236', INSIDE_FLAT = '#5A2E3A', TONGUE = '#FF8FA3';

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

  // [rx, ry] of the open eye
  function size(face) {
    var r = face.eyeR;
    if (face.eyeStyle === 'q') return [r, n(r * 10.5 / 8.5)];
    if (face.eyeStyle === 'ham') return [r, n(r * 8.6 / 7.6)];
    return [r, r];
  }
  function isFlat(face) { return face.eyeStyle === 'flat'; }

  // a stroked pen line in the face ink; crayon faces get a second, thinner pass so it reads hand-drawn
  function pen(face, d, w) {
    var a = `<path d="${d}" fill="none" stroke="${face.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (face.eyeStyle !== 'crayon') return a;
    return a + `<path d="${d}" transform="translate(.6 .5)" fill="none" stroke="${face.ink}" stroke-width="${n(w * 0.45)}" stroke-linecap="round" opacity=".55"/>`;
  }

  // ^^ closed happy arc (prototype happyArc, drawn 1 unit below the eye centre)
  function happyEye(face, p) {
    var w = face.arc[0], cx = p[0], cy = p[1] + 1;
    return `<path d="M${n(cx - w)},${n(cy + 2)} q${w},${n(-w * 1.25)} ${n(w * 2)},0" fill="none" stroke="${face.ink}" stroke-width="${face.arc[1]}" stroke-linecap="round"/>`;
  }

  // ‿ gently closed eye (sleeping, sipping); P0 cat gets a lash flick, flat skins a filled crescent
  function closedEye(face, p, i) {
    var w = face.arc[0], cx = p[0], cy = n(p[1] + 0.5), o = i === 0 ? -1 : 1;
    if (isFlat(face)) {
      return `<path d="M${n(cx - w)},${cy} Q${cx},${n(cy + w * 1.25)} ${n(cx + w)},${cy} Q${cx},${n(cy + w * 0.5)} ${n(cx - w)},${cy} Z" fill="${face.ink}"/>`;
    }
    var out = pen(face, `M${n(cx - w)},${cy} q${w},${n(w * 0.9)} ${n(2 * w)},0`, face.arc[1]);
    if (face.eyeStyle === 'q') out += pen(face, `M${n(cx + o * w)},${cy} l${n(o * 3)},${-2.6}`, n(face.arc[1] * 0.75));
    return out;
  }

  // the open eye cut by a lid line from a (outer corner) to b (inner corner); only the part below the line shows.
  // With c the lid is a curve (quadratic through control c) that reaches the corners exactly.
  function lidded(face, p, i, uid, tag, a, b, c) {
    var s = size(face), low = n(p[1] + s[1] + 4), id = uid + '-' + tag + i, top;
    if (c) top = `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
    else {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      top = `M${n(a[0] - dx * 0.4)},${n(a[1] - dy * 0.4)} L${n(b[0] + dx * 0.4)},${n(b[1] + dy * 0.4)}`;
    }
    var x2 = c ? b[0] : n(b[0] + (b[0] - a[0]) * 0.4), x1 = c ? a[0] : n(a[0] - (b[0] - a[0]) * 0.4);
    return `<clipPath id="${id}"><path d="${top} L${x2},${low} L${x1},${low} Z"/></clipPath><g clip-path="url(#${id})">${openEye(face, p, uid)}</g>`;
  }

  // drowsy half lids: an arched lid over the lower half of the eye, dipping a little at the outer corner
  function sleepyEye(face, p, i, uid) {
    var s = size(face), cx = p[0], cy = p[1], o = i === 0 ? -1 : 1;
    var a = [n(cx + o * s[0] * 1.14), n(cy + s[1] * 0.26)], b = [n(cx - o * s[0] * 1.14), n(cy + s[1] * 0.12)], c = [cx, n(cy - s[1] * 0.36)];
    var out = lidded(face, p, i, uid, 'sl', a, b, c);
    if (isFlat(face)) return out;
    return out + pen(face, `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`, n(face.arc[1] * 0.8));
  }

  // cross eyes: lids slanting down to the nose, with short thick brows above
  function angryEye(face, p, i, uid) {
    var s = size(face), cx = p[0], cy = p[1], o = i === 0 ? -1 : 1;
    var a = [n(cx + o * s[0] * 1.1), n(cy - s[1] * 0.62)], b = [n(cx - o * s[0] * 1.1), n(cy + s[1] * 0.04)];
    var out = lidded(face, p, i, uid, 'an', a, b);
    var lift = Math.max(2.2, s[1] * 0.42), w = Math.max(2.2, face.arc[1]);
    var ba = [n(cx + o * s[0] * 1.2), n(cy - s[1] * 0.78 - lift)], bb = [n(cx - o * s[0] * 0.95), n(cy - s[1] * 0.12 - lift)];
    if (isFlat(face)) {
      // brow as a filled bar
      var dx = bb[0] - ba[0], dy = bb[1] - ba[1], len = Math.sqrt(dx * dx + dy * dy), nx = n(-dy / len * w / 2), ny = n(dx / len * w / 2);
      return out + `<path d="M${n(ba[0] + nx)},${n(ba[1] + ny)} L${n(bb[0] + nx)},${n(bb[1] + ny)} L${n(bb[0] - nx)},${n(bb[1] - ny)} L${n(ba[0] - nx)},${n(ba[1] - ny)} Z" fill="${face.ink}"/>`;
    }
    return out + pen(face, `M${ba[0]},${ba[1]} L${bb[0]},${bb[1]}`, w);
  }

  // wide white eyes with a small pupil
  function surprisedEye(face, p, uid) {
    var s = size(face), cx = p[0], cy = p[1], st = face.eyeStyle, line = isFlat(face) ? '' : ` stroke="${face.ink}" stroke-width="${n(Math.max(1.4, face.arc[1] * 0.62))}"`;
    if (st === 'dot') {
      var r = n(s[0] * 1.4);
      return `<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"${line}/><circle cx="${cx}" cy="${n(cy + 0.3)}" r="${n(s[0] * 0.62)}" fill="${face.ink}"/></g>`;
    }
    var rx = n(s[0] * 1.1), ry = n(s[1] * 1.1), pr = n(Math.min(s[0], s[1]) * 0.48), py = n(cy + s[1] * 0.06);
    var pupil = st === 'q' ? `<circle cx="${cx}" cy="${py}" r="${n(pr * 1.3)}" fill="${face.iris}"/><circle cx="${cx}" cy="${py}" r="${n(pr * 0.78)}" fill="#2E2220"/>` :
      `<circle cx="${cx}" cy="${py}" r="${pr}" fill="${st === 'ham' || st === 'gloss' ? 'url(#' + uid + '-geye)' : face.ink}"/>`;
    return `<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"${line}/>${pupil}<circle cx="${n(cx + pr * 0.38)}" cy="${n(py - pr * 0.4)}" r="${n(Math.max(0.7, pr * 0.34))}" fill="#fff"/></g>`;
  }

  // round blank dot eyes: a little stunned but calm (glossy styles keep one tiny catch-light)
  function dazedEye(face, p, uid) {
    var s = size(face), cx = p[0], cy = p[1], st = face.eyeStyle, r, fillc = face.ink, hl = '';
    if (st === 'dot') r = n(s[0] * 1.15);
    else if (st === 'flat' || st === 'crayon') r = n(s[0] * 0.82);
    else {
      r = n(Math.min(s[0], s[1]) * (st === 'gloss' ? 0.8 : 0.66));
      fillc = st === 'q' ? '#2E2220' : 'url(#' + uid + '-geye)';
      hl = `<circle cx="${n(cx + r * 0.38)}" cy="${n(cy - r * 0.38)}" r="${n(r * 0.24)}" fill="#fff"/>`;
    }
    return `<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillc}"/>${hl}</g>`;
  }

  // shining excited eyes: the open eye with a big star catch-light; tiny dot eyes become little ink stars
  function sparkleEye(face, p, uid) {
    var s = size(face), cx = p[0], cy = p[1], st = face.eyeStyle;
    if (st === 'dot') {
      var R = n(s[0] * 1.7);
      return `<g class="blink"><path d="${C.star4(cx, cy, R)}" fill="${face.ink}" stroke="${face.ink}" stroke-width="1" stroke-linejoin="round"/><circle cx="${n(cx + 0.5)}" cy="${n(cy - 0.6)}" r="${n(s[0] * 0.28)}" fill="#fff"/></g>`;
    }
    var big = st === 'q' || st === 'ham' ? 0.42 : 0.5, k = Math.min(s[0], s[1]);
    var star = `<path d="${C.star4(n(cx - k * 0.3), n(cy - k * 0.3), n(k * big))}" fill="#fff"/><path d="${C.star4(n(cx + k * 0.42), n(cy + k * 0.4), n(k * 0.22))}" fill="#fff"/>`;
    return openEye(face, p, uid).replace(/<\/g>$/, star + '</g>');
  }

  function one(face, ex, i, uid) {
    var p = face.eyes[i];
    switch (ex) {
      case 'happy': return happyEye(face, p);
      case 'closed': return closedEye(face, p, i);
      case 'sleepy': return sleepyEye(face, p, i, uid);
      case 'angry': return angryEye(face, p, i, uid);
      case 'surprised': return surprisedEye(face, p, uid);
      case 'dazed': return dazedEye(face, p, uid);
      case 'sparkle': return sparkleEye(face, p, uid);
      default: return openEye(face, p, uid);
    }
  }

  // both eyes for an expression
  function eyes(face, expression, uid) {
    var ex = EXPRESSIONS.indexOf(expression) >= 0 ? expression : 'open';
    return one(face, ex, 0, uid) + one(face, ex, 1, uid);
  }

  // stroke attributes for mouth lines (S4 flat art draws its lines without round joins)
  function lineAttrs(face, w) {
    return isFlat(face) ? `stroke="${face.ink}" stroke-width="${w}" stroke-linecap="round"` : C.ST(w, face.ink);
  }

  // a filled mouth shape: dark inside, optional tongue, ink outline on top (none for flat skins)
  function filled(face, d, tongue) {
    var inside = isFlat(face) ? INSIDE_FLAT : INSIDE;
    var out = `<path d="${d}" fill="${inside}"/>` + (tongue || '');
    return isFlat(face) ? out : out + `<path d="${d}" fill="none" ${C.ST(face.mouthSW, face.ink)}/>`;
  }

  // the mouth for a mouth name
  function mouth(face, name) {
    var x = face.mouth[0], y = face.mouth[1], sw = face.mouthSW, d;
    var isY = face.mouthStyle === 'y', w = face.mouthSize[0], h = face.mouthSize[1];
    var nm = MOUTHS.indexOf(name) >= 0 ? name : 'neutral';
    if (nm === 'neutral') {
      if (isY) {
        var y2 = n(y + 2.6);
        d = `M${x},${y} v2.6 M${x},${y2} q-2.6,2.8 -5.4,1.2 M${x},${y2} q2.6,2.8 5.4,1.2`;
      } else {
        var a = n(w / 2);
        d = `M${n(x - w)},${y} q${a},${h} ${w},0 q${a},${h} ${w},0`;
      }
      return `<path d="${d}" fill="none" ${lineAttrs(face, sw)}/>`;
    }
    // the Y mouth keeps its philtrum line; the new shape hangs below it
    var u = isY ? 4.6 : w, y0 = isY ? n(y + 2.6) : y;
    var lead = isY ? `<path d="M${x},${y} v2.6" fill="none" ${lineAttrs(face, sw)}/>` : '';
    switch (nm) {
      case 'smile': {
        var W = n(u * 1.1), H = n(u * 1.45), q = n(W / 2), qh = n(H * 0.3);
        d = `M${n(x - W)},${y0} q${q},${qh} ${W},0 q${q},${qh} ${W},0 C${n(x + W)},${n(y0 + H * 1.25)} ${n(x - W)},${n(y0 + H * 1.25)} ${n(x - W)},${y0} Z`;
        return lead + filled(face, d, `<ellipse cx="${x}" cy="${n(y0 + H * 0.74)}" rx="${n(W * 0.48)}" ry="${n(H * 0.2)}" fill="${TONGUE}"/>`);
      }
      case 'open': {
        var cy = n(y0 + u * 0.9), rx = n(u * 0.6), ry = n(u * 0.78);
        d = `M${n(x - rx)},${cy} a${rx},${ry} 0 1,0 ${n(2 * rx)},0 a${rx},${ry} 0 1,0 ${n(-2 * rx)},0 Z`;
        return lead + filled(face, d, `<ellipse cx="${x}" cy="${n(cy + ry * 0.48)}" rx="${n(rx * 0.55)}" ry="${n(ry * 0.3)}" fill="${TONGUE}"/>`);
      }
      case 'yawn': {
        var ycy = n(y0 + u * 1.45), yrx = n(u * 0.95), yry = n(u * 1.45);
        d = `M${n(x - yrx)},${ycy} a${yrx},${yry} 0 1,0 ${n(2 * yrx)},0 a${yrx},${yry} 0 1,0 ${n(-2 * yrx)},0 Z`;
        return lead + filled(face, d, `<ellipse cx="${x}" cy="${n(ycy + yry * 0.55)}" rx="${n(yrx * 0.6)}" ry="${n(yry * 0.3)}" fill="${TONGUE}"/>`);
      }
      case 'chew': {
        // a smaller ω over a little opening that opens and shuts (.chew is animated by pets.css)
        var cw = n(u * 0.72), ca = n(cw / 2), ch = n(isY ? 3 : h * 0.9);
        var top = isY ? `M${x},${y0} q-2,2.2 -4.2,1 M${x},${y0} q2,2.2 4.2,1` : `M${n(x - cw)},${y0} q${ca},${ch} ${cw},0 q${ca},${ch} ${cw},0`;
        var gy = n(y0 + (isY ? 2.6 : ch * 0.55));
        return lead + `<g class="chew" style="transform-origin:${x}px ${gy}px"><ellipse cx="${x}" cy="${n(gy + u * 0.32)}" rx="${n(u * 0.42)}" ry="${n(u * 0.34)}" fill="${isFlat(face) ? INSIDE_FLAT : INSIDE}"/></g><path d="${top}" fill="none" ${lineAttrs(face, sw)}/>`;
      }
      case 'tiny': {
        var tcy = n(y0 + u * 0.55), trx = n(u * 0.3), trY = n(u * 0.38);
        d = `M${n(x - trx)},${tcy} a${trx},${trY} 0 1,0 ${n(2 * trx)},0 a${trx},${trY} 0 1,0 ${n(-2 * trx)},0 Z`;
        var inside = isFlat(face) ? INSIDE_FLAT : INSIDE;
        return lead + `<path d="${d}" fill="${inside}"/>` + (isFlat(face) ? '' : `<path d="${d}" fill="none" ${C.ST(n(face.mouthSW * 0.8), face.ink)}/>`);
      }
      default: {   // pout: a little frown
        var pw = n(u * 0.72);
        d = `M${n(x - pw)},${n(y0 + u * 0.95)} q${pw},${n(-u * 1.15)} ${n(2 * pw)},0`;
        return lead + `<path d="${d}" fill="none" ${lineAttrs(face, sw)}/>`;
      }
    }
  }

  return { eyes: eyes, mouth: mouth, size: size, EXPRESSIONS: EXPRESSIONS, MOUTHS: MOUTHS };
})();
