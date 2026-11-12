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

  // ---------- the cats of hamster H2 and S4: 鼓鼓頰貓 and 扁平幾何貓 ----------
  var NEW_CATS = [['cat:h2', 'hamster:h2', '鼓鼓頰貓'], ['cat:s4', 'hamster:s4', '扁平幾何貓']];

  test('pets: cat H2 鼓鼓頰貓 and cat S4 扁平幾何貓 share their hamster\'s look and keep seamless cat arms', function () {
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
    // H2: two puffing cheeks like the hamster, a little dried fish on the head instead of the seed
    var h2 = QJZ.pets.compose('cat:h2', 'petonly', { state: 'idle' });
    eq(h2.split('class="puff"').length - 1, 2, 'cat H2 has two puffy cheeks');
    ok(h2.indexOf('#C9D4DE') > 0 && h2.indexOf('#33302E') < 0, 'cat H2 carries a fish, not a sunflower seed');
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
})();
