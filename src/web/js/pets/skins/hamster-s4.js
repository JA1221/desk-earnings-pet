// Hamster S4 扁平幾何鼠 — no outlines, built from circles, two-tone left/right. Port of docs/prototypes/shared.js s4Ham.
(function (P) {
  var O = '#F2A65A', D = '#E08A3E', CR = '#FFF3E3', INK = '#2B2B3A';

  P.register({
    id: 'hamster:s4', kind: 'hamster', skin: 's4', name: '扁平幾何鼠', room: 'flat', wrap: null,
    build: function (uid) {
      return {
        crop: '58 58 120 116',
        seed: true,
        defs: `<clipPath id="${uid}-b"><circle cx="118" cy="122" r="52"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="head"><circle cx="86" cy="76" r="13" fill="${D}"/><circle cx="86" cy="76" r="6.5" fill="#FF9FB0"/><circle cx="150" cy="76" r="13" fill="${D}"/><circle cx="150" cy="76" r="6.5" fill="#FF9FB0"/>
    <circle cx="118" cy="122" r="52" fill="${O}"/><g clip-path="url(#${uid}-b)"><rect x="118" y="60" width="60" height="120" fill="${D}" opacity=".35"/><circle cx="118" cy="152" r="38" fill="${CR}"/><rect x="118" y="110" width="40" height="80" fill="#F3E2CC" opacity=".6"/></g>
    <path d="M113,72 h10 l-5,12 z" fill="${D}"/><circle cx="118" cy="119" r="13" fill="${CR}"/>
    <circle cx="90" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/><circle cx="146" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/>
    <!--EYES-->
    <path d="M114.5,114 h7 l-3.5,4 z" fill="#E8607A"/><!--MOUTH--></g>`,
          front: `<g class="pawL"><circle cx="104" cy="150" r="6.5" fill="#FFB8C3"/></g><g class="pawR"><circle cx="132" cy="150" r="6.5" fill="#FFB8C3"/></g>`,
          post: ''
        },
        face: {
          eyes: [[101, 106], [135, 106]], eyeR: 5, eyeStyle: 'flat', hl: 1.6, ink: INK, arc: [5, 2.6],
          mouth: [118, 121], mouthStyle: 'w', mouthSize: [4, 2.4], mouthSW: 1.6
        }
      };
    }
  });
})(QJZ.pets);
