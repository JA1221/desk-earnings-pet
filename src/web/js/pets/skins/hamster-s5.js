// Hamster S5 蠟筆手繪鼠 — crayon grain, wobbly lines, scribbled blush, twinkling stars.
// Port of docs/prototypes/shared.js s5Ham.
(function (P) {
  var C = P.common, ST = C.ST, LC = '#4A3A30';
  var B = 'M64,174 C60,122 84,78 118,78 C152,78 176,122 172,174 Z';

  P.register({
    id: 'hamster:s5', kind: 'hamster', skin: 's5', name: '蠟筆手繪鼠', room: 'crayon', wrap: 'crayon',
    build: function (uid) {
      var st = ST(2.6, LC);
      return {
        crop: '56 56 124 112',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="head"><circle cx="92" cy="86" r="10" fill="#FFB347" ${st}/><circle cx="92" cy="87" r="5" fill="#FF9FB0"/><circle cx="144" cy="86" r="10" fill="#FFB347" ${st}/><circle cx="144" cy="87" r="5" fill="#FF9FB0"/>
    <path d="${B}" fill="#FFB347"/><g clip-path="url(#${uid}-b)"><path d="M40,124 C66,114 90,122 118,118 C146,122 170,114 196,124 V200 H40 Z" fill="#FFF8EE"/><path d="M152,96 l10,-10 M156,104 l12,-12 M158,112 l12,-12" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${B}" fill="none" ${st}/>
    <path d="${C.star4(66, 70, 5)}" fill="#FFE066" class="tw" ${ST(1.2, LC)}/><path d="${C.star4(172, 64, 4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2, LC)}/>
    ${C.scribble(88, 118)}${C.scribble(150, 118)}
    <!--EYES-->
    <ellipse cx="118" cy="112" rx="2.6" ry="1.9" fill="#FF7F9A"/><!--MOUTH-->
    <path d="M86,110 l-12,-2 M86,114 l-12,2 M150,110 l12,-2 M150,114 l12,2" ${ST(1.6, LC)}/></g>`,
          front: `<g class="pawL"><ellipse cx="104" cy="150" rx="7" ry="5.4" fill="#FF9FB0" ${st}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="7" ry="5.4" fill="#FF9FB0" ${st}/></g>`,
          post: ''
        },
        face: {
          eyes: [[102, 106], [134, 106]], eyeR: 4, eyeStyle: 'crayon', hl: 1.4, ink: LC, arc: [4.5, 2.6],
          mouth: [118, 115.5], mouthStyle: 'w', mouthSize: [4.5, 2.6], mouthSW: 2
        }
      };
    }
  });
})(QJZ.pets);
