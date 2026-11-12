window.QJZ = window.QJZ || {};
// The prompt arbiter (spec 4.9, 5.1-5.3). Pure: holds at most one bubble, queues, merges and answers.
//   Q = {prompt:null|Prompt, noticeReadyAt, remindReadyAt, waveAt}
//   Prompt = {kind:'both'|'sit'|'water'|'break'|'breakEnd', water:boolean, shownMs}
//   A ready-at of null means "blocked right now": the 3 s gate starts on the first step it is no longer blocked.
QJZ.prompt = (function () {
  var GATE_MS = 3000, WAVE_MS = 120000;
  var LINES = {
    both: ['起來動一動，順便喝口水～', '坐好久了～起來倒杯水吧！', '起來走走，順便把水杯裝滿～', '伸個懶腰、喝口水，再繼續加油！', '該起來囉～去裝杯水回來吧！'],
    sit: ['坐好久了，起來動一動！', '屁股要長香菇了～起來走走吧！', '起來伸個懶腰吧～', '站起來動一動，等等腦袋更清楚！', '該讓椅子休息一下囉～'],
    water: ['喝口水吧～', '水杯空了嗎？補一杯吧～', '補充水分，工作才有精神！', '咕嚕咕嚕～一起喝水吧！', '記得喝水，皮膚才會水噹噹～']
  };
  var LABELS = { drink: '喝了', up: '起來了', later: '等一下', ok: '好', skip: '跳過休息', next: '開始', stop: '先不要' };
  var ICONS = { both: 'stand', sit: 'stand', water: 'drop', break: 'rest', breakEnd: 'tom' };

  function isNotice(p) { return p.kind === 'break' || p.kind === 'breakEnd'; }
  function make(q, o) {
    return { prompt: 'prompt' in o ? o.prompt : q.prompt, noticeReadyAt: 'noticeReadyAt' in o ? o.noticeReadyAt : q.noticeReadyAt,
      remindReadyAt: 'remindReadyAt' in o ? o.remindReadyAt : q.remindReadyAt, waveAt: 'waveAt' in o ? o.waveAt : q.waveAt };
  }
  function initial() { return { prompt: null, noticeReadyAt: 0, remindReadyAt: 0, waveAt: 0 }; }

  function wanted(c) {
    if (c.blocked) return null;
    if (c.notice === 'break' || c.notice === 'breakEnd') return { kind: c.notice, water: c.notice === 'break' && !!c.noticeWater && !!c.working };
    if (c.working && !c.focus && c.due && c.due.due) return { kind: c.due.sit && c.due.water ? 'both' : (c.due.sit ? 'sit' : 'water'), water: false };
    return null;
  }

  function step(q, c) {
    var now = c.nowMs, nr = q.noticeReadyAt, rr = q.remindReadyAt, events = [], pr = q.prompt, waveAt = q.waveAt;
    // Gates: held while blocked (notice) or blocked/focus (reminder); 3 s after the hold ends.
    if (c.blocked) nr = null; else if (nr === null) nr = now + GATE_MS;
    if (c.blocked || c.focus) rr = null; else if (rr === null) rr = now + GATE_MS;
    var w = wanted(c);
    function show(p) { pr = { kind: p.kind, water: p.water, shownMs: now }; waveAt = now; events.push({ type: 'show', prompt: pr }); }
    function hide() { pr = null; nr = c.blocked ? null : now + GATE_MS; rr = c.blocked || c.focus ? null : now + GATE_MS; events.push({ type: 'hide', quiet: true }); }
    if (pr) {
      if (!w) hide();
      else if (isNotice(w)) {
        if (!isNotice(pr) || pr.kind !== w.kind) { hide(); show(w); }
        else if (pr.water !== w.water) { pr = { kind: pr.kind, water: w.water, shownMs: pr.shownMs }; events.push({ type: 'update', prompt: pr }); }
      } else if (isNotice(pr)) hide();
      else if (pr.kind !== w.kind) { pr = { kind: w.kind, water: false, shownMs: pr.shownMs }; events.push({ type: 'update', prompt: pr }); }
      if (pr && now >= waveAt + WAVE_MS && events.length === 0) {
        waveAt = pr.shownMs + Math.floor((now - pr.shownMs) / WAVE_MS) * WAVE_MS;
        events.push({ type: 'wave', prompt: pr });
      }
    } else if (w && now >= (isNotice(w) ? nr : rr)) show(w);
    return { q: { prompt: pr, noticeReadyAt: nr, remindReadyAt: rr, waveAt: waveAt }, events: events };
  }

  function buttonsFor(p) {
    if (p.kind === 'both') return ['drink', 'up', 'later'];
    if (p.kind === 'sit') return ['up', 'later'];
    if (p.kind === 'water') return ['drink', 'later'];
    if (p.kind === 'break') return p.water ? ['ok', 'drink', 'skip'] : ['ok', 'skip'];
    return ['next', 'stop'];
  }
  var EFFECTS = {
    both: { drink: ['standup', 'drink'], up: ['standup'], later: ['snooze'] },
    sit: { up: ['standup'], later: ['snooze'] },
    water: { drink: ['standup', 'drink'], later: ['snooze'] },
    break: { ok: ['ackNotice'], skip: ['ackNotice', 'skipBreak'], drink: ['ackNotice', 'drink'] },
    breakEnd: { next: ['ackNotice', 'nextFocus'], stop: ['ackNotice', 'stopPomodoro'] }
  };

  // The bubble closes on every answer that has effects; the caller hides it. Anything else changes nothing.
  function answer(q, buttonId, nowMs) {
    var p = q.prompt;
    if (!p || buttonsFor(p).indexOf(buttonId) < 0) return { q: q, effects: [] };
    return { q: make(q, { prompt: null, noticeReadyAt: nowMs + GATE_MS, remindReadyAt: nowMs + GATE_MS }), effects: EFFECTS[p.kind][buttonId].slice() };
  }

  function view(p, v) {
    v = v || {};
    var buttons = buttonsFor(p).map(function (id) { return { id: id, label: LABELS[id] }; });
    var title, sub = '', waterLine = null;
    if (p.kind === 'break') {
      title = (v.long ? '長休息 ' : '休息 ') + v.breakMin + ' 分鐘！起來走走～'; sub = '第 ' + v.done + ' 顆番茄完成'; waterLine = p.water ? '順便喝口水吧～' : null;
    } else if (p.kind === 'breakEnd') title = '休息結束～要開始下一顆嗎？';
    else {
      var n = LINES[p.kind].length; title = LINES[p.kind][(((v.turn | 0) % n) + n) % n];
      if (p.kind === 'both') sub = '已經坐 ' + v.min + ' 分鐘囉・今天 ' + v.cups + '/' + v.cupGoal + ' 杯';
      else if (p.kind === 'sit') sub = '已經坐 ' + v.min + ' 分鐘囉';
      else sub = '今天 ' + v.cups + ' 杯，目標 ' + v.cupGoal + ' 杯';
    }
    return { kind: p.kind, icon: ICONS[p.kind], title: title, sub: sub, waterLine: waterLine, buttons: buttons };
  }

  return { initial: initial, step: step, answer: answer, view: view, LINES: LINES, GATE_MS: GATE_MS, WAVE_MS: WAVE_MS };
})();
