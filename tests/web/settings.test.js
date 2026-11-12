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
test('skin not allowed for the pet falls back', function(){ eq(P('{"pet":{"kind":"cat","skin":"h2"}}').settings.pet.skin,'p0'); });
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
test('display.opaque (相容模式) defaults to false and is sanitised', function(){
  eq(P(null).settings.display,{opaque:false}); eq(P('{"display":{"opaque":true}}').settings.display,{opaque:true});
  eq(P('{"display":{"opaque":"yes"}}').settings.display.opaque,false); eq(P('{"display":5}').settings.display,{opaque:false}); });
test('skinsFor', function(){ eq(QJZ.settings.skinsFor('hamster'),['p0','p4','h2','s4','s5']); eq(QJZ.settings.skinsFor('cat'),['p0','p4','s5']); });
test('workDays: all-invalid non-empty falls back, empty stays empty, numeric sort', function(){
  eq(P('{"workDays":[9,"x"]}').settings.workDays,[1,2,3,4,5]); eq(P('{"workDays":[]}').settings.workDays,[]); eq(P('{"workDays":[6,0,3]}').settings.workDays,[0,3,6]); });
})();
