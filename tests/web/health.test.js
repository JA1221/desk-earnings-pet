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
})();
