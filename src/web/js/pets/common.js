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
  function defs(uid) {
    return `
 <radialGradient id="${uid}-geye" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#55423A"/><stop offset=".55" stop-color="#22160F"/><stop offset="1" stop-color="#120B08"/></radialGradient>
 <filter id="${uid}-crayon" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.4 3.1" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
 <filter id="${uid}-wobble" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="${uid}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .42 0 0 0 0 .34 0 0 0 0 .26 0 0 0 -1.5 .95"/></filter>`;
  }

  return { L0: L0, ST: ST, star4: star4, blushLines: blushLines, scribble: scribble, badge: badge, seed: seed, keys: keys, defs: defs };
})();
