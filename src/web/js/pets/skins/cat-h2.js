// Cat H2 鼓鼓頰貓 — the cat of hamster H2: an orange tabby mochi whose whisker pads puff out into big round cheeks,
// with a little dried fish balanced on its head where H2 keeps its sunflower seed. Same 2.8 line, two-tone cheeks,
// highlights and round build as H2; pointed ears, whiskers, forehead stripes and a curled tail make it a cat.
// Poses: lie = flattened mochi asleep on the keyboard, cheeks still full; dangle = lifted mochi drop, cheeks swinging,
// feet and tail hanging.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var F = '#FFB25E', W = '#FFF6EA', SH = '#F29A48', STRIPE = '#E8893A', EAR = '#FFA9B6';
  var B = 'M62,172 C60,124 84,96 118,96 C152,96 176,124 174,172 Z';
  var BD = 'M118,86 C124,86 127,95 132,102 C158,108 176,130 176,152 C176,172 150,180 118,180 C86,180 60,172 60,152 C60,130 78,108 104,102 C109,95 112,86 118,86 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="104" cy="150" rx="7" ry="5.2" fill="${W}" ${ST(2.8)}/><path d="M101.6,147.4 v2.6 M106.4,147.4 v2.6" ${ST(1.5)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="132" cy="150" rx="7" ry="5.2" fill="${W}" ${ST(2.8)}/><path d="M129.6,147.4 v2.6 M134.4,147.4 v2.6" ${ST(1.5)}/></g>`;

  // a puffed whisker pad: H2's two-tone cheek with blush and highlight, two whiskers pointing out
  function cheek(cx, uid, st) {
    var bx = cx + (cx < 118 ? 3 : -3), o = cx < 118 ? -1 : 1, wx = cx + o * 16;
    return `<g class="puff" style="transform-origin:${cx}px 139px;animation-delay:${cx < 118 ? 0 : -0.6}s"><circle cx="${cx}" cy="139" r="20" fill="url(#${uid}-ck)" ${st}/><ellipse cx="${bx}" cy="142" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${C.blushLines(bx, 142)}<path d="M${cx - 12},128 q5,-7 12,-7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".85"/>` +
      `<path d="M${wx},134 l${o * 12},-3.6 M${wx},141 l${o * 12},1.6" ${ST(1.7)}/></g>`;
  }
  function ears(st, dx) {
    dx = dx || 0;
    var a = 82 + dx, b = 154 - dx;
    return `<path d="M${a},112 L${a - 5},90 Q${a - 7},79 ${a + 3},83 L${a + 24},98 Z" fill="${F}" ${st}/><path d="M${b},112 L${b + 5},90 Q${b + 7},79 ${b - 3},83 L${b - 24},98 Z" fill="${F}" ${st}/>` +
      `<path d="M${a + 1},104 L${a - 1.6},91 L${a + 13},98.6 Z" fill="${EAR}"/><path d="M${b - 1},104 L${b + 1.6},91 L${b - 13},98.6 Z" fill="${EAR}"/>`;
  }
  function body(path, clip, st) {
    return `<path d="${path}" fill="${F}"/><g clip-path="url(#${clip})"><ellipse cx="118" cy="166" rx="46" ry="30" fill="${W}"/><ellipse cx="168" cy="138" rx="14" ry="36" fill="${SH}" opacity=".55"/></g><path d="${path}" fill="none" ${st}/>`;
  }
  function tail(d, origin) {
    return `<g class="tail" style="transform-origin:${origin}"><path d="${d}" fill="none" stroke="${L}" stroke-width="15" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${F}" stroke-width="9.5" stroke-linecap="round"/></g>`;
  }
  // the little dried fish balanced on top of the head (inside the head group, so it rides along): silver, darker
  // back, head left and forked tail right
  function topFish(x, y, rot, sc) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc || 1})"><path d="M6,0 L11.6,-4.6 Q10,0 11.6,4.6 Z" fill="#8E9DAD" ${ST(1.5)}/>` +
      `<path d="M-10,0 C-6,-5.4 3,-5.4 7.4,0 C3,5.4 -6,5.4 -10,0 Z" fill="#C9D4DE" ${ST(1.6)}/>` +
      `<path d="M-6.4,-1.6 C-2.6,-3.6 1.8,-3.6 5.6,-1.2" fill="none" stroke="#7F8E9C" stroke-width="1.3" stroke-linecap="round"/>` +
      `<circle cx="-6.2" cy="-.5" r="1.05" fill="${L}"/><path d="M-3.4,-2.6 q1.4,2.6 0,5.2" fill="none" stroke="${L}" stroke-width=".9" opacity=".7"/></g>`;
  }
  function paw(x, y, rot) {
    return `<g transform="translate(${x} ${y})${rot ? ' rotate(' + rot + ')' : ''}"><ellipse rx="7" ry="5.2" fill="${W}" ${ST(2.8)}/><path d="M-2.4,-2.6 v2.6 M2.4,-2.6 v2.6" ${ST(1.5)}/></g>`;
  }

  P.register({
    id: 'cat:h2', kind: 'cat', skin: 'h2', name: '鼓鼓頰貓', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      var face = `<path d="M108,100 v6 M118,98 v8 M128,100 v6" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M85,116 C89,109 95,105 101,103" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    ${cheek(82, uid, st)}${cheek(154, uid, st)}
    <!--EYES-->
    <path d="M115.4,124.4 h5.2 q-.5,2.4 -2.6,3 q-2.1,-.6 -2.6,-3 z" fill="#FF8090" ${ST(1.2)}/><!--MOUTH--><!--OVER-->`;
      var art = tail('M74,160 C48,160 42,136 54,124', '74px 160px') + `
    ${ears(st)}
    ${body(B, uid + '-b', st)}${topFish(118, 91.4, -9, 1.15)}
    ${face}
   `;
      return {
        crop: '50 64 136 104',
        seed: false,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath><linearGradient id="${uid}-ck" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="${F}"/><stop offset=".43" stop-color="${W}"/></linearGradient>`,
        layers: {
          back: '',
          pre: `<g class="squish">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[105, 118], [131, 118]], eyeR: 4.8, eyeStyle: 'gloss', ink: L, arc: [4.8, 2.6],
          mouth: [118, 128.4], mouthStyle: 'w', mouthSize: [3.5, 2.2], mouthSW: 1.7
        },
        rig: {
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, 66],
          top: [118, 88], qm: [138, 80], zzz: [152, 96], side: [[62, 118], [174, 118]], nose: [120, 126], anger: [140, 108],
          cheeks: [[82, 143, 11], [154, 143, 11]], hold: [118, 138, 0.78], smoke: 34,
          fire: [[58, 154, 1], [178, 154, 1]], bento: [152, 149, 0.92],
          paw: paw, limb: { fill: F }, pawL: PAW_L, pawR: PAW_R,
          up: { ink: 'back', fill: 'over', w: [10, 7.5], arms: [[[80, 114], [64, 98], -30], [[156, 114], [172, 98], 30]] },
          holdArm: { paws: [[108, 142, 25], [128, 142, -25]] },
          scratch: { ink: 'back', fill: 'over', w: [10, 7.5], arm: [[80, 114], [74, 100]], paw: [77, 95, -45] },
          pack: { lift: 6,
            desk: { bag: [178, 141, 0.86], rest: [166, 128, -20] } }
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="161" rx="66" ry="5" fill="${L}" opacity=".12"/>` +
              `<g transform="translate(118 160) scale(1.12 .78) translate(-118 -172)"><g class="breath" style="transform-origin:118px 172px">${art}</g></g>` +
              paw(103, 159, -10) + paw(133, 159, 10),
            anchors: { zzz: [152, 106], top: [118, 100] }
          },
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -20)">` + tail('M100,174 C86,186 70,178 70,160', '100px 174px') +
              `<g class="legs" style="transform-origin:118px 176px">${paw(106, 180, 180)}${paw(130, 180, 180)}</g>` +
              ears(st, 4) + body(BD, uid + '-bd', st) + topFish(118, 94.6, -9, 1.05) + face +
              `<g class="limp" style="transform-origin:118px 140px">${paw(64, 158, 60)}${paw(172, 158, -60)}</g></g></g>`,
            anchors: { top: [118, 64], side: [[64, 98], [172, 98]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
