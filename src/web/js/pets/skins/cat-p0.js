// Cat P0 Q版大眼貓 — orange tabby, big anime eyes, staff badge on a lanyard. Port of docs/prototypes/shared.js p0Cat.
// Poses: lie = head resting sideways on crossed arms, back and tail behind; dangle = held by the scruff, the whole
// cat hanging with a long body, limp arms, swinging legs and tail.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var COL = { body: '#FFB25B', shade: '#F59A42', stripe: '#E57A2E', belly: '#FFF3DF', ear: '#FFA3B5', iris: '#C97A2B', nose: '#FF6F86', socks: '#FFF3DF', blush: '#FF8FA3' };
  var HEAD = 'M118,46 C146,46 166,60 171,82 C173,92 172,98 170,102 L177,106 L169,110 L175,116 L165,118 C158,128 142,132 118,132 C94,132 78,128 71,118 L61,116 L67,110 L59,106 L66,102 C64,98 63,92 65,82 C70,60 90,46 118,46 Z';
  var TORSO = 'M80,172 C76,140 88,114 118,112 C148,114 160,140 156,172 Z', TAIL = 'M86,150 C56,154 42,128 56,106';
  var TORSO_D = 'M84,168 C80,138 90,114 118,112 C146,114 156,138 152,168 C150,180 86,180 84,168 Z';
  var BELLY = 'M104,134 l4,-5 l3.5,4.5 l3.5,-5 l3,5 l3,-5 l3.5,5 l3.5,-4.5 l4,5 C136,146 132,160 118,162 C104,160 100,146 104,134 Z';

  // typing arm with a white sock paw; left = true for pawL
  function arm(left, st) {
    var cx = left ? 99 : 137;
    return `<g class="paw${left ? 'L' : 'R'}"><path d="${left ? 'M88,134 C84,140 85,146 89,151 L109,151 C109,146 108,140 105,134 Z' : 'M148,134 C152,140 151,146 147,151 L127,151 C127,146 128,140 131,134 Z'}" fill="${COL.body}"/><path d="${left ? 'M88,134 C84,140 85,146 89,151' : 'M148,134 C152,140 151,146 147,151'}" fill="none" ${st}/><path d="${left ? 'M107,141 C108.5,144 109,148 109,151' : 'M129,141 C127.5,144 127,148 127,151'}" fill="none" ${st}/><ellipse cx="${cx}" cy="151" rx="12" ry="7.5" fill="${COL.socks}" ${st}/><path d="M${cx - 4},148.5 v3.5 M${cx + 4},148.5 v3.5" ${ST(2)}/></g>`;
  }
  // a white sock paw seen from the front (toes towards -y before rotation)
  function paw(x, y, rot) {
    return `<g transform="translate(${x} ${y})${rot ? ' rotate(' + rot + ')' : ''}"><ellipse rx="9" ry="7.5" fill="${COL.socks}" ${ST(3)}/><path d="M-3.4,-4 v3.4 M3.4,-4 v3.4" ${ST(2)}/></g>`;
  }
  function tail(d, origin, st) {
    return `<g class="tail" style="transform-origin:${origin}"><path d="${d}" fill="none" stroke="${L}" stroke-width="19" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${COL.body}" stroke-width="13" stroke-linecap="round"/></g>`;
  }
  // limbs that grow out of the torso without a seam: outlines go before the torso, fur after it (QJZ.pets.rig.grow)
  function grown(R, pairs, w) {
    var ink = '', fur = '';
    pairs.forEach(function (p) { var g = P.rig.grow(R, p, w); ink += g.ink; fur += g.fill; });
    return { ink: ink, fur: fur };
  }
  function limb(a, b) {
    var d = `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
    return `<path d="${d}" fill="none" stroke="${L}" stroke-width="17" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${COL.body}" stroke-width="11" stroke-linecap="round"/>`;
  }

  P.register({
    id: 'cat:p0', kind: 'cat', skin: 'p0', name: 'Q版大眼貓', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(3);
      var lanyard = `<path d="M104,124 L113,136 M132,124 L123,136" stroke="#4DA3FF" stroke-width="3.2" stroke-linecap="round"/>${C.badge(110, 134.5)}`;
      var head = `<path d="M70,78 L64,36 Q63,25 73,29 L106,54 Z" fill="${COL.body}" ${st}/><path d="M166,78 L172,36 Q173,25 163,29 L130,54 Z" fill="${COL.body}" ${st}/>
     <path d="M75,66 L71,40 L94,55 Z" fill="${COL.ear}"/><path d="M161,66 L165,40 L142,55 Z" fill="${COL.ear}"/>
     <path d="M75,58 l6,-2.5 M76,64 l7,-1.5 M161,58 l-6,-2.5 M160,64 l-7,-1.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>
     <path d="${HEAD}" fill="${COL.body}"/><g clip-path="url(#${uid}-hc)"><path d="M56,108 C86,128 150,128 182,100 L182,140 L56,140 Z" fill="${COL.shade}"/></g><path d="${HEAD}" fill="none" ${st}/>
     <path d="M118,51 v9 M107,53 q2.5,5 2,9 M129,53 q-2.5,5 -2,9" stroke="${COL.stripe}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M66,86 h8 M65,93 h7 M170,86 h-8 M171,93 h-7" stroke="${COL.stripe}" stroke-width="3.5" stroke-linecap="round"/>
     <path d="M82,66 C88,58 98,53 108,52" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
     <ellipse cx="110" cy="108" rx="10.5" ry="7.5" fill="${COL.belly}"/><ellipse cx="126" cy="108" rx="10.5" ry="7.5" fill="${COL.belly}"/>
     <ellipse cx="81" cy="108" rx="9" ry="5" fill="${COL.blush}" opacity=".75"/><ellipse cx="155" cy="108" rx="9" ry="5" fill="${COL.blush}" opacity=".75"/>${C.blushLines(81, 108)}${C.blushLines(155, 108)}
     <!--EYES-->
     <path d="M113.5,100 h9 q-1,4 -4.5,5 q-3.5,-1 -4.5,-5 z" fill="${COL.nose}" ${ST(1.6)}/>
     <!--MOUTH-->
     <path d="M74,100 Q64,97 54,97 M74,105 Q64,105 53,107 M75,110 Q66,112 57,116 M162,100 Q172,97 182,97 M162,105 Q172,105 183,107 M161,110 Q170,112 179,116" fill="none" ${ST(2)}/><!--OVER-->`;
      var R = { line: [L, 3], limb: { fill: COL.body }, mode: 'sticker' };
      var legs = grown(R, [[[106, 168], [104, 183]], [[130, 168], [132, 183]]], [12, 10]);
      var limp = grown(R, [[[92, 133], [85, 153]], [[144, 133], [151, 153]]], [12.5, 10]);
      var LEGS = '<g class="legs" style="transform-origin:118px 164px">', LIMP = '<g class="limp" style="transform-origin:118px 130px">';
      var stripes = `<path d="M68.8,142.8 L64.6,153 M59.2,134.9 L49.8,140.7 M56.1,122.9 L45.1,122.5" stroke="${COL.stripe}" stroke-width="3.6" stroke-linecap="round"/>`;
      return {
        crop: '52 18 132 122',
        seed: false,
        defs: `<clipPath id="${uid}-hc"><path d="${HEAD}"/></clipPath><clipPath id="${uid}-tc"><path d="${TORSO}"/></clipPath><clipPath id="${uid}-td"><path d="${TORSO_D}"/></clipPath>`,
        layers: {
          back: `<g class="tail"><path d="${TAIL}" fill="none" stroke="${L}" stroke-width="19" stroke-linecap="round"/><path d="${TAIL}" fill="none" stroke="${COL.body}" stroke-width="13" stroke-linecap="round"/>${stripes}</g>
     <path d="${TORSO}" fill="${COL.body}"/><g clip-path="url(#${uid}-tc)"><ellipse cx="156" cy="150" rx="22" ry="40" fill="${COL.shade}"/></g><path d="${TORSO}" fill="none" ${st}/>
     <path d="${BELLY}" fill="${COL.belly}"/>
     ${lanyard}`,
          pre: '',
          front: arm(true, st) + arm(false, st),
          post: `<g class="head">${head}</g>`
        },
        face: {
          eyes: [[97, 91], [139, 91]], eyeR: 8.5, eyeStyle: 'q', iris: COL.iris, ink: L, arc: [8, 3.6],
          mouth: [118, 107], mouthStyle: 'w', mouthSize: [9, 5.5], mouthSW: 2.4
        },
        rig: {
          mode: 'sticker', line: [L, 3], pivot: [118, 128], grab: [118, 22],
          top: [118, 40], qm: [124, 28], zzz: [160, 42], side: [[62, 84], [174, 84]], nose: [119.5, 103], anger: [152, 66],
          cheeks: [[81, 108, 11], [155, 108, 11]], hold: [118, 125, 1.05], smoke: 42,
          fire: [[68, 152, 1.25], [168, 152, 1.25]], bento: [154, 149, 1],
          paw: paw, limb: { fill: COL.body }, pawL: arm(true, st), pawR: arm(false, st),
          up: { ink: 'front', fill: 'front', w: [14, 9.5], arms: [[[98, 120], [55, 84], -25], [[138, 120], [181, 84], 25]] },
          holdArm: { paws: [[105, 130, 25], [131, 130, -25]], w: 11, arms: [[[93, 138], [104, 131]], [[143, 138], [132, 131]]] },
          scratch: { ink: 'front', fill: 'front', w: 11, arm: [[98, 122], [52, 104], [66, 66]], paw: [76, 56, -35] },
          pack: { lift: 4,
            desk: { bag: [178, 141, 0.86], rest: [163, 128, -20], restArm: [[148, 136], [160, 130]], w: 11 } }
        },
        poses: {
          // head resting sideways on crossed arms; the back and tail peek out on the right
          lie: {
            front: `<ellipse cx="118" cy="162" rx="64" ry="5" fill="${L}" opacity=".12"/>` +
              tail('M146,156 C174,160 188,138 176,118', '146px 156px', st) +
              `<path d="M98,160 C98,134 116,120 142,122 C166,124 174,142 172,160 Z" fill="${COL.body}" ${st}/>` +
              `<g transform="translate(-6 26) rotate(-11 118 132)"><g class="breath" style="transform-origin:118px 132px">${head}</g></g>` +
              limb([66, 158], [112, 160]) + limb([170, 158], [124, 160]) + paw(114, 160, 90) + paw(122, 158, -90),
            anchors: { zzz: [158, 66], top: [112, 66] }
          },
          // hanging from the scruff: long body, limp arms, legs and tail swinging behind the swing
          dangle: {
            front: `<g class="swing"><g transform="translate(118 22) scale(.93) translate(-118 -44)">` +
              tail('M100,168 C84,178 72,166 72,150', '100px 168px', st) +
              LEGS + legs.ink + '</g>' + LIMP + limp.ink + '</g>' +
              `<path d="${TORSO_D}" fill="${COL.body}"/><g clip-path="url(#${uid}-td)"><ellipse cx="156" cy="146" rx="22" ry="40" fill="${COL.shade}"/></g><path d="${TORSO_D}" fill="none" ${st}/>` +
              `<path d="${BELLY}" fill="${COL.belly}"/>${lanyard}` +
              LEGS + legs.fur + paw(104, 186, 180) + paw(132, 186, 180) + '</g>' +
              LIMP + limp.fur + paw(84, 157, 170) + paw(152, 157, -170) + '</g>' +
              head + `</g></g>`,
            anchors: { top: [118, 24], side: [[66, 66], [170, 66]] }
          }
        }
      };
    }
  });
})(QJZ.pets);
