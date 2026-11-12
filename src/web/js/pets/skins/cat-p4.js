// Cat P4 圓滾麻糬貓 — toast-shaped mochi cat that squishes while typing. Port of docs/prototypes/shared.js mochiCat.
// Poses: lie = the toast melts flat on the keyboard, tail curled beside it; dangle = lifted toast stretched into a
// drop, feet and tail hanging.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var F = '#FFB868', W = '#FFF6EA';
  var B = 'M60,172 C58,116 80,86 118,86 C156,86 178,116 176,172 Z';
  var BD = 'M118,78 C126,78 130,86 136,92 C162,100 178,126 178,150 C178,172 152,180 118,180 C84,180 58,172 58,150 C58,126 74,100 100,92 C106,86 110,78 118,78 Z';
  var PAW_L = `<g class="pawL"><ellipse cx="100" cy="151" rx="8.5" ry="5.5" fill="${W}" ${ST(2.8)}/></g>`;
  var PAW_R = `<g class="pawR"><ellipse cx="136" cy="151" rx="8.5" ry="5.5" fill="${W}" ${ST(2.8)}/></g>`;

  function paw(x, y, rot) {
    return `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="5.5" fill="${W}" ${ST(2.8)}${rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : ''}/>`;
  }
  function tail(d, origin) {
    return `<g class="tail"${origin ? ' style="transform-origin:' + origin + '"' : ''}><path d="${d}" fill="none" stroke="${L}" stroke-width="15" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${F}" stroke-width="9.5" stroke-linecap="round"/></g>`;
  }
  function ears(st, dx) {
    dx = dx || 0;
    return `<path d="M${74 + dx},104 L${72 + dx},72 Q${74 + dx},66 ${80 + dx},70 L${102 + dx},88 Z" fill="${F}" ${st}/><path d="M${162 - dx},104 L${164 - dx},72 Q${162 - dx},66 ${156 - dx},70 L${134 - dx},88 Z" fill="${F}" ${st}/><path d="M${78 + dx},96 L${77 + dx},78 L${94 + dx},90 Z" fill="#FFA9B6"/><path d="M${158 - dx},96 L${159 - dx},78 L${142 - dx},90 Z" fill="#FFA9B6"/>`;
  }
  function body(path, clip, st) {
    return `<path d="${path}" fill="${F}"/><g clip-path="url(#${clip})"><ellipse cx="118" cy="160" rx="38" ry="26" fill="${W}"/><ellipse cx="170" cy="134" rx="14" ry="40" fill="#F29A48" opacity=".55"/></g><path d="${path}" fill="none" ${st}/>`;
  }

  P.register({
    id: 'cat:p4', kind: 'cat', skin: 'p4', name: '圓滾麻糬貓', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(2.8);
      var face = `<path d="M108,90 v8 M118,88 v9 M128,90 v8" stroke="#E8893A" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="96" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/><ellipse cx="140" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/>
    <!--EYES-->
    <path d="M116,121.5 h4 l-2,2z" fill="#FF8090" ${ST(1.1)}/><!--MOUTH-->
    <path d="M86,122 h-10 M86,127 l-9,2 M150,122 h10 M150,127 l9,2" ${ST(1.7)}/><!--OVER-->`;
      var art = tail('M70,160 C44,160 38,136 50,124') + `
    ` + ears(st) + `
    ` + body(B, uid + '-b', st) + `
    ` + face;
      return {
        crop: '50 58 136 110',
        seed: false,
        defs: `<clipPath id="${uid}-b"><path d="${B}"/></clipPath><clipPath id="${uid}-bd"><path d="${BD}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="squish">${art}</g>`,
          front: PAW_L + PAW_R,
          post: ''
        },
        face: {
          eyes: [[104, 117], [132, 117]], eyeR: 3.5, eyeStyle: 'dot', ink: L, arc: [4.5, 2.4],
          mouth: [118, 124.5], mouthStyle: 'w', mouthSize: [4, 2.4], mouthSW: 1.7
        },
        rig: {
          mode: 'sticker', line: [L, 2.8], pivot: [118, 172], grab: [118, 56],
          top: [118, 72], qm: [126, 70], zzz: [152, 78], side: [[64, 110], [172, 110]], nose: [119.5, 122], anger: [146, 100],
          cheeks: [[96, 126, 9], [140, 126, 9]], hold: [118, 134, 0.85], smoke: 34,
          fire: [[56, 154, 1.1], [180, 154, 1.1]], bento: [152, 149, 0.95],
          paw: paw, limb: { fill: F }, pawL: PAW_L, pawR: PAW_R,
          up: { ink: 'back', fill: 'over', w: [10, 7.5], arms: [[[75, 114], [62, 100], -30], [[161, 114], [174, 100], 30]] },
          holdArm: { paws: [[107, 140, 25], [129, 140, -25]] },
          scratch: { ink: 'back', fill: 'over', w: [10, 7.5], arm: [[75, 114], [69, 100]], paw: [74, 94, -45] },
          pack: { lift: 6,
            worn: { bag: [79, 100, 1.25, -16], straps: [[82, 100, 64, 128, 82, 158], [154, 100, 172, 128, 154, 158]], paws: [[73, 134, 15], [163, 134, -15]] },
            desk: { bag: [178, 141, 0.86], rest: [166, 126, -20] },
            hug: { bag: [118, 154, 0.82, -6], handle: false, paws: [[102, 137, 35], [134, 137, -35]] } }
        },
        poses: {
          lie: {
            front: `<ellipse cx="118" cy="161" rx="66" ry="5" fill="${L}" opacity=".12"/>` +
              `<g transform="translate(118 160) scale(1.14 .76) translate(-118 -172)"><g class="breath" style="transform-origin:118px 172px">${art}</g></g>` +
              paw(100, 159, -8) + paw(136, 159, 8),
            anchors: { zzz: [152, 98], top: [118, 96] }
          },
          dangle: {
            front: `<g class="swing"><g transform="translate(0 -20)">` + tail('M96,176 C82,186 68,176 70,160', '96px 176px') +
              `<g class="legs" style="transform-origin:118px 176px"><ellipse cx="105" cy="180" rx="6.5" ry="7" fill="${W}" ${st}/><ellipse cx="131" cy="180" rx="6.5" ry="7" fill="${W}" ${st}/></g>` +
              ears(st, 6) + body(BD, uid + '-bd', st) + face +
              `<g class="limp" style="transform-origin:118px 140px">${paw(64, 154, 60)}${paw(172, 154, -60)}</g></g></g>`,
            anchors: { top: [118, 52], side: [[64, 92], [172, 92]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
