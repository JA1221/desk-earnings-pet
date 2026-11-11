// Hamster H2 鼓鼓頰鼠 — mochi body with seed-stuffed cheeks that puff, a seed in the corner of the mouth.
// Port of docs/prototypes/shared.js h2Ham.
(function (P) {
  var C = P.common, ST = C.ST;
  var G = '#F7B868', W = '#FFF6EA';
  var B = 'M62,172 C60,126 84,100 118,100 C152,100 176,126 174,172 Z';

  function cheek(cx, uid, st) {
    var bx = cx + (cx < 118 ? 3 : -3);
    return `<g class="puff" style="transform-origin:${cx}px 139px;animation-delay:${cx < 118 ? 0 : -0.6}s"><circle cx="${cx}" cy="139" r="20" fill="url(#${uid}-ck)" ${st}/><ellipse cx="${bx}" cy="142" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${C.blushLines(bx, 142)}<path d="M${cx - 12},128 q5,-7 12,-7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".85"/></g>`;
  }

  P.register({
    id: 'hamster:h2', kind: 'hamster', skin: 'h2', name: '鼓鼓頰鼠', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      return {
        crop: '50 88 136 92',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><linearGradient id="${uid}-ck" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="${G}"/><stop offset=".43" stop-color="${W}"/></linearGradient>`,
        layers: {
          back: '',
          pre: `<g class="squish">
    <circle cx="96" cy="105" r="8" fill="${G}" ${st}/><circle cx="96" cy="105.5" r="4" fill="#FFA9B6"/><circle cx="140" cy="105" r="8" fill="${G}" ${st}/><circle cx="140" cy="105.5" r="4" fill="#FFA9B6"/>
    <path d="${B}" fill="${G}"/><g clip-path="url(#${uid}-b)"><ellipse cx="118" cy="166" rx="46" ry="30" fill="${W}"/><ellipse cx="168" cy="140" rx="14" ry="34" fill="#EFA552" opacity=".6"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M118,104 v7" stroke="#E0923E" stroke-width="3" stroke-linecap="round"/>
    <path d="M94,112 C100,105 106,102 114,101" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    ${cheek(82, uid, st)}${cheek(154, uid, st)}
    <!--EYES-->
    <ellipse cx="118" cy="126" rx="2.4" ry="1.7" fill="#FF8090"/><!--MOUTH-->
    <g transform="rotate(-25 126 134)"><ellipse cx="126" cy="134" rx="5.6" ry="3" fill="#3A3A3A" ${ST(1.4)}/><path d="M121.5,133.5 h9 M122,135.2 h8" stroke="#fff" stroke-width=".9" opacity=".85"/></g>
   </g>`,
          front: `<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g><g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g>`,
          post: ''
        },
        face: {
          eyes: [[105, 119], [131, 119]], eyeR: 4.6, eyeStyle: 'gloss', ink: C.L0, arc: [4.8, 2.6],
          mouth: [118, 129], mouthStyle: 'w', mouthSize: [3.5, 2.2], mouthSW: 1.7
        }
      };
    }
  });
})(QJZ.pets);
