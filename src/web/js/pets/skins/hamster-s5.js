// Hamster S5 蠟筆手繪鼠 — crayon grain, wobbly lines, scribbled blush, twinkling stars.
// Port of docs/prototypes/shared.js s5Ham.
// Poses (crayon filter on everything): lie = melted flat on the keyboard; dangle = round-bottomed body pinched at the top.
(function (P) {
  var C = P.common, ST = C.ST, LC = '#4A3A30', O = '#FFB347', PINK = '#FF9FB0';
  var B = 'M64,174 C60,122 84,78 118,78 C152,78 176,122 172,174 Z';
  var BD = 'M64,146 C60,110 84,78 118,78 C152,78 176,110 172,146 C170,168 150,178 118,178 C86,178 66,168 64,146 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="104" cy="150" rx="7" ry="5.4" fill="${PINK}" ${ST(2.6, LC)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="132" cy="150" rx="7" ry="5.4" fill="${PINK}" ${ST(2.6, LC)}/></g>`;

  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="7" ry="5.4" fill="${PINK}" ${ST(2.6, LC)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }
  function art(path, clip, st) {
    return `<circle cx="92" cy="86" r="10" fill="${O}" ${st}/><circle cx="92" cy="87" r="5" fill="#FF9FB0"/><circle cx="144" cy="86" r="10" fill="${O}" ${st}/><circle cx="144" cy="87" r="5" fill="#FF9FB0"/>
    <path d="${path}" fill="${O}"/><g clip-path="url(#${clip})"><path d="M40,124 C66,114 90,122 118,118 C146,122 170,114 196,124 V200 H40 Z" fill="#FFF8EE"/><path d="M152,96 l10,-10 M156,104 l12,-12 M158,112 l12,-12" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${path}" fill="none" ${st}/>
    <path d="${C.star4(66, 70, 5)}" fill="#FFE066" class="tw" ${ST(1.2, LC)}/><path d="${C.star4(172, 64, 4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2, LC)}/>
    ${C.scribble(88, 118)}${C.scribble(150, 118)}
    <!--EYES-->
    <ellipse cx="118" cy="112" rx="2.6" ry="1.9" fill="#FF7F9A"/><!--MOUTH-->
    <path d="M86,110 l-12,-2 M86,114 l-12,2 M150,110 l12,-2 M150,114 l12,2" ${ST(1.6, LC)}/><!--OVER-->`;
  }

  P.register({
    id: 'hamster:s5', kind: 'hamster', skin: 's5', name: '蠟筆手繪鼠', room: 'crayon', wrap: 'crayon',
    build: function (uid) {
      var st = ST(2.6, LC), main = art(B, uid + '-b', st);
      return {
        crop: '56 56 124 112',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="head">${main}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[102, 106], [134, 106]], eyeR: 4, eyeStyle: 'crayon', hl: 1.4, ink: LC, arc: [4.5, 2.6],
          mouth: [118, 115.5], mouthStyle: 'w', mouthSize: [4.5, 2.6], mouthSW: 2
        },
        rig: {
          mode: 'crayon', line: [LC, 2.6], pivot: [118, 174], grab: [118, 58],
          top: [118, 74], qm: [158, 66], zzz: [152, 80], side: [[68, 100], [168, 100]], nose: [120, 112.5], anger: [142, 92],
          cheeks: [[88, 119, 9.5], [150, 119, 9.5]], hold: [118, 126, 0.95], smoke: 32,
          fire: [[60, 154, 1.1], [176, 154, 1.1]], bento: [150, 149, 1],
          paw: paw, pawL: PAW_L, pawR: PAW_R,
          up: { paws: [[76, 108, -60], [160, 108, 60]] },
          holdArm: { paws: [[107, 132, 30], [129, 132, -30]] },
          scratch: { paw: [82, 97, -55] },
          pack: { lift: 6,
            worn: { bag: [80, 98, 1.25, -16], straps: [[86, 94, 68, 124, 82, 158], [150, 94, 168, 124, 154, 158]], paws: [[75, 131, 15], [161, 131, -15]] },
            desk: { bag: [176, 141, 0.86], wave: [82, 98, -40], rest: [164, 126, -25] },
            hug: { bag: [118, 150, 0.85, -6], paws: [[101, 133, 35], [135, 133, -35]] } }
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="161" rx="62" ry="5" fill="${LC}" opacity=".12"/>` +
              `<g transform="translate(118 160) rotate(-4) scale(1.1 .78) translate(-118 -174)"><g class="breath" style="transform-origin:118px 174px">${main}</g></g>` +
              paw(100, 158, -10) + paw(136, 158, 10),
            anchors: { zzz: [152, 92], top: [118, 90] }
          },
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -14)"><g class="legs" style="transform-origin:118px 170px"><ellipse cx="106" cy="178" rx="6.5" ry="7.5" fill="${PINK}" ${st}/><ellipse cx="130" cy="178" rx="6.5" ry="7.5" fill="${PINK}" ${st}/></g>` +
              `<path d="M110,82 Q114,68 118,64 Q122,68 126,82 Z" fill="${O}" ${st}/>${art(BD, uid + '-bd', st)}` +
              `<g class="limp" style="transform-origin:118px 130px">${paw(72, 146, 50)}${paw(164, 146, -50)}</g></g></g>`,
            anchors: { top: [118, 56], side: [[68, 86], [168, 86]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
