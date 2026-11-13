// Cat S4 扁平幾何貓 — the cat of hamster S4 (the user's pick, candidate 圓圓橘貓): hamster S4's own build, one big
// circle with no outlines, two-tone left/right (the right half under a darker veil, the right ear darker), as an orange
// tabby with soft rounded-triangle ears, three little forehead stripes, a cream muzzle and chest, short whiskers and a
// tail curled low. Arms are flat fur grown out of the circle; their colour follows the split (OD on the right), so they
// melt into the body, and the whiskers are drawn after them. Paws get a darker circle peeking out underneath so they
// keep an edge on the cream chest and on the keyboard.
// Poses: lie = the circle squashed into an oval over the keyboard; dangle = lifted by the scruff: the circle pinched
// up into a soft tip on top, arms and legs hanging limp, tail behind.
(function (P) {
  var C = P.common;
  var O = '#F2A65A', D = '#E08A3E', CR = '#FFF3E3', INK = '#2B2B3A', PINK = '#FF9FB0';
  var OD = '#EC9C50';   // O under the .35 D veil: the right half
  var EL = [[72, 99], [70, 62.5], [97, 74.5]];
  var TIP = [118, 57], DANGLE_DY = -15;
  var PAW_L = `<g class="pawL">${paw(104, 151)}</g>`, PAW_R = `<g class="pawR">${paw(132, 151)}</g>`;

  function paw(x, y) {
    return `<circle cx="${x}" cy="${Math.round((y + 1.6) * 100) / 100}" r="7.5" fill="${D}"/><circle cx="${x}" cy="${y}" r="7.5" fill="${CR}"/>`;
  }
  function tail(d, origin) {
    return `<g class="tail" style="transform-origin:${origin}"><path d="${d}" fill="none" stroke="${D}" stroke-width="12" stroke-linecap="round"/></g>`;
  }
  function ears() {
    var l = EL, r = l.map(function (p) { return C.mirrorX(p); });
    return `<path d="${C.softTri(l[0], l[1], l[2], 0.36, 3)}" fill="${O}"/><path d="${C.softTri(r[0], r[1], r[2], 0.36, 3)}" fill="${D}"/>` +
      `<path d="${C.innerTri(l[0], l[1], l[2], 0.5, 2.5)}" fill="${PINK}"/><path d="${C.innerTri(r[0], r[1], r[2], 0.5, 2.5)}" fill="${PINK}"/>`;
  }
  // limbs that grow out of the body without a seam (QJZ.pets.rig.grow; flat: fur only)
  function grown(R, pairs, w) {
    return pairs.map(function (p) { return P.rig.grow(R, p, w).fill; }).join('');
  }

  P.register({
    id: 'cat:s4', kind: 'cat', skin: 's4', name: '扁平幾何貓', room: 'flat', wrap: null,
    build: function (uid) {
      var art = ears() + `<circle class="fur" cx="118" cy="122" r="52" fill="${O}"/><g clip-path="url(#${uid}-b)"><circle cx="118" cy="170" r="31" fill="${CR}"/>` +
        `<rect x="118" y="68" width="52" height="108" fill="${D}" opacity=".35"/>` +
        `<path d="M108.5,71 h6 l-3,10 z M115,69.5 h6 l-3,12 z M121.5,71 h6 l-3,10 z" fill="${D}"/></g>` +
        `<circle cx="110.5" cy="125" r="8.4" fill="${CR}"/><circle cx="125.5" cy="125" r="8.4" fill="${CR}"/>` +
        `<circle cx="86" cy="124" r="7" fill="${PINK}" opacity=".9"/><circle cx="150" cy="124" r="7" fill="${PINK}" opacity=".9"/>` +
        `<!--EYES--><path d="M114.6,117.6 h6.8 l-3.4,4 z" fill="#E8607A"/><!--MOUTH--><!--OVER-->` +
        `<path d="M70.5,117 l-8.5,-2 M70.5,123 l-8.5,2 M165.5,117 l8.5,-2 M165.5,123 l8.5,2" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
      var lowTail = tail('M86,160 C65,163 53,154 53,138', '61px 156px');
      var sleepTail = tail('M86,160 C67,163 57,155 57,142', '64px 156px');   // asleep: curled in closer
      var R = { line: [INK, 0], limb: { fill: `url(#${uid}-lf)` }, mode: 'flat' };
      // the scruff pulled up into a soft tip, two-tone like the rest (its rounded apex lies 2.1 below TIP: rig.grab)
      var tuft = `<path d="${C.softTri([105, 78], TIP, [131, 78], 0.2, 1.2)}" fill="url(#${uid}-lf)"/>`;
      return {
        crop: '58 52 120 120',
        seed: false,
        defs: `<clipPath id="${uid}-b"><circle cx="118" cy="122" r="52"/></clipPath>` +
          `<linearGradient id="${uid}-lf" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="236" y2="0"><stop offset=".5" stop-color="${O}"/><stop offset=".5" stop-color="${OD}"/></linearGradient>`,
        layers: {
          back: '',
          pre: `<g class="head">${lowTail}${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[99.5, 110], [136.5, 110]], eyeR: 5.8, eyeStyle: 'flat', hl: 1.9, ink: INK, arc: [5.6, 2.6],
          mouth: [118, 122.4], mouthStyle: 'w', mouthSize: [4.4, 2.6], mouthSW: 1.6
        },
        rig: {
          mode: 'flat', line: [INK, 0], pivot: [118, 174], grab: [118, TIP[1] + DANGLE_DY + 2.5],
          top: [118, 64], qm: [146, 58], zzz: [158, 74], side: [[66, 110], [170, 110]], nose: [119.5, 119], anger: [146, 88],
          cheeks: [[86, 124, 9], [150, 124, 9]], hold: [118, 132, 0.95], smoke: 34,
          fire: [[62, 154, 1.1], [174, 154, 1.1]], bento: [152, 149, 1],
          paw: paw, limb: { fill: `url(#${uid}-lf)` }, pawL: PAW_L, pawR: PAW_R,
          up: { ink: 'back', fill: 'over', w: [13, 10], arms: [[[84, 140], [60, 103], -30], [[152, 140], [176, 103], 30]] },
          holdArm: { paws: [[107, 136, 0], [129, 136, 0]] },
          scratch: { ink: 'back', fill: 'over', w: 11, arm: [[82, 134], [60, 114], [64, 90]], paw: [68, 82, 0] },
          pack: { lift: 5, desk: { bag: [178, 141, 0.86], rest: [164, 128, 0] } },
          hello: { ink: 'back', fill: 'over', w: [13, 10], arm: [[84, 138], [58, 96], -35] }, glass: [118, 139, 0.88], bang: [179, 78],
          glassArm: { paws: [[107, 140, 0], [129, 140, 0]] },
          phones: { l: [67, 112, -8], r: [169, 112, 8], size: [13, 21] }
        },
        poses: {
          // the circle flattens into a wide oval over the keyboard, tail curled beside it
          lie: {
            front: `<ellipse cx="118" cy="161" rx="62" ry="5" fill="${INK}" opacity=".1"/>` +
              `<g transform="translate(118 160) rotate(-4) scale(1.08 .8) translate(-118 -174)"><g class="breath" style="transform-origin:118px 174px">${sleepTail}${art}</g></g>` +
              paw(100, 158) + paw(136, 158),
            anchors: { zzz: [152, 82], top: [118, 80] }
          },
          // held by the scruff: the soft tip on top, arms and legs hanging limp, tail behind
          dangle: {
            front: `<g class="swing"><g transform="translate(0 ${DANGLE_DY})">` + tail('M104,166 C94,182 80,180 78,166', '104px 166px') +
              `<g class="legs" style="transform-origin:118px 168px">${grown(R, [[[106, 160], [105, 174]], [[130, 160], [131, 174]]], [12, 10])}${paw(105, 176)}${paw(131, 176)}</g>` +
              tuft + art +
              `<g class="limp" style="transform-origin:118px 130px">${grown(R, [[[78, 132], [72, 146]], [[158, 132], [164, 146]]], [12, 10])}${paw(71, 148)}${paw(165, 148)}</g></g></g>`,
            anchors: { top: [118, TIP[1] + DANGLE_DY - 6], side: [[66, 96], [170, 96]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
