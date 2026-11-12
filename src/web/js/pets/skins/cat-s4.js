// Cat S4 扁平幾何貓 — the cat of hamster S4: no outlines, built from circles and triangles, two-tone left/right (the
// right half under a darker veil, the right ear darker). Port of docs/prototypes/shared.js s4Cat.
// Arms are flat fur with no seam: their colour follows the split (OD on the right), so they melt into the body.
// Poses stay flat and geometric: lie = the round head resting on its paws, a half-disc back and the tail behind;
// dangle = held by the scruff, a capsule body with round feet and tail hanging.
(function (P) {
  var O = '#F2A65A', D = '#E08A3E', CR = '#FFF3E3', INK = '#2B2B3A', PINK = '#FF9FB0';
  var OD = '#EC9C50';   // O under the .35 D veil: the right half
  var TORSO = 'M78,178 A40,44 0 0 1 158,178 Z';
  var PAW_L = `<g class="pawL"><circle cx="102" cy="151" r="8" fill="${CR}"/></g>`;
  var PAW_R = `<g class="pawR"><circle cx="134" cy="151" r="8" fill="${CR}"/></g>`;

  function paw(x, y) { return `<circle cx="${x}" cy="${y}" r="8" fill="${CR}"/>`; }
  function tail(d, origin) {
    return `<g class="tail"${origin ? ' style="transform-origin:' + origin + '"' : ''}><path d="${d}" fill="none" stroke="${D}" stroke-width="12" stroke-linecap="round"/></g>`;
  }
  // limbs that grow out of the torso without a seam (QJZ.pets.rig.grow; flat: fur only)
  function grown(R, pairs, w) {
    return pairs.map(function (p) { return P.rig.grow(R, p, w).fill; }).join('');
  }

  P.register({
    id: 'cat:s4', kind: 'cat', skin: 's4', name: '扁平幾何貓', room: 'flat', wrap: null,
    build: function (uid) {
      var head = `<path d="M78,70 L80,32 L106,52 Z" fill="${O}"/><path d="M158,70 L156,32 L130,52 Z" fill="${D}"/><path d="M83,62 L84,42 L99,54 Z" fill="${PINK}"/><path d="M153,62 L152,42 L137,54 Z" fill="${PINK}"/>
    <circle cx="118" cy="92" r="44" fill="${O}"/><g clip-path="url(#${uid}-h)"><rect x="118" y="40" width="50" height="100" fill="${D}" opacity=".35"/><path d="M108,48 h6 l-3,11 z M116,47 h5 l-2.5,12 z M122,48 h6 l-3,11 z" fill="${D}"/></g>
    <circle cx="110" cy="107" r="9" fill="${CR}"/><circle cx="126" cy="107" r="9" fill="${CR}"/>
    <circle cx="88" cy="104" r="6.5" fill="${PINK}" opacity=".9"/><circle cx="148" cy="104" r="6.5" fill="${PINK}" opacity=".9"/>
    <!--EYES-->
    <path d="M114.5,100 h7 l-3.5,4 z" fill="#E8607A"/><!--MOUTH-->
    <path d="M79,101 l-13,-2.6 M79,107 l-13,2.6 M157,101 l13,-2.6 M157,107 l13,2.6" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><!--OVER-->`;
      var R = { line: [INK, 0], limb: { fill: `url(#${uid}-lf)` }, mode: 'flat' };
      var legs = grown(R, [[[108, 170], [106, 184]], [[128, 170], [130, 184]]], [11, 9.5]);
      var limp = grown(R, [[[96, 136], [90, 154]], [[140, 136], [146, 154]]], [11.5, 9.5]);
      var LEGS = '<g class="legs" style="transform-origin:118px 166px">', LIMP = '<g class="limp" style="transform-origin:118px 134px">';
      return {
        crop: '56 24 124 120',
        seed: false,
        defs: `<clipPath id="${uid}-h"><circle cx="118" cy="92" r="44"/></clipPath><clipPath id="${uid}-t"><path d="${TORSO}"/></clipPath>` +
          `<clipPath id="${uid}-d"><rect x="88" y="124" width="60" height="56" rx="28"/></clipPath>` +
          `<linearGradient id="${uid}-lf" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="236" y2="0"><stop offset=".5" stop-color="${O}"/><stop offset=".5" stop-color="${OD}"/></linearGradient>`,
        layers: {
          back: tail('M88,156 C60,160 48,134 60,112') +
            `<path d="${TORSO}" fill="${O}"/><g clip-path="url(#${uid}-t)"><rect x="118" y="120" width="44" height="60" fill="${D}" opacity=".35"/><circle cx="118" cy="160" r="20" fill="${CR}"/><path d="M118,140 A20,20 0 0 1 118,180 Z" fill="#F3E2CC" opacity=".6"/></g>`,
          pre: '',
          front: PAW_L + PAW_R,
          post: `<g class="head">${head}</g>`
        },
        face: {
          eyes: [[101, 92], [135, 92]], eyeR: 5.4, eyeStyle: 'flat', hl: 1.7, ink: INK, arc: [5.5, 2.6],
          mouth: [118, 107], mouthStyle: 'w', mouthSize: [5, 2.6], mouthSW: 1.6
        },
        rig: {
          mode: 'flat', line: [INK, 0], pivot: [118, 134], grab: [118, 30],
          top: [118, 48], qm: [126, 36], zzz: [158, 52], side: [[70, 88], [166, 88]], nose: [119.5, 103], anger: [146, 68],
          cheeks: [[88, 104, 9], [148, 104, 9]], hold: [118, 124, 1], smoke: 38,
          fire: [[72, 152, 1.15], [164, 152, 1.15]], bento: [154, 149, 1],
          paw: paw, limb: { fill: `url(#${uid}-lf)` }, pawL: PAW_L, pawR: PAW_R,
          up: { ink: 'back', fill: 'front', w: [13, 9], arms: [[[98, 140], [62, 90], -25], [[138, 140], [174, 90], 25]] },
          holdArm: { paws: [[106, 128, 0], [130, 128, 0]] },
          scratch: { ink: 'back', fill: 'front', w: 10, arm: [[98, 140], [60, 108], [74, 70]], paw: [82, 58, 0] },
          pack: { lift: 4,
            desk: { bag: [178, 141, 0.86], rest: [162, 130, 0], restArm: [[140, 142], [158, 132]], w: 10 } }
        },
        poses: {
          // the round head resting on its paws; a half-disc back (two-tone) and the tail behind it
          lie: {
            front: `<ellipse cx="118" cy="162" rx="58" ry="5" fill="${INK}" opacity=".1"/>` +
              tail('M170,156 C192,158 196,136 184,124', '170px 156px') +
              `<path d="M108,160 A34,32 0 0 1 142,128 V160 Z" fill="${O}"/><path d="M142,128 A34,32 0 0 1 176,160 H142 Z" fill="${OD}"/>` +
              `<g transform="translate(-10 28) rotate(-11 118 134)"><g class="breath" style="transform-origin:118px 134px">${head}</g></g>` +
              paw(98, 160) + paw(126, 160),
            anchors: { zzz: [150, 74], top: [92, 76] }
          },
          // held by the scruff: a two-tone capsule body, legs and arms hanging, tail behind
          dangle: {
            front: `<g class="swing"><g transform="translate(118 30) scale(.95) translate(-118 -48)">` + tail('M104,170 C90,182 78,170 78,152', '104px 170px') +
              `<rect x="88" y="124" width="60" height="56" rx="28" fill="${O}"/><g clip-path="url(#${uid}-d)"><rect x="118" y="120" width="34" height="64" fill="${D}" opacity=".35"/><circle cx="118" cy="158" r="17" fill="${CR}"/><path d="M118,141 A17,17 0 0 1 118,175 Z" fill="#F3E2CC" opacity=".6"/></g>` +
              LEGS + legs + paw(106, 186) + paw(130, 186) + '</g>' +
              LIMP + limp + paw(90, 157) + paw(146, 157) + '</g>' +
              head + `</g></g>`,
            anchors: { top: [118, 30], side: [[70, 72], [166, 72]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
