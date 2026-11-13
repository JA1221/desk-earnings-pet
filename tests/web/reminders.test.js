(function () {
var R = QJZ.reminders, D = '2026-11-12';
function S(o) {   // parsed 1.0 settings + a literal health object (Ruling M1)
  var s = QJZ.settings.parse('{"salary":{"amount":50000}}').settings;
  s.health = { asked: true, every: 50, sit: { on: true }, water: { on: true, goal: 8 }, pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4 } };
  for (var k in (o || {})) s.health[k] = o[k];
  return s;
}
var ALL = S(), H = ALL.health;
function started(h, m) { return QJZ.day.manualStart(QJZ.day.empty(D), at(h, m)); }
function run(rec, from, to) { return R.advance(R.initial(D, from), to, rec, ALL); }
function due(r, t, h, cups) { return R.due(r, t, h || H, cups || 0).due; }
test('reminders: working time excludes lunch, before the start, after 8 h, 休假, 下班; clock went back', function () {
  var r9 = started(9, 0);
  eq(R.workMs(r9, ALL, at(9, 0), at(10, 0)), 3600000); eq(R.workMs(r9, ALL, at(11, 30), at(13, 30)), 3600000, 'lunch');
  eq(R.workMs(r9, ALL, at(8, 0), at(9, 30)), 1800000, 'before the start'); eq(R.workMs(r9, ALL, at(17, 30), at(19, 0)), 1800000, 'ends 18:00');
  eq(R.workMs(QJZ.day.setOffDay(r9, true), ALL, at(9, 0), at(10, 0)), 0, '今天休假'); eq(R.workMs(QJZ.day.empty(D), ALL, at(9, 0), at(10, 0)), 0, 'not started');
  eq(R.workMs(QJZ.day.manualEnd(r9, at(15, 0)), ALL, at(14, 0), at(16, 0)), 3600000, '下班 15:00'); eq(R.workMs(r9, ALL, at(10, 0), at(9, 0)), 0, 'clock went back');
});
test('reminders: due after 50 working minutes, not a millisecond earlier', function () {
  var rec = started(9, 0);
  eq(due(run(rec, at(9, 0), at(9, 49, 59, 999)), at(9, 49, 59, 999)), false); eq(due(run(rec, at(9, 0), at(9, 50)), at(9, 50)), true);
});
test('reminders: what the bubble asks', function () {
  function ask(sit, water, cups) { return R.ask(S({ sit: { on: sit }, water: { on: water, goal: 8 } }).health, cups); }
  eq(ask(true, true, 3), { sit: true, water: true }); eq(ask(true, false, 3), { sit: true, water: false }); eq(ask(false, true, 3), { sit: false, water: true });
  eq(ask(true, true, 8), { sit: true, water: false }, 'goal reached'); eq(ask(false, true, 8), { sit: false, water: false }); eq(ask(false, false, 0), { sit: false, water: false });
  eq(R.ask(S({ asked: false }).health, 0), { sit: false, water: false }, 'not asked yet (§5.5)');
  eq(due(run(started(9, 0), at(9, 0), at(15, 0)), at(15, 0), S({ sit: { on: false }, water: { on: true, goal: 8 } }).health, 8), false, 'water only, goal reached: done for today');
});
test('reminders: the end of lunch restarts the timer (start 11:20 -> due 13:50, not 13:10)', function () {
  var r = started(11, 20);
  eq(due(run(r, at(11, 20), at(13, 49, 59)), at(13, 49, 59)), false); eq(due(run(r, at(11, 20), at(13, 50)), at(13, 50)), true);
});
test('reminders: a lock of 5:00 is a stand-up and restarts the timer, 4:59 is not; a lock during lunch is not', function () {
  var rec = started(9, 0), r30 = R.goAway(run(rec, at(9, 0), at(9, 30)), at(9, 30), rec, ALL);
  var short = R.comeBack(r30, at(9, 34, 59), rec, ALL); eq(short.standup, false);
  eq(due(R.advance(short.r, at(9, 54, 58), rec, ALL), at(9, 54, 58)), false); eq(due(R.advance(short.r, at(9, 54, 59), rec, ALL), at(9, 54, 59)), true);
  var long = R.comeBack(r30, at(9, 35), rec, ALL); eq([long.standup, long.r.ms], [true, 0]);
  eq(due(R.advance(long.r, at(10, 25), rec, ALL), at(10, 25)), true);
  eq(R.comeBack(R.goAway(run(rec, at(9, 0), at(12, 10)), at(12, 10), rec, ALL), at(12, 40), rec, ALL).standup, false, 'lunch');
});
test('reminders: 等一下 brings it back exactly 10 minutes later', function () {
  var rec = started(9, 0), r = R.snooze(run(rec, at(9, 0), at(9, 51)), at(9, 51));
  eq(due(R.advance(r, at(10, 0, 59, 999), rec, ALL), at(10, 0, 59, 999)), false); eq(due(R.advance(r, at(10, 1), rec, ALL), at(10, 1)), true);
});
test('reminders: reset; a break restarts the timer; skipping the break restores it', function () {
  var rec = started(9, 0), r = R.reset(run(rec, at(9, 0), at(9, 40)));
  eq(due(R.advance(r, at(10, 29, 59), rec, ALL), at(10, 29, 59)), false); eq(due(R.advance(r, at(10, 30), rec, ALL), at(10, 30)), true);
  r = R.breakStarted(run(rec, at(9, 0), at(9, 45))); eq(r.ms, 0);
  r = R.breakSkipped(R.advance(r, at(9, 46), rec, ALL)); eq(r.ms, 46 * 60000); eq(due(R.advance(r, at(9, 50), rec, ALL), at(9, 50)), true);
});
test('reminders: nothing asked, or a day that never started, is never due; minutes to the next one', function () {
  var off = S({ sit: { on: false }, water: { on: false, goal: 8 } }).health, rec = started(9, 0);
  eq(due(run(rec, at(9, 0), at(15, 0)), at(15, 0), off), false); eq(due(run(QJZ.day.empty(D), at(9, 0), at(15, 0)), at(15, 0)), false);
  eq(R.minutesToNext(run(rec, at(9, 0), at(9, 42)), H, 0), 8); eq(R.minutesToNext(R.initial(D, at(9, 0)), off, 0), null);
});
test('reminders: a long gap across lunch counts only the working time after the lunch end', function () {
  var rec = started(9, 0); eq(R.advance(run(rec, at(9, 0), at(11, 0)), at(14, 0), rec, ALL).ms, 3600000);
});
// 1.1.1 item 5: 現在提醒我一次 forces the reminder due now. Whatever restarts the timer ends it; 等一下 snoozes it.
test('reminders: a forced reminder is due at once, until something restarts the timer', function () {
  var rec = started(9, 0), r = R.force(run(rec, at(9, 0), at(9, 7)));
  eq([r.forced, r.ms, r.snoozeUntil], [true, 7 * 60000, null], 'the real time sat is kept');
  eq(due(r, at(9, 7)), true); eq(R.minutesToNext(r, H, 0), 0);
  eq(R.due(R.force(R.initial(D, at(9, 0))), at(9, 0), S({ sit: { on: false }, water: { on: false, goal: 8 } }).health, 0).due, false, 'nothing asked: nothing due');
  eq(due(R.advance(r, at(9, 30), rec, ALL), at(9, 30)), true, 'it stays due');
  var z = R.snooze(r, at(9, 8));
  eq([due(z, at(9, 17, 59)), due(z, at(9, 18))], [false, true], '等一下: 10 minutes');
  eq(R.force(z).snoozeUntil, null, 'forcing again ends the snooze');
  eq(R.reset(r).forced, false, '喝了 / 起來了'); eq(R.breakStarted(r).forced, false, 'a break');
  eq(R.comeBack(R.goAway(r, at(9, 10), rec, ALL), at(9, 15), rec, ALL).r.forced, false, 'a lock of 5 min');
  eq(R.comeBack(R.goAway(r, at(9, 10), rec, ALL), at(9, 14), rec, ALL).r.forced, true, 'a shorter one does not');
  eq(R.advance(R.force(run(rec, at(9, 0), at(11, 50))), at(13, 10), rec, ALL).forced, false, 'the end of lunch');
  eq(R.initial(D, at(9, 0)).forced, false);
});
})();
