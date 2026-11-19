window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Shared art helpers for the pet skins, ported from docs/prototypes/shared.js.
// Every id inside an SVG is prefixed with the compose call's uid so several SVGs can live on one page.
QJZ.pets.common = (function () {
  var L0 = '#3D2C24';

  // standard outline attributes (prototype ST)
  function ST(w, c) {
    return 'stroke="' + (c || L0) + '" stroke-width="' + (w === undefined ? 3 : w) + '" stroke-linejoin="round" stroke-linecap="round"';
  }

  // four-point sparkle star path
  function star4(x, y, r) {
    return `M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z`;
  }

  // three little blush strokes
  function blushLines(x, y, c) {
    return `<path d="M${x - 4},${y - 2} l-2,4 M${x + 0.5},${y - 2} l-2,4 M${x + 5},${y - 2} l-2,4" stroke="${c || '#E2506E'}" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>`;
  }

  // crayon zig-zag blush (S5 skins)
  function scribble(x, y, c) {
    return `<path d="M${x - 8},${y + 2} l3,-4 l3,4 l3,-4 l3,4 l3,-4" fill="none" stroke="${c || '#FF7F9A'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // staff ID badge on a lanyard (P0 skins)
  function badge(x, y) {
    return `<rect x="${x}" y="${y}" width="16" height="11.5" rx="2" fill="#fff" stroke="${L0}" stroke-width="2"/><rect x="${x + 2.5}" y="${y + 2.5}" width="5" height="6.5" rx="1" fill="#FFB25B"/><path d="M${x + 10},${y + 4} h3.5 M${x + 10},${y + 7} h3.5" stroke="#A9B4C2" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  // sunflower seed lying on the desk next to the keyboard (hamster skins with seed:true)
  function seed(L) {
    return `<g transform="rotate(25 186 151)"><ellipse cx="186" cy="151" rx="6" ry="3.4" fill="#3A3A3A" stroke="${L}" stroke-width="1.6"/><path d="M181.5,150 h9 M182,152 h8" stroke="#fff" stroke-width="1" opacity=".85"/></g>`;
  }

  // keyboard key caps
  function keys() {
    var k = '';
    for (var r = 0; r < 2; r++) {
      for (var i = 0; i < 11; i++) k += `<rect x="${Math.round((75 + i * 8.2 - r * 1.5) * 10) / 10}" y="${149.5 + r * 4.4}" width="6" height="2.8" rx="1.2" fill="#CFC8E8"/>`;
    }
    return k;
  }

  // per-SVG defs used by the kept skins and rooms: glossy eye gradient, crayon grain, crayon-room wobble and paper.
  // crayon and wobble go on still parts only (filterStatic), many of them small or thin: their region is a fixed
  // area around the art in user space, so a displaced edge is never clipped (the noise is the same as before).
  function defs(uid) {
    return `
 <radialGradient id="${uid}-geye" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#55423A"/><stop offset=".55" stop-color="#22160F"/><stop offset="1" stop-color="#120B08"/></radialGradient>
 <filter id="${uid}-crayon" ${REGION}><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.4 3.1" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
 <filter id="${uid}-wobble" ${REGION}><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="${uid}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .42 0 0 0 0 .34 0 0 0 0 .26 0 0 0 -1.5 .95"/></filter>`;
  }

  var REGION = 'filterUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="430"';

  // 省電模式's crayon grain (compose opts.saver, spec §5.9): instead of the crayon filter, each colour is painted with a
  // still pattern of that colour flecked with paper, the way crayon leaves the paper showing. A pattern is drawn once
  // and repeated, where the filter works out its noise per pixel, and it needs no extra layer (a mask did: it cost more
  // than the filter). grainPattern(uid, key, colour) -> the <pattern> id="<uid>-gr<key>": a 16 x 14 tile, rotated so
  // its rows do not line up with the drawing, with 30 specks [x, y, r, strength] (about 10 % of its area).
  var SPECKS = [[3, 9.5, 0.53, 0.92], [12.6, 7.2, 0.5, 0.89], [0.5, 5.3, 0.52, 0.86], [12.4, 3.5, 0.45, 0.86],
    [15.5, 10.1, 0.58, 0.94], [8, 2, 0.59, 0.91], [2.4, 12.6, 0.49, 0.93], [5.6, 6.8, 0.44, 0.86],
    [15, 12.1, 0.55, 0.96], [9.2, 10, 0.42, 0.92], [7.3, 5.5, 0.6, 0.91], [0.9, 1.7, 0.54, 1], [3.2, 2.7, 0.47, 0.99],
    [5.1, 1.8, 0.41, 0.97], [6.6, 13.4, 0.59, 0.94], [6.1, 3.7, 0.58, 0.87], [13.1, 1.2, 0.45, 0.89],
    [13.1, 10.8, 0.58, 0.94], [10.8, 12.9, 0.4, 0.94], [9.3, 3.8, 0.48, 0.99], [6.2, 9.7, 0.51, 0.86],
    [8, 7.6, 0.59, 0.86], [15.2, 5.1, 0.46, 1], [9.8, 0.8, 0.53, 0.92], [12.9, 13, 0.6, 0.85], [4.3, 11.5, 0.43, 0.95],
    [1, 11, 0.59, 0.96], [1.1, 8.4, 0.54, 0.89], [3.3, 5.7, 0.51, 0.88], [9.8, 6.6, 0.56, 0.9]];
  var FLECKS = SPECKS.map(function (s) {
    return `<circle cx="${s[0]}" cy="${s[1]}" r="${s[2]}" fill="#FFF8EC" fill-opacity="${Math.round(s[3] * 60) / 100}"/>`;
  }).join('');
  function grainPattern(uid, key, colour) {
    return `<pattern id="${uid}-gr${key}" width="16" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(23)">` +
      `<rect width="16" height="14" fill="${colour}"/>${FLECKS}</pattern>`;
  }

  // ---- shape helpers (cat H2 / S4) ----
  function r2(v) { return Math.round(v * 100) / 100; }
  // a closed smooth outline through the points (Catmull-Rom drawn as cubic Béziers)
  function smooth(pts) {
    var m = pts.length, d = 'M' + r2(pts[0][0]) + ',' + r2(pts[0][1]);
    for (var i = 0; i < m; i++) {
      var p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
      d += ' C' + r2(p1[0] + (p2[0] - p0[0]) / 6) + ',' + r2(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        r2(p2[0] - (p3[0] - p1[0]) / 6) + ',' + r2(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + r2(p2[0]) + ',' + r2(p2[1]);
    }
    return d + ' Z';
  }
  // a symmetric smooth blob: the left half (from the top on the axis x = cx down the left side to the bottom on the axis)
  // mirrored into a closed outline
  function blob(left, cx) {
    cx = cx === undefined ? 118 : cx;
    var right = left.slice(1, -1).reverse().map(function (p) { return [2 * cx - p[0], p[1]]; });
    return smooth(left.concat(right));
  }
  // a soft triangle (an ear): base corners b1, b2, apex a rounded off by `round` (share of each side), sides bulging
  // out by `bulge`
  function softTri(b1, a, b2, round, bulge) {
    var k = round === undefined ? 0.3 : round, g = bulge === undefined ? 2.5 : bulge;
    var cx = (b1[0] + a[0] + b2[0]) / 3, cy = (b1[1] + a[1] + b2[1]) / 3;
    function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
    function ctl(p, q) {
      var m = lerp(p, q, 0.5), dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
      if ((m[0] - cx) * nx + (m[1] - cy) * ny < 0) { nx = -nx; ny = -ny; }
      return [m[0] + nx * g, m[1] + ny * g];
    }
    var p1 = lerp(a, b1, k), p2 = lerp(a, b2, k), c1 = ctl(b1, p1), c2 = ctl(p2, b2);
    return `M${r2(b1[0])},${r2(b1[1])} Q${r2(c1[0])},${r2(c1[1])} ${r2(p1[0])},${r2(p1[1])} Q${r2(a[0])},${r2(a[1])} ${r2(p2[0])},${r2(p2[1])} Q${r2(c2[0])},${r2(c2[1])} ${r2(b2[0])},${r2(b2[1])} Z`;
  }
  // the same triangle pulled towards its centroid by f and moved down by `lift` (the pink inside of an ear)
  function innerTri(b1, a, b2, f, lift) {
    var cx = (b1[0] + a[0] + b2[0]) / 3, cy = (b1[1] + a[1] + b2[1]) / 3 + (lift || 0);
    function s(p) { return [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; }
    return softTri(s(b1), s(a), s(b2), 0.34, 1.2);
  }
  // p mirrored about x = cx (default 118)
  function mirrorX(p, cx) { return [2 * (cx === undefined ? 118 : cx) - p[0], p[1]]; }

  // CPU: an SVG filter around something that animates is computed again on every frame (the crayon skins cost about
  // twice the CPU of the others that way). Around a still subtree it is drawn once and reused while its parent moves.
  // ANIMATED: every class pets.css animates (tests check that no filter is ever above a moving element).
  var ANIMATED = ['armL', 'armR', 'bang', 'blink', 'bod', 'breath', 'cf', 'chew', 'cloud', 'code', 'coin', 'coinspin', 'crumb',
    'csp', 'dot0', 'dot1', 'dot2', 'drip', 'eyes-alt', 'eyes-open', 'flame', 'fly', 'head', 'held', 'hrt', 'knk', 'knock', 'leaves', 'like', 'swipe',
    'legs', 'limp', 'look', 'lvl', 'mouth-a', 'mouth-b', 'note', 'pawL', 'pawR', 'pose-a', 'pose-b', 'puff', 'qm', 'scr', 'smk',
    'snot', 'spk', 'squish', 'steam', 'steam2', 'swing', 'tail', 'tear', 'tw', 'vein', 'zz'];
  var MOVING = new RegExp('(?:^|\\s)(?:' + ANIMATED.join('|') + ')(?:\\s|$)');
  var SVGNS = 'http://www.w3.org/2000/svg';

  function moving(el) {
    if (MOVING.test(el.getAttribute('class') || '')) return true;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (moving(c)) return true;
    return false;
  }
  // Wraps each run of still siblings under el in <g filter="url">, and goes down into the children that move.
  function split(el, url) {
    var run = [];
    function flush() {
      for (var i = 0; i < run.length; i++) {
        if (run[i].nodeType !== 1) continue;
        var g = el.ownerDocument.createElementNS(SVGNS, 'g');
        g.setAttribute('filter', url);
        el.insertBefore(g, run[0]);
        run.forEach(function (n) { g.appendChild(n); });
        break;
      }
      run = [];
    }
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && moving(n)) { flush(); split(n, url); }
      else run.push(n);
    });
    flush();
  }
  // SVG markup (a fragment) with filter `url` on everything in it that does not move. Markup that does not parse
  // as XML keeps the plain wrapper (the old way: correct, only slower).
  function filterStatic(markup, url) {
    if (!markup) return '';
    var doc = null;
    try { doc = new DOMParser().parseFromString('<svg xmlns="' + SVGNS + '">' + markup + '</svg>', 'image/svg+xml'); } catch (e) {}
    if (!doc || doc.getElementsByTagName('parsererror').length) return '<g filter="' + url + '">' + markup + '</g>';
    split(doc.documentElement, url);
    var s = new XMLSerializer().serializeToString(doc.documentElement), a = s.indexOf('>') + 1, b = s.lastIndexOf('</svg>');
    return b > a ? s.slice(a, b) : '';
  }

  return { L0: L0, ST: ST, star4: star4, blushLines: blushLines, scribble: scribble, badge: badge, seed: seed, keys: keys, defs: defs, grainPattern: grainPattern,
    ANIMATED: ANIMATED, filterStatic: filterStatic, smooth: smooth, blob: blob, softTri: softTri, innerTri: innerTri, mirrorX: mirrorX };
})();
