window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// Arm poses shared by the skins. A skin's build(uid) returns a `rig` describing where its paws go:
//
// rig = {
//   pivot: [x,y],            head (or mochi) tilt pivot -> --hx/--hy; grab: [x,y] dangle pivot -> --gx/--gy
//   top: [x,y],              top of the head (hearts, coin, smoke come from here); qm: [x,y] the ? mark
//   zzz: [x,y],              where Zzz / dots start (upper right of the head)
//   side: [[x,y],[x,y]],     left / right of the head at eye height (sweat drops)
//   nose: [x,y],             snot-bubble anchor;  anger: [x,y]  vein mark;  cheeks: [[x,y],[x,y]]
//   hold: [x,y,scale],       held item (mug, snack, rice ball) centre and size
//   fire: [[x,y,s],...],     flames behind the body (sprint)
//   bag: {x,y,s,rot, straps:[[x1,y1,x2,y2],[...]]}   backpack behind the body + straps in front
//   bento: [x,y,s],          lunch box on the desk
//   paw(x, y, rot) -> svg    one paw in the skin's style
//   limb: {w, fill}          arm thickness and fur colour (outline from the skin's line colour)
//   pawL, pawR: svg          the resting / typing paws (class pawL / pawR)
//   up:      {slot:'back'|'front', arms:[[from,to,rot],[from,to,rot]]}   both arms raised
//   holdArm: {paws:[[x,y,rot],[x,y,rot]], arms?:[[from,to],[from,to]]}  paws holding the item
//   scratch: {slot, arm:[from,(elbow,)to], paw:[x,y,rot]}                 left paw scratching the head
//   strap:   [[x,y,rot],[x,y,rot]]                                       paws gripping backpack straps
//   line: [colour, width], mode: 'sticker'|'flat'|'crayon'
// }
// arms(rig, mode) -> {back, front, over}: markup for the pet's back layer (behind the body), front layer
// (after the desk, behind a cat's head) and the OVER slot (inside the head group, in front of the face).
QJZ.pets.rig = (function () {
  function n(v) { return Math.round(v * 100) / 100; }

  // an outlined capsule through the points (a stubby arm or leg; three points give an elbow)
  function limb(rig, pts, w) {
    var d = 'M' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' L'), lw = w || rig.limb.w;
    var out = rig.mode === 'flat' ? '' : `<path d="${d}" fill="none" stroke="${rig.line[0]}" stroke-width="${n(lw + rig.line[1] * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return out + `<path d="${d}" fill="none" stroke="${rig.limb.fill}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  function arm(rig, a, cls) {   // a = [from, to, rot]
    return `<g class="${cls}" style="transform-origin:${a[0][0]}px ${a[0][1]}px">${limb(rig, [a[0], a[1]])}${rig.paw(a[1][0], a[1][1], a[2])}</g>`;
  }

  function arms(rig, mode) {
    switch (mode) {
      case 'type': case 'rest': return { front: rig.pawL + rig.pawR };
      case 'up': {
        var m = arm(rig, rig.up.arms[0], 'armL') + arm(rig, rig.up.arms[1], 'armR'), o = {};
        o[rig.up.slot] = m;
        return o;
      }
      case 'hold': {
        var h = rig.holdArm, a = '';
        if (h.arms) a = limb(rig, h.arms[0]) + limb(rig, h.arms[1]);
        return { over: a + rig.paw(h.paws[0][0], h.paws[0][1], h.paws[0][2]) + rig.paw(h.paws[1][0], h.paws[1][1], h.paws[1][2]) };
      }
      case 'scratch': {
        var s = rig.scratch, r = { front: rig.pawR };
        var lm = limb(rig, s.arm);
        var pw = `<g class="scr" style="transform-origin:${s.paw[0]}px ${s.paw[1] + 6}px">${rig.paw(s.paw[0], s.paw[1], s.paw[2])}</g>`;
        if (s.slot === 'over') r.over = lm + pw;
        else { r[s.slot] = (r[s.slot] || '') + lm; r.over = pw; }
        return r;
      }
      case 'strap': {
        var t = rig.strap;
        return { over: rig.paw(t[0][0], t[0][1], t[0][2]) + rig.paw(t[1][0], t[1][1], t[1][2]) };
      }
      default: return {};
    }
  }

  return { limb: limb, arms: arms };
})();
