// Cat S5 蠟筆手繪貓 — crayon grain, scribbled stripes and blush, twinkling stars. Port of docs/prototypes/shared.js s5Cat.
// Poses (crayon filter on everything): lie = head resting on its paws, back and tail behind; dangle = held by the
// scruff, round-bottomed body with dangling legs and tail.
(function (P) {
  var C = P.common, ST = C.ST, LC = '#4A3A30', O = '#FFB347', CR = '#FFF8EE';
  var HD = 'M70,92 C70,62 90,50 118,50 C146,50 166,62 166,92 C166,118 146,130 118,130 C90,130 70,118 70,92 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="102" cy="151" rx="10" ry="6.5" fill="${CR}" ${ST(2.6, LC)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="134" cy="151" rx="10" ry="6.5" fill="${CR}" ${ST(2.6, LC)}/></g>`;

  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="6.5" fill="${CR}" ${ST(2.6, LC)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }
  function tail(d, origin) {
    return `<g class="tail"${origin ? ' style="transform-origin:' + origin + '"' : ''}><path d="${d}" fill="none" stroke="${LC}" stroke-width="17" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${O}" stroke-width="11.5" stroke-linecap="round"/></g>`;
  }
  // limbs that grow out of the torso without a seam: outlines go before the torso, fur after it (QJZ.pets.rig.grow)
  function grown(R, pairs, w) {
    var ink = '', fur = '';
    pairs.forEach(function (p) { var g = P.rig.grow(R, p, w); ink += g.ink; fur += g.fill; });
    return { ink: ink, fur: fur };
  }

  P.register({
    id: 'cat:s5', kind: 'cat', skin: 's5', name: '蠟筆手繪貓', room: 'crayon', wrap: 'crayon',
    build: function (uid) {
      var st = ST(2.6, LC);
      var head = `<path d="M76,70 L74,34 L102,54 Z" fill="${O}" ${st}/><path d="M160,70 L162,34 L134,54 Z" fill="${O}" ${st}/><path d="M80,62 L79,42 L96,55 Z" fill="#FF9FB0"/><path d="M156,62 L157,42 L140,55 Z" fill="#FF9FB0"/>
    <path d="${HD}" fill="${O}"/><g clip-path="url(#${uid}-h)"><ellipse cx="118" cy="112" rx="16" ry="10" fill="${CR}"/><path d="M150,104 l8,-8 M152,110 l9,-9 M155,115 l8,-8" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${HD}" fill="none" ${st}/>
    <path d="M106,54 l3,9 M118,52 v10 M130,54 l-3,9" stroke="#E07B2E" stroke-width="3" stroke-linecap="round"/>
    <path d="${C.star4(62, 44, 5)}" fill="#FFE066" class="tw" ${ST(1.2, LC)}/><path d="${C.star4(176, 40, 4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2, LC)}/>
    ${C.scribble(88, 106)}${C.scribble(150, 106)}
    <!--EYES-->
    <path d="M115.5,103 h5 l-2.5,3 z" fill="#FF7F9A" ${ST(1.2, LC)}/><!--MOUTH-->
    <path d="M72,100 l-12,-2 M72,105 l-12,2 M164,100 l12,-2 M164,105 l12,2" ${ST(1.6, LC)}/><!--OVER-->`;
      var R = { line: [LC, 2.6], limb: { fill: O }, mode: 'crayon' };
      var legs = grown(R, [[[108, 168], [106, 181]], [[128, 168], [130, 181]]], [11, 9.5]);
      var limp = grown(R, [[[97, 136], [91, 153]], [[139, 136], [145, 153]]], [11.5, 9.5]);
      var LEGS = '<g class="legs" style="transform-origin:118px 166px">', LIMP = '<g class="limp" style="transform-origin:118px 134px">';
      var bodyD = 'M86,168 C84,142 94,126 118,126 C142,126 152,142 150,168 C148,180 88,180 86,168 Z';
      return {
        crop: '54 20 128 120',
        seed: false,
        defs: `<clipPath id="${uid}-h"><path d="${HD}"/></clipPath>`,
        layers: {
          back: `<g class="tail"><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${LC}" stroke-width="17" stroke-linecap="round"/><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${O}" stroke-width="11.5" stroke-linecap="round"/></g>
     <path d="M86,176 C84,146 94,128 118,128 C142,128 152,146 150,176 Z" fill="${O}" ${st}/><ellipse cx="118" cy="154" rx="16" ry="18" fill="${CR}"/>`,
          pre: '',
          front: PAW_L + PAW_R,
          post: `<g class="head">${head}</g>`
        },
        face: {
          eyes: [[100, 92], [136, 92]], eyeR: 4.4, eyeStyle: 'crayon', hl: 1.5, ink: LC, arc: [5, 2.6],
          mouth: [118, 107], mouthStyle: 'w', mouthSize: [4.5, 2.6], mouthSW: 2
        },
        rig: {
          mode: 'crayon', line: [LC, 2.6], pivot: [118, 128], grab: [118, 30],
          top: [118, 46], qm: [126, 34], zzz: [158, 50], side: [[70, 86], [166, 86]], nose: [119.5, 104], anger: [146, 66],
          cheeks: [[88, 107, 10], [150, 107, 10]], hold: [118, 122, 1], smoke: 38,
          fire: [[72, 152, 1.15], [164, 152, 1.15]], bento: [154, 149, 1],
          paw: paw, limb: { fill: O }, pawL: PAW_L, pawR: PAW_R,
          up: { ink: 'back', fill: 'front', w: [13, 9], arms: [[[96, 138], [62, 88], -25], [[140, 138], [174, 88], 25]] },
          holdArm: { paws: [[106, 127, 20], [130, 127, -20]] },
          scratch: { ink: 'back', fill: 'front', w: 10, arm: [[98, 138], [60, 106], [74, 70]], paw: [82, 58, -30] },
          pack: { lift: 4,
            worn: { bag: [160, 128, 1.15, 16], straps: [[100, 130, 104, 152], [136, 130, 132, 152]], slot: 'front',
              paws: [[103, 140, 0], [133, 140, 0]], arms: [[[92, 144], [101, 141]], [[144, 144], [135, 141]]], w: 10 },
            desk: { bag: [178, 141, 0.86], rest: [162, 130, -20], restArm: [[144, 140], [158, 132]], w: 10 },
            hug: { bag: [118, 148, 0.9, -6], paws: [[104, 144, 30], [132, 144, -30]], arms: [[[92, 142], [102, 143]], [[144, 142], [134, 143]]], w: 10 } }
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="162" rx="58" ry="5" fill="${LC}" opacity=".12"/>` +
              tail('M140,156 C168,160 180,140 170,120', '140px 156px') +
              `<path d="M100,160 C100,136 116,124 138,126 C158,128 166,144 164,160 Z" fill="${O}" ${st}/>` +
              `<g transform="translate(-4 30) rotate(-11 118 130)"><g class="breath" style="transform-origin:118px 130px">${head}</g></g>` +
              paw(104, 160, -6) + paw(132, 160, 6),
            anchors: { zzz: [156, 74], top: [112, 74] }
          },
          dangle: {
            front: `<g class="swing"><g transform="translate(118 30) scale(.95) translate(-118 -46)">` + tail('M104,170 C90,180 78,168 78,152', '104px 170px') +
              LEGS + legs.ink + '</g>' + LIMP + limp.ink + '</g>' +
              `<path d="${bodyD}" fill="${O}" ${st}/><ellipse cx="118" cy="152" rx="16" ry="17" fill="${CR}"/>` +
              LEGS + legs.fur + paw(106, 184, 180) + paw(130, 184, 180) + '</g>' +
              LIMP + limp.fur + paw(90, 157, 170) + paw(146, 157, -170) + '</g>' +
              head + `</g></g>`,
            anchors: { top: [118, 30], side: [[70, 68], [166, 68]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
