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

  test('pets: list gives 5 hamsters and 3 cats in skin order', function () {
    eq(QJZ.pets.list('hamster').length, 5);
    eq(QJZ.pets.list('cat').length, 3);
    eq(idsOf(QJZ.pets.list('hamster')), ['hamster:p0', 'hamster:p4', 'hamster:h2', 'hamster:s4', 'hamster:s5']);
    eq(idsOf(QJZ.pets.list('cat')), ['cat:p0', 'cat:p4', 'cat:s5']);
    eq(QJZ.pets.list('dog'), []);
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

  test('pets: compose expression option fills eyes-open', function () {
    var svg = QJZ.pets.compose('cat:s5', 'avatar', { expression: 'happy' });
    var doc = parse(svg);
    eq(doc.querySelector('.eyes-open').getElementsByTagName('path').length, 2, 'happy arcs in eyes-open');
  });
})();
