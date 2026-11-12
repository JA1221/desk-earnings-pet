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
//   bag: {x,y,s,rot, straps:[[x1,y1,x2,y2],[...]]}   backpack behind the body + straps in front
//   bento: [x,y,s],          lunch box on the desk
//   paw(x, y, rot) -> svg    one paw in the skin's style
//   limb: {fill}             fur colour of arms (outline from the skin's line colour)
//   pawL, pawR: svg          the resting / typing paws (class pawL / pawR)
//   up:      {ink, fill, w:[root,tip], arms:[[root,tip,rot],[root,tip,rot]]}   both arms raised
//   holdArm: {paws:[[x,y,rot],[x,y,rot]], arms?:[[root,tip],[root,tip]], w}    paws holding the item
//   scratch: {ink, fill, w, arm:[root,(elbow,)tip], paw:[x,y,rot]}            left paw scratching the head
//   strap:   [[x,y,rot],[x,y,rot]]                                             paws gripping backpack straps
//   line: [colour, width], mode: 'sticker'|'flat'|'crayon'
// }
// Raised arms grow out of the body without a seam: `ink` names the slot drawn before the body (the outline), `fill`
// the slot drawn after it (the fur, which covers the body's outline where the arm joins). Hamster arms are short nubs.
// arms(rig, mode) -> {back, front, over}: markup for the pet's back layer (behind the body), front layer
// (after the desk, behind a cat's head) and the OVER slot (inside the head group, in front of the face).
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
    var lw = rig.line[1], ink, fill;
    if (pts.length === 2) {
      var d = taper(pts[0], pts[1], w[0], w[1]);
      ink = `<path d="${d}" fill="${rig.line[0]}" stroke="${rig.line[0]}" stroke-width="${n(lw * 2)}" stroke-linejoin="round"/>`;
      fill = `<path d="${d}" fill="${rig.limb.fill}"/>`;
    } else {
      var p = 'M' + pts.map(function (q) { return n(q[0]) + ',' + n(q[1]); }).join(' L');
      ink = `<path d="${p}" fill="none" stroke="${rig.line[0]}" stroke-width="${n(w + lw * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      fill = `<path d="${p}" fill="none" stroke="${rig.limb.fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return { ink: rig.mode === 'flat' ? '' : ink, fill: fill };
  }

  // an outlined limb lying in front of the body (holding paws); the root is patched with fur so it has no cap seam
  function front(rig, a, b, w) {
    var g = grow(rig, [a, b], [w, w * 0.85]);
    return g.ink + g.fill + `<circle cx="${a[0]}" cy="${a[1]}" r="${n(w / 2 + rig.line[1])}" fill="${rig.limb.fill}"/>`;
  }

  function add(o, k, m) { if (m) o[k] = (o[k] || '') + m; }

  function arms(rig, mode) {
    switch (mode) {
      case 'type': case 'rest': return { front: rig.pawL + rig.pawR };
      case 'up': {
        var u = rig.up, o = {};
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
        var s = rig.scratch, r = { front: rig.pawR }, gs = grow(rig, s.arm, s.w);
        add(r, s.ink, gs.ink);
        add(r, s.fill, gs.fill);
        add(r, 'over', `<g class="scr" style="transform-origin:${s.paw[0]}px ${s.paw[1] + 6}px">${rig.paw(s.paw[0], s.paw[1], s.paw[2])}</g>`);
        return r;
      }
      case 'strap': {
        var t = rig.strap;
        return { over: rig.paw(t[0][0], t[0][1], t[0][2]) + rig.paw(t[1][0], t[1][1], t[1][2]) };
      }
      default: return {};
    }
  }

  return { grow: grow, front: front, taper: taper, arms: arms };
})();
