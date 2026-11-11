(function () {
var D = '2026-11-11', L = { start: '12:00', end: '13:00' };
var T = function (m) { return QJZ.time.atMinutes(D, m); };
var SAL = { mode: 'monthly', amount: 50000, divisor: 22 };
function snap(start, end, now) {
  return QJZ.earn.snapshot({ startMs: start, endMs: end, nowMs: now, day: D, salary: SAL, hoursPerDay: 8, lunch: L });
}
test('monthly 50000 / 22 / 8h', function(){ var r=QJZ.earn.rates({mode:'monthly',amount:50000,divisor:22},8);
  near(r.daily,2272.727,0.001); near(r.hourly,284.0909,0.0001); near(r.perSecond,0.0789141,1e-7); });
test('divisor 30', function(){ near(QJZ.earn.rates({mode:'monthly',amount:30000,divisor:30},8).daily,1000,1e-9); });
test('hourly mode', function(){ var r=QJZ.earn.rates({mode:'hourly',amount:200,divisor:22},8); eq(r.hourly,200); eq(r.daily,1600); });
test('start 08:30 -> end 17:30', function(){ eq(QJZ.earn.endAtMs(T(8*60+30),D,8,L), T(17*60+30)); });
test('09:12 start, 14:32:07 now', function(){ var s=snap(T(9*60+12), null, T(14*60+32)+7000);
  eq(s.workedSec,15607); near(s.earned,1231.61,0.01); near(s.pct,0.5419,0.0001); eq(s.status,'working'); });
test('lunch is unpaid and paused', function(){ var s=snap(T(9*60), null, T(12*60+30)); eq(s.status,'lunch'); eq(s.workedSec,3*3600); });
test('start during lunch counts from 13:00', function(){ eq(snap(T(12*60+30),null,T(13*60+30)).workedSec,1800); });
test('start after lunch has no lunch deduction', function(){ eq(QJZ.earn.endAtMs(T(13*60+30),D,8,L), T(21*60+30)); });
test('clock earlier than start gives zero, not negative', function(){ var s=snap(T(9*60),null,T(8*60)); eq(s.workedSec,0); eq(s.earned,0); eq(s.status,'before'); });
test('now far past end caps at 8h', function(){ var s=snap(T(8*60+30),null,T(23*60)); eq(s.workedSec,28800); eq(s.status,'done'); eq(s.remainingSec,0); });
test('manual end at 16:00', function(){ var s=snap(T(8*60+30),T(16*60),T(18*60)); eq(s.workedSec,23400); eq(s.status,'ended'); });
test('dayKey before 04:00 is previous day', function(){ eq(QJZ.time.dayKey(new Date(2026,10,12,3,59).getTime()),'2026-11-11'); eq(QJZ.time.dayKey(new Date(2026,10,12,4,0).getTime()),'2026-11-12'); });

test('workedSeconds is 0 when until <= start', function(){
  eq(QJZ.earn.workedSeconds(T(540),T(540),D,L),0); eq(QJZ.earn.workedSeconds(T(540),T(500),D,L),0); });
test('workedSeconds never NaN on bad input', function(){
  eq(QJZ.earn.workedSeconds(null,T(500),D,L),0); eq(QJZ.earn.workedSeconds(T(500),NaN,D,L),0); });
test('malformed lunch counts as no lunch', function(){
  var bad=[{start:'abc',end:'13:00'},{start:'12:00',end:''},{start:null,end:undefined},null,{start:'12:00',end:'1300'}];
  for (var i=0;i<bad.length;i++){ eq(QJZ.earn.workedSeconds(T(9*60),T(15*60),D,bad[i]),6*3600); }
  eq(QJZ.earn.endAtMs(T(9*60),D,8,{start:'x',end:'y'}), T(17*60)); });
test('lunch end <= start counts as no lunch', function(){
  eq(QJZ.earn.workedSeconds(T(9*60),T(15*60),D,{start:'13:00',end:'12:00'}),6*3600);
  eq(QJZ.earn.workedSeconds(T(9*60),T(15*60),D,{start:'12:00',end:'12:00'}),6*3600); });
test('snapshot with malformed lunch has no NaN', function(){
  var s=QJZ.earn.snapshot({startMs:T(540),endMs:null,nowMs:T(600),day:D,salary:SAL,hoursPerDay:8,lunch:{start:'zz',end:'13:00'}});
  eq(s.workedSec,3600); ok(!isNaN(s.earned)); eq(s.status,'working'); });
test('manual end earlier than start gives 0 worked', function(){ var s=snap(T(9*60),T(8*60),T(18*60)); eq(s.workedSec,0); eq(s.earned,0); eq(s.status,'ended'); });
test('no start gives zero and status before', function(){ var s=snap(null,null,T(600)); eq(s.workedSec,0); eq(s.status,'before'); eq(s.endAtMs,null); });
test('weekday and parseHM', function(){ eq(QJZ.time.weekday('2026-11-11'),3); eq(QJZ.time.weekday('2026-11-15'),0);
  eq(QJZ.time.parseHM('12:30'),750); eq(QJZ.time.parseHM('xx'),NaN); eq(QJZ.time.parseHM(''),NaN); });
test('dayKey with custom boundary', function(){ eq(QJZ.time.dayKey(new Date(2026,10,12,5,0).getTime(),6),'2026-11-11'); });
})();
