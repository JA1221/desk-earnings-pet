window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Arm poses shared by the skins. A skin's build(uid) returns a `rig` describing where its paws go:
//
// rig = {
//   pivot: [x,y],            head (or mochi) tilt pivot -> --hx/--hy; grab: [x,y] dangle pivot -> --gx/--gy
//   top: [x,y],              top of the head (hearts, coin, smoke come from here); qm: [x,y] the ? mark
//   zzz: [x,y],              where Zzz / dots start (upper right of the head)
//   side: [[x,y],[x,y]],     left / right of the head at eye height (sweat drops)
//   nose: [x,y],             snot-bubble anchor;  anger: [x,y]  vein mark;  cheeks: [[x,y,r],[x,y,r]]
//   hold: [x,y,scale],       held item (mug, snack, rice ball) centre and size
//   fire: [[x,y,s],...],     flames behind the body (sprint)
//   bento: [x,y,s],          lunch box on the desk
//   paw(x, y, rot) -> svg    one paw in the skin's style
//   limb: {fill}             (cats) fur colour of arms (outline from the skin's line colour)
//   pawL, pawR: svg          the resting / typing paws (class pawL / pawR)
//   up:      both paws raised, one of
//            {ink, fill, w:[root,tip], arms:[[root,tip,rot],[root,tip,rot]]}   (cats) arms that grow out of the body
//            {paws:[[x,y,rot],[x,y,rot]]}                                     (hamsters) paws only, pressed against
//                                                                             the sides of the head / cheeks
//   holdArm: {paws:[[x,y,rot],[x,y,rot]], arms?:[[root,tip],[root,tip]], w}    paws holding the item
//   scratch: left paw on the head, one of
//            {ink, fill, w, arm:[root,(elbow,)tip], paw:[x,y,rot]}              (cats) with an arm
//            {paw:[x,y,rot]}                                                    (hamsters) the paw alone
//   pack:    the waitBag backpack in its three review styles (QJZ.pets.setBagStyle), sitting up `lift` units
//            off the keyboard (not in the avatar):
//            {lift,
//             worn: {bag:[x,y,s,rot], straps:[[x1,y1,x2,y2],[...]], slot:'over'|'front', paws:[[x,y,rot],[x,y,rot]],
//                    arms?:[[root,tip],[root,tip]], w?}
//                   bag behind the body, straps in front (slot: in the head group, or on a cat's torso), paws
//                   gripping them (cats reach them with short arms)
//             desk: {bag:[x,y,s], wave?:[x,y,rot], rest:[x,y,rot], restArm?:[root,tip], w?}
//                   bag standing on the desk; one paw waves (hamsters: `wave`, beside the head; cats: the left
//                   raised arm of `up`), the other pats the bag (`rest`, cats reach it with `restArm`)
//             hug:  {bag:[x,y,s,rot], handle?:false, paws:[[x,y,rot],[x,y,rot]], arms?:[[root,tip],[root,tip]], w?}
//                   bag hugged in front of the chest, paws on its upper corners}
//   line: [colour, width], mode: 'sticker'|'flat'|'crayon'
// }
// Hamsters have no arms at all, only small paws that always touch the body outline (the user's pick in review).
// Cat arms grow out of the body without a seam: `ink` names the slot drawn before the body (the outline), `fill`
// the slot drawn after it (the fur, which covers the body's outline where the arm joins). Arms in front of the body
// (holding, hugging) are outlined limbs whose root is patched with fur (front()).
// arms(rig, mode) -> {back, front, over}: markup for the pet's back layer (behind the body), front layer
// (after the desk, behind a cat's head) and the OVER slot (inside the head group, in front of the face).
// Modes: type | rest | up | hold | scratch, and the backpack styles strap (worn) | wave (desk) | hug.
QJZ.pets.rig = (function () {
  function n(v) { return Math.round(v * 100) / 100; }

  // outline of a limb tapering from width wr at a (root) to wt at b (tip); both ends rounded
  function taper(a, b, wr, wt) {
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len, h1 = wr / 2, h2 = wt / 2;
    return `M${n(a[0] + nx * h1)},${n(a[1] + ny * h1)} L${n(b[0] + nx * h2)},${n(b[1] + ny * h2)} A${n(h2)},${n(h2)} 0 0 0 ${n(b[0] - nx * h2)},${n(b[1] - ny * h2)}` +
      ` L${n(a[0] - nx * h1)},${n(a[1] - ny * h1)} A${n(h1)},${n(h1)} 0 0 0 ${n(a[0] + nx * h1)},${n(a[1] + ny * h1)} Z`;
  }

  // a limb that grows out of the body: {ink, fill}. Draw ink before the body and fill after it.
  // Two points give a tapered limb (w = [root, tip]); more points a bent limb of even width (w = number).
  function grow(rig, pts, w) {
    var lw = rig.line[1], ink, fill, col = rig.limb.fill;
    if (pts.length === 2) {
      var d = taper(pts[0], pts[1], w[0], w[1]);
      ink = `<path class="limb" d="${d}" fill="${rig.line[0]}" stroke="${rig.line[0]}" stroke-width="${n(lw * 2)}" stroke-linejoin="round"/>`;
      fill = `<path class="limb" d="${d}" fill="${col}"/>`;
    } else {
      var p = 'M' + pts.map(function (q) { return n(q[0]) + ',' + n(q[1]); }).join(' L');
      ink = `<path class="limb" d="${p}" fill="none" stroke="${rig.line[0]}" stroke-width="${n(w + lw * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      fill = `<path class="limb" d="${p}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return { ink: rig.mode === 'flat' ? '' : ink, fill: fill };
  }

  // an outlined limb lying in front of the body (holding paws); the root is patched with fur so it has no cap seam
  function front(rig, a, b, w) {
    var g = grow(rig, [a, b], [w, w * 0.85]);
    return g.ink + g.fill + `<circle cx="${a[0]}" cy="${a[1]}" r="${n(w / 2 + rig.line[1])}" fill="${rig.limb.fill}"/>`;
  }

  function add(o, k, m) { if (m) o[k] = (o[k] || '') + m; }
  function paws(rig, list) {
    return list.map(function (p) { return rig.paw(p[0], p[1], p[2]); }).join('');
  }
  // cat arms in front of the body ([[root, tip], ...]); hamsters have none
  function limbs(rig, list, w) {
    return list ? list.map(function (a) { return front(rig, a[0], a[1], w || 10); }).join('') : '';
  }

  function arms(rig, mode) {
    switch (mode) {
      case 'type': case 'rest': return { front: rig.pawL + rig.pawR };
      case 'up': {
        var u = rig.up, o = {};
        if (u.paws) {   // paws only: they wiggle in place (origin = the paw), so they never leave the head outline
          o.over = u.paws.map(function (q, i) {
            return `<g class="arm${i ? 'R' : 'L'}" style="transform-origin:${q[0]}px ${q[1]}px">${rig.paw(q[0], q[1], q[2])}</g>`;
          }).join('');
          return o;
        }
        u.arms.forEach(function (a, i) {
          var g = grow(rig, [a[0], a[1]], u.w), g0 = `<g class="arm${i ? 'R' : 'L'}" style="transform-origin:${a[0][0]}px ${a[0][1]}px">`;
          add(o, u.ink, g.ink ? g0 + g.ink + '</g>' : '');
          add(o, u.fill, g0 + g.fill + rig.paw(a[1][0], a[1][1], a[2]) + '</g>');
        });
        return o;
      }
      case 'hold': {
        var h = rig.holdArm, m = '';
        if (h.arms) m = front(rig, h.arms[0][0], h.arms[0][1], h.w) + front(rig, h.arms[1][0], h.arms[1][1], h.w);
        return { over: m + rig.paw(h.paws[0][0], h.paws[0][1], h.paws[0][2]) + rig.paw(h.paws[1][0], h.paws[1][1], h.paws[1][2]) };
      }
      case 'scratch': {
        var s = rig.scratch, r = { front: rig.pawR }, oy = s.arm ? s.paw[1] + 6 : s.paw[1];
        if (s.arm) {
          var gs = grow(rig, s.arm, s.w);
          add(r, s.ink, gs.ink);
          add(r, s.fill, gs.fill);
        }
        add(r, 'over', `<g class="scr" style="transform-origin:${s.paw[0]}px ${oy}px">${rig.paw(s.paw[0], s.paw[1], s.paw[2])}</g>`);
        return r;
      }
      case 'strap': {   // worn backpack: paws gripping the straps at the chest
        var w = rig.pack.worn, o2 = {};
        o2[w.slot || 'over'] = limbs(rig, w.arms, w.w) + paws(rig, w.paws);
        return o2;
      }
      case 'wave': {   // backpack on the desk: wave with the left paw, pat the bag with the right
        var d = rig.pack.desk, u2 = rig.up, o3 = {}, q = d.wave, r2 = d.rest;
        if (u2.paws) {
          q = q || u2.paws[0];
          o3.over = `<g class="armL" style="transform-origin:${q[0]}px ${n(q[1] + 7)}px">${rig.paw(q[0], q[1], q[2])}</g>`;
        } else {
          var a0 = u2.arms[0], g2 = grow(rig, [a0[0], a0[1]], u2.w), g3 = `<g class="armL" style="transform-origin:${a0[0][0]}px ${a0[0][1]}px">`;
          add(o3, u2.ink, g2.ink ? g3 + g2.ink + '</g>' : '');
          add(o3, u2.fill, g3 + g2.fill + rig.paw(a0[1][0], a0[1][1], a0[2]) + '</g>');
        }
        var pivot = d.restArm ? d.restArm[0] : [r2[0] - 7, r2[1] + 2];
        add(o3, 'front', `<g class="armR" style="transform-origin:${pivot[0]}px ${pivot[1]}px">` +
          limbs(rig, d.restArm ? [d.restArm] : null, d.w) + rig.paw(r2[0], r2[1], r2[2]) + '</g>');
        return o3;
      }
      case 'hug': {   // backpack hugged in front of the chest
        var h2 = rig.pack.hug;
        return { front: limbs(rig, h2.arms, h2.w) + paws(rig, h2.paws) };
      }
      default: return {};
    }
  }

  return { grow: grow, front: front, taper: taper, arms: arms };
})();
