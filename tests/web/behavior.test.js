// QJZ.behavior (base state, idle picks, the poker, the Brain that decides what the pet shows from the wall clock)
// and QJZ.lines (what the pet says). All pure: the rng is seeded, times are plain numbers.
(function () {
  var B = QJZ.behavior, L = QJZ.lines;
  var WORK_IDLES = ['stretch', 'yawn', 'coffee', 'stare', 'scratch'];
  var BASE = ['idle', 'typing', 'sprint', 'lunchSleep', 'celebrate', 'waitBag'];
  var T0 = new Date(2026, 10, 12, 10, 0, 0, 0).getTime();
  function working(min) { return { status: 'working', minutesToEnd: min === undefined ? 300 : min }; }

  // ---------- base ----------
  test('behavior: base state per status', function () {
    eq(B.base('working', 31), 'typing');
    eq(B.base('working', 30), 'sprint');
    eq(B.base('working', 0.5), 'sprint');
    eq(B.base('lunch', 0), 'lunchSleep');
    eq(B.base('before', 480), 'idle');
    eq(B.base('done', 0), 'celebrate');
    eq(B.base('ended', 0), 'celebrate');
    eq(B.base('done', 0, 7.9), 'celebrate', 'celebrate for 8 s');
    eq(B.base('done', 0, 8), 'waitBag', 'then waitBag');
    eq(B.base('ended', 0, 600), 'waitBag');
    eq(B.base('bogus', 10), 'idle');
  });

  // ---------- poker ----------
  test('behavior: poker — four pokes pet, the fifth within 2 s angers it for 4 s', function () {
    var p = new B.Poker();
    eq([p.poke(T0), p.poke(T0 + 300), p.poke(T0 + 600), p.poke(T0 + 900)], ['petted', 'petted', 'petted', 'petted']);
    ok(!p.angry(T0 + 900));
    eq(p.poke(T0 + 1200), 'angry');
    ok(p.angry(T0 + 1200 + 3900), 'still angry before 4 s');
    eq(p.poke(T0 + 1200 + 2000), 'angry', 'pokes while angry stay angry');
    ok(!p.angry(T0 + 1200 + 4000), 'calm after 4 s');
    eq(p.poke(T0 + 1200 + 5000), 'petted', 'a poke after 5 s is petting again');
  });

  test('behavior: poker — slow pokes never anger', function () {
    var p = new B.Poker(), got = [];
    for (var i = 0; i < 12; i++) got.push(p.poke(T0 + i * 600));
    ok(got.every(function (s) { return s === 'petted'; }), got.join());
  });

  // ---------- pickIdle ----------
  test('behavior: pickIdle with a seeded rng picks only the five working idles, all of them', function () {
    var rng = B.rng(42), seen = {};
    for (var i = 0; i < 500; i++) {
      var s = B.pickIdle({ energy: 80, mood: 60 }, rng);
      ok(WORK_IDLES.indexOf(s) >= 0, 'allowed: ' + s);
      seen[s] = true;
    }
    eq(Object.keys(seen).sort(), WORK_IDLES.slice().sort());
    eq(B.pickIdle({ energy: 80, mood: 60 }, B.rng(1), 'working') !== null, true);
  });

  test('behavior: pickIdle yawns three times as often when energy < 40', function () {
    function share(energy) {
      var rng = B.rng(9), n = 0;
      for (var i = 0; i < 4000; i++) if (B.pickIdle({ energy: energy, mood: 50 }, rng) === 'yawn') n++;
      return n / 4000;
    }
    var tired = share(30), fresh = share(80);
    ok(tired > 0.37 && tired < 0.49, 'tired ' + tired + ' (3/7)');
    ok(fresh > 0.16 && fresh < 0.24, 'fresh ' + fresh + ' (1/5)');
  });

  test('behavior: RULING-3 — before work pickIdle sometimes dozes, never a working idle', function () {
    var rng = B.rng(5), doze = 0, none = 0;
    for (var i = 0; i < 400; i++) {
      var s = B.pickIdle({ energy: 100, mood: 70 }, rng, 'before');
      if (s === 'doze') doze++;
      else if (s === null) none++;
      else ok(false, 'before work: ' + s);
    }
    ok(doze > 40 && none > 40, 'doze ' + doze + ' / none ' + none);
    ['lunch', 'done', 'ended'].forEach(function (st) {
      eq(B.pickIdle({ energy: 30, mood: 50 }, B.rng(3), st), null, st);
    });
  });

  test('behavior: rng is seeded and stays in [0, 1)', function () {
    var a = B.rng(77), b = B.rng(77), xs = [];
    for (var i = 0; i < 200; i++) { var x = a(); eq(x, b()); ok(x >= 0 && x < 1); xs.push(x); }
    ok(xs[0] !== xs[1]);
  });

  // ---------- Brain ----------
  // Runs the brain from t0 for sec seconds in steps of stepMs; returns the runs [{state, from, to}].
  function runs(brain, info, sec, stepMs, t0) {
    var out = [], t = t0 || T0, end = t + sec * 1000, cur = null;
    for (; t <= end; t += stepMs || 250) {
      var s = brain.update(t, typeof info === 'function' ? info(t) : info);
      if (!cur || cur.state !== s) { cur = { state: s, from: t, to: t }; out.push(cur); }
      else cur.to = t;
    }
    return out;
  }

  test('behavior: brain — idle actions every 20–60 s for 3–5 s while typing', function () {
    var r = runs(new B.Brain(B.rng(7)), working(), 900);
    var acts = r.filter(function (x) { return x.state !== 'typing'; });
    ok(acts.length >= 12 && acts.length <= 40, acts.length + ' idle actions in 15 min');
    acts.forEach(function (a) {
      ok(WORK_IDLES.indexOf(a.state) >= 0, a.state);
      var len = a.to - a.from + 250;
      ok(len >= 3000 && len <= 5250, a.state + ' lasted ' + len);
    });
    for (var i = 1; i < r.length - 1; i++) {
      if (r[i].state !== 'typing') continue;
      var gap = r[i].to - r[i].from + 250;
      ok(gap >= 20000 && gap <= 60250, 'typing for ' + gap + ' between idle actions');
    }
  });

  test('behavior: brain — no idle actions while sprinting, at lunch or after work', function () {
    eq(runs(new B.Brain(B.rng(7)), working(20), 300).map(function (x) { return x.state; }), ['sprint']);
    eq(runs(new B.Brain(B.rng(7)), { status: 'lunch', minutesToEnd: 300, lunchMin: 20 }, 300).map(function (x) { return x.state; }), ['lunchSleep']);
    eq(runs(new B.Brain(B.rng(7)), { status: 'done', minutesToEnd: 0 }, 300).map(function (x) { return x.state; }), ['celebrate', 'waitBag']);
  });

  test('behavior: brain — celebrate for 8 s from when 可以下班 is first seen, then waitBag', function () {
    var b = new B.Brain(B.rng(1));
    eq(b.update(T0, working(1)), 'sprint');
    eq(b.update(T0 + 1000, { status: 'done', minutesToEnd: 0 }), 'celebrate');
    eq(b.update(T0 + 8900, { status: 'done', minutesToEnd: 0 }), 'celebrate');
    eq(b.update(T0 + 9000, { status: 'done', minutesToEnd: 0 }), 'waitBag');
    eq(b.update(T0 + 9100, { status: 'ended', minutesToEnd: 0 }), 'celebrate', '下班 after 可以下班 celebrates again');
  });

  test('behavior: brain — RULING-3 lunch: lunchEat for the first 10 minutes, then lunchSleep', function () {
    var b = new B.Brain(B.rng(1));
    eq(b.update(T0, { status: 'lunch', minutesToEnd: 240, lunchMin: 0 }), 'lunchEat');
    eq(b.update(T0 + 1000, { status: 'lunch', minutesToEnd: 240, lunchMin: 9.9 }), 'lunchEat');
    eq(b.update(T0 + 2000, { status: 'lunch', minutesToEnd: 240, lunchMin: 10 }), 'lunchSleep');
    eq(b.update(T0 + 3000, { status: 'lunch', minutesToEnd: 240 }), 'lunchSleep', 'no lunch clock: sleep');
  });

  test('behavior: brain — before work it mostly idles and dozes now and then', function () {
    var r = runs(new B.Brain(B.rng(11)), { status: 'before', minutesToEnd: 480 }, 1800, 500);
    var states = {};
    r.forEach(function (x) { states[x.state] = true; });
    eq(Object.keys(states).sort(), ['doze', 'idle']);
    r.filter(function (x) { return x.state === 'doze'; }).forEach(function (d) {
      var len = d.to - d.from + 500;
      ok(len >= 8000 && len <= 15500, 'doze lasted ' + len);
    });
  });

  test('behavior: brain — overlays: petted, angry, eat (delayed), hop; dangle wins while dragging', function () {
    var b = new B.Brain(B.rng(2)), w = working();
    eq(b.update(T0, w), 'typing');
    eq(b.poke(T0 + 100), 'petted');
    ok(!b.angered);
    eq(b.update(T0 + 200, w), 'petted');
    eq(b.update(T0 + 2200, w), 'typing', 'petting lasts 2 s');
    for (var i = 0; i < 4; i++) b.poke(T0 + 3000 + i * 100);
    eq(b.poke(T0 + 3400), 'angry');
    ok(b.angered, 'just turned angry');
    eq(b.update(T0 + 3500, w), 'angry');
    eq(b.poke(T0 + 3600), 'angry');
    ok(!b.angered, 'already angry');
    eq(b.update(T0 + 7300, w), 'angry');
    eq(b.update(T0 + 7400, w), 'typing', 'angry for 4 s');
    b.show('eat', T0 + 8000, 3000, 800);
    eq(b.update(T0 + 8500, w), 'typing', 'the snack is still flying');
    eq(b.update(T0 + 8800, w), 'eat');
    eq(b.update(T0 + 11700, w), 'eat');
    eq(b.update(T0 + 11800, w), 'typing');
    b.show('hop', T0 + 12000, 2400);
    eq(b.update(T0 + 12000, w), 'hop');
    b.drag(true);
    eq(b.update(T0 + 12100, w), 'dangle');
    b.poke(T0 + 12200);
    eq(b.update(T0 + 12300, w), 'dangle', 'dangle beats everything');
    b.drag(false);
    eq(b.update(T0 + 12400, w), 'hop', 'the poke did not take the hop slot');
    eq(b.update(T0 + 30000, w), 'typing');
  });

  test('behavior: brain — a poke during the snack flight, eat or hop does not drop that pose', function () {
    var b = new B.Brain(B.rng(2)), w = working();
    b.update(T0, w);
    b.show('eat', T0 + 100, 3000, 800);
    eq(b.poke(T0 + 300), 'petted', 'the poke itself still counts');
    eq(b.update(T0 + 400, w), 'typing', 'still flying: no petted pose either');
    eq(b.update(T0 + 1000, w), 'eat', 'the eat pose plays');
    b.poke(T0 + 1500);
    eq(b.update(T0 + 1600, w), 'eat', 'a poke while eating is ignored');
    eq(b.update(T0 + 3800, w), 'eat');
    eq(b.update(T0 + 3900, w), 'typing');
    b.show('hop', T0 + 10000, 2400);
    b.poke(T0 + 10100);
    eq(b.update(T0 + 10200, w), 'hop');
    eq(b.update(T0 + 12400, w), 'typing');
    // an angry streak pauses the pose, it does not eat it
    b.show('eat', T0 + 20000, 3000, 800);
    for (var i = 0; i < 5; i++) b.poke(T0 + 20100 + i * 50);
    eq(b.update(T0 + 20400, w), 'angry');
    eq(b.update(T0 + 21000, w), 'angry');
    eq(b.update(T0 + 24500, w), 'typing', 'angry is over; the eat window has passed');
    b.poke(T0 + 30000);
    eq(b.update(T0 + 30100, w), 'petted', 'with nothing playing a poke pets as before');
  });

  test('behavior: brain — change reports base transitions; a gap or the first look is quiet', function () {
    var b = new B.Brain(B.rng(3));
    b.update(T0, working());
    eq(b.change, { from: null, to: 'typing', quiet: true }, 'first look');
    b.update(T0 + 1000, working());
    eq(b.change, null);
    b.update(T0 + 2000, working(30));
    eq(b.change, { from: 'typing', to: 'sprint', quiet: false });
    var t = T0 + 3600000, done = { status: 'done', minutesToEnd: 0 };
    b.update(t, done);
    eq(b.change, { from: 'sprint', to: 'celebrate', quiet: true }, 'after an hour hidden');
    var seen = null;
    for (var s = 1; s <= 8; s++) { b.update(t + s * 1000, done); if (b.change) seen = b.change; }
    eq(seen, { from: 'celebrate', to: 'waitBag', quiet: false });
    eq(b.base, 'waitBag');
  });

  test('behavior: brain — after a gap the idle schedule restarts instead of firing at once', function () {
    var b = new B.Brain(B.rng(4)), t = T0 + 3600000;
    b.update(T0, working());
    eq(b.update(t, working()), 'typing');
    for (var s = 1; s < 20; s++) eq(b.update(t + s * 1000, working()), 'typing', 'not before 20 s (' + s + ')');
  });

  // ---------- lines ----------
  var RICH = { name: '金金', kind: 'hamster', minutesToLunch: 15, minutesToEnd: 12, earned: 1234.5, step: 100, gained: 2,
    hour: 10, energy: 30, mood: 30, items: QJZ.settings.DEFAULTS.items };
  function ctxs() {
    var out = [{}, { kind: 'cat' }, { kind: 'hamster', off: true }, { kind: 'cat', minutesToEnd: 200, earned: 30, hour: 15 },
      { kind: 'cat', minutesToLunch: 1, minutesToEnd: 1, earned: 65, hour: 18, energy: 90, mood: 95 },
      { kind: 'hamster', minutesToLunch: 60.5, minutesToEnd: 30.2, earned: 0.4, hour: 8, items: [] }, RICH];
    var cat = {}; for (var x in RICH) cat[x] = RICH[x];
    cat.kind = 'cat'; cat.name = '小橘';
    out.push(cat);
    return out;
  }

  test('lines: every base state has at least 5 lines for each kind', function () {
    BASE.forEach(function (s) {
      ['cat', 'hamster'].forEach(function (k) {
        ok(L.templates(s, k).length >= 5, s + ' ' + k + ': ' + L.templates(s, k).length);
      });
    });
    eq(BASE.filter(function (s) { return L.STATES.indexOf(s) < 0; }), []);
  });

  test('lines: pick never leaves a { placeholder, for every state, kind and context', function () {
    var rng = B.rng(21);
    L.STATES.forEach(function (s) {
      ctxs().forEach(function (c, ci) {
        for (var i = 0; i < 40; i++) {
          var o = {}; for (var k in c) o[k] = c[k];
          o.rng = rng;
          var line = L.pick(s, o);
          ok(typeof line === 'string' && line.length > 0, s + ' ctx ' + ci + ': empty');
          ok(!/[{}]/.test(line), s + ' ctx ' + ci + ': ' + line);
        }
      });
    });
  });

  test('lines: every template fills completely with a rich context (coverage)', function () {
    var n = 0;
    L.STATES.forEach(function (s) {
      ['cat', 'hamster'].forEach(function (k) {
        L.templates(s, k).forEach(function (t) {
          var c = {}; for (var x in RICH) c[x] = RICH[x];
          c.kind = k; c.rng = B.rng(n);
          var out = L.fill(t, c);
          ok(out && !/[{}\[\]]/.test(out), s + ' ' + k + ': ' + t + ' -> ' + out);
          n++;
        });
      });
    });
    ok(n > 150, n + ' templates');
  });

  test('lines: cats often end with 喵, hamsters with 吱, never the other one', function () {
    var rng = B.rng(8), cat = 0, ham = 0, N = 300;
    for (var i = 0; i < N; i++) {
      var c = L.pick('typing', { kind: 'cat', rng: rng }), h = L.pick('typing', { kind: 'hamster', rng: rng });
      if (c.indexOf('喵') >= 0) cat++;
      if (h.indexOf('吱') >= 0) ham++;
      ok(c.indexOf('吱') < 0, c);
      ok(h.indexOf('喵') < 0, h);
    }
    ok(cat > N * 0.5, 'cat ' + cat);
    ok(ham > N * 0.5, 'hamster ' + ham);
  });

  test('lines: time-aware and money lines show when they apply, and only then', function () {
    function some(state, ctx, re) {
      var rng = B.rng(31), hit = 0;
      for (var i = 0; i < 400; i++) { ctx.rng = rng; if (re.test(L.pick(state, ctx))) hit++; }
      return hit;
    }
    ok(some('typing', { kind: 'cat', minutesToLunch: 15 }, /^再 15 分鐘就午休了！$/) > 0, 'lunch countdown');
    eq(some('typing', { kind: 'cat', minutesToLunch: 200 }, /午休/), 0, 'not hours ahead');
    ok(some('sprint', { kind: 'cat', minutesToEnd: 12 }, /^再 12 分鐘就下班了！$/) > 0, 'end countdown');
    ok(some('typing', { kind: 'hamster', earned: 300 }, /^已經賺到.*(珍奶|便當|拿鐵)了！$/) > 0, 'money in items');
    ok(some('typing', { kind: 'hamster', earned: 130 }, /已經賺到兩杯珍奶了！/) > 0, 'two cups');
    eq(some('typing', { kind: 'hamster', earned: 20 }, /已經賺到|NT\$/), 0, 'nothing to brag about yet');
    ok(some('typing', { kind: 'hamster', minutesToEnd: 125 }, /2 小時 5 分/) > 0, 'time left');
    ok(some('idle', { kind: 'cat', off: true }, /休假|放鬆|耍廢/) > 0, 'day off');
    eq(some('idle', { kind: 'cat', off: true }, /上班|開工/), 0, 'no work talk on a day off');
    ok(some('hop', { kind: 'cat', step: 100 }, /NT\$ 100/) > 0, 'milestone amount');
    ok(some('missed', { kind: 'cat', gained: 2, step: 100 }, /NT\$ 200/) > 0, 'missed while hidden: the money');
    ok(some('missed', { kind: 'cat', gained: 2, step: 100 }, /小魚乾又多了兩份喵/) > 0, 'missed while hidden: the snacks');
  });

  test('lines: waitBag says 可以走了！ and names fill in literally', function () {
    var rng = B.rng(13), seen = false;
    for (var i = 0; i < 200; i++) if (L.pick('waitBag', { kind: 'hamster', rng: rng }).indexOf('可以走了！') >= 0) seen = true;
    ok(seen, '可以走了！');
    var withName = 0;
    for (var j = 0; j < 300; j++) {
      var s = L.pick('typing', { kind: 'cat', name: '{x}', rng: rng });
      if (s.indexOf('{x}') >= 0) withName++;
      ok(!/\{(?!x\})/.test(s), s);
    }
    ok(withName > 0, 'the name is used');
    var dflt = 0;
    for (var k = 0; k < 300; k++) if (L.pick('typing', { kind: 'cat', rng: rng }).indexOf('小橘') >= 0) dflt++;
    ok(dflt > 0, 'default cat name 小橘');
    eq(L.pick('nope', {}), '', 'unknown state');
  });
})();
