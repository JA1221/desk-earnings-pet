(function () {
var P = function (t) { return QJZ.settings.parse(t); };
test('parse null gives defaults', function(){ var p=QJZ.settings.parse(null); eq(p.settings.salary.divisor,22); eq(p.settings.layout.start,'U1'); eq(p.corrupted,false); });
test('broken json gives defaults and flags corrupted', function(){ var p=QJZ.settings.parse('{bad json'); eq(p.corrupted,true); eq(p.settings.milestone,100); });
test('wrong types fall back', function(){ var s=QJZ.settings.parse('{"salary":{"amount":"abc"},"hoursPerDay":-3}').settings; eq(s.salary.amount,0); eq(s.hoursPerDay,8); });
test('partial settings keep defaults elsewhere', function(){ var s=QJZ.settings.parse('{"salary":{"mode":"hourly","amount":200}}').settings; eq(s.salary.divisor,22); eq(s.items.length,3); });
test('salary validation', function(){ var v=QJZ.settings.validateSalary;
  eq(v('').error,'請輸入薪資'); eq(v('0').error,'薪資要大於 0'); eq(v('-5').error,'薪資要大於 0');
  eq(v('abc').error,'請輸入數字'); eq(v('1e12').error,'請輸入數字'); eq(v('50,000').value,50000); eq(v('12345678').error,'金額太大了'); });

test('empty, null-ish, non-object json give defaults and are not corrupted', function(){
  var inputs=['', '   ', 'null', '[]', '[1,2]', '42', '"text"', 'true', undefined];
  for (var i=0;i<inputs.length;i++){ var p=P(inputs[i]); eq(p.corrupted,false,'input '+inputs[i]); eq(p.settings,QJZ.settings.DEFAULTS,'input '+inputs[i]); } });
test('parse returns a fresh copy, not DEFAULTS itself', function(){ var p=P(null).settings; p.items.push({name:'x',price:1,icon:''}); p.salary.amount=5; eq(QJZ.settings.DEFAULTS.items.length,3); eq(QJZ.settings.DEFAULTS.salary.amount,0); });
test('valid settings round trip', function(){ var s=P('{"salary":{"mode":"hourly","amount":200,"divisor":30},"hoursPerDay":7.5,"workDays":[1,3],"pet":{"kind":"cat","skin":"s5"},"milestone":50,"onboarded":true}').settings;
  eq(s.salary,{mode:'hourly',amount:200,divisor:30}); eq(s.hoursPerDay,7.5); eq(s.workDays,[1,3]); eq(s.pet.kind,'cat'); eq(s.pet.skin,'s5'); eq(s.milestone,50); eq(s.onboarded,true); });
test('skin not allowed for the pet falls back', function(){ eq(P('{"pet":{"kind":"cat","skin":"s6"}}').settings.pet.skin,'p0'); eq(P('{"pet":{"kind":"hamster","skin":"k6"}}').settings.pet.skin,'p0'); });
test('the cat H2 and S4 skins are kept', function(){ eq(P('{"pet":{"kind":"cat","skin":"h2"}}').settings.pet.skin,'h2'); eq(P('{"pet":{"kind":"cat","skin":"s4"}}').settings.pet.skin,'s4'); });
test('bad lunch, divisor, layout and items fall back', function(){
  var s=P('{"lunch":{"start":"noon","end":"13:00"},"salary":{"divisor":7},"layout":{"start":"X9"},"items":[{"name":"","price":5},{"name":"a","price":"b"},3]}').settings;
  eq(s.lunch,{start:'12:00',end:'13:00'}); eq(s.salary.divisor,22); eq(s.layout.start,'U1'); eq(s.items.length,3); });
test('valid items are kept, invalid ones dropped', function(){ var s=P('{"items":[{"name":"咖啡","price":50,"icon":"c"},{"name":"bad","price":0}]}').settings; eq(s.items,[{name:'咖啡',price:50,icon:'c'}]); });
test('workDays sanitised', function(){ eq(P('{"workDays":[5,1,1,9,"x",2.5]}').settings.workDays,[1,5]); eq(P('{"workDays":"mon"}').settings.workDays,[1,2,3,4,5]); });

test('validateSalary trims spaces', function(){ var v=QJZ.settings.validateSalary; eq(v('  50000  ').value,50000); eq(v('　500　').value,500); eq(v('   ').error,'請輸入薪資'); });
test('validateSalary accepts full-width digits', function(){ var v=QJZ.settings.validateSalary; eq(v('５００００').value,50000); eq(v('５０，０００').value,50000); eq(v(' ３５．５ ').value,35.5); });
test('validateSalary boundaries and odd input', function(){ var v=QJZ.settings.validateSalary;
  eq(v('10000000').value,10000000); eq(v('10000001').error,'金額太大了'); eq(v('1').value,1); eq(v('12.5').value,12.5);
  eq(v('.').error,'請輸入數字'); eq(v('5,00').error,'請輸入數字'); eq(v('1 000').error,'請輸入數字'); eq(v('NaN').error,'請輸入數字'); eq(v('Infinity').error,'請輸入數字'); eq(v(null).error,'請輸入薪資'); });
// 1.1 adds display.powerSaver (省電模式, §5.9) beside it, default off.
test('display.opaque (相容模式) defaults to false and is sanitised', function(){
  eq(P(null).settings.display,{opaque:false,powerSaver:false}); eq(P('{"display":{"opaque":true}}').settings.display,{opaque:true,powerSaver:false});
  eq(P('{"display":{"opaque":"yes"}}').settings.display.opaque,false); eq(P('{"display":5}').settings.display,{opaque:false,powerSaver:false});
  eq(P('{"display":{"powerSaver":true}}').settings.display,{opaque:false,powerSaver:true}); eq(P('{"display":{"powerSaver":1}}').settings.display.powerSaver,false); });
// #12: the app starts in the last used layout: layout.current, or M3 when layout.mini. 1.0's layout.start is kept as
// it is (unused), and an upgrade changes no value: it only adds layout.mini (false).
test('layout.mini (left as the mini badge) defaults to false and is sanitised; layout.start is kept', function(){
  eq(P(null).settings.layout.mini,false); eq(P(null).settings.layout.start,'U1');
  eq(P('{"layout":{"mini":true}}').settings.layout.mini,true); eq(P('{"layout":{"mini":"yes"}}').settings.layout.mini,false);
  eq(P('{"layout":{"start":"U7","current":"U3"}}').settings.layout.start,'U7','kept, unused'); });
// 1.1 (§5.5): the new keys come in at their defaults (the reminders off, not asked yet); no 1.0 value changes.
test('an old 1.0 settings.json reads back with every value unchanged (only layout.mini and the 1.1 defaults added)', function(){
  var old={version:1,salary:{mode:'hourly',amount:183.5,divisor:30},hoursPerDay:7.5,lunch:{start:'12:30',end:'13:30'},startMode:'manual',
    workDays:[1,2,3,4,5,6],pet:{kind:'cat',skin:'s4',names:{cat:'咪咪',hamster:'倉倉'}},
    layout:{start:'U7',current:'U3',topmost:{U1:true,U3:false,U5B:true,U7:false,M3:false}},milestone:250,
    items:[{name:'咖啡',price:55,icon:'☕'}],sound:{enabled:true,volume:0.3},autostart:false,
    privacy:{hideFromCapture:false,hotkey:'Ctrl+Alt+J'},display:{opaque:true},onboarded:true};
  var s=P(JSON.stringify(old)).settings, want=JSON.parse(JSON.stringify(old));
  want.layout.mini=false;
  want.layout.topmost.U10=true; want.layout.topmost.U12=false; want.layout.topmost.U13=false; want.layout.capsule='top';
  want.display.powerSaver=false;
  want.health={asked:false,every:50,sit:{on:false},water:{on:false,goal:8},pomodoro:{focus:25,short:5,long:15,longEvery:4}};
  eq(s,want); });
// Review M-2: a 1.0 user who picked 開啟時的版型 = 迷你徽章 (layout.start 'M3') keeps opening in the mini badge: a file
// without layout.mini gets mini = (start === 'M3'). A mini that is there wins; no other value changes.
test('layout.mini comes from a 1.0 start layout of M3 when the file has no mini', function(){
  eq(P('{"layout":{"start":"M3","current":"U3"}}').settings.layout,
    {start:'M3',current:'U3',topmost:QJZ.settings.DEFAULTS.layout.topmost,mini:true,capsule:'top'});
  eq(P('{"layout":{"start":"M3","current":"U3","mini":false}}').settings.layout.mini,false,'a saved mini wins');
  eq(P('{"layout":{"start":"M3","mini":"yes"}}').settings.layout.mini,false,'a mini that is there but not a boolean: false, as before');
  eq(P('{"layout":{"start":"U7","current":"U1"}}').settings.layout.mini,false);
  eq(P('{"layout":{"start":"m3"}}').settings.layout.mini,false,'only a valid M3');
  var old={version:1,salary:{mode:'monthly',amount:42000,divisor:22},layout:{start:'M3',current:'U1',topmost:{U1:false,U3:true,U5B:false,U7:true,M3:false}},
    milestone:100,onboarded:true};
  var s=P(JSON.stringify(old)).settings;
  eq(s.layout,{start:'M3',current:'U1',topmost:{U1:false,U3:true,U5B:false,U7:true,M3:false,U10:true,U12:false,U13:false},mini:true,capsule:'top'},
    'start and topmost kept (1.1 adds its layouts and the capsule dock at their defaults)');
  eq([s.salary,s.milestone,s.onboarded],[old.salary,100,true]); });
test('skinsFor', function(){ eq(QJZ.settings.skinsFor('hamster'),['p0','p4','h2','s4','s5']); eq(QJZ.settings.skinsFor('cat'),['p0','p4','h2','s4','s5']); });
test('workDays: all-invalid non-empty falls back, empty stays empty, numeric sort', function(){
  eq(P('{"workDays":[9,"x"]}').settings.workDays,[1,2,3,4,5]); eq(P('{"workDays":[]}').settings.workDays,[]); eq(P('{"workDays":[6,0,3]}').settings.workDays,[0,3,6]); });

// ---- 1.1 (§4.9, §5.4, §5.5) ----
test('settings: health defaults and the derived goals (§4.9, §5.4)', function () {
  var d = QJZ.settings.parse(null).settings;
  eq(d.health, { asked: false, every: 50, sit: { on: false }, water: { on: false, goal: 8 }, pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4 } });
  eq(QJZ.settings.standGoal(d), 9); eq(QJZ.settings.tomatoGoal(d), 4);
  eq(QJZ.settings.standGoal(QJZ.settings.parse('{"hoursPerDay":7.5}').settings), 9); eq(QJZ.settings.standGoal(QJZ.settings.parse('{"health":{"every":120}}').settings), 4);
  eq(QJZ.settings.standGoal(QJZ.settings.parse('{"health":{"every":20}}').settings), 24);
});
test('settings: health ranges and steps', function () {
  function h(o) { return QJZ.settings.parse(JSON.stringify({ health: o })).settings.health; }
  eq(h({ every: 53 }).every, 55); eq(h({ every: 52 }).every, 50); eq(h({ every: 10 }).every, 20); eq(h({ every: 500 }).every, 120); eq(h({ every: '50' }).every, 50);
  eq(h({ water: { goal: 0 } }).water.goal, 1); eq(h({ water: { goal: 8.6 } }).water.goal, 9); eq(h({ water: { goal: 99 } }).water.goal, 20);
  eq(h({ pomodoro: { focus: 7 } }).pomodoro.focus, 10); eq(h({ pomodoro: { focus: 93 } }).pomodoro.focus, 90);
  eq(h({ pomodoro: { short: 0 } }).pomodoro.short, 1); eq(h({ pomodoro: { short: 31 } }).pomodoro.short, 30);
  eq(h({ pomodoro: { long: 7 } }).pomodoro.long, 5); eq(h({ pomodoro: { long: 62 } }).pomodoro.long, 60);
  eq(h({ pomodoro: { longEvery: 1 } }).pomodoro.longEvery, 2); eq(h({ pomodoro: { longEvery: 9 } }).pomodoro.longEvery, 8);
  eq(h({ sit: { on: 'yes' } }).sit.on, false); eq(h({ asked: 1 }).asked, false); eq(h([]).every, 50);
});
test('settings: new layouts, the stored capsule dock, 省電模式', function () {
  var d = QJZ.settings.parse(null).settings;
  eq([d.layout.topmost.U10, d.layout.topmost.U12, d.layout.topmost.U13, d.layout.capsule, d.display.powerSaver], [true, false, false, 'top', false]);
  eq(QJZ.settings.parse('{"layout":{"capsule":"bottomRight"}}').settings.layout.capsule, 'bottomRight');
  eq(QJZ.settings.parse('{"layout":{"capsule":"left"}}').settings.layout.capsule, 'top');
  ok(['U10', 'U12', 'U13'].every(function (l) { return QJZ.settings.LAYOUTS.indexOf(l) >= 0; }));
});
test('settings: saved 1.1 values read back unchanged (health, the new layouts, every dock)', function () {
  var H = { asked: true, every: 35, sit: { on: true }, water: { on: true, goal: 12 }, pomodoro: { focus: 45, short: 10, long: 30, longEvery: 3 } };
  eq(P(JSON.stringify({ health: H })).settings.health, H);
  var lay = P('{"layout":{"current":"U12","topmost":{"U10":false,"U12":true,"U13":"yes"}}}').settings.layout;
  eq([lay.current, lay.topmost.U10, lay.topmost.U12, lay.topmost.U13], ['U12', false, true, false], 'a non-boolean topmost keeps the default');
  eq(QJZ.settings.DOCKS, ['top', 'bottomLeft', 'bottomCenter', 'bottomRight']);
  QJZ.settings.DOCKS.forEach(function (k) { eq(P(JSON.stringify({ layout: { capsule: k } })).settings.layout.capsule, k); });
});
test('settings: a 1.0 settings.json keeps every value; reminders stay off until asked', function () {
  function onlyKeysOf(v, shape) {   // v restricted to the keys the 1.0 file has
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return v;
    var o = {}; for (var k in shape) o[k] = onlyKeysOf(v[k], shape[k]); return o;
  }
  var old = JSON.parse(V10.settings), s = QJZ.settings.parse(V10.settings).settings;
  eq(onlyKeysOf(s, old), old); eq([s.health.asked, s.health.sit.on, s.health.water.on], [false, false, false]);
});
})();
