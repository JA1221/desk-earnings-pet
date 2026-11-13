(function () {
var P = QJZ.prompt;
function c(t, o) { o = o || {}; var a = o.ask || '';
  return { nowMs: t, blocked: !!o.blocked, focus: !!o.focus, working: o.working !== false, forced: !!o.forced,
    due: { due: !!a, sit: a === 'both' || a === 'sit', water: a === 'both' || a === 'water' }, notice: o.notice || null, noticeWater: !!o.noticeWater }; }
function st(q, t, o) { return P.step(q, c(t, o)); }
function ty(x) { return x.events.map(function (e) { return e.type + (e.prompt && e.type !== 'wave' ? ':' + e.prompt.kind + (e.prompt.water ? '+w' : '') : '') + (e.quiet ? ':quiet' : ''); }); }
test('prompt: shows at once when nothing has blocked it', function () { var x = st(P.initial(), at(9, 50), { ask: 'both' }); eq(ty(x), ['show:both']); eq(x.events[0].prompt.shownMs, at(9, 50)); });
test('prompt: hidden / fullscreen / panel (blocked) queue; shown 3 s after it ends', function () {
  var x = st(st(P.initial(), at(9, 49), { blocked: true }).q, at(9, 50), { blocked: true, ask: 'both' }); eq(ty(x), []);
  x = st(x.q, at(9, 55), { ask: 'both' }); eq(ty(x), []); x = st(x.q, at(9, 55, 2, 999), { ask: 'both' }); eq(ty(x), []);
  eq(ty(st(x.q, at(9, 55, 3), { ask: 'both' })), ['show:both']);
});
test('prompt: focus queues the reminder until 3 s after it ends', function () {
  var x = st(st(P.initial(), at(9, 40), { focus: true }).q, at(9, 50), { focus: true, ask: 'sit' }); eq(ty(x), []);
  x = st(x.q, at(10, 16), { ask: 'sit' }); eq(ty(x), []); eq(ty(st(x.q, at(10, 16, 3), { ask: 'sit' })), ['show:sit']);
});
test('prompt: the break notice is not held by the focus; its water line only while working', function () {
  var q = st(P.initial(), at(9, 40), { focus: true }).q;
  eq(ty(st(q, at(10, 5), { notice: 'break', noticeWater: true })), ['show:break+w']);
  eq(ty(st(q, at(10, 5), { notice: 'break', noticeWater: true, working: false })), ['show:break']);
});
test('prompt: changed parts update the same bubble; nothing left closes it quietly', function () {
  var q = st(P.initial(), at(9, 50), { ask: 'both' }).q, x = st(q, at(9, 55), { ask: 'sit' });
  eq(ty(x), ['update:sit']); eq(x.events[0].prompt.shownMs, at(9, 50));
  eq(ty(st(st(P.initial(), at(9, 50), { ask: 'water' }).q, at(9, 55), {})), ['hide:quiet']);
});
test('prompt: re-waves every 2 minutes, never a second bubble', function () {
  var q = st(P.initial(), at(9, 50), { ask: 'both' }).q;
  eq(ty(st(q, at(9, 51, 59, 999), { ask: 'both' })), []); var x = st(q, at(9, 52), { ask: 'both' }); eq(ty(x), ['wave']);
  eq(ty(st(x.q, at(9, 53), { ask: 'both' })), []); eq(ty(st(st(x.q, at(9, 53), { ask: 'both' }).q, at(9, 54), { ask: 'both' })), ['wave']);
});
test('prompt: lunch / 下班 / 休假 close it quietly and keep it closed', function () {
  var x = st(st(P.initial(), at(11, 55), { ask: 'both' }).q, at(12, 0), { ask: 'both', working: false });
  eq(ty(x), ['hide:quiet']); eq(ty(st(x.q, at(12, 30), { ask: 'both', working: false })), []);
});
test('prompt: starting a focus puts the bubble back in the queue', function () {
  var x = st(st(P.initial(), at(9, 50), { ask: 'both' }).q, at(9, 51), { ask: 'both', focus: true }); eq(ty(x), ['hide:quiet']);
  x = st(x.q, at(10, 16), { ask: 'both' }); eq(ty(x), []); eq(ty(st(x.q, at(10, 16, 3), { ask: 'both' })), ['show:both']);
});
test('prompt: a pomodoro notice replaces the reminder; the reminder returns 3 s after the notice is answered', function () {
  var x = st(st(P.initial(), at(10, 0), { ask: 'water' }).q, at(10, 10), { ask: 'water', notice: 'breakEnd' });
  eq(ty(x), ['hide:quiet', 'show:breakEnd']); var a = P.answer(x.q, 'stop', at(10, 11)); eq(a.effects, ['ackNotice', 'stopPomodoro']);
  eq(ty(st(a.q, at(10, 11, 2, 999), { ask: 'water' })), []); eq(ty(st(a.q, at(10, 11, 3), { ask: 'water' })), ['show:water']);
});
test('prompt: an ignored break bubble becomes the break-end bubble', function () {
  var x = st(st(P.initial(), at(10, 5), { notice: 'break' }).q, at(10, 10), { notice: 'breakEnd' });
  eq(ty(x), ['hide:quiet', 'show:breakEnd']); eq(x.events[1].prompt.shownMs, at(10, 10));
});
test('prompt: pomodoro notices also show outside working hours', function () { eq(ty(st(P.initial(), at(19, 0), { notice: 'breakEnd', working: false })), ['show:breakEnd']); });
test('prompt: answers', function () {
  function ans(o, btn) { return P.answer(st(P.initial(), at(10, 0), o).q, btn, at(10, 1)).effects; }
  eq(ans({ ask: 'both' }, 'drink'), ['drink', 'waterDone']); eq(ans({ ask: 'both' }, 'up'), ['standup']); eq(ans({ ask: 'both' }, 'later'), ['snooze']);
  eq(ans({ ask: 'sit' }, 'up'), ['standup']); eq(ans({ ask: 'sit' }, 'later'), ['snooze']); eq(ans({ ask: 'sit' }, 'drink'), []);
  eq(ans({ ask: 'water' }, 'drink'), ['standup', 'drink']); eq(ans({ ask: 'water' }, 'later'), ['snooze']); eq(ans({ ask: 'water' }, 'up'), []);
  eq(ans({ notice: 'break' }, 'ok'), ['ackNotice']); eq(ans({ notice: 'break' }, 'skip'), ['ackNotice', 'skipBreak']); eq(ans({ notice: 'break' }, 'drink'), []);
  eq(ans({ notice: 'break', noticeWater: true }, 'drink'), ['ackNotice', 'drink']); eq(ans({ notice: 'break', noticeWater: true }, 'ok'), ['ackNotice']);
  eq(ans({ notice: 'breakEnd' }, 'next'), ['ackNotice', 'nextFocus']); eq(ans({ notice: 'breakEnd' }, 'stop'), ['ackNotice', 'stopPomodoro']);
});
test('prompt: stale and repeated answers do nothing', function () {
  eq(P.answer(P.initial(), 'drink', at(10, 0)).effects, []);
  var a = P.answer(st(P.initial(), at(10, 0), { ask: 'water' }).q, 'drink', at(10, 1)); eq(a.effects, ['standup', 'drink']);
  eq(P.answer(a.q, 'drink', at(10, 1)).effects, [], 'double press');
});
test('prompt: after any answer the next prompt waits 3 s', function () {
  var a = P.answer(st(P.initial(), at(9, 50), { ask: 'sit' }).q, 'up', at(9, 51));
  eq(ty(st(a.q, at(9, 51), { ask: 'water' })), []); eq(ty(st(a.q, at(9, 51, 3), { ask: 'water' })), ['show:water']);
});
test('prompt: view copy', function () {
  function lab(v) { return v.buttons.map(function (b) { return b.label; }); }
  var b = P.view({ kind: 'both' }, { min: 50, cups: 3, cupGoal: 8, turn: 0 });
  eq([b.title, b.sub, b.icon], ['起來動一動，順便喝口水～', '已經坐 50 分鐘囉・今天 3/8 杯', 'stand']); eq(lab(b), ['喝了', '起來了', '等一下']);
  eq(b.buttons.map(function (x) { return x.id; }), ['drink', 'up', 'later']); eq(P.view({ kind: 'both' }, { turn: 6 }).title, P.LINES.both[1]);
  ok(P.LINES.both.length >= 5 && P.LINES.sit.length >= 5 && P.LINES.water.length >= 5);
  var s = P.view({ kind: 'sit' }, { min: 50, turn: 0 }); eq([s.title, s.sub], ['坐好久了，起來動一動！', '已經坐 50 分鐘囉']); eq(lab(s), ['起來了', '等一下']);
  var w = P.view({ kind: 'water' }, { cups: 3, cupGoal: 8, turn: 0 }); eq([w.title, w.sub, w.icon], ['喝口水吧～', '今天 3 杯，目標 8 杯', 'drop']); eq(lab(w), ['喝了', '等一下']);
  var r = P.view({ kind: 'break', water: false }, { breakMin: 5, done: 3 }); eq([r.title, r.sub, r.waterLine], ['休息 5 分鐘！起來走走～', '第 3 顆番茄完成', null]); eq(lab(r), ['好', '跳過休息']);
  var l = P.view({ kind: 'break', water: true }, { breakMin: 15, long: true, done: 4 }); eq([l.title, l.waterLine], ['長休息 15 分鐘！起來走走～', '順便喝口水吧～']); eq(lab(l), ['好', '喝了', '跳過休息']);
  var e = P.view({ kind: 'breakEnd' }, {}); eq(e.title, '休息結束～要開始下一顆嗎？'); eq(lab(e), ['開始', '先不要']);
});
// 1.1.1 item 5: a forced reminder (現在提醒我一次) shows outside work time too; the gates still hold it.
test('prompt: a forced reminder shows outside work time; hidden, full screen, the panel and a focus still hold it', function () {
  eq(ty(st(P.initial(), at(12, 30), { ask: 'both', working: false })), [], 'lunch: not by itself');
  var x = st(P.initial(), at(12, 30), { ask: 'both', working: false, forced: true }); eq(ty(x), ['show:both'], 'asked for');
  eq(ty(st(x.q, at(12, 31), { ask: 'both', working: false, forced: true })), [], 'it stays');
  eq(ty(st(P.initial(), at(12, 30), { ask: 'both', forced: true, blocked: true })), []);
  eq(ty(st(P.initial(), at(12, 30), { ask: 'both', forced: true, focus: true })), []);
  x = st(st(P.initial(), at(12, 30), { ask: 'both', forced: true, blocked: true }).q, at(12, 31), { ask: 'both', forced: true, working: false });
  eq(ty(x), []); eq(ty(st(x.q, at(12, 31, 3), { ask: 'both', forced: true, working: false })), ['show:both'], '3 s after the gate opens');
});
// 1.1.1 review: a reminder asked for right after one (現在提醒我一次) can come with no minute sat; then the bubble leaves
// 「已經坐 N 分鐘囉」 out instead of saying 「已經坐 0 分鐘囉」.
test('prompt: no 「已經坐 N 分鐘囉」 when no minute has been sat', function () {
  eq(P.view({ kind: 'both' }, { min: 0, cups: 3, cupGoal: 8, turn: 0 }).sub, '今天 3/8 杯');
  eq(P.view({ kind: 'sit' }, { min: 0, turn: 0 }).sub, '', '起來動 alone: no sub at all');
  eq(P.view({ kind: 'water' }, { min: 0, cups: 3, cupGoal: 8, turn: 0 }).sub, '今天 3 杯，目標 8 杯', 'water never said it');
  eq(P.view({ kind: 'sit' }, { min: 1, turn: 0 }).sub, '已經坐 1 分鐘囉', 'one minute is said');
});
// 1.1.2 item 7: 喝了 on a bubble that asks both only logs a cup; the bubble stays, now the 起來動 one (起來了 / 等一下),
// and closes only on those. A water-only bubble still closes on 喝了.
test('prompt: 喝了 on the both bubble keeps it, as the 起來動 bubble', function () {
  var x = st(P.initial(), at(9, 50), { ask: 'both' }), a = P.answer(x.q, 'drink', at(9, 51));
  eq(a.effects, ['drink', 'waterDone']);
  eq(a.q.prompt, { kind: 'sit', water: false, shownMs: at(9, 50) }, 'the same bubble, now asking 起來動');
  eq(a.stays, true);
  eq([a.q.remindReadyAt, a.q.noticeReadyAt, a.q.waveAt], [x.q.remindReadyAt, x.q.noticeReadyAt, x.q.waveAt], 'no gate: it never went');
  eq(P.answer(a.q, 'drink', at(9, 51)).effects, [], 'a second 喝了 does nothing');
  eq(ty(st(a.q, at(9, 51, 1), { ask: 'sit' })), [], 'the next step leaves it as it is');
  eq(P.view(a.q.prompt, { min: 50, turn: 0 }).buttons.map(function (b) { return b.id; }), ['up', 'later']);
  var u = P.answer(a.q, 'up', at(9, 52));
  eq([u.effects, u.q.prompt, u.stays], [['standup'], null, false], '起來了 closes it');
  var w = P.answer(st(P.initial(), at(9, 50), { ask: 'water' }).q, 'drink', at(9, 51));
  eq([w.q.prompt, w.stays], [null, false], 'water alone: 喝了 closes it');
});
// 1.1.2 item 11: the combined line fits U5-B.
test('prompt: the shorter combined line', function () {
  eq(P.LINES.both[3], '伸懶腰、喝口水，再加油！');
  eq(P.LINES.both.indexOf('伸個懶腰、喝口水，再繼續加油！'), -1);
});
})();
