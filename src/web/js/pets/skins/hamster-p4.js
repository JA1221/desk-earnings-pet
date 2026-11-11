// Hamster P4 圓滾麻糬鼠 — the whole hamster is one mochi; tiny face low down; squishes while typing.
// Port of docs/prototypes/shared.js mochiHam.
(function (P) {
  var C = P.common, ST = C.ST;
  var B = 'M56,172 C54,122 80,98 118,98 C156,98 182,122 180,172 Z';

  P.register({
    id: 'hamster:p4', kind: 'hamster', skin: 'p4', name: '圓滾麻糬鼠', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      return {
        crop: '50 78 136 96',
        seed: true,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="squish"><circle cx="94" cy="103" r="7.5" fill="#F9C27A" ${st}/><circle cx="94" cy="103.5" r="3.6" fill="#FFA9B6"/><circle cx="142" cy="103" r="7.5" fill="#F9C27A" ${st}/><circle cx="142" cy="103.5" r="3.6" fill="#FFA9B6"/>
    <path d="${B}" fill="#F9C27A"/><g clip-path="url(#${uid}-b)"><ellipse cx="118" cy="156" rx="44" ry="28" fill="#FFF4E4"/><ellipse cx="166" cy="140" rx="14" ry="34" fill="#EFAE62" opacity=".6"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M90,110 C96,104 104,101 112,100" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="97" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/><ellipse cx="139" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/>
    <!--EYES-->
    <ellipse cx="118" cy="130.5" rx="2" ry="1.4" fill="#FF8090"/><!--MOUTH--></g>`,
          front: `<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g><g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g>`,
          post: ''
        },
        face: {
          eyes: [[106, 126], [130, 126]], eyeR: 3.3, eyeStyle: 'dot', ink: C.L0, arc: [4, 2.4],
          mouth: [118, 133], mouthStyle: 'w', mouthSize: [3, 2], mouthSW: 1.6
        }
      };
    }
  });
})(QJZ.pets);
