// Hamster S4 扁平幾何鼠 — no outlines, built from circles, two-tone left/right. Port of docs/prototypes/shared.js s4Ham.
// Poses stay flat and geometric: lie = the circle squashed into an oval on the keyboard; dangle = circle body
// pinched at the top with round feet.
(function (P) {
  var O = '#F2A65A', D = '#E08A3E', CR = '#FFF3E3', INK = '#2B2B3A', PINK = '#FFB8C3';
  var PAW_L = `<g class="pawL"><circle cx="104" cy="150" r="6.5" fill="${PINK}"/></g>`;
  var PAW_R = `<g class="pawR"><circle cx="132" cy="150" r="6.5" fill="${PINK}"/></g>`;

  function paw(x, y) { return `<circle cx="${x}" cy="${y}" r="6.5" fill="${PINK}"/>`; }

  P.register({
    id: 'hamster:s4', kind: 'hamster', skin: 's4', name: '扁平幾何鼠', room: 'flat', wrap: null,
    build: function (uid) {
      var art = `<circle cx="86" cy="76" r="13" fill="${D}"/><circle cx="86" cy="76" r="6.5" fill="#FF9FB0"/><circle cx="150" cy="76" r="13" fill="${D}"/><circle cx="150" cy="76" r="6.5" fill="#FF9FB0"/>
    <circle cx="118" cy="122" r="52" fill="${O}"/><g clip-path="url(#${uid}-b)"><rect x="118" y="60" width="60" height="120" fill="${D}" opacity=".35"/><circle cx="118" cy="152" r="38" fill="${CR}"/><rect x="118" y="110" width="40" height="80" fill="#F3E2CC" opacity=".6"/></g>
    <path d="M113,72 h10 l-5,12 z" fill="${D}"/><circle cx="118" cy="119" r="13" fill="${CR}"/>
    <circle cx="90" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/><circle cx="146" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/>
    <!--EYES-->
    <path d="M114.5,114 h7 l-3.5,4 z" fill="#E8607A"/><!--MOUTH--><!--OVER-->`;
      return {
        crop: '58 58 120 116',
        seed: true,
        defs: `<clipPath id="${uid}-b"><circle cx="118" cy="122" r="52"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="head">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[101, 106], [135, 106]], eyeR: 5, eyeStyle: 'flat', hl: 1.6, ink: INK, arc: [5, 2.6],
          mouth: [118, 121], mouthStyle: 'w', mouthSize: [4, 2.4], mouthSW: 1.6
        },
        rig: {
          mode: 'flat', line: [INK, 0], pivot: [118, 174], grab: [118, 50],
          top: [118, 64], qm: [168, 56], zzz: [152, 68], side: [[70, 102], [166, 102]], nose: [119.5, 116], anger: [144, 86],
          cheeks: [[90, 122, 9.5], [146, 122, 9.5]], hold: [118, 130, 0.95], smoke: 32,
          fire: [[62, 154, 1.1], [174, 154, 1.1]], bento: [150, 149, 1],
          bag: { x: 164, y: 104, s: 1.05, rot: 14, straps: [[80, 124, 90, 146], [156, 124, 146, 146]] },
          paw: paw, pawL: PAW_L, pawR: PAW_R,
          up: { paws: [[68, 108, 0], [168, 108, 0]] },
          holdArm: { paws: [[108, 135, 0], [128, 135, 0]] },
          scratch: { paw: [70, 95, 0] },
          strap: [[89, 140, 0], [147, 140, 0]]
        },
        poses: {
          // the circle flattens into a wide oval over the keyboard
          lie: {
            front: `<ellipse cx="118" cy="161" rx="60" ry="5" fill="${INK}" opacity=".1"/>` +
              `<g transform="translate(118 160) rotate(-4) scale(1.08 .8) translate(-118 -174)"><g class="breath" style="transform-origin:118px 174px">${art}</g></g>` +
              paw(100, 158) + paw(136, 158),
            anchors: { zzz: [152, 84], top: [118, 80] }
          },
          // pinched up at the top (a little triangle tuft), round feet swinging below
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -14)"><g class="legs" style="transform-origin:118px 168px"><circle cx="106" cy="174" r="7" fill="${PINK}"/><circle cx="130" cy="174" r="7" fill="${PINK}"/></g>` +
              `<path d="M110,74 L118,58 L126,74 Z" fill="${D}"/>${art}` +
              `<g class="limp" style="transform-origin:118px 130px">${paw(74, 146)}${paw(162, 146)}</g></g></g>`,
            anchors: { top: [118, 50], side: [[70, 88], [166, 88]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
