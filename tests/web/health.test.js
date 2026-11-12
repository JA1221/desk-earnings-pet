// QJZ.health: per-day counts on a history record, sanitized.
(function () {
  test('health: counts of a record, sanitized', function () {
    eq(QJZ.health.of({}), { cups: 0, cupGoal: null, tomatoes: 0, standups: 0 });
    eq(QJZ.health.sanitize({ cups: -2, cupGoal: 'x', tomatoes: 2.7, standups: '4' }), { cups: 0, cupGoal: null, tomatoes: 2, standups: 0 });
    eq(QJZ.health.sanitize('nope'), null);
    eq(QJZ.health.sanitize({ cups: 1e9 }).cups, 999);
    eq(QJZ.health.sanitize({ cupGoal: 21 }).cupGoal, null);
    eq(QJZ.health.sanitize({ cupGoal: 20.5 }).cupGoal, 20);
    eq(QJZ.health.has({ health: { cups: 1 } }), true);
    eq(QJZ.health.has({ health: { cups: 0, tomatoes: 0, standups: 0 } }), false);
    eq(QJZ.health.has({}), false);
  });
  test('health: add never goes below 0; seal sets the goal once', function () {
    eq(QJZ.health.add({ cups: 1 }, 'cups', -5).cups, 0);
    eq(QJZ.health.add(null, 'tomatoes', 2).tomatoes, 2);
    eq(QJZ.health.seal({ day: 'd' }, 8), { day: 'd' });
    eq(QJZ.health.seal({ health: { cups: 1 } }, 8).health.cupGoal, 8);
    eq(QJZ.health.seal({ health: { cups: 1, cupGoal: 6 } }, 8).health.cupGoal, 6);
    eq(QJZ.health.withHealth({ day: 'd' }, { cups: 2 }).health.cups, 2);
  });

  // ---------- the calendar ----------
  var SET8 = { health: { water: { goal: 8 } } };
  function rec(day, h) { return { day: day, health: h }; }
  function cell(cal, d) {
    var out = null;
    cal.weeks.forEach(function (w) { w.forEach(function (c) { if (c && c.d === d) out = c; }); });
    return out;
  }
  test('health: November 2026 starts on Sunday with five weeks', function () {
    var cal = QJZ.health.calendar({ days: {} }, '2026-11', { day: '2026-11-12' }, SET8);
    eq(cal.weeks.length, 5);
    eq(cal.weeks[0][0].d, 1);
    eq(cal.weeks[4][1].d, 30);
    eq(cal.weeks[4][2], null);
    eq(cal.title, '2026 年 11 月');
    eq(QJZ.health.calendar({ days: {} }, '2026-10', { day: '2026-11-12' }, SET8).weeks[0].slice(0, 4), [null, null, null, null], 'October starts on a Thursday');
  });
  test('health: calendar levels use the day\'s own goal', function () {
    function lv(cups, cupGoal, setGoal) {
      var days = { '2026-11-03': rec('2026-11-03', { cups: cups, cupGoal: cupGoal, tomatoes: 0, standups: 0 }) };
      var c = cell(QJZ.health.calendar({ days: days }, '2026-11', { day: '2026-11-12' }, { health: { water: { goal: setGoal } } }), 3);
      return c.full ? 'full' : c.blank ? 'blank' : c.level;
    }
    eq([0, 1, 3, 6, 7, 8, 9].map(function (n) { return lv(n, 8, 8); }), [0, 1, 2, 3, 3, 'full', 'full']);
    eq(lv(6, 6, 10), 'full', 'sealed goal 6 beats the setting 10');
    eq(lv(3, null, 8), 2, 'no sealed goal: the setting, never NaN');
  });
  test('health: blank days, today live, totals', function () {
    var days = {
      '2026-11-03': rec('2026-11-03', { cups: 8, cupGoal: 8, tomatoes: 2, standups: 0 }),
      '2026-11-04': { day: '2026-11-04', earned: 100 }
    };
    var today = { day: '2026-11-12', health: { cups: 3, cupGoal: null, tomatoes: 0, standups: 0 } };
    var cal = QJZ.health.calendar({ days: days }, '2026-11', today, SET8);
    eq([cell(cal, 4).blank, cell(cal, 5).blank], [true, true]);
    eq([cell(cal, 3).full, cell(cal, 3).tomatoes, cell(cal, 3).level], [true, 2, 4]);
    var t = cell(cal, 12);
    eq([t.blank, t.today, t.level], [false, true, 2], 'live, against the setting');
    eq(cal.totals, { cups: 11, tomatoes: 2 });
    var none = QJZ.health.calendar({ days: days }, '2026-11', { day: '2026-11-12' }, SET8);
    eq([cell(none, 12).blank, cell(none, 12).level], [false, 0], 'today with no health shows 0, not blank');
    eq(none.totals, { cups: 8, tomatoes: 2 });
    eq(cell(QJZ.health.calendar({ days: days }, '2026-10', today, SET8), 31).today, false, 'today outside the month');
  });
})();
