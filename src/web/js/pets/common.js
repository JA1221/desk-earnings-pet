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

  // CPU: an SVG filter around something that animates is computed again on every frame (the crayon skins cost about
  // twice the CPU of the others that way). Around a still subtree it is drawn once and reused while its parent moves.
  // ANIMATED: every class pets.css animates (tests check that no filter is ever above a moving element).
  var ANIMATED = ['armL', 'armR', 'blink', 'bod', 'breath', 'cf', 'chew', 'cloud', 'code', 'coin', 'coinspin', 'crumb',
    'csp', 'dot0', 'dot1', 'dot2', 'drip', 'eyes-alt', 'eyes-open', 'flame', 'fly', 'head', 'held', 'hrt', 'leaves', 'legs',
    'limp', 'look', 'mouth-a', 'mouth-b', 'note', 'pawL', 'pawR', 'pose-a', 'pose-b', 'puff', 'qm', 'scr', 'smk', 'snot',
    'spk', 'squish', 'steam', 'steam2', 'swing', 'tail', 'tear', 'tw', 'vein', 'zz'];
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

  return { L0: L0, ST: ST, star4: star4, blushLines: blushLines, scribble: scribble, badge: badge, seed: seed, keys: keys, defs: defs,
    ANIMATED: ANIMATED, filterStatic: filterStatic };
})();
