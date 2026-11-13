// Cat H2 貪吃貓 — the cat of hamster H2 貪吃鼠 (the user's pick, candidate 小魚乾虎斑貓): a round orange tabby mochi whose
// cheeks swell out of the face outline itself, with a little dried fish on its head where H2 keeps its sunflower seed.
// Same 2.8 line, glossy eyes, blush strokes and highlight as H2; soft rounded ears, cheek and forehead stripes, a cream
// muzzle and chest, short whiskers, a tail curled low on the left (clear of the whiskers).
// Arms grow out of the mochi; their outlines ride in the mochi's own group, cut to outside the body (rig.inkClip), so a
// tilting or squishing mochi never pulls the outline off the arm.
// Poses: lie = flattened mochi asleep on the keyboard; dangle = lifted by the scruff, the pinched-up tip of the head
// on top: the round face (a little dazed) over a small hanging body, front paws curled up under the chin, hind feet and tail
// dangling, the fish sliding off to one side.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var F = '#FFB25E', W = '#FFF6EA', SH = '#F29A48', STRIPE = '#E8893A', EAR = '#FFA9B6';
  var B = C.blob([[118, 91], [97, 92.6], [81, 99], [70.5, 109], [64.5, 120], [56.5, 133], [54.5, 144], [58.5, 156], [62, 176], [118, 181]]);
  // lifted: the head pulled up into a tip at (118, 81), the cheeks, then a small body hanging below
  var BD = C.blob([[118, 81], [116.4, 84.6], [111, 90], [97, 93], [81, 99.5], [70.5, 109], [64.5, 120], [56.5, 133], [55, 144],
    [60, 153], [71, 159], [76, 168], [77.5, 182], [84, 195], [100, 202], [118, 204]]);
  var TIP = [118, 81], DANGLE_TIP_Y = 34, DS = 0.95;
  var EL = [[70, 112], [72.5, 79], [101, 95]];
  var PAW_L = `<g class="pawL">${paw(104, 150)}</g>`, PAW_R = `<g class="pawR">${paw(132, 150)}</g>`;

  // a cream paw with two toe lines (toes towards -y before rotation)
  function paw(x, y, rot) {
    return `<g transform="translate(${x} ${y})${rot ? ' rotate(' + rot + ')' : ''}"><ellipse rx="7" ry="5.2" fill="${W}" ${ST(2.8)}/><path d="M-2.4,-2.6 v2.6 M2.4,-2.6 v2.6" ${ST(1.5)}/></g>`;
  }
  function ears(st, dx) {
    dx = dx || 0;
    var l = EL.map(function (p) { return [p[0] + dx, p[1]]; }), r = l.map(function (p) { return C.mirrorX(p); });
    return `<path d="${C.softTri(l[0], l[1], l[2])}" fill="${F}" ${st}/><path d="${C.softTri(r[0], r[1], r[2])}" fill="${F}" ${st}/>` +
      `<path d="${C.innerTri(l[0], l[1], l[2], 0.55, 1.5)}" fill="${EAR}"/><path d="${C.innerTri(r[0], r[1], r[2], 0.55, 1.5)}" fill="${EAR}"/>`;
  }
  // the mochi: fur, cream chest (belly = [cx, cy, rx, ry]) and the right-hand shade under the clip, outline on top
  function fur(path, clip, st, belly) {
    var b = belly || [118, 164, 50, 31];
    return `<path class="fur" d="${path}" fill="${F}"/><g clip-path="url(#${clip})"><ellipse cx="${b[0]}" cy="${b[1]}" rx="${b[2]}" ry="${b[3]}" fill="${W}"/>` +
      `<ellipse cx="172" cy="136" rx="13" ry="38" fill="${SH}" opacity=".5"/></g><path d="${path}" fill="none" ${st}/>`;
  }
  function tail(d, origin, stripes) {
    return `<g class="tail" style="transform-origin:${origin}"><path d="${d}" fill="none" stroke="${L}" stroke-width="15.1" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${F}" stroke-width="9.5" stroke-linecap="round"/>${stripes || ''}</g>`;
  }
  // the little dried fish balanced on top of the head (inside the head group, so it rides along): silver, darker back,
  // head left and forked tail right
  function topFish(x, y, rot, sc) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc || 1})"><path d="M6,0 L11.6,-4.6 Q10,0 11.6,4.6 Z" fill="#8E9DAD" ${ST(1.5)}/>` +
      `<path d="M-10,0 C-6,-5.4 3,-5.4 7.4,0 C3,5.4 -6,5.4 -10,0 Z" fill="#C9D4DE" ${ST(1.6)}/>` +
      `<path d="M-6.4,-1.6 C-2.6,-3.6 1.8,-3.6 5.6,-1.2" fill="none" stroke="#7F8E9C" stroke-width="1.3" stroke-linecap="round"/>` +
      `<circle cx="-6.2" cy="-.5" r="1.05" fill="${L}"/><path d="M-3.4,-2.6 q1.4,2.6 0,5.2" fill="none" stroke="${L}" stroke-width=".9" opacity=".7"/>` +
      `<path d="M-7.6,-2.8 q2,-1.6 4.6,-1.8" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8"/></g>`;
  }
  // a short hind leg hanging behind the body, ending in a foot
  function leg(x) {
    var d = `M${x},194 L${x},207`;
    return `<path d="${d}" fill="none" stroke="${L}" stroke-width="15.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${F}" stroke-width="10" stroke-linecap="round"/>` + paw(x, 210, 180);
  }
  function n(v) { return Math.round(v * 100) / 100; }

  P.register({
    id: 'cat:h2', kind: 'cat', skin: 'h2', name: '貪吃貓', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      var face = `<path d="M108,96.5 v6 M118,95 v8 M128,96.5 v6" stroke="${STRIPE}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M78,121 C81,111 88,104 96,101" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    <path d="M64.6,118 l7,1.6 M61.4,124 l7.4,.4 M171.4,118 l-7,1.6 M174.6,124 l-7.4,.4" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="110.2" cy="133.2" rx="9.2" ry="6.6" fill="${W}"/><ellipse cx="125.8" cy="133.2" rx="9.2" ry="6.6" fill="${W}"/>
    <ellipse cx="86" cy="134" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${C.blushLines(86, 134)}
    <ellipse cx="150" cy="134" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${C.blushLines(150, 134)}
    <path d="M58.6,129.6 l-8,-2.2 M58,135 l-8,1 M177.4,129.6 l8,-2.2 M178,135 l8,1" ${ST(1.7)}/>
    <!--EYES-->
    <path d="M115.4,126.8 h5.2 q-.5,2.4 -2.6,3 q-2.1,-.6 -2.6,-3 z" fill="#FF8090" ${ST(1.2)}/><!--MOUTH--><!--OVER-->`;
      var mochi = ears(st) + fur(B, uid + '-b', st) + topFish(118, 86.4, -9, 1.3) + face;
      var art = tail('M84,158 C64,162 51,157 47.5,145.5', '58px 156px',
        `<path d="M51.4,154.4 l3,-5.2 M47.6,148 l6,-1.4" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>`) + mochi;
      // asleep, the tail curls in close to the flattened mochi (inside the pet area)
      var sleepy = tail('M86,160 C70,164 60,158 57,149', '64px 156px',
        `<path d="M61.4,157.6 l2.6,-5.4" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>`) + mochi;
      // lifted: the tip of the head at (118, DANGLE_TIP_Y), the whole cat a little smaller
      var lift = `translate(118 ${DANGLE_TIP_Y}) scale(${DS}) translate(${-TIP[0]} ${-TIP[1]})`;
      function at(p) { return [n(118 + (p[0] - TIP[0]) * DS), n(DANGLE_TIP_Y + (p[1] - TIP[1]) * DS)]; }
      return {
        crop: '48 60 140 104',
        seed: false,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath>` +
          `<clipPath id="${uid}-out"><path clip-rule="evenodd" d="M0,0 H240 V240 H0 Z ${B}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="squish">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[100.5, 122], [135.5, 122]], eyeR: 6.1, eyeStyle: 'gloss', ink: L, arc: [5.4, 2.6],
          mouth: [118, 130.2], mouthStyle: 'w', mouthSize: [3.6, 2.3], mouthSW: 1.7
        },
        rig: {
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, DANGLE_TIP_Y - 1],
          top: [118, 82], qm: [142, 76], zzz: [154, 92], side: [[62, 122], [174, 122]], nose: [120, 126], anger: [142, 104],
          cheeks: [[86, 135, 10], [150, 135, 10]], hold: [118, 140, 0.8], smoke: 36,
          fire: [[56, 154, 1], [180, 154, 1]], bento: [154, 149, 0.92],
          paw: paw, limb: { fill: F }, pawL: PAW_L, pawR: PAW_R, inkClip: `url(#${uid}-out)`,
          up: { ink: 'over', fill: 'over', w: [10.5, 8], arms: [[[77, 122], [58, 104], -40], [[159, 122], [178, 104], 40]] },
          holdArm: { paws: [[108, 143, 25], [128, 143, -25]] },
          scratch: { ink: 'over', fill: 'over', w: [10.5, 8], arm: [[78, 120], [72, 104]], paw: [74, 98, -40] },
          pack: { lift: 6, desk: { bag: [178, 141, 0.86], rest: [164, 127, -20] } },
          hello: { ink: 'over', fill: 'over', w: [10.5, 8], arm: [[77, 122], [56, 100], -40] }, glass: [118, 143.5, 0.66], bang: [179, 92],
          // the fish stays on top of the band
          phones: { l: [65, 116, -10], r: [171, 116, 10], apex: 91.5, size: [12, 19], top: topFish(118, 86.4, -9, 1.3) }
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="161" rx="66" ry="5" fill="${L}" opacity=".12"/>` +
              `<g transform="translate(118 160) scale(1.1 .78) translate(-118 -172)"><g class="breath" style="transform-origin:118px 172px">${sleepy}</g></g>` +
              paw(103, 159, -10) + paw(133, 159, 10),
            anchors: { zzz: [152, 104], top: [118, 98] }
          },
          dangle: {
            front: `<g class="swing"><g transform="${lift}">` +
              tail('M100,197 C93,213 77,216 72,204', '100px 197px', `<path d="M86.6,213.4 l-1.2,-6.4" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>`) +
              `<g class="legs" style="transform-origin:118px 196px">${leg(104)}${leg(132)}</g>` +
              ears(st, 2) + fur(BD, uid + '-bd', st, [118, 178, 33, 44]) + topFish(131, 91, 24, 1.2) + face +
              `<g class="limp" style="transform-origin:118px 150px">${paw(98, 155, 158)}${paw(138, 155, -158)}</g></g></g>`,
            anchors: { top: at([118, 74]), side: [at([62, 122]), at([174, 122])] }
          }
        }
      };
    }
  });
})(QJZ.pets);
