(function () {
var SETTINGS_50000 = QJZ.settings.parse('{"salary":{"amount":50000}}').settings;
test('month total sums closed days plus today', function(){ var h={version:1,days:{'2026-11-10':{day:'2026-11-10',earned:2272.73},'2026-10-31':{day:'2026-10-31',earned:999}}};
  near(QJZ.history.monthTotal(h,'2026-11',{day:'2026-11-11'},1231.61),3504.34,0.001); });
test('monthTotals newest first', function(){ var t=QJZ.history.monthTotals({version:1,days:{'2026-10-01':{day:'2026-10-01',earned:10},'2026-11-01':{day:'2026-11-01',earned:20}}}); eq(t[0].month,'2026-11'); });
test('closeDay without end uses the 8h cap', function(){ var r=QJZ.history.closeDay({day:'2026-11-11',startMs:QJZ.time.atMinutes('2026-11-11',510),endMs:null},SETTINGS_50000); near(r.earned,2272.73,0.01); });
test('milestones and snacks', function(){ eq(QJZ.rewards.milestones(1231.61,100),12); eq(QJZ.rewards.snacksAvailable({snacksEaten:5},1231.61,100),7); eq(QJZ.rewards.itemCount(1231.61,{price:65}),'18.9'); });
test('corrupt history', function(){ var p=QJZ.history.parse('[]x'); eq(p.corrupted,true); eq(Object.keys(p.history.days).length,0); });

test('history parse: empty / null / array / number are empty and not corrupted', function(){
  var inputs=[null,'','  ','null','[]','7','"x"'];
  for (var i=0;i<inputs.length;i++){ var p=QJZ.history.parse(inputs[i]); eq(p.corrupted,false,'input '+inputs[i]); eq(p.history,{version:1,days:{}},'input '+inputs[i]); } });
test('history parse drops non-object day entries', function(){
  var p=QJZ.history.parse('{"version":1,"days":{"2026-11-10":{"earned":5},"2026-11-09":null,"2026-11-08":3,"2026-11-07":"x","2026-11-06":[1],"junk":{"earned":1}}}');
  eq(Object.keys(p.history.days),['2026-11-10']); eq(p.history.days['2026-11-10'].day,'2026-11-10'); eq(p.corrupted,false); });
test('history parse: days not an object gives empty', function(){ eq(QJZ.history.parse('{"days":[1,2]}').history.days,{}); eq(QJZ.history.parse('{"days":5}').history.days,{}); });
test('history parse nulls out non-numeric earned', function(){ eq(QJZ.history.parse('{"days":{"2026-11-10":{"earned":"abc"}}}').history.days['2026-11-10'].earned,null); });
test('closeDay uses manual end and does not mutate', function(){
  var rec={day:'2026-11-11',startMs:QJZ.time.atMinutes('2026-11-11',510),endMs:QJZ.time.atMinutes('2026-11-11',960),earned:null};
  var r=QJZ.history.closeDay(rec,SETTINGS_50000); near(r.earned,6.5*3600*50000/22/8/3600,0.01); eq(rec.earned,null); });
test('closeDay with no start earns 0', function(){ eq(QJZ.history.closeDay({day:'2026-11-11',startMs:null,endMs:null},SETTINGS_50000).earned,0); });
test('monthTotal does not double count today, ignores other months', function(){
  var h={version:1,days:{'2026-11-11':{day:'2026-11-11',earned:100},'2026-11-10':{day:'2026-11-10',earned:50}}};
  near(QJZ.history.monthTotal(h,'2026-11',{day:'2026-11-11'},30),80,1e-9);
  near(QJZ.history.monthTotal(h,'2026-11',null,0),150,1e-9);
  near(QJZ.history.monthTotal(h,'2026-12',{day:'2026-11-11'},30),0,1e-9); });
test('monthDays sorted ascending', function(){
  var h={version:1,days:{'2026-11-10':{earned:2},'2026-11-02':{earned:1},'2026-10-30':{earned:9}}};
  eq(QJZ.history.monthDays(h,'2026-11'),[{day:'2026-11-02',earned:1},{day:'2026-11-10',earned:2}]); });
test('rewards edge cases', function(){
  eq(QJZ.rewards.milestones(99.99,100),0); eq(QJZ.rewards.milestones(-5,100),0); eq(QJZ.rewards.milestones(500,0),0);
  eq(QJZ.rewards.snacksAvailable({snacksEaten:20},1231.61,100),0); eq(QJZ.rewards.snacksAvailable({},250,100),2);
  eq(QJZ.rewards.itemCount(0,{price:65}),'0.0'); eq(QJZ.rewards.itemCount(100,{price:0}),'0.0'); });
})();
