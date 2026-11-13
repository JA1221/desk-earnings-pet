// Hamster P4 圓滾麻糬鼠 — the whole hamster is one mochi; tiny face low down; squishes while typing.
// Port of docs/prototypes/shared.js mochiHam.
// Poses: lie = the mochi melts flat on the keyboard; dangle = picked up by the top, the mochi stretches into a drop.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var F = '#F9C27A', W = '#FFF4E4', PINK = '#FFB8C3';
  var B = 'M56,172 C54,122 80,98 118,98 C156,98 182,122 180,172 Z';
  // the lifted mochi: pinched at the top, sagging round at the bottom
  var BD = 'M118,84 C124,84 127,93 132,100 C160,106 178,130 178,152 C178,172 152,180 118,180 C84,180 58,172 58,152 C58,130 76,106 104,100 C109,93 112,84 118,84 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}/></g>`;

  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4.2" fill="${PINK}" ${ST(2.8)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }
  function ear(x, y, st, rot) {
    return `<g${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}><circle cx="${x}" cy="${y}" r="7.5" fill="${F}" ${st}/><circle cx="${x}" cy="${y + 0.5}" r="3.6" fill="#FFA9B6"/></g>`;
  }
  // mochi body with belly and side shade, clipped to its outline
  function body(path, clip, st) {
    return `<path d="${path}" fill="${F}"/><g clip-path="url(#${clip})"><ellipse cx="118" cy="156" rx="44" ry="28" fill="${W}"/><ellipse cx="166" cy="140" rx="14" ry="34" fill="#EFAE62" opacity=".6"/></g><path d="${path}" fill="none" ${st}/>`;
  }
  var FACE = `<ellipse cx="97" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/><ellipse cx="139" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/>
    <!--EYES-->
    <ellipse cx="118" cy="130.5" rx="2" ry="1.4" fill="#FF8090"/><!--MOUTH--><!--OVER-->`;

  P.register({
    id: 'hamster:p4', kind: 'hamster', skin: 'p4', name: '圓滾麻糬鼠', room: 'sticker', wrap: null,
    poses11: ['wave', 'holdCup', 'sip', 'focus'],
    build: function (uid) {
      var st = ST(2.8);
      var shine = `<path d="M90,110 C96,104 104,101 112,100" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>`;
      var art = ear(94, 103, st) + ear(142, 103, st) + `
    ` + body(B, uid + '-b', st) + `
    ` + shine + `
    ` + FACE;
      var lifted = ear(104, 98, st, -18) + ear(132, 98, st, 18) +
        body(BD, uid + '-bd', st) + `<path d="M84,118 C90,110 98,106 106,104" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".8"/>` + FACE;
      return {
        crop: '50 78 136 96',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="squish">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[106, 126], [130, 126]], eyeR: 3.3, eyeStyle: 'dot', ink: L, arc: [4, 2.4],
          mouth: [118, 133], mouthStyle: 'w', mouthSize: [3, 2], mouthSW: 1.6
        },
        rig: {
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, 63],
          top: [118, 94], qm: [156, 88], zzz: [150, 98], side: [[66, 122], [170, 122]], nose: [119.5, 131], anger: [142, 112],
          cheeks: [[97, 134, 8], [139, 134, 8]], hold: [118, 137, 0.72], smoke: 30,
          fire: [[56, 154, 1], [180, 154, 1]], bento: [152, 149, 0.92],
          paw: paw, pawL: PAW_L, pawR: PAW_R,
          up: { paws: [[64, 124, -60], [172, 124, 60]] },
          holdArm: { paws: [[110, 143, 25], [126, 143, -25]] },
          scratch: { paw: [69, 115, -55] },
          pack: { lift: 8,
            desk: { bag: [178, 141, 0.86], wave: [66, 112, -45], rest: [168, 124, -25] } },
          hello: { paw: [67, 113, -50], pivot: [73, 119] }, glass: [118, 143, 0.64], glassArm: { paws: [[109, 144, 35], [127, 144, -35]] },
          phones: { l: [67, 121, -8], r: [169, 121, 8], size: [12, 19] }
        },
        poses: {
          // the mochi melts flat over the keyboard
          lie: {
            front: `<ellipse cx="118" cy="161" rx="66" ry="5" fill="${L}" opacity=".12"/>` +
              `<g transform="translate(118 160) scale(1.14 .76) translate(-118 -172)"><g class="breath" style="transform-origin:118px 172px">${art}</g></g>` +
              paw(100, 159, -10) + paw(136, 159, 10),
            anchors: { zzz: [150, 108], top: [118, 106] }
          },
          // lifted by the top: the mochi stretches into a drop, little feet dangling
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -20)"><g class="legs" style="transform-origin:118px 176px">` +
              `<ellipse cx="106" cy="180" rx="5.5" ry="6.5" fill="${PINK}" ${st}/><ellipse cx="130" cy="180" rx="5.5" ry="6.5" fill="${PINK}" ${st}/></g>` +
              lifted +
              `<g class="limp" style="transform-origin:118px 140px">${paw(64, 156, 60)}${paw(172, 156, -60)}</g></g></g>`,
            anchors: { top: [118, 62], side: [[66, 104], [170, 104]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
