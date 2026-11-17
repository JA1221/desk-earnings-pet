// QJZ.stats (1.1.5 item 2): the week / month series of 紀錄 → 統計.
(function () {
  var S = function () { return QJZ.stats; };
  function hrec(day, earned, health) {
    var r = { day: day, earned: earned };
    if (health) r.health = health;
    return r;
  }

  test('stats: the week runs Monday to Sunday, across a month and a year', function () {
    eq(S().range('week', '2026-11-12'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'], 'a Thursday');
    eq(S().range('week', '2026-11-09')[0], '2026-11-09', 'a Monday starts its own week');
    eq(S().range('week', '2026-11-15')[0], '2026-11-09', 'a Sunday ends the week before it');
    eq(S().range('week', '2026-12-02'), ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'], 'across a month');
    eq(S().range('week', '2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'], 'across a year');
  });

  test('stats: the month is every date of today\'s month', function () {
    var m = S().range('month', '2026-11-12');
    eq([m.length, m[0], m[29]], [30, '2026-11-01', '2026-11-30']);
    eq(S().range('month', '2028-02-29').length, 29, 'a leap February');
    eq(S().range('month', '2026-02-01').length, 28);
    eq(S().range('month', '2026-12-31')[30], '2026-12-31');
  });

  test('stats: 收入 per day: closed days, open and missing ones are no data, today live, the days after it empty', function () {
    var h = { version: 1, days: {
      '2026-11-09': hrec('2026-11-09', 2000),
      '2026-11-10': hrec('2026-11-10', null),           // still open
      '2026-11-11': hrec('2026-11-11', 0),              // an off day
      '2026-11-08': hrec('2026-11-08', 999),            // the week before
      '2026-11-12': hrec('2026-11-12', null)
    } };
    var w = S().series(h, { day: '2026-11-12' }, 300.5, 'week', 'earned');
    eq([w.from, w.to], ['2026-11-09', '2026-11-15']);
    eq(w.days.map(function (d) { return d.v; }), [2000, null, 0, 300.5, null, null, null]);
    eq(w.days.map(function (d) { return d.future; }), [false, false, false, false, true, true, true]);
    eq(w.days[3], { day: '2026-11-12', d: 12, wd: 4, v: 300.5, today: true, future: false });
    near(w.total, 2300.5, 1e-9, 'today counts in the total');
    eq([w.avg, w.avgDays], [2000, 1], 'the average: days with data only, the 0 day and today left out');
    eq(w.max, 2000);
    var m = S().series(h, { day: '2026-11-12' }, 300.5, 'month', 'earned');
    eq(m.days.length, 30);
    near(m.total, 2999 + 300.5, 1e-9, 'the 8th is in the month');
    eq([m.avg, m.avgDays], [1499.5, 2]);
    near(m.total, QJZ.history.monthTotal(h, '2026-11', { day: '2026-11-12' }, 300.5), 1e-9, 'the same sum as the 本月累計 chip');
  });

  test('stats: today before it starts is 0, never null; no history at all', function () {
    var w = S().series({ version: 1, days: {} }, { day: '2026-11-12' }, 0, 'week', 'earned');
    eq(w.days[3].v, 0);
    eq([w.total, w.avg, w.avgDays, w.max], [0, null, 0, 0]);
    eq(S().series({ version: 1, days: {} }, { day: '2026-11-12' }, NaN, 'week', 'earned').days[3].v, 0, 'a bad live amount');
    eq(S().series(null, { day: '2026-11-12' }, 5, 'month', 'cups').total, 0);
  });

  test('stats: the counts come from each day\'s health record and today\'s live one', function () {
    var h = { version: 1, days: {
      '2026-11-02': hrec('2026-11-02', 1000, { cups: 8, cupGoal: 8, tomatoes: 3, standups: 6 }),
      '2026-11-03': hrec('2026-11-03', 1000),                                          // no health record: no data
      '2026-11-04': hrec('2026-11-04', 1000, { cups: 0, tomatoes: 0, standups: 0 }),    // a record of nothing
      '2026-11-05': hrec('2026-11-05', 1000, { cups: 4, tomatoes: 1, standups: 2 })
    } };
    var today = { day: '2026-11-06', health: { cups: 3, tomatoes: 2, standups: 1 } };
    var c = S().series(h, today, 0, 'month', 'cups');
    eq(c.days.slice(1, 6).map(function (d) { return d.v; }), [8, null, 0, 4, 3]);
    eq([c.total, c.avg, c.avgDays, c.max], [15, 6, 2, 8]);
    var t = S().series(h, today, 0, 'month', 'tomatoes');
    eq([t.total, t.avg, t.avgDays], [6, 2, 2]);
    var s = S().series(h, today, 0, 'week', 'standups');
    eq([s.from, s.total, s.avg, s.avgDays], ['2026-11-02', 9, 4, 2]);
    eq(S().series(h, { day: '2026-11-06' }, 0, 'week', 'cups').days[4].v, 0, 'today with no health yet: 0');
  });

  // 1.1.5 review: ◀ ▶ step back through the periods
  test('stats: an earlier period: across a year end, a leap February, never past today\'s', function () {
    var h = { version: 1, days: {} };
    var w = S().series(h, { day: '2027-01-05' }, 0, 'week', 'earned', -1);
    eq([w.from, w.to, w.current, w.offset], ['2026-12-28', '2027-01-03', false, -1], 'the week before (Tue 01-05): across the year end');
    eq(S().series(h, { day: '2027-01-05' }, 0, 'week', 'earned', 0).from, '2027-01-04', 'the current week');
    eq(S().series(h, { day: '2027-01-05' }, 0, 'week', 'earned', -2).from, '2026-12-21');
    var f = S().series(h, { day: '2028-03-31' }, 0, 'month', 'earned', -1);
    eq([f.from, f.to, f.days.length], ['2028-02-01', '2028-02-29', 29], 'the 31st steps back to a whole February');
    eq(S().series(h, { day: '2027-01-10' }, 0, 'month', 'earned', -1).from, '2026-12-01', 'back over a year end');
    eq(S().series(h, { day: '2027-01-10' }, 0, 'month', 'earned', -13).from, '2025-12-01');
    eq(S().series(h, { day: '2026-11-12' }, 0, 'month', 'earned', 3).from, '2026-11-01', 'a future offset is today\'s');
  });

  test('stats: a past period has no today; its 合計 and 平均 are its own, every day with data counted', function () {
    var h = { version: 1, days: {
      '2026-10-01': hrec('2026-10-01', 1000, { cups: 4 }), '2026-10-02': hrec('2026-10-02', 3000),
      '2026-10-05': hrec('2026-10-05', 0), '2026-10-31': hrec('2026-10-31', 500, { cups: 2 }),
      '2026-11-02': hrec('2026-11-02', 9999) } };
    var m = S().series(h, { day: '2026-11-12' }, 777, 'month', 'earned', -1);
    eq([m.from, m.to, m.current], ['2026-10-01', '2026-10-31', false]);
    ok(m.days.every(function (d) { return !d.today && !d.future; }), 'no today, nothing ahead');
    eq([m.total, m.avg, m.avgDays, m.max], [4500, 1500, 3, 3000], 'the live amount is not in it; the 0 day is not data');
    var c = S().series(h, { day: '2026-11-12' }, 0, 'month', 'cups', -1);
    eq([c.total, c.avg, c.avgDays], [6, 3, 2]);
    var w = S().series(h, { day: '2026-11-04' }, 0, 'week', 'earned', -1);
    eq([w.from, w.total, w.avgDays], ['2026-10-26', 500, 1], 'the week before, across the month');
  });

  test('stats: the earliest period with any record', function () {
    var h = { version: 1, days: { '2026-09-01': hrec('2026-09-01', 1), '2026-11-02': hrec('2026-11-02', 1) } };
    eq(S().earliest(h, 'month', '2026-11-12'), -2);
    eq(S().earliest(h, 'week', '2026-11-12'), -10, 'the week of Mon 08-31 to the week of Mon 11-09');
    eq(S().earliest({ version: 1, days: { '2026-12-31': hrec('2026-12-31', 1) } }, 'month', '2027-01-02'), -1, 'over a year end');
    eq(S().earliest({ version: 1, days: {} }, 'month', '2026-11-12'), 0, 'none: today\'s only');
    eq(S().earliest({ version: 1, days: { '2026-11-12': hrec('2026-11-12', 1) } }, 'week', '2026-11-12'), 0, 'only today');
    eq(S().earliest(null, 'week', '2026-11-12'), 0);
  });

  test('stats: unknown period or item fall back to 月 and 收入', function () {
    var m = S().series({ version: 1, days: {} }, { day: '2026-11-12' }, 0, 'year', 'steps');
    eq([m.period, m.metric, m.days.length], ['month', 'earned', 30]);
  });

  test('stats: the scale\'s top: round for 收入, even and whole for a count', function () {
    eq([S().top(0, 'earned'), S().top(2272.73, 'earned'), S().top(95, 'earned')], [100, 2500, 100]);
    eq([0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 15, 25].map(function (v) { return S().top(v, 'cups'); }), [4, 2, 2, 4, 6, 6, 8, 8, 10, 20, 20, 30]);
  });
})();
