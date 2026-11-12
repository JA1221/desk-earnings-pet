(function () {
var P = QJZ.pomodoro, CFG = { focus: 25, short: 5, long: 15, longEvery: 4 };
function types(x) { return x.events.map(function (e) { return e.type; }); }
test('pomodoro: 25 minutes of focus, then the 5-minute break starts at once', function () {
  var p = P.start(P.idle(), at(9, 0), CFG); eq([p.phase, p.endMs, p.day], ['focus', at(9, 25), '2026-11-12']);
  eq(P.advance(p, at(9, 24, 59, 999), CFG, 0).events, []);
  var x = P.advance(p, at(9, 25), CFG, 0); eq(types(x), ['focusDone', 'breakStart']); eq(x.events[0].day, '2026-11-12');
  eq([x.p.phase, x.p.startMs, x.p.endMs, x.p.long, x.p.done, x.p.notice], ['break', at(9, 25), at(9, 30), false, 1, 'break']);
});
test('pomodoro: the break ends in breakOver and never starts the next one by itself', function () {
  var b = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 25), CFG, 0).p, x = P.advance(b, at(9, 30), CFG, 0);
  eq(types(x), ['breakDone']); eq([x.p.phase, x.p.notice], ['breakOver', 'breakEnd']); eq(P.advance(x.p, at(12, 0), CFG, 1).p.phase, 'breakOver');
});
test('pomodoro: every 4th tomato of its day gets the 15-minute long break', function () {
  var f = P.start(P.idle(), at(9, 0), CFG);
  eq([P.advance(f, at(9, 25), CFG, 3).p.long, P.advance(f, at(9, 25), CFG, 3).p.endMs], [true, at(9, 40)]);
  eq(P.advance(f, at(9, 25), CFG, 4).p.long, false); eq(P.advance(f, at(9, 25), CFG, 7).p.long, true);
  eq(P.advance(f, at(9, 25), { focus: 25, short: 5, long: 15, longEvery: 2 }, 1).p.long, true);
});
test('pomodoro: stop counts nothing; skip break starts a focus now; start again from breakOver', function () {
  var s = P.stop(P.start(P.idle(), at(9, 0), CFG)); eq([s.phase, s.notice], ['idle', null]); eq(P.advance(s, at(10, 0), CFG, 0).events, []);
  var b = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 25), CFG, 0).p, k = P.skipBreak(b, at(9, 26), CFG);
  eq([k.phase, k.startMs, k.endMs, k.notice], ['focus', at(9, 26), at(9, 51), null]);
  eq(P.start(P.advance(b, at(9, 30), CFG, 0).p, at(9, 40), CFG).endMs, at(10, 5)); eq(P.start(k, at(9, 30), CFG), k, 'a running focus is not restarted');
});
test('pomodoro: a restart catches up through every phase that ended while closed', function () {
  var x = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 40), CFG, 0);
  eq(x.events.map(function (e) { return e.type + '@' + new Date(e.atMs).toTimeString().slice(0, 5); }), ['focusDone@09:25', 'breakStart@09:25', 'breakDone@09:30']);
  eq(x.p.phase, 'breakOver');
});
test('pomodoro: a tomato counts for the day it started', function () {
  var p = P.start(P.idle(), new Date(2026, 10, 12, 3, 50).getTime(), CFG); eq(p.day, '2026-11-11');
  eq(P.advance(p, new Date(2026, 10, 12, 4, 15).getTime(), CFG, 0).events[0].day, '2026-11-11');
});
test('pomodoro: sanitize', function () {
  var good = P.start(P.idle(), at(9, 0), CFG); eq(P.sanitize(JSON.parse(JSON.stringify(good))), good); eq(P.sanitize(P.idle()), P.idle());
  eq(P.sanitize('x'), null); eq(P.sanitize({ phase: 'zzz' }), null);
  eq(P.sanitize({ phase: 'focus', startMs: at(9, 0), endMs: at(8, 0), day: '2026-11-12' }), null);
  eq(P.sanitize({ phase: 'focus', startMs: at(9, 0), endMs: at(9, 0) + 3 * 86400000, day: '2026-11-12' }), null, 'days away');
  eq(P.sanitize({ phase: 'focus', startMs: NaN, endMs: at(9, 0), day: '2026-11-12' }), null);
  eq(P.sanitize({ phase: 'focus', startMs: at(9, 0), endMs: at(9, 25), day: 'tomorrow' }), null);
  eq(P.sanitize(null), null);
});
test('pomodoro: ring text, minutes left and fraction', function () {
  var p = P.start(P.idle(), at(9, 0), CFG);
  eq(P.mmss(p, at(9, 25) - 1121200), '18:42'); eq(P.minutesLeft(p, at(9, 25) - 660001), 12); eq(P.fraction(p, at(9, 12, 30)), 0.5); eq(P.mmss(P.idle(), at(9, 0)), null);
});
test('pomodoro: clock set back', function () {
  var p = P.start(P.idle(), at(9, 0), CFG);
  eq([P.minutesLeft(p, at(8, 0)), P.fraction(p, at(8, 0)), P.mmss(p, at(8, 0))], [25, 0, '25:00']);
  eq(P.remainingMs(p, at(8, 0)), 25 * 60000); eq(P.remainingMs(p, at(10, 0)), 0); eq(P.fraction(p, at(10, 0)), 1);
});
})();
