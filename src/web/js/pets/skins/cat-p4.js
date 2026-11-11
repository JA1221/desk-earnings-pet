// Cat P4 圓滾麻糬貓 — toast-shaped mochi cat that squishes while typing. Port of docs/prototypes/shared.js mochiCat.
(function (P) {
  var C = P.common, ST = C.ST;
  var B = 'M60,172 C58,116 80,86 118,86 C156,86 178,116 176,172 Z';

  P.register({
    id: 'cat:p4', kind: 'cat', skin: 'p4', name: '圓滾麻糬貓', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      return {
        crop: '50 58 136 110',
        seed: false,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="squish"><g class="tail"><path d="M70,160 C44,160 38,136 50,124" fill="none" stroke="${C.L0}" stroke-width="15" stroke-linecap="round"/><path d="M70,160 C44,160 38,136 50,124" fill="none" stroke="#FFB868" stroke-width="9.5" stroke-linecap="round"/></g>
    <path d="M74,104 L72,72 Q74,66 80,70 L102,88 Z" fill="#FFB868" ${st}/><path d="M162,104 L164,72 Q162,66 156,70 L134,88 Z" fill="#FFB868" ${st}/><path d="M78,96 L77,78 L94,90 Z" fill="#FFA9B6"/><path d="M158,96 L159,78 L142,90 Z" fill="#FFA9B6"/>
    <path d="${B}" fill="#FFB868"/><g clip-path="url(#${uid}-b)"><ellipse cx="118" cy="160" rx="38" ry="26" fill="#FFF6EA"/><ellipse cx="170" cy="134" rx="14" ry="40" fill="#F29A48" opacity=".55"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M108,90 v8 M118,88 v9 M128,90 v8" stroke="#E8893A" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="96" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/><ellipse cx="140" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/>
    <!--EYES-->
    <path d="M116,121.5 h4 l-2,2z" fill="#FF8090" ${ST(1.1)}/><!--MOUTH-->
    <path d="M86,122 h-10 M86,127 l-9,2 M150,122 h10 M150,127 l9,2" ${ST(1.7)}/></g>`,
          front: `<g class="pawL"><ellipse cx="100" cy="151" rx="8.5" ry="5.5" fill="#FFF6EA" ${st}/></g><g class="pawR"><ellipse cx="136" cy="151" rx="8.5" ry="5.5" fill="#FFF6EA" ${st}/></g>`,
          post: ''
        },
        face: {
          eyes: [[104, 117], [132, 117]], eyeR: 3.5, eyeStyle: 'dot', ink: C.L0, arc: [4.5, 2.4],
          mouth: [118, 124.5], mouthStyle: 'w', mouthSize: [4, 2.4], mouthSW: 1.7
        }
      };
    }
  });
})(QJZ.pets);
