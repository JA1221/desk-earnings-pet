// QJZ.mood: 心情 / 體力. Pure: tick per status, interactions, hearts / bolts, and advance() that follows the
// working day in order (work, lunch, work) so a window that was hidden for hours catches up from the wall clock.
// 2026-11-12 is a Thursday.
(function () {
  var M = QJZ.mood;
  function at(h, m) { return new Date(2026, 10, 12, h, m || 0, 0, 0).getTime(); }
  function run(m, seconds, status, step) {
    step = step || 10;
    for (var t = 0; t < seconds; t += step) m = M.tick(m, step, status);
    return m;
  }
  var DAY = { day: '2026-11-12', startMs: at(9, 0), endMs: null, hoursPerDay: 8, lunch: { start: '12:00', end: '13:00' } };
  function day(extra) {
    var d = {};
    for (var k in DAY) d[k] = DAY[k];
    for (var x in (extra || {})) d[x] = extra[x];
    return d;
  }

  test('mood: initial is full energy and a good mood', function () {
    eq(M.initial(), { energy: 100, mood: 70 });
    ok(M.initial() !== M.initial(), 'a fresh object each time');
  });

  test('mood: 8 h of working ticks drain energy 100 -> 40', function () {
    var m = run(M.initial(), 8 * 3600, 'working');
    near(m.energy, 40, 0.5);
    near(run(M.initial(), 8 * 3600, 'working', 1).energy, 40, 0.5, '1 s steps');
  });

  test('mood: 1 h of lunch restores energy 40 -> 70', function () {
    near(run({ energy: 40, mood: 50 }, 3600, 'lunch').energy, 70, 0.5);
  });

  test('mood: mood drifts toward 50 by 10 an hour from either side and stops there', function () {
    near(run({ energy: 100, mood: 70 }, 3600, 'working').mood, 60, 0.01);
    eq(run({ energy: 100, mood: 70 }, 3 * 3600, 'before').mood, 50, 'never past 50');
    near(run({ energy: 100, mood: 20 }, 3600, 'lunch').mood, 30, 0.01);
    eq(run({ energy: 100, mood: 50 }, 3600, 'done').mood, 50);
  });

  test('mood: energy only moves while working or at lunch', function () {
    ['before', 'done', 'ended', 'off', 'bogus'].forEach(function (s) {
      eq(run({ energy: 55, mood: 50 }, 3600, s).energy, 55, s);
    });
  });

  test('mood: tick clamps to 0..100 and is pure', function () {
    eq(M.tick({ energy: 99, mood: 50 }, 3600, 'lunch').energy, 100);
    eq(M.tick({ energy: 1, mood: 50 }, 3600, 'working').energy, 0);
    var m = { energy: 80, mood: 60 };
    var n = M.tick(m, 60, 'working');
    eq(m, { energy: 80, mood: 60 }, 'input untouched');
    ok(n !== m);
    eq(M.tick(m, -5, 'working'), m, 'negative dt changes nothing');
    eq(M.tick(m, NaN, 'working'), m, 'NaN dt changes nothing');
  });

  test('mood: pet +5 mood, annoy -5, feed +15 mood and +10 energy, clamped at 100 and 0', function () {
    eq(M.pet({ energy: 50, mood: 60 }), { energy: 50, mood: 65 });
    eq(M.annoy({ energy: 50, mood: 60 }), { energy: 50, mood: 55 });
    eq(M.annoy({ energy: 50, mood: 3 }).mood, 0);
    eq(M.feed({ energy: 50, mood: 60 }), { energy: 60, mood: 75 });
    eq(M.feed({ energy: 95, mood: 95 }), { energy: 100, mood: 100 }, 'feeding at 95 clamps at 100');
    eq(M.pet({ energy: 50, mood: 98 }).mood, 100);
  });

  test('mood: hearts and bolts are 0..5', function () {
    eq(M.hearts({ mood: 70 }), 4);
    eq(M.hearts({ mood: 0 }), 0);
    eq(M.hearts({ mood: 100 }), 5);
    eq(M.hearts({ mood: 49 }), 2);
    eq(M.bolts({ energy: 40 }), 2);
    eq(M.bolts({ energy: 62.5 }), 3);
    eq(M.bolts({ energy: 100 }), 5);
    eq(M.hearts({ mood: 140 }), 5, 'clamped');
    eq(M.bolts({ energy: -3 }), 0, 'clamped');
  });

  test('mood: advance follows the day in order — morning work, lunch, afternoon', function () {
    // 09:00-12:00 work: 100 -> 77.5; lunch +30 caps at 100; 13:00-18:00 work: 100 -> 62.5
    var m = M.advance(M.initial(), at(9, 0), at(18, 0), day());
    near(m.energy, 62.5, 0.01);
    eq(m.mood, 50, '9 hours of drift');
    near(M.advance(M.initial(), at(9, 0), at(12, 0), day()).energy, 77.5, 0.01);
    near(M.advance(M.initial(), at(9, 0), at(12, 30), day()).energy, 92.5, 0.01, 'half an hour of lunch');
  });

  test('mood: advance in small steps equals one big step (a hidden window catches up)', function () {
    var a = M.initial(), t = at(9, 0), step = 7 * 60 * 1000;
    while (t < at(18, 0)) { var nx = Math.min(t + step, at(18, 0)); a = M.advance(a, t, nx, day()); t = nx; }
    var b = M.advance(M.initial(), at(9, 0), at(18, 0), day());
    near(a.energy, b.energy, 1e-6);
    near(a.mood, b.mood, 1e-6);
  });

  test('mood: advance before the start, after a manual end, after 8 h, and with no lunch', function () {
    eq(M.advance(M.initial(), at(7, 0), at(9, 0), day()).energy, 100, 'before the start');
    eq(M.advance(M.initial(), at(7, 0), at(10, 0), day({ startMs: null })).energy, 100, 'never started');
    near(M.advance(M.initial(), at(9, 0), at(15, 0), day({ endMs: at(11, 0) })).energy, 85, 0.01, 'no drain or lunch after 下班');
    near(M.advance(M.initial(), at(9, 0), at(23, 0), day()).energy, 62.5, 0.01, 'nothing after 8 worked hours');
    near(M.advance(M.initial(), at(9, 0), at(17, 0), day({ lunch: null })).energy, 40, 0.01, 'no lunch break');
    var m = M.initial();
    eq(M.advance(m, at(10, 0), at(9, 0), day()), m, 'backwards: unchanged');
  });
})();
