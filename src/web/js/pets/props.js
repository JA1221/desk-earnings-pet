window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Prop overlays for the pet states. draw(name, ctx) -> {slot: svg, ...} where slot is one of
//   back  - behind the pet (moves with the body): flames
//   desk  - on the desk, after the desk is drawn: lunch box, backpack standing on the desk
//   front - in front of the desk, moving with the body, behind a cat's head
//   held  - held in both paws, inside the head group (compose wraps these + the holding paws in .held)
//   over  - in front of the face, inside the head group
//   face  - next to the mouth, inside the head group: snot bubble, tear, sweat drop, anger mark, red cheeks, crumbs
//   top   - above everything, not attached to the body: Zzz, hearts, smoke, confetti, coin, ?, dots, sparkles, notes
// ctx = {uid, mode:'sticker'|'flat'|'crayon', L: line colour, kind:'cat'|'hamster', rig, face, bag: 'desk' with the backpack}.
// Sticker props get the A1 ink outline, crayon props the crayon ink, flat (S4) props no outline.
// Animated parts carry classes that pets.css drives per state (.zz .snot .hrt .smk .cf .coin .flame ...).
QJZ.pets.props = (function () {
  var C = QJZ.pets.common;
  var BLUE = '#4DA3FF', BLUE_L = '#7CC4FF', BLUE_D = '#2F86E0', GOLD = '#FFC857';

  function n(v) { return Math.round(v * 100) / 100; }
  function ol(ctx, w) { return ctx.mode === 'flat' ? '' : C.ST(w, ctx.L); }
  // a line with an ink edge underneath (sticker / crayon) so it reads on any background
  function inked(ctx, d, colour, w) {
    var under = ctx.mode === 'flat' ? '' : `<path d="${d}" fill="none" stroke="${ctx.L}" stroke-width="${n(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return under + `<path class="keep" d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function at(p, inner, extra) {
    var s = p[2] !== undefined && p[2] !== 1 ? ` scale(${p[2]})` : '';
    return `<g transform="translate(${n(p[0])} ${n(p[1])})${s}"${extra || ''}>${inner}</g>`;
  }
  // an animated group whose transform origin is its local 0,0 (pets.css uses transform-box:view-box)
  function anim(cls, inner, style) {
    return `<g class="${cls}" style="transform-origin:0 0${style ? ';' + style : ''}">${inner}</g>`;
  }
  function drop(ctx, s) {
    function k(v) { return n(v * s); }
    return `<path d="M0,${k(-5)} C${k(2.6)},${k(-1)} ${k(3.6)},${k(1.4)} ${k(3.6)},${k(3.2)} a${k(3.6)},${k(3.6)} 0 0 1 ${k(-7.2)},0 C${k(-3.6)},${k(1.4)} ${k(-2.6)},${k(-1)} 0,${k(-5)} Z" fill="#9AD0FF" ${ol(ctx, 1.4)}/>` +
      `<path d="M${k(-1.6)},${k(2.4)} q0,${k(1.5)} ${k(1.4)},${k(1.9)}" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" class="keep"/>`;
  }
  // [x, y, scale, rotation] placement
  function place(p, inner) {
    return `<g transform="translate(${n(p[0])} ${n(p[1])})${p[3] ? ` rotate(${p[3]})` : ''}${p[2] !== undefined && p[2] !== 1 ? ` scale(${p[2]})` : ''}">${inner}</g>`;
  }
  // The backpack seen from the front, centred on 0,0: 42 x 50 body (y -25..25) with a top handle up to y -36, a light
  // flap with a gold buckle and a zipped front pocket. Flat (S4) bags have no ink, a darker blue rim instead.
  function pack(ctx) {
    var flat = ctx.mode === 'flat', h = 'M-8,-24 q8,-15 16,0';
    var loop = flat ? `<path d="${h}" fill="none" stroke="${BLUE_D}" stroke-width="4" stroke-linecap="round"/>` :
      `<path d="${h}" fill="none" stroke="${ctx.L}" stroke-width="7" stroke-linecap="round"/><path class="keep" d="${h}" fill="none" stroke="${BLUE_D}" stroke-width="3.4" stroke-linecap="round"/>`;
    return loop + (flat ? '<rect x="-22.6" y="-26.6" width="45.2" height="53.2" rx="14.4" fill="' + BLUE_D + '"/>' : '') +
      `<rect x="-21" y="-25" width="42" height="50" rx="13" fill="${BLUE}" ${ol(ctx, 2.8)}/>` +
      `<path d="M-15,-5 v22 M15,-5 v22" stroke="${BLUE_D}" stroke-width="2.2" stroke-linecap="round" class="keep"/>` +
      `<rect x="-12" y="5" width="24" height="15" rx="5" fill="${BLUE_L}" ${ol(ctx, 2.2)}/>` +
      `<path d="M-8,10.6 h12" stroke="${flat ? BLUE_D : ctx.L}" stroke-width="1.6" stroke-linecap="round" class="keep"/>` +
      `<rect x="4.6" y="8.2" width="4.2" height="6.4" rx="1.6" fill="${GOLD}" ${ol(ctx, 1.3)}/>` +
      `<path d="M-21,-11 q0,-14 13,-14 h16 q13,0 13,14 v3.6 q-21,9 -42,0 z" fill="${BLUE_L}" ${ol(ctx, 2.6)}/>` +
      `<rect x="-4.4" y="-7.6" width="8.8" height="7.4" rx="2" fill="${GOLD}" ${ol(ctx, 1.9)}/>` +
      `<path d="M-14,-19 q2.4,-3.6 6.6,-3.8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85" class="keep"/>`;
  }
  // the 1.1 waving paw's knock centre: rig.hello (its knock point, the paw or the arm tip), else the waitBag wave paw
  function knockAt(rig) {
    var h = rig.hello;
    var d = rig.pack.desk, p = h ? h.knock || (h.paw ? h.paw : h.arm[1]) : d.wave || (rig.up.paws ? rig.up.paws[0] : rig.up.arms[0][1]);
    return [p[0], p[1]];
  }
  // one headphone cup centred on 0,0 (dir -1 left, 1 right): a tomato shell, the yellow cushion on the head side
  function phoneCup(ctx, dir, w, h) {
    var x = n(-w / 2), y = n(-h / 2), cw = n(w * 0.46), cx = dir < 0 ? n(w / 2 - cw - 1.2) : n(-w / 2 + 1.2);
    return `<rect x="${n(cx)}" y="${n(y + 3.2)}" width="${cw}" height="${n(h - 6.4)}" rx="${n(cw / 2)}" fill="#FFC857" ${ol(ctx, 2)}/>` +
      `<rect x="${dir < 0 ? x : n(x + w * 0.3)}" y="${y}" width="${n(w * 0.7)}" height="${h}" rx="${n(w * 0.35)}" fill="#FF6B57" ${ol(ctx, 2.6)}/>` +
      `<path class="keep" d="M${n(dir < 0 ? x + 3 : -x - 3)},${n(y + 5)} v${n(h * 0.28)}" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`;
  }
  var HEART = 'M0,4 C-7,-1 -7.5,-6 -4,-7.6 C-2,-8.5 -0.4,-7.4 0,-5.6 C0.4,-7.4 2,-8.5 4,-7.6 C7.5,-6 7,-1 0,4 Z';
  // the water glass, centred on 0,0: 16 wide, 21.6 tall; the sip straw reaches SIP_STRAW above its centre
  var GLASS = 'M-8,-11 L-6.6,8.2 Q-6.4,10.6 -4,10.6 H4 Q6.4,10.6 6.6,8.2 L8,-11';
  var WATER = 'M-6.7,-3.2 H6.7 L5.9,7.8 Q5.7,9.7 3.6,9.7 H-3.6 Q-5.7,9.7 -5.9,7.8 Z';
  var SIP_STRAW = 15.5;
  // the glass at p ([x,y,scale]) with an orange straw (path straw, a light stripe along hl) standing in the water, seen
  // through the glass; the water level is .lvl (scaled from the bottom)
  function glassArt(ctx, p, straw, hl) {
    // flat (S4) skins have no ink: the glass keeps a soft blue edge instead, so it still reads on a cream chest
    var edge = function (w) { return ctx.mode === 'flat' ? `stroke="#8EC2EA" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" class="keep"` : ol(ctx, w); };
    var rim = `<ellipse cx="0" cy="-11" rx="8" ry="2.2" fill="#F7FCFF" ${edge(1.8)}/>`;
    var sw = (ctx.mode === 'flat' ? '' : `<path d="${straw}" fill="none" stroke="${ctx.L}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>`) +
      `<path class="keep" d="${straw}" fill="none" stroke="#FF8A3D" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path class="keep" d="${hl}" fill="none" stroke="#FFC48F" stroke-width="1" stroke-linecap="round"/>`;
    var water = anim('lvl', `<path d="${WATER}" fill="#7CC4FF" opacity=".88"/><ellipse cx="0" cy="-3.2" rx="6.7" ry="1.6" fill="#B9E0FF"/>` +
      `<circle cx="-2.4" cy="5.2" r="1.1" fill="#fff" opacity=".85"/><circle cx="1" cy="2.4" r=".75" fill="#fff" opacity=".85"/>`, 'transform-origin:0 9.7px');
    return at(p, `<path d="${GLASS} Z" fill="#EAF6FF"/>` + rim + sw + water +
      `<path class="keep" d="M-5.2,-8 L-4.3,4.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="${GLASS}" fill="none" ${edge(2.2)}/><path d="M-8,-11 A8,2.2 0 0 0 8,-11" fill="none" ${edge(1.8)}/>`);
  }
  var ZED = 'M-4.5,-5.5 h9 v2.4 l-5.6,6.2 h5.6 v2.4 h-9 v-2.4 l5.6,-6.2 h-5.6 z';

  var DRAW = {
    // pink heart mug with a latte top and curling steam
    coffee: function (ctx) {
      var h = 'M7,-3 q6.5,0 6.5,4.5 q0,4.5 -6.5,4.5', mug = ctx.mode === 'flat' ? '#7FB7E8' : '#FF8FA3';
      var handle = ctx.mode === 'flat' ? `<path d="${h}" fill="none" stroke="${mug}" stroke-width="3.4"/>` :
        `<path d="${h}" fill="none" stroke="${ctx.L}" stroke-width="5.6" stroke-linecap="round"/><path d="${h}" fill="none" stroke="${mug}" stroke-width="2.4" stroke-linecap="round"/>`;
      var steam = '';
      for (var i = 0; i < 2; i++) steam += anim('steam2', `<path class="keep" d="M${-3 + i * 6},-11 q-2.4,-3 0,-6 q2.4,-3 0,-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`, `animation-delay:${-i * 0.9}s`);
      return { held: at(ctx.rig.hold, steam + handle +
        `<path d="M-8,-7 h16 v10.5 a5.5,5.5 0 0 1 -5.5,5.5 h-5 a5.5,5.5 0 0 1 -5.5,-5.5 z" fill="${mug}" ${ol(ctx, 2.2)}/>` +
        `<ellipse cx="0" cy="-7" rx="8" ry="2.3" fill="#8B5A3C" ${ol(ctx, 1.6)}/><ellipse cx="-.6" cy="-7.2" rx="4.4" ry="1.1" fill="#F2DCC0"/>` +
        `<path d="M0,5.2 c-3,-2.2 -4,-3.6 -4,-5 a2,2 0 0 1 4,-.6 a2,2 0 0 1 4,.6 c0,1.4 -1,2.8 -4,5z" fill="#fff"/>`) };
    },
    // rice ball with nori, held for lunch
    onigiri: function (ctx) {
      var d = 'M0,-10 C3.5,-10 11,1 11,5 C11,8.5 8,9.5 0,9.5 C-8,9.5 -11,8.5 -11,5 C-11,1 -3.5,-10 0,-10 Z';
      return { held: at(ctx.rig.hold, `<path d="${d}" fill="#fff"/><path d="M-6.5,2.6 h13 v6.9 h-13 z" fill="#2F4A3A"/><path d="M-4,-3 l1.2,.5 M3,-2.4 l1.1,-.6 M-.6,-6 l1,.4 M1,-0.4 l1.2,.3" stroke="#E6DACB" stroke-width="1" stroke-linecap="round"/>` +
        (ctx.mode === 'flat' ? '' : `<path d="${d}" fill="none" ${ol(ctx, 2)}/>`)) };
    },
    // snack: a little dried fish for cats, a sunflower seed for hamsters
    snack: function (ctx) {
      if (ctx.kind === 'cat') {
        return { held: at(ctx.rig.hold, `<g transform="rotate(-8)"><path d="M7,0 L13,-5 Q11.4,0 13,5 Z" fill="#8E9DAD" ${ol(ctx, 1.6)}/>` +
          `<path d="M-10,0 C-6,-5.6 4,-5.6 8,0 C4,5.6 -6,5.6 -10,0 Z" fill="#C9D4DE" ${ol(ctx, 1.8)}/><path d="M-6.5,-1.6 C-2.6,-3.8 2,-3.8 6,-1.2" fill="none" stroke="#7F8E9C" stroke-width="1.4" stroke-linecap="round"/>` +
          `<circle cx="-6.2" cy="-.6" r="1.1" fill="${ctx.L}"/><path d="M-3.4,-2.6 q1.4,2.6 0,5.2" fill="none" stroke="${ctx.L}" stroke-width="1" opacity=".7"/></g>`) };
      }
      return { held: at(ctx.rig.hold, `<g transform="rotate(-8)"><path d="M0,-8.5 C3,-5 4.6,1 3.8,4.5 C3,8 -3,8 -3.8,4.5 C-4.6,1 -3,-5 0,-8.5 Z" fill="#3A3A3A" ${ol(ctx, 1.6)}/>` +
        `<path d="M-1.5,-4.6 q-1,4.6 -.4,9.4 M1.5,-4.6 q1,4.6 .4,9.4" fill="none" stroke="#fff" stroke-width=".9" opacity=".85"/></g>`) };
    },
    // lunch box on the desk with rice, egg, sausage, broccoli and chopsticks
    bento: function (ctx) {
      var chop = inked(ctx, 'M5,-11 L21,-4.5', '#D9A066', 1.6) + inked(ctx, 'M7.5,-13 L22.5,-7', '#D9A066', 1.6);
      return { desk: at(ctx.rig.bento, `<path d="M-15,-4 L-13,-9.5 H13 L15,-4 Z" fill="#FFF8EC" ${ol(ctx, 2)}/>` +
        `<circle cx="-8" cy="-6.6" r="1.9" fill="#E5534B"/><path d="M-.4,-9.4 L0,-4.2" stroke="${ctx.L}" stroke-width="1.1"/>` +
        `<rect x="2" y="-8.6" width="5" height="3.6" rx="1" fill="#FFD93D"/><circle cx="10.4" cy="-6.8" r="2.1" fill="#6CC46A"/><ellipse cx="-3.6" cy="-6.6" rx="2.2" ry="1.5" fill="#FF7A6B"/>` +
        `<rect x="-17" y="-4.5" width="34" height="11.5" rx="3" fill="#E5534B" ${ol(ctx, 2.2)}/><path d="M-13,1.2 h26" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75" class="keep"/>` + chop) };
    },
    // three Zs floating up and away
    zzz: function (ctx) { return { top: zeds(ctx, ctx.rig.zzz, 3) }; },
    z: function (ctx) { return { top: zeds(ctx, ctx.rig.zzz, 2) }; },
    // snot bubble that grows and shrinks with the breath
    bubble: function (ctx) {
      return { face: at(ctx.rig.nose, anim('snot', `<circle cx="4.2" cy="1.4" r="4.4" fill="#CDEBFF" fill-opacity=".75" ${ol(ctx, 1.3)}/><path d="M2,-1.2 q1.2,-1.6 3.2,-1.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" class="keep"/>`)) };
    },
    // the backpack, packed and zipped, standing on the desk beside the pet (rig.pack.desk has the per-skin placement)
    bag: function (ctx) {
      return { desk: place(ctx.rig.pack.desk.bag, `<ellipse cx="0" cy="25.5" rx="23" ry="3.6" fill="${ctx.L}" opacity=".16"/>` + pack(ctx)) };
    },
    // crumbs dropping from the mouth while eating
    crumbs: function (ctx) {
      var m = ctx.face.mouth, c = ctx.kind === 'cat' ? '#A9B6C2' : '#6B6158', out = '';
      [[-5, 0, 0], [3, 2, -0.4], [6, -1, -0.8]].forEach(function (k) {
        out += at([m[0] + k[0], m[1] + 8 + k[1]], anim('crumb', `<circle r="1.1" fill="${c}"/>`, `animation-delay:${k[2]}s`));
      });
      return { face: out };
    },
    // a big sweat drop on the side of the head, plus little drops flying off
    sweat: function (ctx) {
      var r = ctx.rig.side[1], l = ctx.rig.side[0];
      var fly = at([l[0], l[1] - 4], anim('fly', drop(ctx, 0.6), '--fx:-9px')) + at([r[0], r[1] - 8], anim('fly', drop(ctx, 0.55), '--fx:9px;animation-delay:-.35s'));
      return { face: at([r[0] - 3, r[1] - 6], anim('drip', drop(ctx, 1))), top: fly };
    },
    // flames flickering behind the body
    fire: function (ctx) {
      var out = '';
      ctx.rig.fire.forEach(function (f, i) {
        out += at(f, anim('flame', `<path d="M0,0 C-9,0 -12,-9 -8,-17 C-6,-21 -6,-25 -8,-29 C-1,-26 4,-20 3,-13 C6,-15 7,-18 6,-21 C11,-15 12,-6 8,-2 C6,0 3,0 0,0 Z" fill="#FF8A3D" ${ol(ctx, 2.2)}/>` +
          `<path d="M0,-2 C-4,-2 -6,-6 -4,-10 C-3,-12 -3,-14 -4,-16 C0,-14 2,-11 2,-8 C3,-9 4,-10 4,-11 C6,-8 6,-4 4,-2.5 C3,-2 1.5,-2 0,-2 Z" fill="#FFD93D"/>`, `animation-delay:${-i * 0.17}s`));
      });
      return { back: out };
    },
    // hearts rising from the head
    hearts: function (ctx) {
      var t = ctx.rig.top, out = '';
      [[-15, 2, 0, -6], [1, -4, -0.7, 4], [16, 3, -1.4, 9]].forEach(function (k, i) {
        out += at([t[0] + k[0], t[1] + k[1], i === 1 ? 1.1 : 0.9], anim('hrt', `<path d="${HEART}" fill="#FF5C7C" ${ol(ctx, 1.8)}/><circle cx="-3.4" cy="-4.8" r="1.2" fill="#fff" opacity=".85"/>`, `animation-delay:${k[2]}s;--dx:${k[3]}px`));
      });
      return { top: out };
    },
    // steam puffs from both sides of the head
    smoke: function (ctx) {
      var t = ctx.rig.top, w = ctx.rig.smoke || 26, out = '';
      var puff = `<path d="M-6,2 a4,4 0 0 1 1,-7 a5,5 0 0 1 9,-1 a4,4 0 0 1 2,8 z" fill="#F3EEE8" ${ol(ctx, 1.6)}/>`;
      [[-w, 0, '-10px'], [-w - 4, -0.6, '-12px'], [w, -0.3, '10px'], [w + 4, -0.9, '12px']].forEach(function (k) {
        out += at([t[0] + k[0], t[1] + 8], anim('smk', puff, `animation-delay:${k[1]}s;--dx:${k[2]}`));
      });
      return { top: out };
    },
    // the cross-popping anger vein
    anger: function (ctx) {
      var d = 'M-6,-2 Q-2,-2 -2,-6 M2,-6 Q2,-2 6,-2 M6,2 Q2,2 2,6 M-2,6 Q-2,2 -6,2';
      return { face: at(ctx.rig.anger, anim('vein', inked(ctx, d, '#FF4D6A', 2.4))) };
    },
    // soft pink blush on both cheeks
    blush: function (ctx) {
      var out = '';
      ctx.rig.cheeks.forEach(function (c) {
        out += `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${n(c[2] * 0.9)}" ry="${n(c[2] * 0.55)}" fill="#FF8FA3" opacity=".55"/>`;
      });
      return { face: out };
    },
    // two music notes bobbing up beside the head
    notes: function (ctx) {
      var t = ctx.rig.top, w = ctx.rig.smoke || 26;
      function note(c) {
        return inked(ctx, 'M2.7,2.2 V-8.6 q3.6,1 4.8,4.6', c, 1.8) + `<ellipse cx="0" cy="2.6" rx="3.3" ry="2.5" transform="rotate(-20 0 2.6)" fill="${c}" ${ol(ctx, 1.4)}/>`;
      }
      return { top: at([t[0] - w - 12, t[1] + 2], anim('note', note('#FF5C7C'), '--dx:-5px')) +
        at([t[0] + w + 10, t[1] - 6], anim('note', note('#4DA3FF'), '--dx:5px;animation-delay:-1s')) };
    },
    // red puffed cheeks
    puff: function (ctx) {
      var out = '';
      ctx.rig.cheeks.forEach(function (c) { out += `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${c[2]}" ry="${n(c[2] * 0.62)}" fill="#FF5C7C" opacity=".42"/>`; });
      return { face: out };
    },
    // confetti falling over the whole stage
    confetti: function (ctx) {
      var cols = ['#FFC857', '#FF8A3D', '#8EE3B0', '#FF5C7C', '#9AD0FF', '#FFD93D'], out = '', x0 = ctx.rig.top[0];
      var X = [-66, -50, -36, -22, -9, 5, 18, 31, 45, 58, 70, -58, 38, -14];
      for (var i = 0; i < X.length; i++) {
        var c = cols[i % cols.length], shape = i % 4 === 3 ?
          `<path d="M0,-4 q2.4,2 0,4 q-2.4,2 0,4" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" class="keep"/>` :
          `<rect x="-1.9" y="-3.2" width="3.8" height="6.4" rx=".8" fill="${c}" ${ol(ctx, 1.1)}/>`;
        out += at([x0 + X[i], 0], anim('cf', shape, `animation-delay:${n(-(i * 0.37) % 2.2)}s;animation-duration:${n(1.9 + (i % 3) * 0.35)}s;--r:${(i % 2 ? -1 : 1) * (200 + i * 23)}deg`));
      }
      return { top: out };
    },
    // a gold coin popping out of the head, with sparkles
    coin: function (ctx) {
      var t = ctx.rig.top;
      var coin = `<circle r="8" fill="${GOLD}" ${ol(ctx, 2.2)}/><circle r="5.6" fill="none" stroke="#F0A020" stroke-width="1.3"/>` +
        `<path class="keep" d="M2.3,-2.4 q-.6,-1.5 -2.3,-1.5 q-2.3,0 -2.3,1.7 q0,1.5 2.3,1.9 q2.4,.5 2.4,2.1 q0,1.8 -2.4,1.8 q-1.8,0 -2.4,-1.5 M0,-5.2 v10.4" fill="none" stroke="#C67A12" stroke-width="1.5" stroke-linecap="round"/>` +
        `<path class="keep" d="M-5,-2.6 a6,6 0 0 1 2.8,-3.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;
      var sp = `<path d="${C.star4(-12, 2, 3.4)}" fill="#FFE066" ${ol(ctx, 1)}/><path d="${C.star4(12, -4, 2.6)}" fill="#FFE066" ${ol(ctx, 1)}/>`;
      return { top: at([t[0], t[1] - 4], anim('coin', anim('coinspin', coin) + anim('csp', sp))) };
    },
    // puzzled question mark
    question: function (ctx) {
      var t = ctx.rig.top;
      var q = ctx.rig.qm || [t[0] + 26, t[1] + 2];
      return { top: at(q, anim('qm', inked(ctx, 'M-3.2,-3.6 q0,-4.2 3.6,-4.2 q3.6,0 3.6,3.6 q0,2.6 -3.6,3.8 v2.2', '#FF8A3D', 2.6) +
        `<circle cx="0.4" cy="6.6" r="1.7" fill="#FF8A3D" ${ol(ctx, 1.2)}/>`)) };
    },
    // a tear at the corner of the eye after a yawn
    tear: function (ctx) {
      var e = ctx.face.eyes[1], s = QJZ.pets.expr.size(ctx.face);
      return { face: at([n(e[0] + s[0] + 1.2), n(e[1] + 1.5)], anim('tear', drop(ctx, 0.62))) };
    },
    // … appearing one dot at a time
    dots: function (ctx) {
      var t = ctx.rig.top, out = '';
      for (var i = 0; i < 3; i++) out += at([t[0] + 20 + i * 6.5, t[1] - 4], anim('dot' + i, `<circle r="2" fill="${ctx.mode === 'flat' ? '#2B2B3A' : ctx.L}"/>`));
      return { top: out };
    },
    // twinkles around the head (stretch)
    sparkle: function (ctx) {
      var t = ctx.rig.top, w = ctx.rig.smoke || 26;
      return { top: at([t[0] - w - 8, t[1] + 6], anim('spk', `<path d="${C.star4(0, 0, 4)}" fill="#FFE066" ${ol(ctx, 1.1)}/>`)) +
        at([t[0] + w + 8, t[1] + 2], anim('spk', `<path d="${C.star4(0, 0, 3.2)}" fill="#FFE066" ${ol(ctx, 1.1)}/>`, 'animation-delay:-.3s')) };
    },
    // ---- 1.1 poses ----
    // a glass of water held up in front of the body (rig.glass, else rig.hold), its orange straw leaning out to the
    // right, away from the mouth (holdCup: offering it to you)
    glass: function (ctx) {
      return { held: glassArt(ctx, ctx.rig.glass || ctx.rig.hold, 'M2.6,8 L4.4,-13 L11,-15.4', 'M5.4,-13.8 L10.4,-15.6') };
    },
    // the same glass with the straw straight up in the mouth (sip): rig.sipGlass, else centred under the middle of the
    // tiny o mouth, as big as the skin's glass (its straw then SIP_STRAW x that scale long); the water (.lvl) goes down
    sipGlass: function (ctx) {
      var f = ctx.face, y = f.mouthStyle === 'y', u = y ? 4.6 : f.mouthSize[0], s = (ctx.rig.glass || ctx.rig.hold)[2] || 1;
      var p = ctx.rig.sipGlass || [f.mouth[0], n((y ? f.mouth[1] + 2.6 : f.mouth[1]) + u * 0.55 + SIP_STRAW * s), s];
      return { held: glassArt(ctx, p, 'M0.4,8 L0,-' + SIP_STRAW, 'M-0.5,-6 L-0.5,-' + (SIP_STRAW - 2)) };
    },
    // refreshed: sparkles popping beside the cheeks, a yellow one and a water-blue one (the end of a sip)
    fresh: function (ctx) {
      var s = ctx.rig.side;
      return { top: at([s[0][0] - 6, s[0][1] - 14], anim('spk', `<path d="${C.star4(0, 0, 5.2)}" fill="#FFE066" ${ol(ctx, 1.3)}/>`)) +
        at([s[1][0] + 7, s[1][1] - 20], anim('spk', `<path d="${C.star4(0, 0, 4.4)}" fill="#9AD0FF" ${ol(ctx, 1.3)}/>`, 'animation-delay:.12s')) +
        at([s[1][0] + 13, s[1][1] - 6], anim('spk', `<path d="${C.star4(0, 0, 2.8)}" fill="#FFE066" ${ol(ctx, 1.1)}/>`, 'animation-delay:.24s')) };
    },
    // knock marks: three strokes bursting out from the waving paw (in time with the wave, .knk), and an orange ! by the
    // head (rig.bang, else rig.qm; popping, .bang); both ride with the body
    knock: function (ctx) {
      var k = knockAt(ctx.rig), q = ctx.rig.bang || ctx.rig.qm || [ctx.rig.top[0] + 30, ctx.rig.top[1]], c = ctx.mode === 'flat' ? '#2B2B3A' : ctx.L, burst = '';
      [-160, -125, -90].forEach(function (deg) {
        var r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
        burst += `<path class="keep" d="M${n(cs * 14)},${n(sn * 14)} L${n(cs * 19.5)},${n(sn * 19.5)}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
      });
      var bang = `<circle r="8.6" fill="#FF8A3D" ${ol(ctx, 2.2)}/><path class="keep" d="M0,-4.8 V0.6" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="0" cy="4" r="1.6" fill="#fff"/>`;
      return { over: `<g class="knock">` + at(k, anim('knk', burst)) + at(q, anim('bang', bang)) + '</g>' };
    },
    // headphones: a band over the head between two tomato cups on its sides (rig.phones {l, r: [x,y,rot], apex: y,
    // size: [w,h], top}; by default from rig.side and rig.top). top: what sits on the head (H2's seed, the cat's fish),
    // drawn again over the band so the band passes under it
    headphones: function (ctx) {
      var s = ctx.rig.side, t = ctx.rig.top, ph = ctx.rig.phones || {};
      var l = ph.l || [s[0][0] + 1, s[0][1], -6], r = ph.r || [s[1][0] - 1, s[1][1], 6], sz = ph.size || [14, 22];
      var apex = ph.apex === undefined ? t[1] + 2 : ph.apex, top = sz[1] / 2 - 3;
      var x0 = l[0], y0 = l[1] - top, x2 = r[0], y2 = r[1] - top, cy = (4 * apex - y0 - y2) / 2;
      var d = `M${n(x0)},${n(y0)} Q${n((x0 + x2) / 2)},${n(cy)} ${n(x2)},${n(y2)}`;
      var band = (ctx.mode === 'flat' ? '' : `<path d="${d}" fill="none" stroke="${ctx.L}" stroke-width="8.6" stroke-linecap="round"/>`) +
        `<path class="keep" d="${d}" fill="none" stroke="#FF6B57" stroke-width="${ctx.mode === 'flat' ? 5 : 4.2}" stroke-linecap="round"/>`;
      return { over: band + (ph.top || '') + place([l[0], l[1], 1, l[2]], phoneCup(ctx, -1, sz[0], sz[1])) + place([r[0], r[1], 1, r[2]], phoneCup(ctx, 1, sz[0], sz[1])) };
    },
    // focused brows: short strokes over the eyes, a little lower at the nose
    brows: function (ctx) {
      var f = ctx.face, s = QJZ.pets.expr.size(f), w = Math.max(1.8, f.arc[1] * 0.62), out = '';
      f.eyes.forEach(function (e, i) {
        var o = i === 0 ? -1 : 1, y = e[1] - s[1];
        out += `<path class="keep" d="M${n(e[0] + o * s[0] * 0.85)},${n(y - 4.2)} L${n(e[0] - o * s[0] * 0.45)},${n(y - 2.8)}" fill="none" stroke="${f.ink}" stroke-width="${n(w)}" stroke-linecap="round"/>`;
      });
      return { face: out };
    },
    // the tip of the tongue poking out under the right side of the mouth (concentrating)
    tongue: function (ctx) {
      var f = ctx.face, m = f.mouth, y = f.mouthStyle === 'y';
      var x0 = n(m[0] + (y ? 1.2 : f.mouthSize[0] * 0.28)), y0 = n(m[1] + (y ? 3.4 : f.mouthSize[1] * 0.42));
      var d = `M${x0},${y0} q0,4.2 2.7,4.2 q2.7,0 2.7,-4.2 z`;
      return { face: `<path d="${d}" fill="#FF8FA3" ${ol(ctx, 1.5)}/><path class="keep" d="M${n(x0 + 2.7)},${n(y0 + 0.6)} v1.8" stroke="#E2506E" stroke-width="1" stroke-linecap="round"/>` };
    }
  };

  function zeds(ctx, p, count) {
    var out = '', fillc = ctx.mode === 'flat' ? '#7FB7E8' : '#fff', period = count === 3 ? 3 : 3.6;
    for (var i = 0; i < count; i++) {
      out += anim('zz', `<path d="${ZED}" fill="${fillc}" ${ol(ctx, 1.6)}/>`, `animation-delay:${n(-i * period / count)}s;animation-duration:${period}s`);
    }
    return at([p[0], p[1], p[2] === undefined ? (count === 3 ? 1 : 0.8) : p[2]], out);
  }

  var NAMES = Object.keys(DRAW);

  function draw(name, ctx) {
    var f = DRAW[name];
    return f ? f(ctx) : {};
  }

  return { NAMES: NAMES, HELD: ['coffee', 'onigiri', 'snack', 'glass', 'sipGlass'], draw: draw };
})();
