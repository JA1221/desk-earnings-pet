// Hamster H2 鼓鼓頰鼠 — mochi body with seed-stuffed cheeks that puff, a seed in the corner of the mouth.
// Port of docs/prototypes/shared.js h2Ham.
// Poses: lie = flattened mochi asleep on the keyboard, cheeks still full; dangle = lifted mochi drop, cheeks swinging.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var G = '#F7B868', W = '#FFF6EA', PINK = '#FFB8C3';
  var B = 'M62,172 C60,126 84,100 118,100 C152,100 176,126 174,172 Z';
  var BD = 'M118,86 C124,86 127,95 132,102 C158,108 176,130 176,152 C176,172 150,180 118,180 C86,180 60,172 60,152 C60,130 78,108 104,102 C109,95 112,86 118,86 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}/></g>`;

  function cheek(cx, uid, st) {
    var bx = cx + (cx < 118 ? 3 : -3);
    return `<g class="puff" style="transform-origin:${cx}px 139px;animation-delay:${cx < 118 ? 0 : -0.6}s"><circle cx="${cx}" cy="139" r="20" fill="url(#${uid}-ck)" ${st}/><ellipse cx="${bx}" cy="142" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${C.blushLines(bx, 142)}<path d="M${cx - 12},128 q5,-7 12,-7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".85"/></g>`;
  }
  function ear(x, y, st, rot) {
    return `<g${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}><circle cx="${x}" cy="${y}" r="8" fill="${G}" ${st}/><circle cx="${x}" cy="${y + 0.5}" r="4" fill="#FFA9B6"/></g>`;
  }
  function body(path, clip, st) {
    return `<path d="${path}" fill="${G}"/><g clip-path="url(#${clip})"><ellipse cx="118" cy="166" rx="46" ry="30" fill="${W}"/><ellipse cx="168" cy="140" rx="14" ry="34" fill="#EFA552" opacity=".6"/></g><path d="${path}" fill="none" ${st}/>`;
  }
  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }

  P.register({
    id: 'hamster:h2', kind: 'hamster', skin: 'h2', name: '鼓鼓頰鼠', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      var face = `<path d="M118,104 v7" stroke="#E0923E" stroke-width="3" stroke-linecap="round"/>
    <path d="M94,112 C100,105 106,102 114,101" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    ${cheek(82, uid, st)}${cheek(154, uid, st)}
    <!--EYES-->
    <ellipse cx="118" cy="126" rx="2.4" ry="1.7" fill="#FF8090"/><!--MOUTH-->
    <g transform="rotate(-25 126 134)"><ellipse cx="126" cy="134" rx="5.6" ry="3" fill="#3A3A3A" ${ST(1.4)}/><path d="M121.5,133.5 h9 M122,135.2 h8" stroke="#fff" stroke-width=".9" opacity=".85"/></g><!--OVER-->`;
      var art = `
    ${ear(96, 105, st)}${ear(140, 105, st)}
    ${body(B, uid + '-b', st)}
    ${face}
   `;
      return {
        crop: '50 88 136 92',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath><linearGradient id="${uid}-ck" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="${G}"/><stop offset=".43" stop-color="${W}"/></linearGradient>`,
        layers: {
          back: '',
          pre: `<g class="squish">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[105, 119], [131, 119]], eyeR: 4.6, eyeStyle: 'gloss', ink: L, arc: [4.8, 2.6],
          mouth: [118, 129], mouthStyle: 'w', mouthSize: [3.5, 2.2], mouthSW: 1.7
        },
        rig: {
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, 66],
          top: [118, 96], qm: [154, 90], zzz: [150, 100], side: [[64, 118], [172, 118]], nose: [120, 126], anger: [140, 108],
          cheeks: [[82, 143, 11], [154, 143, 11]], hold: [118, 138, 0.72], smoke: 30,
          fire: [[60, 154, 1], [176, 154, 1]], bento: [152, 149, 0.92],
          bag: { x: 166, y: 118, s: 0.9, rot: 14, sw: 0.8, straps: [[70, 124, 76, 146], [166, 124, 160, 146]] },
          paw: paw, limb: { w: 8, fill: G }, pawL: PAW_L, pawR: PAW_R,
          up: { slot: 'back', arms: [[[80, 132], [52, 106], -35], [[156, 132], [184, 106], 35]] },
          holdArm: { paws: [[110, 142, 25], [126, 142, -25]] },
          scratch: { slot: 'back', arm: [[78, 124], [66, 106]], paw: [76, 104, -40] },
          strap: [[77, 141, 10], [159, 141, -10]]
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="161" rx="64" ry="5" fill="${L}" opacity=".12"/>` +
              `<g transform="translate(118 160) scale(1.12 .78) translate(-118 -172)"><g class="breath" style="transform-origin:118px 172px">${art}</g></g>` +
              paw(102, 159, -10) + paw(134, 159, 10),
            anchors: { zzz: [150, 110], top: [118, 108] }
          },
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -20)"><g class="legs" style="transform-origin:118px 176px">` +
              `<ellipse cx="106" cy="180" rx="5.5" ry="6.5" fill="${PINK}" ${st}/><ellipse cx="130" cy="180" rx="5.5" ry="6.5" fill="${PINK}" ${st}/></g>` +
              ear(104, 100, st, -18) + ear(132, 100, st, 18) + body(BD, uid + '-bd', st) + face +
              `<g class="limp" style="transform-origin:118px 140px">${paw(64, 158, 60)}${paw(172, 158, -60)}</g></g></g>`,
            anchors: { top: [118, 64], side: [[64, 98], [172, 98]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
