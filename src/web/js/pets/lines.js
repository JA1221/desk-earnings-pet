window.QJZ = window.QJZ || {};
// What the pet says (spec §4.6 對話泡泡): cheering, a little teasing, by state, time of day, money and mood.
// pick(state, ctx) -> a filled line, or '' for a state without lines.
//   ctx = {name, kind:'cat'|'hamster', minutesToLunch, minutesToEnd, earned, rng, items, step (milestone NT$),
//          gained (snacks earned while hidden), hour (0..23), energy, mood, off (a day off)}; every field is optional.
// Templates: '{x}' placeholders, and an optional leading [tag] that limits when a line can come up.
//   {name} pet name   {s} 喵 / 吱   {food} 小魚乾 / 瓜子   {n} minutes to lunch (1..60)   {m} minutes to the end (1..30)
//   {left} time to the end (over 30 minutes)   {item} what today's money buys ("兩杯珍奶", " 3 個便當")
//   {money} today's money (from NT$100)   {step} the milestone amount   {k} / {gain} snacks ('一', '兩', ' 3 ') / NT$
//   earned while hidden
//   [pre] a work day   [off] a day off   [am] before 11:00   [pm] 13:00–17:00   [eve] from 17:00
//   [tired] energy < 40   [low] mood < 40   [glad] mood >= 80
// A line comes up only when all of its placeholders can be filled; time, money and tagged lines weigh double.
// The output is plain text: callers insert it with textContent (layouts.say does).
QJZ.lines = (function () {
  var SOUND = { cat: '喵', hamster: '吱' };
  var NAME = { cat: '小橘', hamster: '金金' };
  var FOOD = { cat: '小魚乾', hamster: '瓜子' };
  var BASE = ['idle', 'typing', 'sprint', 'lunchSleep', 'celebrate', 'waitBag'];
  var DEFAULT_ITEMS = [{ name: '珍奶', price: 65 }, { name: '便當', price: 100 }, { name: '拿鐵', price: 120 }];

  var SHARED = {
    idle: [
      '[pre]早安{s}！今天也一起加油吧！',
      '[pre]{name}已經準備好陪你上班了{s}！',
      '[pre]還沒開始算錢，先發呆一下{s}～',
      '[pre]準備好就開工吧，{name}幫你加油{s}！',
      '[pre]今天一定會是順利的一天{s}！',
      '[off]今天休假！好好放鬆一下{s}～',
      '[off]休假日就是要耍廢{s}～',
      '[off]不用工作的日子最棒了{s}！',
      '[off]今天{name}陪你一起發呆{s}～',
      '[off]出去走走、曬曬太陽吧{s}！',
      '發呆中…腦袋放空{s}～',
      '嗯？你在看{name}嗎{s}？',
      '今天天氣怎麼樣呀{s}？'
    ],
    doze: [
      '呼…呼…{s}…',
      'Zzz…再五分鐘就好…',
      '眼皮好重{s}…',
      '我沒有在睡喔{s}！只是閉目養神…',
      '（點頭）…啊！我醒著{s}！'
    ],
    typing: [
      '認真工作中{s}！',
      '喀啦喀啦，打字打字{s}～',
      '你今天很努力喔，{name}都有看到{s}！',
      '每一秒都在賺錢{s}！',
      '專心模式開啟{s}！',
      '一起加油{s}！你超棒的！',
      '慢慢來，比較快{s}～',
      '記得喝水喔{s}！',
      '再 {n} 分鐘就午休了！',
      '午休倒數 {n} 分鐘，肚子開始叫了{s}～',
      '距離下班還有 {left}，穩穩來{s}！',
      '已經賺到{item}了！',
      '今天已經賺了 NT$ {money}，好厲害{s}！',
      '[am]早上頭腦最清楚，衝一波{s}！',
      '[pm]下午有點想睡…撐住{s}！',
      '[tired]有點累了，起來動一動吧{s}～',
      '[low]工作之餘也摸摸{name}嘛{s}…',
      '[glad]今天心情超好{s}！'
    ],
    sprint: [
      '最後衝刺{s}！',
      '再 {m} 分鐘就下班了！',
      '倒數 {m} 分鐘，撐住{s}！',
      '收尾收尾～包包可以先整理了{s}！',
      '快下班了，手速加快{s}！',
      '終點就在眼前了{s}！',
      '今天的工作快要完成了{s}！',
      '[tired]最後一點點，{name}陪你撐住{s}！'
    ],
    lunchEat: [
      '開動了{s}！',
      '便當好好吃{s}～',
      '吃飽才有力氣繼續拚{s}！',
      '午餐時間最幸福了{s}～',
      '嚼嚼嚼…好香{s}～'
    ],
    lunchSleep: [
      'Zzz…午休中，請勿打擾{s}…',
      '呼…再睡五分鐘就好…',
      '夢到領薪水了{s}…嘿嘿…',
      '睡飽下午才有精神{s}…',
      '（小聲）大家都在午睡…',
      '…便當…還要一個…Zzz',
      '下午再一起努力{s}…呼…'
    ],
    celebrate: [
      '可以下班了{s}！',
      '下班囉！今天辛苦了{s}！',
      '今天的 NT$ {money} 全部入袋{s}！',
      '耶～工作完成{s}！',
      '你今天超棒的，{name}幫你撒花{s}！',
      '收工！今天也平安度過了{s}！'
    ],
    waitBag: [
      '可以走了！',
      '包包背好了，可以走了{s}！',
      '還不走嗎？{name}在等你喔{s}～',
      '回家好好休息吧{s}！',
      '別加班啦，明天再說{s}！',
      '今天賺到{item}，回家路上犒賞自己一下吧{s}！',
      '快點快點，回家囉{s}！',
      '[eve]晚餐要吃什麼呢{s}？'
    ],
    stretch: ['伸～懶～腰～{s}', '坐太久了，動一動{s}！', '嗯～～舒服{s}！', '你也起來伸展一下吧{s}！'],
    yawn: ['哈啊～好睏{s}…', '打個哈欠，繼續努力{s}…', '眼睛快閉起來了{s}…', '[tired]體力剩一點點了{s}…'],
    coffee: ['補充咖啡因{s}！', '喝口咖啡，續命中{s}～', '咖啡好香{s}～', '你要不要也來一杯{s}？'],
    stare: ['盯——', '這行到底哪裡怪怪的{s}…', '螢幕上的字在跳舞{s}…', '專心盯著螢幕中{s}！'],
    scratch: ['嗯…這個要怎麼弄{s}？', '想不通{s}…', '等等，剛剛做到哪了{s}？', '再想一下就會了{s}！'],
    petted: ['嘿嘿，被摸摸了{s} ♡', '摸頭充電中{s}～', '最喜歡你了{s} ♡', '再摸一下嘛{s}～', '心情變好了{s}！'],
    angry: ['不要一直戳啦{s}！', '哼！生氣了{s}！', '再戳就不理你了{s}！', '鼓起臉頰中…哼{s}！', '讓我冷靜一下{s}…'],
    eat: ['謝謝你的{food}{s}！', '嚼嚼嚼…好好吃{s}～', '吃飽飽，繼續陪你上班{s}！', '{food}最棒了{s}！'],
    hop: ['叮！又賺到 NT$ {step} 了{s}！', '又達成一個里程碑{s}！', '又多一份{food}可以吃了{s}！', '存錢筒又變重了{s}！', '錢錢進來了{s}！'],
    dangle: ['哇啊！放我下來{s}！', '要帶我去哪裡{s}？', '好高喔…有點怕怕{s}', '輕一點、輕一點{s}！', '飛起來了{s}～'],
    missed: ['剛剛又賺到 NT$ {gain} 了{s}！', '歡迎回來！{food}又多了{k}份{s}～', '你不在的時候也有在賺錢喔{s}！']
  };
  var KIND = {
    cat: {
      idle: ['舔舔毛，整理一下儀容喵～', '想要罐罐喵…'],
      typing: ['鍵盤好溫暖，好想躺上去喵…', '尾巴也在幫你打氣喵！'],
      sprint: ['衝刺！貓咪也要全速前進喵！'],
      lunchEat: ['有魚嗎？有魚嗎喵？'],
      lunchSleep: ['呼嚕…呼嚕…'],
      waitBag: ['回家記得開罐罐喵！'],
      petted: ['呼嚕呼嚕～好舒服 ♡', '下巴也要摸喵～'],
      eat: ['好吃！是小魚乾喵！'],
      dangle: ['貓咪不是這樣抱的喵！']
    },
    hamster: {
      idle: ['先來跑一下滾輪吱！', '頰囊裡還有昨天的瓜子吱～'],
      typing: ['小爪爪打字超快吱！', '工作完再來吃瓜子吱～'],
      sprint: ['小短腿全速衝刺吱！'],
      lunchEat: ['飯糰先塞進頰囊…等等再吃吱！'],
      lunchSleep: ['縮成一團睡午覺吱…'],
      waitBag: ['回家要跑滾輪吱！'],
      petted: ['好癢喔吱～', '肚子也可以摸喔吱 ♡'],
      eat: ['瓜子！最愛瓜子了吱！', '先塞進頰囊存起來吱～'],
      dangle: ['腳腳懸空了吱！']
    }
  };
  var STATES = Object.keys(SHARED);
  var SPECIAL = { n: 1, m: 1, left: 1, item: 1, money: 1, step: 1, k: 1, gain: 1 };
  var TAGS = {
    pre: function (c) { return !c.off; },
    off: function (c) { return !!c.off; },
    am: function (c) { return c.hour < 11; },
    pm: function (c) { return c.hour >= 13 && c.hour < 17; },
    eve: function (c) { return c.hour >= 17; },
    tired: function (c) { return c.energy < 40; },
    low: function (c) { return c.mood < 40; },
    glad: function (c) { return c.mood >= 80; }
  };

  function kindOf(c) { return c && c.kind === 'cat' ? 'cat' : 'hamster'; }
  function templates(state, kind) {
    if (!Object.prototype.hasOwnProperty.call(SHARED, state)) return [];
    var k = kind === 'cat' ? 'cat' : 'hamster';
    return SHARED[state].concat(KIND[k][state] || []);
  }

  function amount(v) {
    var r = Math.round(v * 100) / 100;
    var s = r % 1 === 0 ? String(r) : r.toFixed(2);
    return s.replace(/^(\d+)/, function (d) { return d.replace(/\B(?=(\d{3})+(?!\d))/g, ','); });
  }
  function unit(name) {
    if (/便當|飯糰|漢堡|麵包|蛋糕|三明治|甜甜圈/.test(name)) return '個';
    if (/奶|茶|啡|鐵|飲|汁|可樂|酒|冰沙|水/.test(name)) return '杯';
    if (/麵|飯|湯|粥/.test(name)) return '碗';
    return '份';
  }
  function count(n) { return n === 1 ? '一' : n === 2 ? '兩' : ' ' + n + ' '; }
  function clock(min) {
    var t = Math.ceil(min), h = Math.floor(t / 60), m = t % 60;
    return h > 0 ? h + ' 小時' + (m ? ' ' + m + ' 分' : '') : m + ' 分鐘';
  }
  function itemText(c, probe) {
    var items = Array.isArray(c.items) ? c.items : DEFAULT_ITEMS, ok = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it && it.name && it.price > 0 && c.earned >= it.price) ok.push(it);
    }
    if (!ok.length) return null;
    if (probe) return '';
    var pick = ok[Math.floor((c.rng || Math.random)() * ok.length) % ok.length];
    return count(Math.floor(c.earned / pick.price)) + unit(pick.name) + pick.name;
  }

  // The text for a placeholder, or null when the context cannot fill it. probe: only whether it can (no rng use).
  function value(key, c, probe) {
    var kind = kindOf(c);
    switch (key) {
      case 'name': return typeof c.name === 'string' && c.name ? c.name : NAME[kind];
      case 's': return SOUND[kind];
      case 'food': return FOOD[kind];
      case 'n': return c.minutesToLunch > 0 ? String(Math.ceil(c.minutesToLunch)) : null;
      case 'm': return c.minutesToEnd > 0 ? String(Math.ceil(c.minutesToEnd)) : null;
      case 'left': return c.minutesToEnd > 0 ? clock(c.minutesToEnd) : null;
      case 'item': return c.earned > 0 ? itemText(c, probe) : null;
      case 'money': return c.earned >= 100 ? amount(Math.floor(c.earned)) : null;
      case 'step': return c.step > 0 ? amount(c.step) : null;
      case 'k': return c.gained >= 1 ? count(Math.floor(c.gained)) : null;
      case 'gain': return c.gained >= 1 && c.step > 0 ? amount(Math.floor(c.gained) * c.step) : null;
      default: return null;
    }
  }
  // Placeholders that fill but do not fit the moment: the lunch countdown only in the last hour, the end
  // countdown only in the last 30 minutes, the "time left" line only before that.
  function fits(key, c) {
    if (key === 'n') return Math.ceil(c.minutesToLunch) <= 60;
    if (key === 'm') return Math.ceil(c.minutesToEnd) <= 30;
    if (key === 'left') return c.minutesToEnd > 30;
    return true;
  }

  var TAG = /^\[(\w+)\]/, SLOT = /\{(\w+)\}/g;
  // A template filled from ctx, or null when a placeholder has no value. One pass: a name such as '{x}' stays text.
  function fill(t, c) {
    c = c || {};
    var miss = false;
    var out = t.replace(TAG, '').replace(SLOT, function (all, key) {
      var v = value(key, c);
      if (v === null) { miss = true; return all; }
      return v;
    });
    return miss ? null : out;
  }

  function pick(state, ctx) {
    var c = ctx || {}, list = templates(state, kindOf(c)), rng = c.rng || Math.random;
    var cands = [], weights = [], total = 0;
    for (var i = 0; i < list.length; i++) {
      var t = list[i], tag = TAG.exec(t), special = !!tag, usable = true;
      if (tag && !(TAGS[tag[1]] && TAGS[tag[1]](c))) continue;
      t.replace(SLOT, function (all, key) {
        if (value(key, c, true) === null || !fits(key, c)) usable = false;
        if (SPECIAL[key]) special = true;
        return all;
      });
      if (!usable) continue;
      cands.push(t); weights.push(special ? 2 : 1); total += special ? 2 : 1;
    }
    if (!cands.length) return '';
    var r = rng() * total;
    for (var j = 0; j < cands.length; j++) {
      r -= weights[j];
      if (r < 0) return fill(cands[j], c) || '';
    }
    return fill(cands[cands.length - 1], c) || '';
  }

  return { STATES: STATES, BASE: BASE, templates: templates, fill: fill, pick: pick };
})();
