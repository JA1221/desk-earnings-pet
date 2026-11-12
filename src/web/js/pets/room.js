window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// The office room behind the pet (window, plant, monitor with scrolling code, mug, desk + keyboard),
// ported from docs/prototypes/shared.js `room`. Modes: 'sticker' (outlined), 'flat' (no outlines), 'crayon' (wobbly).
QJZ.pets.room = (function () {
  var C = QJZ.pets.common;
  var CODE_COLORS = ['#FFD166', '#7EE3A5', '#FF8FA3', '#9AD0FF'];
  var CODE_INDENT = [0, 6, 12, 6, 0, 6, 12, 18, 6, 0, 6, 12];
  var CODE_WIDTH = [30, 42, 22, 36, 48, 26, 18, 30, 40, 24, 34, 20];

  // [line colour, line width] for a room mode
  function line(mode) { return mode === 'crayon' ? ['#4A3A30', 2.4] : [C.L0, 3]; }

  // render-mode wrapper for room parts (flat strips outlines via pets.css, crayon wobbles the edges of the parts that
  // stand still: the clouds, code, steam and plant move outside the filter)
  function wrap(mode, uid, m) {
    if (mode === 'flat') return '<g class="flat">' + m + '</g>';
    if (mode === 'crayon') return C.filterStatic(m, 'url(#' + uid + '-wobble)');
    return m;
  }

  function cloud(y, s, delay, L, sw) {
    return `<g class="cloud" style="animation-delay:${delay}s"><path transform="translate(0,${y}) scale(${s})" d="M-12,6 Q-12,0 -6,0 Q-5,-7 2,-7 Q9,-7 10,-1 Q15,-1 15,4 Q15,8 11,8 L-9,8 Q-12,8 -12,6 Z" fill="#fff" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/></g>`;
  }

  // -> {L, sw, defs, before, desk, paper}; scene order is before, pet back/pre, desk, pet front/post, paper
  function build(uid, mode) {
    var ln = line(mode), L = ln[0], sw = ln[1], st = C.ST(sw, L);
    var s2 = `stroke="${L}" stroke-width="${Math.max(1.6, sw - 0.8)}"`;
    var lines = '';
    for (var k = 0; k < 2; k++) {
      for (var i = 0; i < 12; i++) {
        var ind = CODE_INDENT[i];
        lines += `<rect x="${200 + ind}" y="${90 + i * 7 + k * 84}" width="${Math.min(CODE_WIDTH[i], 66 - ind)}" height="3.2" rx="1.6" fill="${CODE_COLORS[(i + k) % 4]}"/>`;
      }
    }
    var wall = mode === 'crayon' ? '#FFF1DE' : '#FFE6C7';
    return {
      L: L,
      sw: sw,
      defs: `<pattern id="${uid}-wp" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1.8" fill="#FFD4A3"/></pattern><clipPath id="${uid}-sky"><rect x="21" y="23" width="56" height="42" rx="5"/></clipPath><clipPath id="${uid}-scr"><rect x="195" y="85" width="78" height="48" rx="5"/></clipPath>`,
      before: `<rect width="300" height="200" fill="${wall}"/>` + wrap(mode, uid, `<rect width="300" height="200" fill="url(#${uid}-wp)" opacity="${mode === 'sticker' ? 1 : 0.5}"/>
    <rect x="14" y="16" width="70" height="56" rx="10" fill="#fff" ${st}/><rect x="21" y="23" width="56" height="42" rx="5" fill="#A8DCFF" ${s2}/>
    <g clip-path="url(#${uid}-sky)"><circle cx="64" cy="34" r="7" fill="#FFD93D" ${s2}/>${cloud(40, 1, 0, L, 2)}${cloud(55, 0.8, -9, L, 2)}</g>
    <rect x="47" y="23" width="4" height="42" fill="#fff" ${s2}/><rect x="21" y="42" width="56" height="4" fill="#fff" ${s2}/>
    <g class="leaves"><ellipse cx="14" cy="116" rx="6" ry="15" transform="rotate(-24 14 116)" fill="#7CCB7E" ${st}/><ellipse cx="29" cy="114" rx="6" ry="16" transform="rotate(22 29 114)" fill="#7CCB7E" ${st}/><ellipse cx="21" cy="108" rx="6.5" ry="19" fill="#7CCB7E" ${st}/></g>
    <path d="M10,138 h24 l-3,17 h-18 z" fill="#E07A5F" ${st}/><rect x="7" y="132" width="30" height="8" rx="3.5" fill="#E07A5F" ${st}/>
    <rect x="228" y="138" width="10" height="13" fill="#7FB7E8" ${st}/><rect x="212" y="149" width="42" height="7" rx="3.5" fill="#7FB7E8" ${st}/>
    <rect x="188" y="78" width="92" height="62" rx="10" fill="#7FB7E8" ${st}/><rect x="195" y="85" width="78" height="48" rx="5" fill="#2C3E66" ${s2}/>
    <g clip-path="url(#${uid}-scr)"><g class="code">${lines}</g></g>
    <g transform="rotate(-9 199 76)"><rect x="187" y="65" width="26" height="22" rx="2" fill="#FFE066" ${s2}/><text x="200" y="80" font-size="8.5" text-anchor="middle" font-weight="800" font-family="Fredoka,sans-serif" fill="${L}">GO!</text></g>
    <path class="steam keep" d="M264,126 q-4,-6 0,-12 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path class="steam keep" style="animation-delay:-1.3s" d="M273,126 q-4,-6 0,-12 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M278,137 q9,0 9,6.5 q0,6.5 -9,6.5" fill="none" stroke="${L}" stroke-width="${sw + 4}"/><path class="keep" d="M278,137 q9,0 9,6.5 q0,6.5 -9,6.5" fill="none" stroke="#FF8FA3" stroke-width="3.5"/>
    <rect x="256" y="130" width="23" height="25" rx="5" fill="#FF8FA3" ${st}/><path d="M267.5,147 c-4,-3 -6,-5 -6,-7 a3,3 0 0 1 6,-1 a3,3 0 0 1 6,1 c0,2 -2,4 -6,7z" fill="#fff"/>`),
      desk: wrap(mode, uid, `<rect x="-4" y="160" width="308" height="90" fill="#C98A5E" ${st}/><rect x="-4" y="152" width="308" height="11" rx="4" fill="#E8AE80" ${st}/><path d="M72,146 H164 L171,159 H65 Z" fill="#F7F4FF" ${st}/>${C.keys()}`),
      paper: mode === 'crayon' ? `<rect x="-10" y="-10" width="320" height="260" filter="url(#${uid}-paper)" opacity=".2" style="mix-blend-mode:multiply" pointer-events="none"/>` : ''
    };
  }

  // the small desk strip under the pet in the pet-only view (prototype petOnlySVG)
  function miniDesk(uid, mode) {
    var ln = line(mode), st = C.ST(ln[1], ln[0]);
    return wrap(mode, uid, `<rect x="44" y="152" width="148" height="18" rx="9" fill="#E8AE80" ${st}/><path d="M72,146 H164 L171,159 H65 Z" fill="#F7F4FF" ${st}/>${C.keys()}`);
  }

  return { line: line, wrap: wrap, build: build, miniDesk: miniDesk };
})();
