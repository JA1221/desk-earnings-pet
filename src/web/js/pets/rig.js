window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Arm poses shared by the skins. A skin's build(uid) returns a `rig` describing where its paws go:
//
// rig = {
//   pivot: [x,y],            head (or mochi) tilt pivot -> --hx/--hy
//   grab: [x,y]              the scruff tip of the dangle pose: its topmost painted point on the centre line, in the
//                            petonly / scene coordinates. The swing pivot (--gx/--gy), and the point U7 hangs under the
//                            cursor while it is dragged (QJZ.pets.grabAt, layouts' dragStart {grab})
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
//   pack:    the waitBag backpack, standing on the desk beside the pet, which sits up `lift` units off the
//            keyboard (not in the avatar):
//            {lift, desk: {bag:[x,y,s], wave?:[x,y,rot], rest:[x,y,rot], restArm?:[root,tip], w?}}
//            one paw waves (hamsters: `wave`, beside the head; cats: the left raised arm of `up`), the other
//            pats the bag (`rest`, cats reach it with `restArm`)
//   hello:   the 1.1 waving paw (wave, holdCup), raised beside the head, one of
//            {paw:[x,y,rot], pivot:[x,y]}                                       (hamsters) the paw alone, rocking
//                                                                             about pivot (inside the body)
//            {ink, fill, w:[root,tip], arm:[root,tip,rot]}                      (cats) a raised arm, swinging from
//                                                                             its root
//            optional knock: [x,y] where the knock marks centre (default: the paw / the arm tip)
//   glass:   [x,y,scale]  (optional, default hold) the water glass held in front of the body (holdCup)
//   sipGlass: [x,y,scale] (optional) the glass while sipping, its straw in the mouth (default: under the tiny o mouth)
//   glassArm: {paws, arms?, w} (optional, default holdArm) the paws (and cat limbs) that hold the glass
//   bang:    [x,y]  (optional, default qm) the ! of the knock marks;  phones: the headphones (props.js headphones)
// The hello arm, glass, sipGlass, glassArm, bang and phones are per skin; a skin without them gets the defaults above.
//   line: [colour, width], mode: 'sticker'|'flat'|'crayon'
//   inkClip: 'url(#id)'      (optional) a clip that keeps only what lies outside the body: then a skin can put the
//                            outlines of its grown arms (up, wave, scratch) in the same moving group as the body and the
//                            fur (ink: 'over'), so a tilting or squishing body never pulls the outline off the arm
// }
// Hamsters have no arms at all, only small paws that always touch the body outline (the user's pick in review).
// Cat arms grow out of the body without a seam: `ink` names the slot drawn before the body (the outline), `fill`
// the slot drawn after it (the fur, which covers the body's outline where the arm joins). Arms in front of the body
// (holding, hugging) are outlined limbs whose root is patched with fur (front()).
// arms(rig, mode) -> {back, under, front, over, grip}: markup for the pet's back layer (behind the body), front layer
// (after the desk, behind a cat's head), the OVER slot (inside the head group, in front of the face) and grip, the
// paws that hold the held prop (compose puts them in the OVER slot with it, in the moving .held group). under: the
// outline, behind the body, of an arm whose fur is in the front layer; the avatar has no front layer, so compose
// leaves it out there (an outline alone would show as a dark arm).
// Modes: type | rest | up | hold | scratch, and wave (the desk backpack: wave with one paw, pat the bag with the other);
// 1.1: hello (wave with the left paw, the right one rests on the keys), glass (both paws hold the water glass:
// glassArm) and cup (wave with the left paw, the right one holds the glass). GRIP: the modes that hold the held prop.
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
  // grown-arm outlines cut to outside the body (rig.inkClip), outside the arm's own moving group so the cut stays put
  function clipInk(rig, m) { return m && rig.inkClip ? '<g clip-path="' + rig.inkClip + '">' + m + '</g>' : m; }
  // the slot for a grown arm's outline: an outline behind the body ('back') whose fur is in the front layer goes to
  // 'under', which the avatar leaves out with that front layer (cat S5: else a dark arm shows in its portrait)
  function inkSlot(ink, fill) { return ink === 'back' && fill === 'front' ? 'under' : ink; }
  function paws(rig, list) {
    return list.map(function (p) { return rig.paw(p[0], p[1], p[2]); }).join('');
  }
  // cat arms in front of the body ([[root, tip], ...]); hamsters have none
  function limbs(rig, list, w) {
    return list ? list.map(function (a) { return front(rig, a[0], a[1], w || 10); }).join('') : '';
  }
  // the 1.1 waving left paw (.armL) into o: a hamster's paw rocking about its pivot, a cat's arm swinging from its root
  // (a skin without rig.hello waves its waitBag paw)
  function hello(rig, o) {
    var h = rig.hello;
    if (!h) {
      var d = rig.pack.desk, q = d.wave || (rig.up.paws ? rig.up.paws[0] : null);
      h = q ? { paw: q, pivot: [q[0], n(q[1] + 7)] } : { ink: rig.up.ink, fill: rig.up.fill, w: rig.up.w, arm: rig.up.arms[0] };
    }
    if (h.paw) {
      add(o, 'over', `<g class="armL" style="transform-origin:${h.pivot[0]}px ${h.pivot[1]}px">${rig.paw(h.paw[0], h.paw[1], h.paw[2])}</g>`);
      return o;
    }
    var a = h.arm, g = grow(rig, [a[0], a[1]], h.w), g0 = `<g class="armL" style="transform-origin:${a[0][0]}px ${a[0][1]}px">`;
    add(o, inkSlot(h.ink, h.fill), g.ink ? clipInk(rig, g0 + g.ink + '</g>') : '');
    add(o, h.fill, g0 + g.fill + rig.paw(a[1][0], a[1][1], a[2]) + '</g>');
    return o;
  }
  // the paw i that holds the glass (rig.glassArm, else holdArm), and a cat's limb to it
  function grip(rig, i) {
    var h = rig.glassArm || rig.holdArm, p = h.paws[i];
    return (h.arms ? front(rig, h.arms[i][0], h.arms[i][1], h.w) : '') + rig.paw(p[0], p[1], p[2]);
  }

  var GRIP = { hold: 1, cup: 1, glass: 1 };

  function arms(rig, mode) {
    switch (mode) {
      case 'type': case 'rest': return { front: rig.pawL + rig.pawR };
      case 'hello': return hello(rig, { front: rig.pawR });
      case 'cup': return hello(rig, { grip: grip(rig, 1) });
      case 'glass': return { grip: grip(rig, 0) + grip(rig, 1) };
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
          add(o, inkSlot(u.ink, u.fill), g.ink ? clipInk(rig, g0 + g.ink + '</g>') : '');
          add(o, u.fill, g0 + g.fill + rig.paw(a[1][0], a[1][1], a[2]) + '</g>');
        });
        return o;
      }
      case 'hold': {
        var h = rig.holdArm, m = '';
        if (h.arms) m = front(rig, h.arms[0][0], h.arms[0][1], h.w) + front(rig, h.arms[1][0], h.arms[1][1], h.w);
        return { grip: m + rig.paw(h.paws[0][0], h.paws[0][1], h.paws[0][2]) + rig.paw(h.paws[1][0], h.paws[1][1], h.paws[1][2]) };
      }
      case 'scratch': {
        var s = rig.scratch, r = { front: rig.pawR }, oy = s.arm ? s.paw[1] + 6 : s.paw[1];
        if (s.arm) {
          var gs = grow(rig, s.arm, s.w);
          add(r, inkSlot(s.ink, s.fill), clipInk(rig, gs.ink));
          add(r, s.fill, gs.fill);
        }
        add(r, 'over', `<g class="scr" style="transform-origin:${s.paw[0]}px ${oy}px">${rig.paw(s.paw[0], s.paw[1], s.paw[2])}</g>`);
        return r;
      }
      case 'wave': {   // backpack on the desk: wave with the left paw, pat the bag with the right
        var d = rig.pack.desk, u2 = rig.up, o3 = {}, q = d.wave, r2 = d.rest;
        if (u2.paws) {
          q = q || u2.paws[0];
          o3.over = `<g class="armL" style="transform-origin:${q[0]}px ${n(q[1] + 7)}px">${rig.paw(q[0], q[1], q[2])}</g>`;
        } else {
          var a0 = u2.arms[0], g2 = grow(rig, [a0[0], a0[1]], u2.w), g3 = `<g class="armL" style="transform-origin:${a0[0][0]}px ${a0[0][1]}px">`;
          add(o3, inkSlot(u2.ink, u2.fill), g2.ink ? clipInk(rig, g3 + g2.ink + '</g>') : '');
          add(o3, u2.fill, g3 + g2.fill + rig.paw(a0[1][0], a0[1][1], a0[2]) + '</g>');
        }
        var pivot = d.restArm ? d.restArm[0] : [r2[0] - 7, r2[1] + 2];
        add(o3, 'front', `<g class="armR" style="transform-origin:${pivot[0]}px ${pivot[1]}px">` +
          limbs(rig, d.restArm ? [d.restArm] : null, d.w) + rig.paw(r2[0], r2[1], r2[2]) + '</g>');
        return o3;
      }
      default: return {};
    }
  }

  return { grow: grow, front: front, taper: taper, arms: arms, GRIP: GRIP };
})();
