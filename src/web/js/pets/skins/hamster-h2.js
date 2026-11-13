// Hamster H2 貪吃鼠 — mochi body with seed-stuffed cheeks that puff, a sunflower seed balanced on its head
// (Task 12 review: moved from the corner of the mouth). Port of docs/prototypes/shared.js h2Ham.
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
  // the sunflower seed balanced on top of the head (inside the head group, so it rides along): a classic teardrop
  // seed, dark with pale stripes running along it, round end left and pointed end right
  function topSeed(x, y, rot, sc) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc || 1})"><path d="M-9.5,0 C-9.5,-5 -4.5,-6 1,-4.6 C5.4,-3.5 9,-1.5 10.2,0 C9,1.5 5.4,3.5 1,4.6 C-4.5,6 -9.5,5 -9.5,0 Z" fill="#33302E" ${ST(1.6)}/>` +
      `<path d="M-7,-2.4 C-2.5,-3.9 3,-3 7.8,-0.7 M-7.8,0.2 C-2.5,-0.3 3,0 9,0.1 M-7,2.7 C-2.5,3.9 3,3 7.8,0.8" fill="none" stroke="#E2DCCF" stroke-width="1.05" stroke-linecap="round"/>` +
      `<path d="M-6.8,-3.6 q2.6,-1.6 5.6,-1.6" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/></g>`;
  }
  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }

  P.register({
    id: 'hamster:h2', kind: 'hamster', skin: 'h2', name: '貪吃鼠', room: 'sticker', wrap: null,
    poses11: ['wave', 'holdCup', 'sip', 'focus'],
    build: function (uid) {
      var st = ST(2.8);
      var face = `<path d="M118,104 v7" stroke="#E0923E" stroke-width="3" stroke-linecap="round"/>
    <path d="M94,112 C100,105 106,102 114,101" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    ${cheek(82, uid, st)}${cheek(154, uid, st)}
    <!--EYES-->
    <ellipse cx="118" cy="126" rx="2.4" ry="1.7" fill="#FF8090"/><!--MOUTH--><!--OVER-->`;
      var art = `
    ${ear(96, 105, st)}${ear(140, 105, st)}
    ${body(B, uid + '-b', st)}${topSeed(118, 94.6, -9)}
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
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, 65],
          top: [118, 96], qm: [154, 90], zzz: [150, 100], side: [[64, 118], [172, 118]], nose: [120, 126], anger: [140, 108],
          cheeks: [[82, 143, 11], [154, 143, 11]], hold: [118, 138, 0.72], smoke: 30,
          fire: [[60, 154, 1], [176, 154, 1]], bento: [152, 149, 0.92],
          paw: paw, pawL: PAW_L, pawR: PAW_R,
          up: { paws: [[68, 122, -60], [168, 122, 60]] },
          holdArm: { paws: [[110, 142, 25], [126, 142, -25]] },
          scratch: { paw: [79, 112, -50] },
          pack: { lift: 8,
            desk: { bag: [178, 141, 0.86], wave: [70, 114, -45], rest: [166, 128, -25] } },
          hello: { paw: [76, 113, -50], pivot: [82, 119] }, glass: [118, 143, 0.64], glassArm: { paws: [[109, 144, 35], [127, 144, -35]] },
          // the seed stays on top of the band
          phones: { l: [74, 118, -12], r: [162, 118, 12], apex: 100, size: [12, 19], top: topSeed(118, 94.6, -9) }
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
              ear(104, 100, st, -18) + ear(132, 100, st, 18) + body(BD, uid + '-bd', st) + topSeed(118, 95, -9, 0.92) + face +
              `<g class="limp" style="transform-origin:118px 140px">${paw(64, 158, 60)}${paw(172, 158, -60)}</g></g></g>`,
            anchors: { top: [118, 64], side: [[64, 98], [172, 98]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
