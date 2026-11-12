(function () {
var D = '2026-11-11'; // Wednesday
var S = { startMode: 'auto', workDays: [1, 2, 3, 4, 5], hoursPerDay: 8, lunch: { start: '12:00', end: '13:00' } };
var T = function (m) { return QJZ.time.atMinutes(D, m); };
function started(m) { return QJZ.day.onActivity(QJZ.day.empty(D), { type: 'logon', ms: T(m) }, S); }

test('first unlock on a weekday starts the day', function(){ var r=QJZ.day.onActivity(QJZ.day.empty('2026-11-11'),{type:'unlock',ms:T(8*60+41)},S); eq(r.startMs,T(8*60+41)); eq(r.startSource,'auto'); });
test('later unlocks keep the first start', function(){ var r=QJZ.day.onActivity(started(8*60+41),{type:'unlock',ms:T(10*60)},S); eq(r.startMs,T(8*60+41)); });
test('saturday does not auto start', function(){ eq(QJZ.day.onActivity(QJZ.day.empty('2026-11-14'),{type:'logon',ms:Date.parse('2026-11-14T09:00:00')},S).startMs,null); });
test('manual mode ignores activity', function(){ eq(QJZ.day.onActivity(QJZ.day.empty(D),{type:'logon',ms:T(540)},{startMode:'manual',workDays:[1,2,3,4,5]}).startMs,null); });
test('off day blocks auto start', function(){ var r=QJZ.day.setOffDay(QJZ.day.empty(D),true); eq(QJZ.day.onActivity(r,{type:'logon',ms:T(540)},S).startMs,null); });
test('adjust start marks adjusted', function(){ var r=QJZ.day.adjustStart(started(540),T(525)); eq(r.startMs,T(525)); ok(r.adjusted); });
test('unlock clears lastLockMs', function(){ var r=QJZ.day.onLock(started(510),T(960)); r=QJZ.day.onActivity(r,{type:'unlock',ms:T(970)},S); eq(r.lastLockMs,null); });
test('early leave question when last lock before end', function(){ var q=QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(started(510),T(962)),S); eq(q.lockMs,T(962)); eq(q.day,D); });
test('no question when locked after end', function(){ eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(started(510),T(18*60)),S),null); });
test('accepting sets confirmed end', function(){ var r=QJZ.day.resolveEarlyLeave(QJZ.day.onLock(started(510),T(962)),true); eq(r.endMs,T(962)); eq(r.endSource,'confirmed'); });
test('resume after midnight past 04:00 starts a new day', function(){ var x=QJZ.day.rollover(started(510),new Date(2026,10,12,8,5).getTime()); eq(x.closed.day,D); eq(x.current.day,'2026-11-12'); eq(x.current.startMs,null); });
test('03:30 next morning is still the same day', function(){ eq(QJZ.day.rollover(started(510),new Date(2026,10,12,3,30).getTime()).closed,null); });

test('declining keeps the day open and stops asking', function(){
  var r=QJZ.day.resolveEarlyLeave(QJZ.day.onLock(started(510),T(962)),false);
  eq(r.endMs,null); eq(r.lastLockMs,null); eq(QJZ.day.earlyLeaveQuestion(r,S),null); });
test('no question without a lock, without a start, or when already ended', function(){
  eq(QJZ.day.earlyLeaveQuestion(started(510),S),null);
  eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(QJZ.day.empty(D),T(960)),S),null);
  eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(QJZ.day.manualEnd(started(510),T(900)),T(960)),S),null); });
test('manual start and end set their sources', function(){
  var r=QJZ.day.manualStart(QJZ.day.empty(D),T(540)); eq(r.startMs,T(540)); eq(r.startSource,'manual');
  r=QJZ.day.manualEnd(r,T(1000)); eq(r.endMs,T(1000)); eq(r.endSource,'manual'); });
test('functions are pure', function(){
  var r=started(510); var before=JSON.stringify(r);
  QJZ.day.onLock(r,T(900)); QJZ.day.adjustStart(r,T(500)); QJZ.day.manualEnd(r,T(900)); QJZ.day.setOffDay(r,true);
  QJZ.day.onActivity(r,{type:'probe',ms:T(600)},S); QJZ.day.rollover(r,new Date(2026,10,13,9,0).getTime());
  eq(JSON.stringify(r),before); });
test('activity on a non-start day still clears lastLockMs', function(){
  var r=QJZ.day.onLock(QJZ.day.empty('2026-11-14'),123); r=QJZ.day.onActivity(r,{type:'unlock',ms:456},S); eq(r.lastLockMs,null); eq(r.startMs,null); });
// ---- final review R-F1 / R-F2 ----
test('manual start on an off day clears the marker and any end: a fresh start', function(){
  var r=QJZ.day.manualEnd(QJZ.day.setOffDay(started(510),true),T(600));
  r=QJZ.day.manualStart(r,T(840)); eq([r.startMs,r.startSource,r.offDay,r.endMs,r.endSource],[T(840),'manual',false,null,null]); });
test('resume clears the end and keeps the start (繼續上班)', function(){
  var r=QJZ.day.resume(QJZ.day.manualEnd(started(510),T(900)));
  eq([r.startMs,r.endMs,r.endSource],[T(510),null,null]); });
test('no early-leave question for an off day', function(){
  eq(QJZ.day.earlyLeaveQuestion(QJZ.day.setOffDay(QJZ.day.onLock(started(510),T(900)),true),S),null); });
test('onExit: the host exit counts as a lock on that day, after the start, only while there is no lock', function(){
  var r=started(540);
  eq(QJZ.day.onExit(r,T(900)).lastLockMs,T(900),'no lock yet');
  eq(QJZ.day.onExit(QJZ.day.onLock(r,T(960)),T(900)).lastLockMs,T(960),'a lock stays');
  eq(QJZ.day.onExit(QJZ.day.onLock(r,T(840)),T(900)).lastLockMs,T(840),'locked before the exit: the lock is when the user left');
  eq(QJZ.day.onExit(QJZ.day.onLock(r,T(900)),new Date(2026,10,12,3,0).getTime()).lastLockMs,T(900),
     'locked at 15:00, Windows Update restarts at 03:00 (still the day): the 15:00 lock stays');
  var back=QJZ.day.onActivity(QJZ.day.onLock(r,T(720)),{type:'unlock',ms:T(780)},S);
  eq(QJZ.day.onExit(back,T(900)).lastLockMs,T(900),'a lock the user came back from (unlock clears it) does not count');
  eq(QJZ.day.onExit(r,T(500)).lastLockMs,null,'before the start');
  eq(QJZ.day.onExit(r,new Date(2026,10,12,9,0).getTime()).lastLockMs,null,'another day');
  eq(QJZ.day.onExit(r,new Date(2026,10,12,2,0).getTime()).lastLockMs,new Date(2026,10,12,2,0).getTime(),'02:00 still belongs to the day');
  eq(QJZ.day.onExit(r,null).lastLockMs,null); eq(QJZ.day.onExit(r,'900').lastLockMs,null); eq(QJZ.day.onExit(r,NaN).lastLockMs,null);
  eq(QJZ.day.onExit(QJZ.day.empty(D),T(900)).lastLockMs,null,'never started'); });
test('rollover returns the same day unchanged', function(){ var r=started(510); var x=QJZ.day.rollover(r,T(600)); eq(x.closed,null); eq(x.current.startMs,T(510)); });
test('clock moving backwards does not roll over', function(){ var r=started(510); var x=QJZ.day.rollover(r,new Date(2026,10,10,10,0).getTime()); eq(x.closed,null); eq(x.current.startMs,T(510)); eq(x.current.day,D); });
})();
