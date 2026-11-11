// Pets: slot-based renderer (Task 9). Every skin in every view must give a well-formed SVG with its
// eye/mouth slots filled, typing paws, the happy-eyes layer, and ids that never collide between SVGs.
(function () {
  var VIEWS = ['scene', 'petonly', 'avatar'];

  function all() { return QJZ.pets.list('hamster').concat(QJZ.pets.list('cat')); }
  function idsOf(defs) { return defs.map(function (d) { return d.id; }); }
  function parse(svg) { return new DOMParser().parseFromString(svg, 'image/svg+xml'); }
  function svgIds(svg) {
    var out = [], re = /\sid="([^"]+)"/g, m;
    while ((m = re.exec(svg))) out.push(m[1]);
    return out;
  }
  function hasClass(el, name) { return (' ' + (el.getAttribute('class') || '') + ' ').indexOf(' ' + name + ' ') >= 0; }

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
      var body = (b.layers.pre || '') + (b.layers.post || '');
      eq(body.split('<!--EYES-->').length, 2, d.id + ' one EYES slot');
      eq(body.split('<!--MOUTH-->').length, 2, d.id + ' one MOUTH slot');
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
    ok(QJZ.pets.compose('hamster:p0', 'petonly', {}).indexOf('viewBox="38 18 160 154"') > 0, 'petonly');
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
    // expressions/mouths that later tasks add fall back to the skin's own look for now
    eq(QJZ.pets.expr.eyes(face, 'nope', 'u9'), open);
    eq(QJZ.pets.expr.mouth(face, 'nope'), mouth);
  });

  test('pets: compose expression option fills eyes-open', function () {
    var svg = QJZ.pets.compose('cat:s5', 'avatar', { expression: 'happy' });
    var doc = parse(svg);
    eq(doc.querySelector('.eyes-open').getElementsByTagName('path').length, 2, 'happy arcs in eyes-open');
  });
})();
