// Pets: slot-based renderer (Task 9) and the pet states (Task 12). Every skin in every view and every state must
// give a well-formed SVG with its slots filled, the state class on the root, references that resolve inside the
// same SVG, and ids that never collide between SVGs.
(function () {
  var VIEWS = ['scene', 'petonly', 'avatar'];
  var STATES = ['idle', 'doze', 'typing', 'stretch', 'yawn', 'coffee', 'stare', 'scratch', 'sprint', 'lunchSleep', 'lunchEat',
    'celebrate', 'waitBag', 'petted', 'angry', 'eat', 'hop', 'dangle'];
  var EXPRESSIONS = ['open', 'happy', 'closed', 'sleepy', 'angry', 'surprised', 'dazed', 'sparkle'];
  var MOUTHS = ['neutral', 'smile', 'open', 'chew', 'yawn', 'pout', 'tiny'];
  var SLOTS = ['<!--EYES-->', '<!--MOUTH-->', '<!--OVER-->'];

  function all() { return QJZ.pets.list('hamster').concat(QJZ.pets.list('cat')); }
  function idsOf(defs) { return defs.map(function (d) { return d.id; }); }
  function parse(svg) { return new DOMParser().parseFromString(svg, 'image/svg+xml'); }
  function svgIds(svg) {
    var out = [], re = /\sid="([^"]+)"/g, m;
    while ((m = re.exec(svg))) out.push(m[1]);
    return out;
  }
  function hasClass(el, name) { return (' ' + (el.getAttribute('class') || '') + ' ').indexOf(' ' + name + ' ') >= 0; }
  // every url(#x) and href="#x" must point at an id defined in the same SVG
  function unresolved(svg) {
    var ids = svgIds(svg), out = [], re = /url\(#([^)]+)\)|href="#([^"]+)"/g, m;
    while ((m = re.exec(svg))) { var r = m[1] || m[2]; if (ids.indexOf(r) < 0) out.push(r); }
    return out;
  }
  function inBody(el) {
    var p = el.parentNode;
    while (p && p.nodeType === 1) {
      if (hasClass(p, 'head') || hasClass(p, 'squish') || hasClass(p, 'breath') || hasClass(p, 'swing')) return true;
      p = p.parentNode;
    }
    return false;
  }
  function slotCount(layers, slot) {
    return ((layers.back || '') + (layers.pre || '') + (layers.front || '') + (layers.post || '')).split(slot).length - 1;
  }

  test('pets: list gives 5 hamsters and 5 cats in skin order', function () {
    eq(QJZ.pets.list('hamster').length, 5);
    eq(QJZ.pets.list('cat').length, 5);
    eq(idsOf(QJZ.pets.list('hamster')), ['hamster:p0', 'hamster:p4', 'hamster:h2', 'hamster:s4', 'hamster:s5']);
    eq(idsOf(QJZ.pets.list('cat')), ['cat:p0', 'cat:p4', 'cat:h2', 'cat:s4', 'cat:s5']);
    // every hamster skin has its cat, in the same order, and settings allows exactly the registered skins
    eq(QJZ.pets.list('cat').map(function (d) { return d.skin; }), QJZ.pets.list('hamster').map(function (d) { return d.skin; }));
    eq(QJZ.pets.list('cat').map(function (d) { return d.skin; }), QJZ.settings.skinsFor('cat'));
    eq(QJZ.pets.list('hamster').map(function (d) { return d.skin; }), QJZ.settings.skinsFor('hamster'));
    eq(QJZ.pets.list('dog'), []);
  });

  test('pets: the H2 skins are called 貪吃鼠 and 貪吃貓 (no skin keeps the old 鼓鼓頰 name)', function () {
    eq([QJZ.pets.get('hamster:h2').name, QJZ.pets.get('cat:h2').name], ['貪吃鼠', '貪吃貓']);
    all().forEach(function (d) { ok(d.name.indexOf('鼓鼓頰') < 0, d.id + ' ' + d.name); });
  });

  test('pets: skin defs carry the contract fields', function () {
    all().forEach(function (d) {
      eq(d.id, d.kind + ':' + d.skin, d.id + ' id');
      ok(typeof d.name === 'string' && d.name.length > 0, d.id + ' name');
      ok(['sticker', 'flat', 'crayon'].indexOf(d.room) >= 0, d.id + ' room');
      ok(d.wrap === null || d.wrap === 'crayon', d.id + ' wrap');
      var b = d.build('t0');
      ok(typeof b.crop === 'string' && b.crop.split(' ').length === 4, d.id + ' crop');
      ok(typeof b.seed === 'boolean', d.id + ' seed');
      ok(b.layers && (b.layers.pre || b.layers.post), d.id + ' layers');
      // one of each slot across all four layers, and in each special pose
      [['layers', b.layers], ['lie', b.poses.lie], ['dangle', b.poses.dangle]].forEach(function (e) {
        SLOTS.forEach(function (slot) { eq(slotCount(e[1], slot), 1, d.id + ' ' + e[0] + ' one ' + slot); });
      });
      ok(b.rig.pivot.length === 2 && b.rig.grab.length === 2 && b.rig.top.length === 2 && b.rig.hold.length === 3, d.id + ' rig anchors');
      ok(typeof b.rig.paw === 'function' && b.rig.pawL.indexOf('class="pawL"') >= 0 && b.rig.pawR.indexOf('class="pawR"') >= 0, d.id + ' rig paws');
      eq(b.layers.front, b.rig.pawL + b.rig.pawR, d.id + ' front layer is the two paws');
      eq(b.face.eyes.length, 2, d.id + ' two eyes');
      ok(b.face.eyeR > 0 && b.face.mouth.length === 2 && typeof b.face.ink === 'string', d.id + ' face');
      ok(['q', 'ham', 'gloss', 'dot', 'flat', 'crayon'].indexOf(b.face.eyeStyle) >= 0, d.id + ' eyeStyle');
    });
  });

  all().forEach(function (d) {
    VIEWS.forEach(function (view) {
      test('pets: ' + d.id + ' ' + view + ' is a well-formed filled SVG', function () {
        var svg = QJZ.pets.compose(d.id, view, { state: 'typing', expression: 'open', mouth: 'neutral', props: [] });
        ok(typeof svg === 'string' && svg.indexOf('<svg') === 0, 'starts with <svg');
        var doc = parse(svg);
        eq(doc.getElementsByTagName('parsererror').length, 0, 'parsererror');
        eq(doc.documentElement.localName, 'svg');
        ok(hasClass(doc.documentElement, 'pet-svg'), 'root .pet-svg');
        ok(svg.indexOf('<!--EYES-->') < 0, 'EYES slot filled');
        ok(svg.indexOf('<!--MOUTH-->') < 0, 'MOUTH slot filled');
        ok(svg.indexOf('eyes-happy') >= 0, 'has eyes-happy');
        ok(svg.indexOf('class="eyes-open"') >= 0, 'has eyes-open');
        // Avatar = back+pre+post like the prototype avatarSVG (no front layer), so paws are checked in the other views.
        if (view !== 'avatar') {
          ok(svg.indexOf('class="pawL"') >= 0, 'has pawL');
          ok(svg.indexOf('class="pawR"') >= 0, 'has pawR');
        }
        // eyes sit inside the moving head (or squish) group, so head motion carries them
        var look = doc.querySelector('.look');
        ok(look, 'has .look');
        var p = look.parentNode, inHead = false;
        while (p && p.nodeType === 1) { if (hasClass(p, 'head') || hasClass(p, 'squish')) { inHead = true; break; } p = p.parentNode; }
        ok(inHead, 'eyes inside .head/.squish');
        eq(svgIds(svg).length, svgIds(svg).filter(function (x, i, a) { return a.indexOf(x) === i; }).length, 'no duplicate id inside one SVG');
      });
    });
  });

  test('pets: two compose calls never share an id', function () {
    all().forEach(function (d) {
      VIEWS.forEach(function (view) {
        var a = svgIds(QJZ.pets.compose(d.id, view, {})), b = svgIds(QJZ.pets.compose(d.id, view, {}));
        ok(a.length > 0, d.id + ' ' + view + ' has ids');
        a.forEach(function (x) { ok(b.indexOf(x) < 0, d.id + ' ' + view + ' shares id ' + x); });
      });
    });
  });

  test('pets: compose defaults and unknown id', function () {
    eq(QJZ.pets.compose('cat:p0', 'scene').indexOf('<svg'), 0);
    var threw = false;
    try { QJZ.pets.compose('dog:p0', 'scene', {}); } catch (e) { threw = true; }
    ok(threw, 'unknown pet throws');
    threw = false;
    try { QJZ.pets.compose('cat:p0', 'poster', {}); } catch (e) { threw = true; }
    ok(threw, 'unknown view throws');
  });

  test('pets: views use the prototype viewBoxes', function () {
    var crop = QJZ.pets.get('hamster:p0').build('t1').crop;
    ok(QJZ.pets.compose('hamster:p0', 'scene', {}).indexOf('viewBox="0 0 300 200"') > 0, 'scene');
    ok(QJZ.pets.compose('hamster:p0', 'scene', { viewBox: '0 -4 300 236' }).indexOf('viewBox="0 -4 300 236"') > 0, 'scene custom');
    // petonly: the prototype's 38 18 160 154 widened for jumps, coins and the dangling pose (same for all skins)
    ok(QJZ.pets.compose('hamster:p0', 'petonly', {}).indexOf('viewBox="30 4 176 170"') > 0, 'petonly');
    ok(QJZ.pets.compose('cat:s5', 'petonly', { state: 'dangle' }).indexOf('viewBox="30 4 176 170"') > 0, 'petonly dangle');
    ok(QJZ.pets.compose('hamster:p0', 'avatar', {}).indexOf('viewBox="' + crop + '"') > 0, 'avatar');
  });

  test('pets: expr eyes and mouth give the skin look', function () {
    var face = QJZ.pets.get('hamster:p0').build('u9').face;
    var open = QJZ.pets.expr.eyes(face, 'open', 'u9');
    eq(open.split('class="blink"').length, 3, 'two blinking eyes');
    ok(open.indexOf('url(#u9-geye)') > 0, 'glossy gradient uses uid');
    var happy = QJZ.pets.expr.eyes(face, 'happy', 'u9');
    eq(happy.split('<path').length, 3, 'two happy arcs');
    ok(happy.indexOf('stroke="' + face.ink + '"') > 0, 'happy arcs in ink');
    var mouth = QJZ.pets.expr.mouth(face, 'neutral');
    ok(mouth.indexOf('<path') === 0 && mouth.indexOf('stroke="' + face.ink + '"') > 0, 'mouth path in ink');
    ok(mouth.indexOf('M118,113.4 ') > 0, 'P0 hamster Y mouth starts at its anchor');
    // the full sets are published; unknown names fall back to the skin's own look
    eq(QJZ.pets.expr.EXPRESSIONS, EXPRESSIONS);
    eq(QJZ.pets.expr.MOUTHS, MOUTHS);
    eq(QJZ.pets.expr.eyes(face, 'nope', 'u9'), open);
    eq(QJZ.pets.expr.eyes(face, undefined, 'u9'), open);
    eq(QJZ.pets.expr.mouth(face, 'nope'), mouth);
    eq(QJZ.pets.expr.mouth(face, undefined), mouth);
  });

  test('pets: every expression and mouth differs from open / neutral for every skin', function () {
    all().forEach(function (d) {
      var face = d.build('u5').face, open = QJZ.pets.expr.eyes(face, 'open', 'u5'), neutral = QJZ.pets.expr.mouth(face, 'neutral');
      EXPRESSIONS.slice(1).forEach(function (x) {
        var m = QJZ.pets.expr.eyes(face, x, 'u5');
        ok(m.length > 0 && m !== open, d.id + ' eyes ' + x + ' differ from open');
        eq(parse('<svg xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="u5-geye"/></defs>' + m + '</svg>').getElementsByTagName('parsererror').length, 0, d.id + ' eyes ' + x + ' parse');
        eq(unresolved('<svg><radialGradient id="u5-geye"/>' + m + '</svg>'), [], d.id + ' eyes ' + x + ' refs');
      });
      MOUTHS.slice(1).forEach(function (x) {
        var m = QJZ.pets.expr.mouth(face, x);
        ok(m.length > 0 && m !== neutral, d.id + ' mouth ' + x + ' differs from neutral');
        eq(parse('<svg xmlns="http://www.w3.org/2000/svg">' + m + '</svg>').getElementsByTagName('parsererror').length, 0, d.id + ' mouth ' + x + ' parse');
      });
      // flat skins draw closed eyes without strokes; crayon skins add a second pencil pass
      if (face.eyeStyle === 'flat') ok(QJZ.pets.expr.eyes(face, 'closed', 'u5').indexOf('stroke') < 0, d.id + ' flat closed eyes');
      if (face.eyeStyle === 'crayon') ok(QJZ.pets.expr.eyes(face, 'closed', 'u5').split('<path').length > 3, d.id + ' crayon closed eyes');
    });
  });

  test('pets: 18 states in review order, each with a label and known parts', function () {
    eq(QJZ.pets.states.NAMES, STATES);
    STATES.forEach(function (s) {
      var st = QJZ.pets.states.get(s);
      ok(st && st.label && st.group, s + ' label');
      ok(EXPRESSIONS.indexOf(st.eyes) >= 0 && MOUTHS.indexOf(st.mouth) >= 0, s + ' face');
      st.props.forEach(function (p) { ok(QJZ.pets.props.NAMES.indexOf(p) >= 0, s + ' prop ' + p); });
      if (st.alt && st.alt.eyes) ok(EXPRESSIONS.indexOf(st.alt.eyes) >= 0, s + ' alt eyes');
      if (st.alt && st.alt.mouth) ok(MOUTHS.indexOf(st.alt.mouth) >= 0, s + ' alt mouth');
    });
    eq(QJZ.pets.states.get('nope'), null);
    eq(QJZ.pets.states.get('hasOwnProperty'), null);
  });

  all().forEach(function (d) {
    STATES.forEach(function (s) {
      test('pets: ' + d.id + ' ' + s + ' composes in every view', function () {
        VIEWS.forEach(function (view) {
          var svg = QJZ.pets.compose(d.id, view, { state: s }), doc = parse(svg), at = view + ': ';
          eq(doc.getElementsByTagName('parsererror').length, 0, at + 'parsererror');
          ok(!/<!--[A-Z]+-->/.test(svg), at + 'no leftover slot');
          ok(hasClass(doc.documentElement, 'pet-svg') && hasClass(doc.documentElement, 'kind-' + d.kind) && hasClass(doc.documentElement, 'st-' + s), at + 'root classes');
          ok(/--hx:[\d.]+px;--hy:[\d.]+px;--gx:[\d.]+px;--gy:[\d.]+px/.test(doc.documentElement.getAttribute('style')), at + 'pivots');
          eq(unresolved(svg), [], at + 'unresolved references');
          var ids = svgIds(svg);
          eq(ids.length, ids.filter(function (x, i, a) { return a.indexOf(x) === i; }).length, at + 'duplicate id');
          var other = svgIds(QJZ.pets.compose(d.id, view, { state: s }));
          ids.forEach(function (x) { ok(other.indexOf(x) < 0, at + 'id shared between two SVGs: ' + x); });
          var look = doc.querySelector('.look');
          ok(look && inBody(look), at + 'eyes ride on the head');
        });
      });
    });
  });

  test('pets: hamsters draw no arm limbs in any state or view; cats still do', function () {
    QJZ.pets.list('hamster').forEach(function (d) {
      var rig = d.build('a0').rig;
      ok(rig.up.paws && !rig.up.arms && rig.scratch.paw && !rig.scratch.arm && !rig.limb, d.id + ' rig has paws only');
      STATES.forEach(function (s) {
        VIEWS.forEach(function (v) {
          ok(QJZ.pets.compose(d.id, v, { state: s }).indexOf('class="limb"') < 0, d.id + ' ' + s + ' ' + v + ': no arm limbs');
        });
      });
    });
    QJZ.pets.list('cat').forEach(function (d) {
      ['stretch', 'celebrate', 'hop', 'scratch'].forEach(function (s) {
        ok(QJZ.pets.compose(d.id, 'petonly', { state: s }).indexOf('class="limb"') > 0, d.id + ' ' + s + ': has arms');
      });
    });
  });

  // ---------- the cats of hamster H2 and S4: 貪吃貓 and 扁平幾何貓 ----------
  function under(el, cls) {
    for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (hasClass(p, cls)) return true;
    return false;
  }
  var NEW_CATS = [['cat:h2', 'hamster:h2', '貪吃貓'], ['cat:s4', 'hamster:s4', '扁平幾何貓']];

  test('pets: cat H2 貪吃貓 and cat S4 扁平幾何貓 share their hamster\'s look and keep seamless cat arms', function () {
    NEW_CATS.forEach(function (e) {
      var cat = QJZ.pets.get(e[0]), ham = QJZ.pets.get(e[1]);
      ok(cat, e[0] + ' registered');
      eq([cat.kind, cat.skin, cat.name, cat.room, cat.wrap], ['cat', ham.skin, e[2], ham.room, ham.wrap], e[0] + ' def');
      var b = cat.build('c0'), hb = ham.build('h0');
      eq([b.face.eyeStyle, b.face.ink, b.rig.mode, b.rig.line], [hb.face.eyeStyle, hb.face.ink, hb.rig.mode, hb.rig.line], e[0] + ' face and line of ' + e[1]);
      eq(b.seed, false, e[0] + ' no sunflower seed on the desk');
      ok(b.rig.up.arms && !b.rig.up.paws && b.rig.scratch.arm && b.rig.limb && b.rig.limb.fill, e[0] + ' arms that grow out of the body');
      eq(Object.keys(b.rig.pack.desk).indexOf('wave'), -1, e[0] + ' waves with the raised arm, not a loose paw');
    });
    // H2 (the user's pick, 小魚乾虎斑貓): the chubby cheeks are part of the face outline, not discs stuck on the sides,
    // and a little dried fish sits on top of the head, riding with the squishing mochi, instead of the seed
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:176px;height:170px';
    document.body.appendChild(host);
    try {
      var h2 = QJZ.pets.compose('cat:h2', 'petonly', { state: 'idle' }), face = QJZ.pets.get('cat:h2').build('w0').face;
      eq(h2.indexOf('class="puff"'), -1, 'cat H2: no separate cheek discs');
      host.innerHTML = h2;
      var svg = host.firstElementChild, body = svg.querySelector('.squish .fur'), pt = svg.createSVGPoint();
      function inside(x, y) { pt.x = x; pt.y = y; return body.isPointInFill(pt); }
      function width(y) { var w = 0; for (var x = 30; x <= 206; x += 0.5) if (inside(x, y)) w += 0.5; return w; }
      var eyeY = face.eyes[0][1];
      ok(width(eyeY + 13) > width(eyeY) + 6, 'cat H2: the outline swells at the cheeks: ' + width(eyeY + 13) + ' vs ' + width(eyeY) + ' at the eyes');
      [face.eyes[0], face.eyes[1], face.mouth].forEach(function (p) { ok(inside(p[0], p[1]), 'cat H2: face feature inside the outline ' + p); });
      ok(h2.indexOf('#33302E') < 0, 'cat H2: no sunflower seed');
      var fish = svg.querySelector('[fill="#C9D4DE"]'), m = fish.parentNode.transform.baseVal.consolidate().matrix, bb = fish.getBBox();
      pt.x = bb.x + bb.width / 2; pt.y = bb.y + bb.height / 2;
      var c = pt.matrixTransform(m), top = 0;
      for (var y = 40; y < eyeY && !top; y += 0.5) if (inside(c.x, y)) top = y;
      ok(under(fish, 'squish'), 'cat H2: the fish rides with the mochi');
      ok(Math.abs(c.x - 118) < 6 && c.y < eyeY - 20 && c.y > top - 12 && c.y < top + 4, 'cat H2: the fish sits on top of the head: ' + Math.round(c.x) + ',' + Math.round(c.y) + ' (head top ' + top + ')');
      // both cats: every arm root lies inside the body (.fur), so the fur drawn over the body's edge hides the seam; and
      // the arm outlines ride in the same moving group as the body, so a tilting body never pulls them off the arm
      NEW_CATS.forEach(function (e) {
        var rig = QJZ.pets.get(e[0]).build('r0').rig, group = e[0] === 'cat:h2' ? 'squish' : 'head';
        [['celebrate', rig.up.arms[0][0]], ['celebrate', rig.up.arms[1][0]], ['scratch', rig.scratch.arm[0]], ['waitBag', rig.up.arms[0][0]]].forEach(function (r) {
          host.innerHTML = QJZ.pets.compose(e[0], 'petonly', { state: r[0] });
          var s2 = host.firstElementChild, p2 = s2.createSVGPoint(), limbs = s2.querySelectorAll('.limb');
          p2.x = r[1][0]; p2.y = r[1][1];
          ok(s2.querySelector('.fur').isPointInFill(p2), e[0] + ' ' + r[0] + ': arm root ' + r[1] + ' inside the body');
          ok(limbs.length > 0, e[0] + ' ' + r[0] + ': has arms');
          Array.prototype.forEach.call(limbs, function (l) { ok(under(l, group), e[0] + ' ' + r[0] + ': arm drawn in the moving body group'); });
        });
      });
    } finally { host.remove(); }
    // S4: flat, no A1 ink outlines anywhere in the art (hamster S4 likewise)
    ['hamster:s4', 'cat:s4'].forEach(function (id) {
      var b = QJZ.pets.get(id).build('f0'), art = [b.layers.back, b.layers.pre, b.layers.front, b.layers.post, b.poses.lie.front, b.poses.dangle.front].join('');
      ok(art.indexOf(QJZ.pets.common.L0) < 0 && art.indexOf('stroke-linejoin') < 0, id + ' has no ink outlines');
    });
  });

  test('pets: cat H2 and S4 compose every state, expression and mouth in every view: no placeholders, refs resolve, ids scoped to the SVG', function () {
    function check(id, view, opts, at) {
      var svg = QJZ.pets.compose(id, view, opts), doc = parse(svg), m = svg.match(/\sid="(pet\d+)-/), uid = m && m[1];
      eq(doc.getElementsByTagName('parsererror').length, 0, at + 'parses');
      ok(!/<!--[A-Z]+-->/.test(svg) && !/undefined|NaN|\$\{|\[object/.test(svg), at + 'no unreplaced placeholder');
      eq(unresolved(svg), [], at + 'url(#) and href refs resolve');
      ok(uid, at + 'has a uid');
      eq(svgIds(svg).filter(function (x) { return x.indexOf(uid + '-') !== 0; }), [], at + 'every id is scoped to the uid');
      ok(hasClass(doc.documentElement, 'kind-cat'), at + 'kind-cat');
      ok(inBody(doc.querySelector('.look')), at + 'eyes ride on the head');
      return doc;
    }
    NEW_CATS.forEach(function (e) {
      var id = e[0];
      VIEWS.forEach(function (view) {
        STATES.forEach(function (s) {
          var doc = check(id, view, { state: s }, id + ' ' + s + ' ' + view + ': ');
          ok(hasClass(doc.documentElement, 'st-' + s), id + ' ' + s + ' ' + view + ': state class');
        });
        EXPRESSIONS.forEach(function (x) { check(id, view, { state: 'typing', expression: x }, id + ' eyes ' + x + ' ' + view + ': '); });
        MOUTHS.forEach(function (x) { check(id, view, { state: 'typing', mouth: x }, id + ' mouth ' + x + ' ' + view + ': '); });
      });
    });
  });

  test('pets: compose state defaults and overrides', function () {
    function el(svg, sel) { return parse(svg).querySelector(sel); }
    ok(hasClass(parse(QJZ.pets.compose('cat:p0', 'avatar', { state: 'nope' })).documentElement, 'st-typing'), 'unknown state falls back to typing');
    ok(hasClass(parse(QJZ.pets.compose('cat:p0', 'avatar', {})).documentElement, 'st-typing'), 'default state is typing');
    // second-frame eyes come from the state, and go away when the caller picks the eyes
    ok(el(QJZ.pets.compose('cat:p0', 'avatar', { state: 'doze' }), '.eyes-alt'), 'doze has a second frame');
    var happy = parse(QJZ.pets.compose('cat:p0', 'avatar', { state: 'doze', expression: 'happy' }));
    eq(happy.querySelector('.eyes-alt'), null, 'expression override drops the second frame');
    eq(happy.querySelector('.eyes-open').getElementsByTagName('path').length, 2, 'expression override fills eyes-open');
    ok(QJZ.pets.compose('hamster:s4', 'avatar', { state: 'yawn' }).indexOf('class="mouth-b"') > 0, 'yawn mouth frame');
    ok(QJZ.pets.compose('hamster:s4', 'avatar', { state: 'yawn', mouth: 'smile' }).indexOf('mouth-b') < 0, 'mouth override drops it');
    // props: state defaults, replaced by opts.props, held props bring their paws
    ok(QJZ.pets.compose('hamster:p0', 'petonly', { state: 'coffee' }).indexOf('class="held"') > 0, 'coffee is held');
    ok(QJZ.pets.compose('hamster:p0', 'petonly', { state: 'coffee', props: [] }).indexOf('steam2') < 0, 'props [] removes the mug');
    ok(QJZ.pets.compose('hamster:p0', 'petonly', { state: 'typing', props: ['hearts'] }).indexOf('class="hrt"') > 0, 'extra props');
    ok(QJZ.pets.compose('cat:p4', 'petonly', { state: 'typing', props: ['snack'] }).indexOf('class="held"') > 0, 'a held prop brings holding paws');
    // special poses draw the pet in front of the desk; the avatar keeps the portrait
    ok(QJZ.pets.compose('hamster:h2', 'petonly', { state: 'dangle' }).indexOf('class="swing"') > 0, 'dangle swings');
    ok(QJZ.pets.compose('hamster:h2', 'petonly', { state: 'lunchSleep' }).indexOf('class="breath"') > 0, 'lunchSleep breathes');
    ok(QJZ.pets.compose('hamster:h2', 'avatar', { state: 'dangle' }).indexOf('class="swing"') < 0, 'avatar has no dangling body');
  });

  test('pets: two DIFFERENT skins in one document share no ids', function () {
    VIEWS.forEach(function (view) {
      var a = svgIds(QJZ.pets.compose('hamster:p0', view, { state: 'idle' }));
      var b = svgIds(QJZ.pets.compose('cat:s5', view, { state: 'idle' }));
      var host = document.createElement('div');
      host.innerHTML = QJZ.pets.compose('hamster:p0', view, { state: 'idle' }) + QJZ.pets.compose('cat:s5', view, { state: 'idle' });
      document.body.appendChild(host);
      try {
        a.forEach(function (x) { ok(b.indexOf(x) < 0, view + ': id shared by hamster:p0 and cat:s5: ' + x); });
        var seen = {}, dup = [];
        Array.prototype.forEach.call(host.querySelectorAll('[id]'), function (n) { if (seen[n.id]) dup.push(n.id); seen[n.id] = 1; });
        eq(dup, [], view + ': duplicate ids in the composed document');
      } finally { host.remove(); }
    });
  });

  // CPU (final review R-F5): an SVG filter around something that animates is computed again every frame. The crayon
  // grain and the room wobble sit on the still parts only (inside the moving groups), so they are drawn once.
  test('pets: crayon skins keep their filters off everything that animates, in every view and state', function () {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:300px;height:200px';
    document.body.appendChild(host);
    try {
      ['hamster:s5', 'cat:s5'].forEach(function (id) {
        VIEWS.forEach(function (view) {
          STATES.forEach(function (st) {
            host.innerHTML = QJZ.pets.compose(id, view, { state: st });
            var svg = host.firstElementChild, bad = [], moving = 0;
            Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
              if (getComputedStyle(el).animationName === 'none') return;
              moving++;
              var f = el.closest('[filter]');
              if (f && svg.contains(f)) bad.push((el.getAttribute('class') || el.tagName) + ' under ' + f.getAttribute('filter'));
            });
            ok(moving > 0, id + ' ' + view + ' ' + st + ': something moves');
            eq(bad, [], id + ' ' + view + ' ' + st);
            ok(svg.querySelectorAll('[filter*="-crayon"]').length > 0, id + ' ' + view + ' ' + st + ': still crayon');
          });
        });
      });
      // the still parts inside a moving group keep the grain: the paws and the body outline
      host.innerHTML = QJZ.pets.compose('hamster:s5', 'petonly', { state: 'typing' });
      ['.pawL ellipse', '.pawR ellipse', '.head path[fill="none"]'].forEach(function (sel) {
        var n = host.querySelector(sel);
        ok(n && n.closest('[filter*="-crayon"]'), sel + ' is drawn in crayon');
      });
      host.innerHTML = QJZ.pets.compose('cat:s5', 'scene', { state: 'typing' });
      ok(host.querySelector('.tail path').closest('[filter*="-crayon"]'), 'the cat tail is crayon');
      ok(host.querySelector('.cloud').closest('[filter]') === null, 'the room clouds move outside the wobble');
      ok(host.querySelector('[filter*="-wobble"]'), 'the still room still wobbles');
      // the other skins have no pet filters at all
      host.innerHTML = QJZ.pets.compose('hamster:p0', 'petonly', { state: 'typing' });
      eq(host.querySelectorAll('[filter]').length, 0);
    } finally { host.remove(); }
  });

  // 省電模式 (§5.9, Task 15): compose(..., {saver: true}) gives the crayon skins a still grain instead of the crayon
  // filter (two feTurbulence passes worked out per pixel whenever their part is drawn): every plain colour of the pet
  // is painted with a pattern of that colour flecked with paper. No filter and no mask is left on the pet (a mask
  // measured more costly than the filter); the room keeps its own wobble, on its still parts.
  test('pets: the saver crayon texture has no animated filter', function () {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:300px;height:200px';
    document.body.appendChild(host);
    function plain(svg) {
      return Array.prototype.filter.call(svg.querySelectorAll('.pa *,.tops *'), function (el) {
        return /^#/.test(el.getAttribute('fill') || '') || /^#/.test(el.getAttribute('stroke') || '');
      }).filter(function (el) { return !el.closest('pattern'); }).length;
    }
    try {
      ['hamster:s5', 'cat:s5'].forEach(function (id) {
        VIEWS.forEach(function (view) {
          STATES.concat(QJZ.pets.NEW_POSES).forEach(function (st) {
            var text = QJZ.pets.compose(id, view, { state: st, saver: true }), what = id + ' ' + view + ' ' + st;
            eq(text.indexOf('-crayon)'), -1, what + ': no crayon filter reference');
            eq(unresolved(text), [], what + ': references resolve');
            var ids = svgIds(text);
            eq(ids.filter(function (x, i) { return ids.indexOf(x) !== i; }), [], what + ': each pattern defined once');
            host.innerHTML = text;
            var svg = host.firstElementChild, bad = [];
            eq(svg.querySelectorAll('.pa [filter],.pa [mask],.tops [filter],.tops [mask]').length, 0, what + ': no filter or mask on the pet');
            ok(svg.querySelectorAll('.pa [fill*="-gr"]').length > 0, what + ': the grain is on');
            eq(plain(svg), 0, what + ': every colour of the pet has the grain');
            Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
              if (getComputedStyle(el).animationName === 'none') return;
              var m = el.closest('[mask],[filter]');
              if (m && svg.contains(m)) bad.push((el.getAttribute('class') || el.tagName) + ' under ' + (m.getAttribute('mask') || m.getAttribute('filter')));
            });
            eq(bad, [], what + ': nothing that moves is under a filter');
          });
        });
      });
      host.innerHTML = QJZ.pets.compose('hamster:s5', 'petonly', { state: 'typing', saver: true });
      ['.pawL ellipse', '.head path[fill="none"]'].forEach(function (sel) {
        var n = host.querySelector(sel), paint = n ? (n.getAttribute('fill') || '') + ' ' + (n.getAttribute('stroke') || '') : '';
        ok(/url\(#pet\d+-gr[0-9a-f]+\)/.test(paint), sel + ' has the grain: ' + paint);
      });
      var pats = host.querySelectorAll('pattern[id*="-gr"]');
      ok(pats.length >= 4, pats.length + ' colours');
      eq(host.querySelectorAll('pattern[id*="-gr"] :is(animate,animateTransform,set,[class],[style])').length, 0,
        'plain patterns: nothing in them moves or could be animated by pets.css');
      // without the option, or on another skin, nothing changes
      ok(QJZ.pets.compose('cat:s5', 'petonly', { state: 'typing' }).indexOf('-crayon)') > 0, 'the crayon filter without it');
      eq(/-gr[0-9a-f]/.test(QJZ.pets.compose('cat:s5', 'petonly', { state: 'typing' })), false);
      ['hamster:p0', 'cat:p4', 'cat:h2', 'hamster:s4'].forEach(function (id) {
        var a = QJZ.pets.compose(id, 'petonly', { state: 'typing' }).replace(/pet\d+/g, 'U');
        var b = QJZ.pets.compose(id, 'petonly', { state: 'typing', saver: true }).replace(/pet\d+/g, 'U');
        eq(b, a, id + ': the same drawing');
      });
    } finally { host.remove(); }
  });

  test('pets: filterStatic wraps still runs and descends into moving groups', function () {
    var f = QJZ.pets.common.filterStatic;
    eq(f('', 'url(#x)'), '');
    eq(f('<path d="M0,0"/><rect width="1" height="1"/>', 'url(#x)'), '<g filter="url(#x)"><path d="M0,0"/><rect width="1" height="1"/></g>');
    eq(f('<g class="head"><path d="M0,0"/><g class="blink"><circle r="1"/></g><path d="M1,1"/></g>', 'url(#x)'),
      '<g class="head"><g filter="url(#x)"><path d="M0,0"/></g><g class="blink"><g filter="url(#x)"><circle r="1"/></g></g><g filter="url(#x)"><path d="M1,1"/></g></g>');
    eq(f('<path class="tw" d="M0,0"/>', 'url(#x)'), '<path class="tw" d="M0,0"/>', 'a moving leaf stays as it is');
    eq(f('<!--c--><g transform="rotate(5)" style="transform-origin:1px 2px"><path d="M0,0"/></g>', 'url(#x)'),
      '<g filter="url(#x)"><!--c--><g transform="rotate(5)" style="transform-origin:1px 2px"><path d="M0,0"/></g></g>');
  });

  // ---------- waitBag: the packed backpack stands on the desk beside the pet ----------
  function norm(svg) { return svg.replace(/pet\d+/g, 'pet#'); }
  function within(el, cls) {
    for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (hasClass(p, cls)) return true;
    return false;
  }

  test('pets: waitBag shows the desk bag for all 10 skins x 3 views, with no unreplaced placeholders, and hamsters have no limbs', function () {
    var P = QJZ.pets;
    eq(P.setBagStyle, undefined, 'no style switch any more');
    eq(P.bagStyle, undefined);
    eq(P.BAG_STYLES, undefined);
    eq(all().length, 10, 'ten skins');
    all().forEach(function (d) {
      var b = d.build('pet0'), lift = b.rig.pack.lift;
      ok(lift >= 0 && lift <= 8, d.id + ' lift ' + lift);
      eq(Object.keys(b.rig.pack).sort(), ['desk', 'lift'], d.id + ' pack data: desk only');
      VIEWS.forEach(function (view) {
        var at = d.id + ' ' + view + ': ';
        var svg = P.compose(d.id, view, { state: 'waitBag' }), doc = parse(svg), root = doc.documentElement;
        eq(doc.getElementsByTagName('parsererror').length, 0, at + 'parses');
        ok(!/<!--[A-Z]+-->/.test(svg), at + 'no leftover slot');
        ok(!/undefined|NaN|\$\{/.test(svg), at + 'no unreplaced value');
        eq(unresolved(svg), [], at + 'refs');
        ok(hasClass(root, 'st-waitBag') && hasClass(root, 'bag-desk'), at + 'root classes');
        ok(inBody(doc.querySelector('.look')), at + 'eyes ride on the head');
        eq(norm(svg), norm(P.compose(d.id, view, { state: 'waitBag', expression: 'sparkle', mouth: 'smile' })), at + 'big shiny eyes, open smile');
        ok(svg.indexOf('class="note"') > 0 && svg.indexOf('class="spk"') > 0, at + 'notes and sparkles');
        if (d.kind === 'hamster') ok(svg.indexOf('class="limb"') < 0, at + 'no arm limbs');
        ok(svg.indexOf('class="pawL"') < 0 && svg.indexOf('class="pawR"') < 0, at + 'paws off the keys');
        ok(svg.indexOf('bagsw') < 0, at + 'the bag does not swing');
        var bags = doc.querySelectorAll('rect[fill="#4DA3FF"]');
        if (view === 'avatar') eq(bags.length, 0, at + 'no desk or arms in the portrait');
        else {
          eq(bags.length, 1, at + 'one bag');
          ok(!within(bags[0], 'bod'), at + 'the bag stands on the desk');
          ok(svg.indexOf('translate(0 -' + lift + ')') > 0 === lift > 0, at + 'sits up ' + lift);
          ok(doc.querySelector('.armL') && doc.querySelector('.armR'), at + 'waves and pats the bag');
          if (d.kind === 'cat') ok(within(doc.querySelector('.limb'), 'armL'), at + 'a cat waves with its arm');
        }
        if (view === 'avatar') ok(svg.indexOf('translate(0 -') < 0, at + 'the portrait does not sit up');
      });
    });
  });

  test('pets: the bag prop brings the desk bag in any state; others have none; compose ignores a bag option', function () {
    var P = QJZ.pets;
    ok(P.compose('hamster:p0', 'scene', { state: 'typing', props: ['bag'] }).indexOf('bag-desk') > 0, 'the bag prop brings the desk bag');
    ok(P.compose('hamster:p0', 'scene', { state: 'typing' }).indexOf('bag-') < 0, 'no bag class without the prop');
    eq(norm(P.compose('cat:p4', 'petonly', { state: 'waitBag', bag: 'hug' })), norm(P.compose('cat:p4', 'petonly', { state: 'waitBag' })), 'no style option');
  });

  test('pets: crayon skins keep their filters off everything that moves in the waitBag desk bag', function () {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:300px;height:200px';
    document.body.appendChild(host);
    try {
      ['hamster:s5', 'cat:s5'].forEach(function (id) {
        {
          VIEWS.forEach(function (view) {
            host.innerHTML = QJZ.pets.compose(id, view, { state: 'waitBag' });
            var svg = host.firstElementChild, bad = [];
            Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
              if (getComputedStyle(el).animationName === 'none') return;
              var f = el.closest('[filter]');
              if (f && svg.contains(f)) bad.push(el.getAttribute('class') || el.tagName);
            });
            eq(bad, [], id + ' ' + view);
          });
        }
      });
    } finally { host.remove(); }
  });

  test('pets: speechAt is the right edge of the head at eye height, following the poses and the backpack lift', function () {
    var P = QJZ.pets;
    eq(P.speechAt('dog:p0', 'typing'), null);
    all().forEach(function (d) {
      var b = d.build('s0'), rig = b.rig, s = rig.side[1], e = b.face.eyes[1];
      ok(s[0] > e[0] + b.face.eyeR && Math.abs(s[1] - e[1]) <= 8, d.id + ' side anchor beside the right eye');
      eq(P.speechAt(d.id, 'typing'), [s[0], s[1] + 4], d.id + ' typing');
      eq(P.speechAt(d.id, 'nope'), P.speechAt(d.id, 'typing'), d.id + ' unknown state');
      var ds = b.poses.dangle.anchors.side[1];
      eq(P.speechAt(d.id, 'dangle'), [ds[0], ds[1] + 4], d.id + ' dangle: the lifted head');
      eq(P.speechAt(d.id, 'lunchSleep'), [s[0], s[1] + b.poses.lie.anchors.top[1] - rig.top[1] + 4], d.id + ' lying lower');
      eq(P.speechAt(d.id, 'waitBag'), [s[0], s[1] - rig.pack.lift + 4], d.id + ' sitting up');
    });
  });

  test('pets: compose expression option fills eyes-open', function () {
    var svg = QJZ.pets.compose('cat:s5', 'avatar', { expression: 'happy' });
    var doc = parse(svg);
    eq(doc.querySelector('.eyes-open').getElementsByTagName('path').length, 2, 'happy arcs in eyes-open');
  });

  // ---------- the 1.1 poses (spec §5.8) ----------
  // A skin that declares no 1.1 pose: cat P4's def as 'test:stub', kind 'test' (so no list sees it). The fallback tests
  // run on it, so the real skins' art (Task 17) cannot break them (Ruling M10). layouts.test.js has the same helper.
  function stubSkin(poses) {
    var src = QJZ.pets.get('cat:p4'), d = {};
    for (var k in src) if (k !== 'poses11') d[k] = src[k];
    d.id = 'test:stub'; d.kind = 'test'; d.skin = 'stub';
    if (poses) d.poses11 = poses;
    QJZ.pets.register(d);
    return d.id;
  }
  // QJZ.pets.states with name drawn as another state's parts (as if Task 17 had added it), or gone (null).
  function withState(name, as, fn) {
    var S = QJZ.pets.states, get = S.get;
    S.get = function (n) { return n === name ? (as ? get(as) : null) : get(n); };
    try { fn(); } finally { S.get = get; }
  }

  test('pets: undeclared new poses fall back', function () {
    var P = QJZ.pets, id = stubSkin();
    eq(P.NEW_POSES, ['wave', 'holdCup', 'sip', 'focus']);
    eq(P.FALLBACK, { wave: 'celebrate', holdCup: 'coffee', sip: 'coffee', focus: 'typing' });
    eq(P.NEW_POSES.map(function (s) { return P.poseFor(id, s); }), ['celebrate', 'coffee', 'coffee', 'typing'], 'the stub');
    STATES.forEach(function (s) { eq(P.poseFor(id, s), s, s + ' is its own pose'); });
    eq([P.poseFor(id, 'nope'), P.poseFor(id, 'toString'), P.poseFor(id, undefined)], ['nope', 'toString', undefined], 'other names pass through');
    eq(P.poseFor('dog:p0', 'wave'), 'celebrate', 'an unknown skin declares nothing');
    var want = { wave: 'st-celebrate', holdCup: 'st-coffee', sip: 'st-coffee', focus: 'st-typing' };
    P.NEW_POSES.forEach(function (s) {
      VIEWS.forEach(function (view) {
        var root = parse(P.compose(id, view, { state: s })).documentElement;
        ok(hasClass(root, want[s]), s + ' ' + view + ': ' + root.getAttribute('class'));
      });
    });
    ok(hasClass(parse(P.compose(id, 'petonly', { state: 'wave' })).documentElement, 'st-celebrate'), 'petonly wave');
    // preview (the review page, Ruling R3): a pose shows before its skin declares it, but only one that exists
    withState('wave', null, function () {
      eq(P.poseFor(id, 'wave', true), 'celebrate', 'no wave state: still the stand-in');
      ok(hasClass(parse(P.compose(id, 'petonly', { state: 'wave', preview: true })).documentElement, 'st-celebrate'), 'compose too');
    });
    withState('wave', 'celebrate', function () {
      eq(P.poseFor(id, 'wave', true), 'wave', 'preview shows a drawn pose');
      eq([P.poseFor(id, 'wave'), P.poseFor(id, 'wave', 1)], ['celebrate', 'celebrate'], 'only with preview === true');
      stubSkin(['wave']);
      eq(P.poseFor(id, 'wave'), 'wave', 'a declared, drawn pose is itself');
      eq(P.poseFor(id, 'sip'), 'coffee', 'the others still fall back');
    });
    stubSkin(['wave']);
    withState('wave', null, function () { eq(P.poseFor(id, 'wave'), 'celebrate', 'declared but not drawn'); });
    stubSkin();
  });

  test('pets: missingPoses lists every hamster and cat skin without poses11', function () {
    var P = QJZ.pets;
    stubSkin();
    eq(P.missingPoses(), [], 'every skin declares the four 1.1 poses (Task 17, approved), and the stub is not listed');
    var d = P.get('cat:p4'), had = d.poses11;
    try {
      d.poses11 = ['wave', 'sip'];
      var part = P.missingPoses();
      eq(part, ['cat:p4 holdCup', 'cat:p4 focus'], 'only what cat:p4 no longer declares');
    } finally { if (had === undefined) delete d.poses11; else d.poses11 = had; }
  });

  // ---------- Task 17: the 1.1 poses drawn for all 10 skins, and declared (poses11) after the user's OK ----------
  test('pets: the 1.1 poses are states by name, outside the 1.0 review order', function () {
    var P = QJZ.pets;
    eq(P.states.NAMES, STATES, 'NAMES stays the 18 1.0 states');
    P.NEW_POSES.forEach(function (s) {
      var st = P.states.get(s);
      ok(st && st.label && st.group === '1.1', s + ' is a state');
      ok(EXPRESSIONS.indexOf(st.eyes) >= 0 && MOUTHS.indexOf(st.mouth) >= 0, s + ' face');
      st.props.forEach(function (p) { ok(P.props.NAMES.indexOf(p) >= 0, s + ' prop ' + p); });
    });
  });

  test('pets: every skin composes the new poses', function () {
    var P = QJZ.pets;
    eq(all().length, 10, 'ten skins');
    all().forEach(function (d) {
      var id = d.id;
      P.NEW_POSES.forEach(function (s) {
        VIEWS.forEach(function (view) {
          var at = id + ' ' + s + ' ' + view + ': ', svg = P.compose(id, view, { state: s, preview: true }), doc = parse(svg), root = doc.documentElement;
          eq(doc.getElementsByTagName('parsererror').length, 0, at + 'parses');
          ok(!/<!--[A-Z]+-->/.test(svg) && !/undefined|NaN|\$\{|\[object/.test(svg), at + 'no leftover slot or value');
          ok(hasClass(root, 'st-' + s) && hasClass(root, 'kind-' + d.kind), at + 'root classes');
          eq(unresolved(svg), [], at + 'refs');
          var ids = svgIds(svg);
          eq(ids.length, ids.filter(function (x, i, a) { return a.indexOf(x) === i; }).length, at + 'duplicate id');
          ok(inBody(doc.querySelector('.look')), at + 'eyes ride on the head');
          if (d.kind === 'hamster') ok(svg.indexOf('class="limb"') < 0, at + 'no arm limbs');
          eq(P.poseFor(id, s), s, at + 'declared');
          ok(hasClass(parse(P.compose(id, view, { state: s })).documentElement, 'st-' + s), at + 'itself without preview too');
        });
        var po = parse(P.compose(id, 'petonly', { state: s, preview: true }));
        if (s === 'wave' || s === 'holdCup') {
          ok(po.querySelector('.armL') && po.querySelector('.knock .knk') && po.querySelector('.knock .bang'), id + ' ' + s + ': waves, with knock marks and a !');
          ok(within(po.querySelector('.armL'), 'bod'), id + ' ' + s + ': the waving paw moves with the body');
          if (d.kind === 'cat') ok(po.querySelector('.armL .limb'), id + ' ' + s + ': a cat waves with its arm');
        }
        if (s === 'holdCup' || s === 'sip') {
          ok(po.querySelector('.held .lvl'), id + ' ' + s + ': the glass is held');
          ok(po.querySelector('.held .pawL') === null, id + ' ' + s + ': holding paws, not the typing ones');
        }
        if (s === 'holdCup') ok(po.querySelector('.held .pose-a') && po.querySelector('.held .pose-b') && po.querySelector('.pose-a .armL'), id + ' holdCup: one paw on the glass while waving, then both');
        if (s === 'focus') {
          eq(po.querySelectorAll('.pa rect[fill="#FF6B57"]').length, 2, id + ' focus: two headphone cups');
          ok(inBody(po.querySelector('.pa rect[fill="#FF6B57"]')), id + ' focus: the headphones ride on the head');
          ok(po.querySelector('.pawL') && po.querySelector('.pawR'), id + ' focus: typing');
        }
      });
    });
  });

  // the root of a cat's waving arm lies inside its own body (the fur drawn over it hides the seam), the avatar never
  // shows an arm's outline without its fur, and every sip straw ends in the middle of the tiny o mouth
  test('pets: cats wave with arms grown out of the body; every sip straw is in the mouth', function () {
    var P = QJZ.pets, host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:176px;height:170px';
    document.body.appendChild(host);
    function bodyAt(svg, x, y) {
      var pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      return Array.prototype.some.call(svg.querySelectorAll('.pa path,.pa circle,.pa ellipse'), function (el) {
        var f = el.getAttribute('fill');
        return f && f !== 'none' && !el.closest('.armL,.prop,.held,.knock,clipPath,defs') && el.isPointInFill(pt);
      });
    }
    try {
      P.list('cat').forEach(function (d) {
        var rig = d.build('w0').rig, root = rig.hello.arm[0];
        ['wave', 'holdCup'].forEach(function (s) {
          host.innerHTML = P.compose(d.id, 'petonly', { state: s, preview: true });
          ok(bodyAt(host.firstElementChild, root[0], root[1]), d.id + ' ' + s + ': the arm root ' + root + ' is inside the body');
          host.innerHTML = P.compose(d.id, 'avatar', { state: s, preview: true });
          var inks = host.querySelectorAll('.armL .limb[fill="' + rig.line[0] + '"]'), furs = host.querySelectorAll('.armL .limb:not([fill="' + rig.line[0] + '"])');
          ok(inks.length === 0 || furs.length > 0, d.id + ' ' + s + ' avatar: no arm outline without its fur');
        });
      });
      all().forEach(function (d) {
        host.innerHTML = P.compose(d.id, 'petonly', { state: 'sip', preview: true });
        var mouth = host.querySelector('.mouth-a path:not([fill="none"])'), straw = host.querySelector('.held path[stroke="#FF8A3D"]');
        // the glass's own placement (translate, scale): the nearest transform attribute, not the animation's
        var m = mouth.getBBox(), sb = straw.getBBox(), g = straw.parentNode.closest('[transform]').transform.baseVal.consolidate().matrix;
        var top = g.d * sb.y + g.f, x = g.a * (sb.x + sb.width / 2) + g.e, my = m.y + m.height / 2, mx = m.x + m.width / 2;
        ok(Math.abs(top - my) < 1.5 && Math.abs(x - mx) < 1.5, d.id + ': straw top ' + [x, top].map(Math.round) + ' at the mouth ' + [mx, my].map(Math.round));
      });
    } finally { host.remove(); }
  });

  test('pets: the crayon skins draw the new poses with no filter above a moving part, and with the saver grain', function () {
    var P = QJZ.pets, host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-2000px;top:0;width:300px;height:200px';
    document.body.appendChild(host);
    function movingUnder(svg, sel) {
      var bad = [];
      Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
        if (getComputedStyle(el).animationName === 'none') return;
        var f = el.closest(sel);
        if (f && svg.contains(f)) bad.push(el.getAttribute('class') || el.tagName);
      });
      return bad;
    }
    try {
      ['hamster:s5', 'cat:s5'].forEach(function (id) {
        P.NEW_POSES.forEach(function (s) {
          VIEWS.forEach(function (view) {
            var at = id + ' ' + s + ' ' + view + ': ';
            host.innerHTML = P.compose(id, view, { state: s, preview: true });
            eq(movingUnder(host.firstElementChild, '[filter]'), [], at + 'crayon off what moves');
            ok(host.querySelectorAll('[filter*="-crayon"]').length > 0, at + 'still crayon');
            var text = P.compose(id, view, { state: s, preview: true, saver: true }), ids = svgIds(text);
            eq(text.indexOf('-crayon)'), -1, at + 'saver: no crayon filter');
            eq(unresolved(text), [], at + 'saver: refs resolve');
            eq(ids.filter(function (x, i) { return ids.indexOf(x) !== i; }), [], at + 'saver: each pattern once');
            host.innerHTML = text;
            ok(hasClass(host.firstElementChild, 'st-' + s), at + 'saver: the pose');
            eq(host.querySelectorAll('.pa [filter],.tops [filter]').length, 0, at + 'saver: no filter on the pet');
          });
        });
      });
    } finally { host.remove(); }
  });
  // The portrait (avatar) has no front layer, so an arm whose fur is drawn there must not leave its outline behind:
  // every arm outline in an avatar has its fur over it (the same limb path in the fur colour). Cat S5's 1.0 arms (up,
  // scratch, the waitBag wave) used to show as dark arms in its portrait.
  test('pets: no cat avatar shows an arm outline without its fur, in any state', function () {
    var P = QJZ.pets;
    P.list('cat').forEach(function (d) {
      var ink = d.build('a0').rig.line[0];
      function paint(el) { var f = el.getAttribute('fill'); return (f && f !== 'none' ? f : el.getAttribute('stroke')) || ''; }
      STATES.concat(P.NEW_POSES).forEach(function (s) {
        [{ state: s }, { state: s, props: ['bag'] }].forEach(function (o) {
          var limbs = parse(P.compose(d.id, 'avatar', o)).querySelectorAll('.limb');
          var bare = Array.prototype.filter.call(limbs, function (el) {
            return paint(el) === ink && !Array.prototype.some.call(limbs, function (f) { return f !== el && f.getAttribute('d') === el.getAttribute('d') && paint(f) !== ink; });
          });
          eq(bare.length, 0, d.id + ' ' + s + (o.props ? ' + bag' : '') + ': arm outlines without fur in the avatar');
        });
      });
    });
  });
})();
