// Cat S5 蠟筆手繪貓 — crayon grain, scribbled stripes and blush, twinkling stars. Port of docs/prototypes/shared.js s5Cat.
(function (P) {
  var C = P.common, ST = C.ST, LC = '#4A3A30', O = '#FFB347';
  var HD = 'M70,92 C70,62 90,50 118,50 C146,50 166,62 166,92 C166,118 146,130 118,130 C90,130 70,118 70,92 Z';

  P.register({
    id: 'cat:s5', kind: 'cat', skin: 's5', name: '蠟筆手繪貓', room: 'crayon', wrap: 'crayon',
    build: function (uid) {
      var st = ST(2.6, LC);
      return {
        crop: '54 20 128 120',
        seed: false,
        defs: `<clipPath id="${uid}-h"><path d="${HD}"/></clipPath>`,
        layers: {
          back: `<g class="tail"><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${LC}" stroke-width="17" stroke-linecap="round"/><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${O}" stroke-width="11.5" stroke-linecap="round"/></g>
     <path d="M86,176 C84,146 94,128 118,128 C142,128 152,146 150,176 Z" fill="${O}" ${st}/><ellipse cx="118" cy="154" rx="16" ry="18" fill="#FFF8EE"/>`,
          pre: '',
          front: `<g class="pawL"><ellipse cx="102" cy="151" rx="10" ry="6.5" fill="#FFF8EE" ${st}/></g><g class="pawR"><ellipse cx="134" cy="151" rx="10" ry="6.5" fill="#FFF8EE" ${st}/></g>`,
          post: `<g class="head"><path d="M76,70 L74,34 L102,54 Z" fill="${O}" ${st}/><path d="M160,70 L162,34 L134,54 Z" fill="${O}" ${st}/><path d="M80,62 L79,42 L96,55 Z" fill="#FF9FB0"/><path d="M156,62 L157,42 L140,55 Z" fill="#FF9FB0"/>
    <path d="${HD}" fill="${O}"/><g clip-path="url(#${uid}-h)"><ellipse cx="118" cy="112" rx="16" ry="10" fill="#FFF8EE"/><path d="M150,104 l8,-8 M152,110 l9,-9 M155,115 l8,-8" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${HD}" fill="none" ${st}/>
    <path d="M106,54 l3,9 M118,52 v10 M130,54 l-3,9" stroke="#E07B2E" stroke-width="3" stroke-linecap="round"/>
    <path d="${C.star4(62, 44, 5)}" fill="#FFE066" class="tw" ${ST(1.2, LC)}/><path d="${C.star4(176, 40, 4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2, LC)}/>
    ${C.scribble(88, 106)}${C.scribble(150, 106)}
    <!--EYES-->
    <path d="M115.5,103 h5 l-2.5,3 z" fill="#FF7F9A" ${ST(1.2, LC)}/><!--MOUTH-->
    <path d="M72,100 l-12,-2 M72,105 l-12,2 M164,100 l12,-2 M164,105 l12,2" ${ST(1.6, LC)}/></g>`
        },
        face: {
          eyes: [[100, 92], [136, 92]], eyeR: 4.4, eyeStyle: 'crayon', hl: 1.5, ink: LC, arc: [5, 2.6],
          mouth: [118, 107], mouthStyle: 'w', mouthSize: [4.5, 2.6], mouthSW: 2
        }
      };
    }
  });
})(QJZ.pets);
