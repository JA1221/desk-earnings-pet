// QJZ.panels: pure helpers (onboarding gating, validation glue, hotkey combos, history aggregation, the
// early-leave question), then the real panels inside the PANEL layout, driven by QJZ.app and QJZ.layouts with a
// fake bridge and a fake clock. 2026-11-12 is a Thursday, 11-11 a Wednesday, 11-09 a Monday.
(function () {
  var U = QJZ.panels.util;
  function at(d, h, m, s) { return new Date(2026, 10, d, h, m, s || 0, 0).getTime(); }
  function defaults(patch) { return QJZ.settings.parse(JSON.stringify(patch || {})).settings; }
  var READY = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true };

  // ---------- gating ----------
  test('panels: onboarding shows until a salary is set and 開始 was pressed', function () {
    ok(U.needsOnboarding(defaults()), 'fresh defaults');
    ok(U.needsOnboarding(defaults({ salary: { amount: 50000 } })), 'salary but never onboarded');
    ok(U.needsOnboarding(defaults({ onboarded: true })), 'onboarded but the salary is 0');
    ok(!U.needsOnboarding(defaults(READY)));
  });

  test('panels: the first panel: onboarding, else a pending early-leave question, else none', function () {
    var q = { day: '2026-11-11', lockMs: at(11, 15, 0) };
    eq(U.initialPanel({ settings: defaults(), pendingQuestion: q }), 'onboarding', 'onboarding first');
    eq(U.initialPanel({ settings: defaults(READY), pendingQuestion: q }), 'question');
    eq(U.initialPanel({ settings: defaults(READY), pendingQuestion: null }), null);
    eq(U.initialPanel(null), null);
  });

  // ---------- validation glue ----------
  test('panels: onboarding form -> settings patch, or the validateSalary error', function () {
    eq(U.onboardingPatch({ mode: 'monthly', amountText: 'abc', divisor: 22 }), { ok: false, error: '請輸入數字' });
    eq(U.onboardingPatch({ mode: 'monthly', amountText: '', divisor: 22 }), { ok: false, error: '請輸入薪資' });
    eq(U.onboardingPatch({ mode: 'monthly', amountText: '50,000', divisor: 22, pet: 'cat:p4', name: '阿橘' }), {
      ok: true,
      patch: { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, pet: { kind: 'cat', skin: 'p4', names: { cat: '阿橘' } }, onboarded: true }
    });
    eq(U.onboardingPatch({ mode: 'hourly', amountText: '１８３.５', divisor: 30, pet: 'hamster:h2', name: '  ' }), {
      ok: true,
      patch: { salary: { mode: 'hourly', amount: 183.5, divisor: 30 }, pet: { kind: 'hamster', skin: 'h2' }, onboarded: true }
    }, 'full-width digits; a blank name keeps the default');
    var p = U.onboardingPatch({ mode: 'weekly', amountText: '1000', divisor: 7, pet: 'dog:x' });
    eq(p.patch, { salary: { mode: 'monthly', amount: 1000, divisor: 22 }, onboarded: true }, 'unknown values fall back');
  });

  test('panels: other money fields reuse validateSalary with neutral wording', function () {
    eq(U.checkAmount(''), { ok: false, error: '請輸入金額' });
    eq(U.checkAmount('0'), { ok: false, error: '金額要大於 0' });
    eq(U.checkAmount('abc'), { ok: false, error: '請輸入數字' });
    eq(U.checkAmount('１２０'), { ok: true, value: 120 });
    eq(U.checkAmount('1,000'), { ok: true, value: 1000 });
    eq(U.amountInputText(50000), '50,000');
    eq(U.amountInputText(183.5), '183.5');
    eq(U.amountInputText(0), '');
  });

  test('panels: item rows', function () {
    eq(U.checkItem({ icon: '🧋', name: ' 珍奶 ', priceText: '65' }), { ok: true, item: { name: '珍奶', price: 65, icon: '🧋' } });
    eq(U.checkItem({ icon: '', name: '', priceText: '65' }), { ok: false, field: 'name', error: '請輸入名稱' });
    eq(U.checkItem({ icon: '', name: '雞排', priceText: 'x' }), { ok: false, field: 'price', error: '請輸入數字' });
  });

  test('panels: lunch, work days, hours, today\'s start', function () {
    eq(U.checkLunch('12:00', '13:00'), { ok: true, start: '12:00', end: '13:00' });
    eq(U.checkLunch('１２：００', '1330'), { ok: true, start: '12:00', end: '13:30' }, 'full-width and HHMM');
    eq(U.normHM('9:05'), '09:05');
    eq(U.normHM('25:00'), null);
    eq(U.checkLunch('13:00', '12:00'), { ok: false, error: '午休結束要晚於開始' });
    eq(U.checkLunch('', '13:00'), { ok: false, error: '請輸入時間' });
    eq(U.toggleDay([1, 2, 3, 4, 5], 6), [1, 2, 3, 4, 5, 6]);
    eq(U.toggleDay([1, 2, 3, 4, 5], 1), [2, 3, 4, 5]);
    eq(U.toggleDay([], 0), [0]);
    eq(U.stepHours(8, 1), 8.5);
    eq(U.stepHours(8, -1), 7.5);
    eq(U.stepHours(16, 1), 16);
    eq(U.stepHours(1, -1), 1);
    eq(U.startAt('2026-11-12', '08:45', at(12, 10, 0)), { ok: true, ms: at(12, 8, 45) });
    eq(U.startAt('2026-11-12', '10:30', at(12, 10, 0)), { ok: false, error: '不能晚於現在' });
    eq(U.startAt('2026-11-12', '', at(12, 10, 0)), { ok: false, error: '請輸入時間' });
    eq(U.startAt('2026-11-12', '03:30', at(12, 10, 0)), { ok: false, error: '起算時間要在 04:00 之後' });
  });

  // ---------- hotkey ----------
  test('panels: a key event -> "Ctrl+Alt+H" style combo', function () {
    function c(e) { return U.comboFromEvent(e); }
    eq(c({ key: 'h', code: 'KeyH', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+H' });
    eq(c({ key: 'F5', code: 'F5', ctrlKey: true, shiftKey: true }), { combo: 'Ctrl+Shift+F5' });
    eq(c({ key: '1', code: 'Digit1', altKey: true }), { combo: 'Alt+1' });
    eq(c({ key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true }), { combo: 'Ctrl+Left' });
    eq(c({ key: ' ', code: 'Space', altKey: true, shiftKey: true }), { combo: 'Alt+Shift+Space' });
    eq(c({ key: 'K', code: 'KeyK', ctrlKey: true, metaKey: true }), { combo: 'Ctrl+Win+K' }, 'host order Ctrl, Alt, Shift, Win');
    eq(c({ key: 'k', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+K' }, 'no code: the key');
    eq(c({ key: 'Process', code: 'KeyH', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+H' }, 'IME on: the code');
    eq(c({ key: 'a', code: 'KeyQ', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+A' }, 'AZERTY: the key cap, not the position');
    eq(c({ key: 'p', code: 'KeyR', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+P' }, 'Dvorak');
    eq(c({ key: 'Q', code: 'KeyQ', ctrlKey: true, shiftKey: true }), { combo: 'Ctrl+Shift+Q' }, 'Shift gives a capital: still one letter');
    eq(c({ key: 'é', code: 'Digit2', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+2' }, 'not a plain letter: the code');
    eq(c({ key: 'ㄘ', code: 'KeyH', ctrlKey: true, altKey: true }), { combo: 'Ctrl+Alt+H' }, 'a non-Latin key: the code');
    eq(c({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), { partial: 'Ctrl+' });
    eq(c({ key: 'Alt', code: 'AltRight', ctrlKey: true, altKey: true }), { partial: 'Ctrl+Alt+' });
    eq(c({ key: 'A', code: 'KeyA', shiftKey: true }), { error: '要按住 Ctrl 或 Alt，再加一個按鍵' });
    eq(c({ key: 'a', code: 'KeyA' }), { error: '要按住 Ctrl 或 Alt，再加一個按鍵' });
    eq(c({ key: 'K', code: 'KeyK', metaKey: true }), { error: '要按住 Ctrl 或 Alt，再加一個按鍵' }, 'Win alone is not enough');
    eq(c({ key: ';', code: 'Semicolon', ctrlKey: true, altKey: true }), { error: '這個按鍵不能用，請用英文字母、數字、F1–F24 或方向鍵' });
    eq(c({ key: '1', code: 'Numpad1', ctrlKey: true, altKey: true }).error, '這個按鍵不能用，請用英文字母、數字、F1–F24 或方向鍵');
    eq(c({ key: 'Escape', code: 'Escape' }), { cancel: true });
    eq(c({ key: 'Tab', code: 'Tab' }), { pass: true });
    eq(c({ key: 'Tab', code: 'Tab', shiftKey: true }), { pass: true });
  });

  test('panels: hotkey and storage warnings', function () {
    eq(U.hotkeyText({ combo: 'Ctrl+Alt+H', reason: 'taken', active: null }),
      { text: 'Ctrl+Alt+H 已被其他程式使用，請換一組', sub: '目前沒有可用的快速隱藏快捷鍵' });
    eq(U.hotkeyText({ combo: 'Ctrl+Alt+K', reason: 'taken', active: 'Ctrl+Alt+H' }),
      { text: 'Ctrl+Alt+K 已被其他程式使用，請換一組', sub: '目前仍然使用 Ctrl+Alt+H' });
    eq(U.hotkeyText({ combo: 'Ctrl+K', reason: 'invalid', active: 'Ctrl+Alt+H' }).text, 'Ctrl+K 不能當快捷鍵，請換一組');
    eq(U.hotkeyText({ combo: 'Ctrl+Alt+K', reason: 'error' }).text, 'Ctrl+Alt+K 設定失敗，請換一組');
    eq(U.hotkeyText(null), null);
    eq(U.storageText(['settings']), '讀不到設定檔（settings.json），為了不弄丟資料，這次不會覆寫它。這次的變更不會存下來。');
    eq(U.storageText(['settings', 'history']),
      '讀不到設定檔（settings.json）和紀錄檔（history.json），為了不弄丟資料，這次不會覆寫它們。這次的變更不會存下來。');
    eq(U.storageText(['window']), '讀不到視窗位置檔（window.json），為了不弄丟資料，這次不會覆寫它。這次的變更不會存下來。');
    eq(U.storageText(['bogus']), null);
    eq(U.storageText([]), null);
  });

  // ---------- history ----------
  function sampleHistory() {
    return { version: 1, days: {
      '2026-11-02': { day: '2026-11-02', earned: 2000 },
      '2026-11-03': { day: '2026-11-03', earned: 1500.5 },
      '2026-11-05': { day: '2026-11-05', startMs: at(5, 9, 0), earned: null },   // still open: not counted
      '2026-11-06': { day: '2026-11-06', offDay: true, earned: 0 },
      '2026-11-12': { day: '2026-11-12', startMs: at(12, 9, 0), earned: null },  // today
      '2026-10-30': { day: '2026-10-30', earned: 999 },
      '2026-10-31': { day: '2026-10-31', earned: 1 },
      '2026-10-29': { day: '2026-10-29', earned: null },
      '2026-09-01': { day: '2026-09-01', earned: 100 }
    } };
  }

  test('panels: history bars: every date of the month, completed days and today\'s live value', function () {
    var h = sampleHistory(), today = h.days['2026-11-12'];
    var m = U.historyModel(h, today, 284.09);
    eq(m.month, '2026-11');
    eq(m.title, '2026 年 11 月');
    eq(m.days.length, 30);
    eq(m.days[0], { day: '2026-11-01', d: 1, earned: null, today: false, weekend: true });
    eq(m.days[1].earned, 2000);
    eq(m.days[2].earned, 1500.5);
    eq(m.days[4].earned, null, 'an open record is not a bar');
    eq(m.days[5].earned, 0, 'a closed off day is a zero bar');
    eq(m.days[11], { day: '2026-11-12', d: 12, earned: 284.09, today: true, weekend: false });
    near(m.total, 3784.59, 1e-9);
    near(m.total, QJZ.history.monthTotal(h, '2026-11', today, 284.09), 1e-9, 'same as the 本月累計 chip');
    eq(m.max, 2000);
    eq(m.worked, 2, 'completed days that earned something');
    eq(U.historyModel({ version: 1, days: {} }, { day: '2026-02-03' }, 0).days.length, 28);
  });

  test('panels: previous months, newest first, without the current month', function () {
    eq(U.previousMonths(sampleHistory(), '2026-11'), [
      { month: '2026-10', title: '2026 年 10 月', total: 1000, worked: 2 },
      { month: '2026-09', title: '2026 年 9 月', total: 100, worked: 1 }
    ]);
    eq(U.previousMonths({ version: 1, days: {} }, '2026-11'), []);
  });

  test('panels: chart scale', function () {
    eq(U.niceMax(0), 100);
    eq(U.niceMax(2000), 2000);
    eq(U.niceMax(2272.73), 2500);
    eq(U.niceMax(3784), 4000);
    eq(U.niceMax(120), 150);
    eq(U.niceMax(95), 100);
  });

  // ---------- early-leave question ----------
  test('panels: the question text names yesterday, or the date', function () {
    eq(U.questionText({ day: '2026-11-11', lockMs: at(11, 16, 2) }, '2026-11-12'), '昨天是不是 16:02 就下班了？');
    eq(U.questionText({ day: '2026-11-09', lockMs: at(9, 16, 2) }, '2026-11-12'), '11/09（一）是不是 16:02 就下班了？');
    eq(U.questionText({ day: '2026-10-31', lockMs: at(1, 0, 0) - 8 * 3600000 }, '2026-11-01'), '昨天是不是 16:00 就下班了？', 'across a month');
  });

  test('panels: the question shows what each answer earns', function () {
    var s = defaults(READY);
    var rec = QJZ.day.onLock(QJZ.day.manualStart(QJZ.day.empty('2026-11-11'), at(11, 9, 0)), at(11, 15, 0));
    var m = U.questionModel({ day: '2026-11-11', lockMs: at(11, 15, 0) }, rec, s, '2026-11-12');
    eq(m.text, '昨天是不是 15:00 就下班了？');
    eq(m.lock, '15:00');
    eq(m.planned, '18:00');
    eq(m.yes, '1,420.45', '5 worked hours');
    eq(m.no, '2,272.73', 'the full day');
    var bare = U.questionModel({ day: '2026-11-11', lockMs: at(11, 15, 0) }, null, s, '2026-11-12');
    eq([bare.yes, bare.no, bare.planned], [null, null, null], 'no record: no amounts');
  });

  // ---------- DOM + app + layouts ----------
  function fixture() {
    var el = document.getElementById('layout-fixture');
    if (!el) {
      el = document.createElement('div');
      el.id = 'layout-fixture';
      el.style.cssText = 'position:absolute;left:0;top:0';
      document.body.appendChild(el);
    }
    return el;
  }
  // o: {settings (object, used as is), history (object), start (today's start ms, null = not started), first}
  function mk(nowMs, o) {
    o = o || {};
    QJZ.panels._reset();
    QJZ.layouts._reset();
    QJZ.app._reset();
    var sent = [], handlers = {}, clock = { ms: nowMs };
    var bridge = {
      send: function (t, p) { sent.push({ type: t, p: p }); },
      on: function (t, f) {
        (handlers[t] = handlers[t] || []).push(f);
        return function () { var l = handlers[t], i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
      },
      emit: function (m) { (handlers[m.type] || []).slice().forEach(function (f) { f(m); }); }
    };
    var root = fixture();
    QJZ.layouts.start(root, { bridge: bridge, first: o.first, session: o.session });
    QJZ.panels.start();
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    var h = o.history || { version: 1, days: {} }, day = QJZ.time.dayKey(nowMs);
    if (o.start !== null && !h.days[day]) h.days[day] = QJZ.day.manualStart(QJZ.day.empty(day), o.start === undefined ? at(12, 9, 0) : o.start);
    bridge.emit({ type: 'init', settings: JSON.stringify(o.settings === undefined ? READY : o.settings), history: JSON.stringify(h),
      probeMs: null, nowMs: nowMs, version: 't', forceOpaque: !!o.forceOpaque });
    return { bridge: bridge, sent: sent, clock: clock, root: root,
      menu: function (a) { bridge.emit({ type: 'menu', action: a }); },
      tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  function done() { QJZ.panels._reset(); QJZ.layouts._reset(); QJZ.app._reset(); }
  function of(sent, type) { return sent.filter(function (s) { return s.type === type; }); }
  function last(sent, type) { var l = of(sent, type); return l.length ? l[l.length - 1].p : null; }
  function $(e, sel) { return e.root.querySelector(sel); }
  function $$(e, sel) { return Array.prototype.slice.call(e.root.querySelectorAll(sel)); }
  function text(e, sel) { var n = $(e, sel); return n ? n.textContent : null; }
  function visible(n) { return !!n && !n.hidden && n.offsetParent !== null; }
  function type(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function commit(input, value) {
    type(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function key(el, o) {
    o.bubbles = true; o.cancelable = true;
    var ev = new KeyboardEvent('keydown', o);
    el.dispatchEvent(ev);
    return ev;
  }
  function savedSettings(e) { QJZ.app.flush(); return JSON.parse(last(e.sent, 'saveSettings').text); }
  function yesterdayOpen(lockHM) {
    var rec = QJZ.day.manualStart(QJZ.day.empty('2026-11-11'), at(11, 9, 0));
    if (lockHM) rec = QJZ.day.onLock(rec, at(11, lockHM[0], lockHM[1]));
    return { version: 1, days: { '2026-11-11': rec } };
  }

  test('panels DOM: a first run shows onboarding; abc blocks, 50,000 passes, 開始 saves and goes to U1', function () {
    var e = mk(at(12, 10, 0), { settings: null });
    eq(QJZ.layouts.current(), 'PANEL');
    eq(last(e.sent, 'setLayout').layout, 'PANEL', 'the first window is the onboarding panel');
    ok($(e, '.panel.p-onboarding'), 'onboarding panel');
    var w = last(e.sent, 'setLayout').width;
    ok(w >= 400 && w <= 410, 'about 400 wide: ' + w);
    var amount = $(e, '[data-f=amount]');
    eq(amount.value, '', 'no salary is prefilled on a first run');
    type(amount, 'abc');
    eq(text(e, '[data-err=amount]'), '請輸入數字', 'the validateSalary error under the field');
    $(e, '[data-pa=next]').click();
    ok(visible($(e, '[data-step="1"]')), 'still on the salary step');
    eq(QJZ.app.state.settings.onboarded, false);
    type(amount, '');
    $(e, '[data-pa=next]').click();
    eq(text(e, '[data-err=amount]'), '請輸入薪資');
    $(e, '[data-seg=mode] [data-v=hourly]').click();
    ok(!visible($(e, '[data-seg=divisor]')), 'no divisor for an hourly wage');
    $(e, '[data-seg=mode] [data-v=monthly]').click();
    $(e, '[data-seg=divisor] [data-v="30"]').click();
    type(amount, '50,000');
    eq(text(e, '[data-err=amount]'), '');
    ok(text(e, '[data-o=preview]').indexOf('1,666.67') >= 0, 'daily wage preview ÷30: ' + text(e, '[data-o=preview]'));
    $(e, '[data-pa=next]').click();
    ok(visible($(e, '[data-step="2"]')), 'pet step');
    eq($$(e, '[data-step="2"] [data-skin]').length, 10, 'all 10 skins');
    eq($$(e, '[data-step="2"] [data-skin^="cat:"]').map(function (b) { return b.getAttribute('data-skin'); }), ['cat:p0', 'cat:p4', 'cat:h2', 'cat:s4', 'cat:s5'], 'five cats, in the hamster order');
    eq([$(e, '[data-step="2"] [data-skin="cat:h2"]').title, text(e, '[data-step="2"] [data-skin="cat:h2"] small')], ['貪吃貓', '貪吃'], 'cat H2');
    eq([$(e, '[data-step="2"] [data-skin="hamster:h2"]').title, text(e, '[data-step="2"] [data-skin="hamster:h2"] small')], ['貪吃鼠', '貪吃'], 'hamster H2');
    eq([$(e, '[data-step="2"] [data-skin="cat:s4"]').title, text(e, '[data-step="2"] [data-skin="cat:s4"] small')], ['扁平幾何貓', '扁平幾何'], 'cat S4');
    ok($(e, '[data-step="2"] [data-skin="cat:h2"] svg') && $(e, '[data-step="2"] [data-skin="cat:s4"] svg'), 'the new cats have avatars');
    ok($(e, '[data-skin="cat:p4"] svg'), 'an avatar');
    $(e, '[data-skin="cat:p4"]').click();
    eq($(e, '[data-f=petName]').value, '小橘', 'the default name of the picked kind');
    type($(e, '[data-f=petName]'), '<b>阿橘</b>');
    $(e, '[data-pa=go]').click();
    var s = QJZ.app.state.settings;
    eq(s.salary, { mode: 'monthly', amount: 50000, divisor: 30 });
    eq([s.pet.kind, s.pet.skin, s.pet.names.cat, s.onboarded], ['cat', 'p4', '<b>阿橘</b>', true]);
    eq(savedSettings(e).onboarded, true, 'persisted');
    eq(QJZ.layouts.current(), 'U1', 'the start layout');
    done();
  });

  test('panels DOM: onboarding keeps an existing salary and can go back a step', function () {
    var e = mk(at(12, 10, 0), { settings: { salary: { mode: 'hourly', amount: 183.5, divisor: 22 } } });
    ok($(e, '.panel.p-onboarding'));
    eq($(e, '[data-f=amount]').value, '183.5');
    ok($(e, '[data-seg=mode] [data-v=hourly]').classList.contains('on'));
    $(e, '[data-pa=next]').click();
    $(e, '[data-pa=prev]').click();
    ok(visible($(e, '[data-step="1"]')));
    eq(QJZ.layouts.current(), 'PANEL');
    done();
  });

  test('panels DOM: a pending early-leave question asks first; 對 uses the lock time', function () {
    var e = mk(at(12, 10, 0), { history: yesterdayOpen([15, 0]) });
    eq(QJZ.layouts.current(), 'PANEL');
    ok($(e, '.panel.p-question'));
    eq(text(e, '[data-o=qtext]'), '昨天是不是 15:00 就下班了？');
    ok($(e, '.p-question .av svg'), 'pet avatar');
    eq(text(e, '[data-pa=yes] b'), '對，用那個時間');
    eq(text(e, '[data-pa=no] b'), '沒有，照原本的算');
    ok(last(e.sent, 'setLayout').height < 500, 'a compact panel');
    $(e, '[data-pa=yes]').click();
    var rec = QJZ.app.state.history.days['2026-11-11'];
    eq([rec.endMs, rec.endSource], [at(11, 15, 0), 'confirmed']);
    near(rec.earned, 1420.45, 0.001);
    eq(QJZ.app.state.pendingQuestion, null);
    eq(JSON.parse(last(e.sent, 'saveHistory').text).days['2026-11-11'].earned, rec.earned, 'saved at once');
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('panels DOM: 沒有 keeps the planned end', function () {
    var e = mk(at(12, 10, 0), { history: yesterdayOpen([15, 0]) });
    $(e, '[data-pa=no]').click();
    var rec = QJZ.app.state.history.days['2026-11-11'];
    eq(rec.endMs, null);
    near(rec.earned, 2272.73, 0.001);
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('panels DOM: a question that comes up later waits until the open panel closes', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    QJZ.app.state.pendingQuestion = { day: '2026-11-11', lockMs: at(11, 15, 0) };
    e.tick(at(12, 10, 0, 1));
    ok($(e, '.panel.p-settings'), 'not taken over');
    $(e, '[data-act=back]').click();
    ok($(e, '.panel.p-question'), 'asked when settings close');
    done();
    var f = mk(at(12, 10, 0));
    QJZ.app.state.pendingQuestion = { day: '2026-11-11', lockMs: at(11, 15, 0) };
    QJZ.app.saveSettings({ milestone: 50 });   // any change
    ok($(f, '.panel.p-question'), 'on a main layout it is asked right away');
    done();
  });

  // #9: the ten sections of spec 5.3 plus 關於, in four tabs: 薪水和時間 (今天, 薪資, 工時, 起算), 寵物 (寵物, 音效),
  // 畫面 (版型, 動力加成), 其他 (開機, 隱私, 關於).
  var PANES = { time: ['today', 'salary', 'hours', 'start'], pet: ['pet', 'sound'], display: ['layout', 'boost'], other: ['autostart', 'privacy', 'about'] };
  test('panels DOM: settings has four tabs (薪水和時間, 寵物, 畫面, 其他) and remembers the tab', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    ok($(e, '.panel.p-settings'));
    eq(text(e, '.ptitle'), '設定');
    eq($$(e, '[data-tab]').map(function (b) { return b.textContent; }), ['薪水和時間', '寵物', '畫面', '其他']);
    ok(visible($(e, '[data-pane=time]')), 'the first tab first');
    eq(last(e.sent, 'setLayout').layout, 'PANEL');
    var h = last(e.sent, 'setLayout').height;
    ok(h > 400 && h <= 640 + 14, 'about 640 tall: ' + h);
    var tabsBox = $(e, '.tabs').getBoundingClientRect(), first = $$(e, '[data-tab]')[0].getBoundingClientRect();
    ok(tabsBox.height < first.height * 1.6, 'one row of tabs');
    Object.keys(PANES).forEach(function (t) {
      $(e, '[data-tab=' + t + ']').click();
      ok(visible($(e, '[data-pane=' + t + ']')), t + ' shows');
      eq($$(e, '[data-pane]').filter(visible).length, 1, 'one tab at a time');
      eq($$(e, '[data-pane=' + t + '] [data-sec]').map(function (n) { return n.getAttribute('data-sec'); }), PANES[t], t + ' sections in order');
      ok($$(e, '[data-pane=' + t + '] [data-sec]').every(visible), t + ': all of them');
      eq($(e, '[data-tab=' + t + ']').getAttribute('aria-selected'), 'true');
      eq(last(e.sent, 'setLayout').height, h, 'the panel keeps its size');
    });
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U1');
    e.menu('settings');
    ok(visible($(e, '[data-pane=other]')), 'the last tab again');
    done();
  });

  test('panels DOM: every 1.0 setting is still there, once, in its tab; 今天休假 and 調整起算時間 come first', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    var WHERE = {
      time: ['[data-tgl=offDay]', '[data-f=startAt]', '[data-pa=applyStart]', '[data-pa=resume]', '[data-seg=mode]', '[data-f=amount]',
        '[data-seg=divisor]', '[data-hstep="-"]', '[data-hstep="+"]', '[data-f=lunchStart]', '[data-f=lunchEnd]', '[data-seg=startMode]', '[data-wd="1"]'],
      pet: ['[data-skin="hamster:p0"]', '[data-f="name.hamster"]', '[data-f="name.cat"]', '[data-tgl=sound]', '[data-f=volume]'],
      display: ['[data-tgl=opaque]', '[data-f=milestone]', '[data-items]', '[data-pa=addItem]'],
      other: ['[data-tgl=autostart]', '[data-tgl=capture]', '[data-f=hotkey]', '[data-pa=hkDefault]', '[data-o=version]']
    };
    Object.keys(WHERE).forEach(function (t) {
      WHERE[t].forEach(function (sel) {
        eq($$(e, '[data-panel] ' + sel).length, 1, sel + ' once');
        ok($(e, '[data-pane=' + t + '] ' + sel), sel + ' in ' + t);
      });
    });
    var today = $(e, '[data-pane=time] [data-sec]');
    eq(today.getAttribute('data-sec'), 'today', 'the first section of the first tab');
    ok(today.querySelector('[data-tgl=offDay]') && today.querySelector('[data-f=startAt]'), '今天休假 and 調整今天的起算時間');
    ok(today.getBoundingClientRect().bottom <= $(e, '[data-f=amount]').getBoundingClientRect().top, 'above 薪資');
    done();
  });

  test('panels DOM: 薪資 saves valid amounts at once and shows errors under the field', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=time]').click();
    var amount = $(e, '[data-f=amount]');
    eq(amount.value, '50,000');
    commit(amount, 'abc');
    eq(text(e, '[data-err=amount]'), '請輸入數字');
    eq(QJZ.app.state.settings.salary.amount, 50000, 'not saved');
    commit(amount, '44,000');
    eq(text(e, '[data-err=amount]'), '');
    eq(QJZ.app.state.settings.salary.amount, 44000);
    $(e, '[data-seg=divisor] [data-v="30"]').click();
    eq(QJZ.app.state.settings.salary.divisor, 30);
    $(e, '[data-seg=mode] [data-v=hourly]').click();
    eq(QJZ.app.state.settings.salary.mode, 'hourly');
    eq(savedSettings(e).salary, { mode: 'hourly', amount: 183.33, divisor: 30 }, '44,000 / 30 / 8 h, converted');
    done();
  });

  test('panels DOM: switching 月薪 and 時薪 converts the amount, hints, and never saves an invalid amount', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=time]').click();
    var amount = $(e, '[data-f=amount]');
    eq(amount.value, '50,000');
    $(e, '[data-seg=mode] [data-v=hourly]').click();
    var s = QJZ.app.state.settings.salary;
    eq(s.mode, 'hourly');
    ok(s.amount !== 50000, 'NT$50,000 an hour is not what anybody meant');
    near(s.amount, 284.09, 0.005, '50,000 / 22 / 8 h');
    eq(amount.value, '284.09', 'the field shows it');
    ok(text(e, '[data-o=modeNote]').indexOf('已切換為時薪') >= 0, 'with a hint: ' + text(e, '[data-o=modeNote]'));
    ok(QJZ.settings.validateSalary(amount.value).ok, 'what is shown and saved passes validateSalary');
    commit(amount, '300');
    eq(QJZ.app.state.settings.salary.amount, 300);
    eq(text(e, '[data-o=modeNote]'), '', 'typing a new amount clears the hint');
    $(e, '[data-seg=mode] [data-v=monthly]').click();
    s = QJZ.app.state.settings.salary;
    eq([s.mode, s.amount], ['monthly', 52800], '300 x 8 h x 22 days');
    eq(amount.value, '52,800');
    ok(text(e, '[data-o=modeNote]').indexOf('已切換為月薪') >= 0);
    commit(amount, '44,000');
    $(e, '[data-seg=mode] [data-v=monthly]').click();
    eq(QJZ.app.state.settings.salary.amount, 44000, 'clicking the mode that is already on changes nothing');
    commit(amount, '5');
    eq(QJZ.app.state.settings.salary.amount, 5, 'a monthly 5 is valid');
    $(e, '[data-seg=mode] [data-v=hourly]').click();   // 5 / 22 / 8 = 0.03 an hour: under 1, so no conversion
    s = QJZ.app.state.settings.salary;
    eq([s.mode, s.amount], ['hourly', 5], 'the mode changes, the amount stays');
    eq(savedSettings(e).salary.amount, 5, 'never saved as 0.03');
    eq(amount.value, '5');
    ok(text(e, '[data-o=modeNote]').indexOf('已換算') < 0, 'no "converted" hint: ' + text(e, '[data-o=modeNote]'));
    eq(text(e, '[data-o=modeNote]'), '已切換為時薪，金額無法換算，沒有改，請確認', 'a short hint that it was not converted');
    done();
  });

  test('panels DOM: an onboarding mode switch converts when it can and shows no hint when it cannot', function () {
    var e = mk(at(12, 10, 0), { settings: { salary: { mode: 'monthly', amount: 100, divisor: 22 } } });
    var amount = $(e, '[data-f=amount]');
    eq(amount.value, '100', 'prefilled');
    $(e, '[data-seg=mode] [data-v=hourly]').click();   // 100 / 22 / 8 = 0.57: not a valid wage
    eq(amount.value, '100', 'kept');
    eq(text(e, '[data-o=modeNote]'), '', 'no hint without a conversion');
    $(e, '[data-seg=mode] [data-v=monthly]').click();   // 100 an hour -> 17,600 a month
    eq(amount.value, '17,600');
    ok(text(e, '[data-o=modeNote]').indexOf('已切換為月薪') >= 0, 'converted, with the hint');
    type(amount, '120');
    $(e, '[data-seg=mode] [data-v=hourly]').click();   // 120 / 176 = 0.68: no conversion
    eq([amount.value, text(e, '[data-o=modeNote]')], ['120', ''], 'no stale hint');
    done();
  });

  // #9: 使用說明 and the licence texts open only when clicked (a disclosure button each); each loads the first time.
  test('panels DOM: 關於 shows the version; 使用說明 and 第三方授權 open on click and load once, as plain text', function () {
    var e = mk(at(12, 10, 0));
    var orig = window.fetch, calls = [];
    function now(v) { return { then: function (ok) { var r = ok(v); return r && r.then ? r : now(r); } }; }   // a synchronous fetch
    window.fetch = function (url) { calls.push(url); return now({ ok: true, text: function () { return now('<b>' + url + '</b>'); } }); };
    try {
      e.menu('settings');
      $(e, '[data-tab=other]').click();
      ok(visible($(e, '[data-sec=about]')));
      eq(text(e, '[data-o=version]'), '版本 t', 'the version the host sent with init');
      ok(text(e, '[data-sec=about]').indexOf('不會上傳') >= 0, 'the data stays on this PC');
      ok(text(e, '[data-sec=about]').indexOf('漫遊設定檔') >= 0 && text(e, '[data-sec=about]').indexOf('%AppData%\\錢進中') >= 0,
        'with the roaming exception, as in the guide');
      var g = $(e, '[data-disc=guide]'), l = $(e, '[data-disc=lic]');
      eq([g.tagName, g.getAttribute('aria-expanded'), l.getAttribute('aria-expanded')], ['BUTTON', 'false', 'false'], 'two closed disclosure buttons');
      ok(g.textContent.indexOf('使用說明') >= 0 && l.textContent.indexOf('第三方授權') >= 0 && g.textContent.indexOf('點開') >= 0, g.textContent);
      eq($$(e, '[data-doc]').filter(visible).length, 0, 'no text shows');
      eq(calls.length, 0, 'and nothing loads before a click');
      g.click();
      eq(g.getAttribute('aria-expanded'), 'true');
      ok(g.textContent.indexOf('收起') >= 0, g.textContent);
      eq(calls, ['guide.txt'], 'only the guide');
      var pre = $(e, '[data-doc="guide.txt"]');
      ok(visible(pre));
      eq(pre.tagName, 'PRE');
      eq(pre.textContent, '<b>guide.txt</b>', 'as text');
      ok(!pre.querySelector('b'), 'never as markup');
      eq(getComputedStyle(pre).overflowY, 'auto', 'it scrolls');
      g.click();
      eq([g.getAttribute('aria-expanded'), visible(pre)], ['false', false], 'closes again');
      g.click();
      eq(calls.length, 1, 'loaded once');
      l.click();
      eq(calls, ['guide.txt', 'licenses/WebView2-SDK.txt', 'fonts/OFL.txt']);
      eq($$(e, '[data-discbody=lic] [data-doc]').filter(visible).map(function (p) { return p.textContent; }),
        ['<b>licenses/WebView2-SDK.txt</b>', '<b>fonts/OFL.txt</b>']);
      $(e, '[data-tab=time]').click();
      $(e, '[data-tab=other]').click();
      eq(calls.length, 3, 'still loaded once');
    } finally { window.fetch = orig; }
    done();
    var f = mk(at(12, 10, 0)), orig2 = window.fetch;
    window.fetch = function () { throw new Error('offline'); };
    try {
      f.menu('settings');
      $(f, '[data-tab=other]').click();
      $(f, '[data-disc=guide]').click();
      $(f, '[data-disc=lic]').click();
      eq($$(f, '[data-doc]').map(function (p) { return p.textContent; }), ['（讀不到使用說明。）', '（讀不到授權文字。）', '（讀不到授權文字。）']);
    } finally { window.fetch = orig2; }
    done();
  });

  test('panels DOM: an invalid item row keeps its last saved item while another row is edited', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=display]').click();
    var before = JSON.parse(JSON.stringify(QJZ.app.state.settings.items));
    eq(before.length, 3);
    var rows = $$(e, '[data-item]');
    commit(rows[1].querySelector('[data-f="item.price"]'), 'x');
    ok(text(e, '[data-item="1"] .err').indexOf('請輸入數字') >= 0);
    eq(QJZ.app.state.settings.items[1], before[1], 'the bad edit is not saved');
    commit(rows[0].querySelector('[data-f="item.name"]'), '大杯珍奶');
    var items = QJZ.app.state.settings.items;
    eq(items.length, 3, 'the invalid row did not vanish');
    eq(items[0].name, '大杯珍奶');
    eq(items[1], before[1], 'row 2 keeps its last good value');
    eq(items[2], before[2]);
    commit(rows[2].querySelector('[data-f="item.name"]'), '');
    commit(rows[0].querySelector('[data-f="item.price"]'), '80');
    items = QJZ.app.state.settings.items;
    eq([items.length, items[2]], [3, before[2]], 'an emptied name keeps the saved row too');
    commit(rows[1].querySelector('[data-f="item.price"]'), '65');
    eq(QJZ.app.state.settings.items[1].price, 65, 'fixing the row saves it');
    $(e, '[data-pa=addItem]').click();
    commit(rows[0].querySelector('[data-f="item.price"]'), '81');
    eq(QJZ.app.state.settings.items.length, 3, 'a new row that was never valid is simply not saved');
    done();
  });

  test('panels DOM: 工時 and 起算', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=time]').click();
    $(e, '[data-hstep="+"]').click();
    eq(QJZ.app.state.settings.hoursPerDay, 8.5);
    commit($(e, '[data-f=lunchEnd]'), '11:00');
    eq(text(e, '[data-err=lunch]'), '午休結束要晚於開始');
    eq(QJZ.app.state.settings.lunch.end, '13:00');
    commit($(e, '[data-f=lunchEnd]'), '13:30');
    eq(QJZ.app.state.settings.lunch, { start: '12:00', end: '13:30' });
    $(e, '[data-tab=time]').click();
    $(e, '[data-seg=startMode] [data-v=manual]').click();
    eq(QJZ.app.state.settings.startMode, 'manual');
    $(e, '[data-wd="6"]').click();
    $(e, '[data-wd="1"]').click();
    eq(QJZ.app.state.settings.workDays, [2, 3, 4, 5, 6]);
    $(e, '[data-tgl=offDay]').click();
    eq(QJZ.app.state.today.offDay, true);
    eq($(e, '[data-tgl=offDay]').getAttribute('aria-checked'), 'true');
    ok(text(e, '[data-o=todayStart]').indexOf('09:00') >= 0, text(e, '[data-o=todayStart]'));
    commit($(e, '[data-f=startAt]'), '10:30');
    $(e, '[data-pa=applyStart]').click();
    eq(text(e, '[data-err=startAt]'), '不能晚於現在');
    commit($(e, '[data-f=startAt]'), '08:45');
    $(e, '[data-pa=applyStart]').click();
    eq(QJZ.app.state.today.startMs, at(12, 8, 45));
    ok(text(e, '[data-o=todayStart]').indexOf('08:45') >= 0);
    done();
  });

  test('panels DOM: 薪水和時間 → 今天休假 zeroes a started day; 繼續上班 shows after 下班 and continues', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=time]').click();
    ok(text(e, '[data-sec=today]').indexOf('不算錢') >= 0, 'the hint says the day counts 0');
    ok(!visible($(e, '[data-pa=resume]')), 'nothing to continue while working');
    $(e, '[data-tgl=offDay]').click();
    eq([QJZ.app.state.snap.status, QJZ.app.state.snap.earned], ['off', 0]);
    $(e, '[data-tgl=offDay]').click();
    near(QJZ.app.state.snap.earned, 284.09, 0.01, 'off again: the day earns as before');
    QJZ.app.endWork();
    var b = $(e, '[data-pa=resume]');
    ok(visible(b), 'after 下班');
    eq(b.textContent, '繼續上班');
    ok(text(e, '[data-sec=today]').indexOf('10:00') >= 0, 'when the day ended');
    b.click();
    eq(QJZ.app.state.today.endMs, null);
    eq(QJZ.app.state.snap.status, 'working');
    ok(!visible($(e, '[data-pa=resume]')));
    QJZ.app.setOffDay(true);
    QJZ.app.endWork();
    ok(!visible($(e, '[data-pa=resume]')), 'not on a holiday');
    done();
  });

  test('panels DOM: 版型 → 相容模式（不透明背景） toggles display.opaque; forced by the host it stays on', function () {
    var e = mk(at(12, 10, 0)), root = document.documentElement;
    e.menu('settings');
    $(e, '[data-tab=display]').click();
    ok(text(e, '[data-sec=layout]').indexOf('相容模式（不透明背景）') >= 0);
    ok(text(e, '[data-sec=layout]').indexOf('視窗周圍出現黑框時請開啟') >= 0);
    var t = $(e, '[data-tgl=opaque]');
    eq([t.getAttribute('aria-checked'), t.disabled], ['false', false]);
    t.click();
    eq(QJZ.app.state.settings.display.opaque, true);
    eq(t.getAttribute('aria-checked'), 'true');
    ok(root.classList.contains('opaque'));
    eq(savedSettings(e).display, { opaque: true });
    t.click();
    eq(QJZ.app.state.settings.display.opaque, false);
    ok(!root.classList.contains('opaque'));
    done();
    var f = mk(at(12, 10, 0), { forceOpaque: true });
    f.menu('settings');
    $(f, '[data-tab=display]').click();
    t = $(f, '[data-tgl=opaque]');
    eq([t.getAttribute('aria-checked'), t.disabled], ['true', true], 'on, and cannot be turned off');
    t.click();
    eq(QJZ.app.state.settings.display.opaque, false, 'the saved setting is untouched');
    ok(text(f, '[data-sec=layout]').indexOf('自動開啟') >= 0, 'says why');
    ok(root.classList.contains('opaque'));
    done();
    ok(!root.classList.contains('opaque'));
  });

  test('panels DOM: after a reload a pending question still comes first; closing it goes to the remembered layout', function () {
    var m = {}, s = { getItem: function (k) { return m.hasOwnProperty(k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
    var e = mk(at(12, 10, 0), { session: s });
    e.menu('layout:U5B');
    var f = mk(at(12, 10, 0), { session: s, history: yesterdayOpen([15, 0]) });
    eq(QJZ.layouts.current(), 'PANEL');
    ok($(f, '.panel.p-question'));
    $(f, '[data-pa=no]').click();
    eq(QJZ.layouts.current(), 'U5B');
    done();
  });

  test('panels DOM: 調整起算時間 from the menu opens 薪水和時間 at the top, the time field focused', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=other]').click();
    $(e, '[data-act=back]').click();
    e.menu('adjust');
    ok($(e, '.panel.p-settings'));
    ok(visible($(e, '[data-pane=time]')) && visible($(e, '[data-sec=today]')));
    eq($(e, '[data-f=startAt]').value, '09:00');
    eq(document.activeElement, $(e, '[data-f=startAt]'));
    eq($(e, '.pscroll').scrollTop, 0);
    done();
  });

  test('panels DOM: 寵物, 版型 and 動力加成 (in 寵物 and 畫面)', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=pet]').click();
    eq($$(e, '[data-sec=pet] [data-skin]').length, 10);
    $(e, '[data-skin="cat:h2"]').click();
    eq([QJZ.app.state.settings.pet.kind, QJZ.app.state.settings.pet.skin], ['cat', 'h2'], 'cat H2 can be picked');
    $(e, '[data-skin="cat:s4"]').click();
    eq([QJZ.app.state.settings.pet.kind, QJZ.app.state.settings.pet.skin], ['cat', 's4'], 'cat S4 can be picked');
    $(e, '[data-skin="hamster:p0"]').click();
    ok($(e, '[data-skin="hamster:p0"]').classList.contains('on'));
    $(e, '[data-skin="cat:s5"]').click();
    eq([QJZ.app.state.settings.pet.kind, QJZ.app.state.settings.pet.skin], ['cat', 's5']);
    ok($(e, '[data-skin="cat:s5"]').classList.contains('on') && !$(e, '[data-skin="hamster:p0"]').classList.contains('on'));
    commit($(e, '[data-f="name.hamster"]'), '<img src=x onerror=alert(1)>');
    eq(QJZ.app.state.settings.pet.names.hamster, '<img src=x onerror=alert(1)>');
    eq($(e, 'img'), null, 'names are never markup');

    // #12: no start-layout picker, no topmost switches (the menu's 版型 ▶ 永遠在最上層), only 相容模式
    $(e, '[data-tab=display]').click();
    eq([$(e, '[data-seg=layoutStart]'), $(e, '[data-tgl^="top."]')], [null, null]);
    eq($$(e, '[data-sec=layout] [data-tgl]').map(function (t) { return t.getAttribute('data-tgl'); }), ['opaque']);
    ok(text(e, '[data-sec=layout]').indexOf('最後用的版型') >= 0 && text(e, '[data-sec=layout]').indexOf('右鍵選單') >= 0, 'says where they went');

    $(e, '[data-tab=display]').click();
    commit($(e, '[data-f=milestone]'), '0');
    eq(text(e, '[data-err=milestone]'), '金額要大於 0');
    commit($(e, '[data-f=milestone]'), '250');
    eq(QJZ.app.state.settings.milestone, 250);
    var rows = $$(e, '[data-item]');
    eq(rows.length, 3);
    commit(rows[0].querySelector('[data-f="item.name"]'), '大杯珍奶');
    commit(rows[0].querySelector('[data-f="item.price"]'), '75');
    eq(QJZ.app.state.settings.items[0], { name: '大杯珍奶', price: 75, icon: '🧋' });
    $(e, '[data-pa=addItem]').click();
    rows = $$(e, '[data-item]');
    eq(rows.length, 4);
    eq(QJZ.app.state.settings.items.length, 3, 'an empty row is not saved');
    commit(rows[3].querySelector('[data-f="item.name"]'), '雞排');
    commit(rows[3].querySelector('[data-f="item.price"]'), 'x');
    ok(text(e, '[data-item="3"] .err').indexOf('請輸入數字') >= 0);
    commit(rows[3].querySelector('[data-f="item.price"]'), '80');
    eq(QJZ.app.state.settings.items[3], { name: '雞排', price: 80, icon: '🎁' });
    rows[1].querySelector('[data-pa=delItem]').click();
    eq(QJZ.app.state.settings.items.map(function (i) { return i.name; }), ['大杯珍奶', '拿鐵', '雞排']);
    for (var i = 0; i < 5; i++) { var del = $(e, '[data-pa=delItem]'); if (del && !del.disabled) del.click(); }
    eq(QJZ.app.state.settings.items.length, 1, 'the last item stays');
    ok($(e, '[data-pa=delItem]').disabled);
    done();
  });

  test('panels DOM: 音效 (寵物), 開機 and 隱私 (其他) send the host messages and persist', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=pet]').click();
    eq($(e, '[data-tgl=sound]').getAttribute('aria-checked'), 'false', 'sound is off by default');
    $(e, '[data-tgl=sound]').click();
    eq(QJZ.app.state.settings.sound.enabled, true);
    commit($(e, '[data-f=volume]'), '30');
    eq(QJZ.app.state.settings.sound.volume, 0.3);
    eq(text(e, '[data-o=volume]'), '30%');

    $(e, '[data-tab=other]').click();
    eq($(e, '[data-tgl=autostart]').getAttribute('aria-checked'), 'true', 'autostart is on by default');
    $(e, '[data-tgl=autostart]').click();
    eq(last(e.sent, 'setAutostart'), { on: false });
    eq(QJZ.app.state.settings.autostart, false);

    $(e, '[data-tab=other]').click();
    var cap = $(e, '[data-tgl=capture]');
    eq(cap.getAttribute('aria-checked'), 'true', 'capture protection is on by default');
    ok(text(e, '[data-sec=privacy]').indexOf('分享螢幕、錄影、截圖時隱形') >= 0);
    cap.click();
    eq(last(e.sent, 'setCaptureGuard'), { on: false });
    eq(QJZ.app.state.settings.privacy.hideFromCapture, false);

    var hk = $(e, '[data-f=hotkey]');
    eq(hk.value, 'Ctrl+Alt+H');
    hk.focus();
    var ev = key(hk, { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    ok(ev.defaultPrevented);
    eq(hk.value, 'Ctrl+…');
    key(hk, { key: 'q', code: 'KeyQ' });
    eq(text(e, '[data-err=hotkey]'), '要按住 Ctrl 或 Alt，再加一個按鍵');
    eq(of(e.sent, 'setHotkey').length, 0);
    key(hk, { key: 'q', code: 'KeyQ', ctrlKey: true, shiftKey: true });
    eq(last(e.sent, 'setHotkey'), { combo: 'Ctrl+Shift+Q' });
    eq(QJZ.app.state.settings.privacy.hotkey, 'Ctrl+Shift+Q');
    eq(hk.value, 'Ctrl+Shift+Q');
    eq(text(e, '[data-err=hotkey]'), '');

    var s = savedSettings(e);
    eq([s.sound.enabled, s.autostart, s.privacy.hideFromCapture, s.privacy.hotkey], [true, false, false, 'Ctrl+Shift+Q'],
      'every change is in settings.json');
    done();
  });

  test('panels DOM: hotkeyFailed shows in 隱私 and the saved hotkey goes back to the working one', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    $(e, '[data-tab=other]').click();
    var hk = $(e, '[data-f=hotkey]');
    hk.focus();
    key(hk, { key: 'k', code: 'KeyK', ctrlKey: true, altKey: true });
    eq(QJZ.app.state.settings.privacy.hotkey, 'Ctrl+Alt+K');
    e.bridge.emit({ type: 'hotkeyFailed', combo: 'Ctrl+Alt+K', reason: 'taken', active: 'Ctrl+Alt+H' });
    var warn = $(e, '[data-o=hkFail]');
    ok(visible(warn));
    ok(warn.textContent.indexOf('Ctrl+Alt+K 已被其他程式使用，請換一組') >= 0, warn.textContent);
    ok(warn.textContent.indexOf('目前仍然使用 Ctrl+Alt+H') >= 0);
    eq(QJZ.app.state.settings.privacy.hotkey, 'Ctrl+Alt+H', 'settings.json keeps the combo that works');
    eq(hk.value, 'Ctrl+Alt+H');
    ok($(e, '[data-tab=other]').classList.contains('alert'), 'the tab is marked');
    ok(!$(e, '[data-tab=time]').classList.contains('alert'), 'only that one');
    hk.focus();
    key(hk, { key: 'j', code: 'KeyJ', ctrlKey: true, altKey: true });
    ok(!visible($(e, '[data-o=hkFail]')), 'a new try clears it');
    done();
  });

  test('panels DOM: a startup hotkey failure is shown and the setting is kept', function () {
    var e = mk(at(12, 10, 0));
    e.bridge.emit({ type: 'hotkeyFailed', combo: 'Ctrl+Alt+H', reason: 'taken', active: null });
    eq(QJZ.app.state.settings.privacy.hotkey, 'Ctrl+Alt+H');
    e.menu('settings');
    $(e, '[data-tab=other]').click();
    ok($(e, '[data-o=hkFail]').textContent.indexOf('Ctrl+Alt+H 已被其他程式使用，請換一組') >= 0);
    done();
  });

  test('panels DOM: storageError shows a small warning on the panels', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    ok(!visible($(e, '[data-pwarn]')));
    e.bridge.emit({ type: 'storageError', file: 'settings', reason: 'unreadable' });
    e.bridge.emit({ type: 'storageError', file: 'history', reason: 'unreadable' });
    ok(visible($(e, '[data-pwarn]')));
    eq($(e, '[data-pwarn]').textContent, U.storageText(['settings', 'history']));
    e.menu('history');
    ok(visible($(e, '[data-pwarn]')), 'on the history panel too');
    done();
    var f = mk(at(12, 10, 0), { settings: null });
    f.bridge.emit({ type: 'storageError', file: 'settings', reason: 'unreadable' });
    ok(visible($(f, '.p-onboarding [data-pwarn]')), 'and on onboarding');
    done();
  });

  test('panels DOM: history: a bar per date, 本月合計, previous months', function () {
    var h = sampleHistory();
    delete h.days['2026-11-12'];
    var e = mk(at(12, 10, 0), { history: h });
    e.menu('history');
    ok($(e, '.panel.p-history'));
    eq(text(e, '.ptitle'), '紀錄');
    eq($$(e, '.hist-chart [data-bar]').length, 30, 'one slot per date');
    eq($$(e, '.hist-chart rect.bar').length, 4, '3 completed days that earned something + today; the 0 day has no bar');
    var zero = $$(e, '.hist-chart [data-bar]')[5];
    eq(zero.querySelector('rect.bar'), null, 'a closed off day with 0 draws nothing, not a 2px stub');
    ok(zero.querySelector('title').textContent.indexOf('NT$ 0.00') >= 0, 'but its tooltip still says 0');
    var bar = $(e, '.hist-chart rect.bar');
    eq(bar.getAttribute('fill'), '#FFC857');
    eq(bar.getAttribute('stroke'), '#3D2C24');
    var total = QJZ.history.monthTotal(QJZ.app.state.history, '2026-11', QJZ.app.state.today, QJZ.app.state.snap.earned);
    eq(text(e, '[data-o=total]'), 'NT$ ' + QJZ.odometer.format(total));
    eq($$(e, '[data-o=months] li').length, 2);
    ok($$(e, '[data-o=months] li')[0].textContent.indexOf('2026 年 10 月') >= 0);
    ok($$(e, '[data-o=months] li')[0].textContent.indexOf('NT$ 1,000.00') >= 0);
    e.tick(at(12, 11, 0));
    var total2 = QJZ.history.monthTotal(QJZ.app.state.history, '2026-11', QJZ.app.state.today, QJZ.app.state.snap.earned);
    eq(text(e, '[data-o=total]'), 'NT$ ' + QJZ.odometer.format(total2), 'today keeps counting');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('panels DOM: Escape closes settings and history', function () {
    var e = mk(at(12, 10, 0));
    e.menu('history');
    key($(e, '.panel'), { key: 'Escape', code: 'Escape' });
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('panels DOM: the panel body does not start a window drag (scrollbars)', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    var sc = $(e, '.pscroll');
    sc.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, screenX: 10, screenY: 10 }));
    sc.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, buttons: 1, screenX: 40, screenY: 10 }));
    eq(of(e.sent, 'dragStart').length, 0);
    done();
  });

  // ---------- app glue ----------
  test('app: host settings actions save and tell the host', function () {
    var e = mk(at(12, 10, 0));
    QJZ.app.setAutostart(false);
    QJZ.app.setCaptureGuard(false);
    QJZ.app.setHotkey('Ctrl+Alt+J');
    eq(last(e.sent, 'setAutostart'), { on: false });
    eq(last(e.sent, 'setCaptureGuard'), { on: false });
    eq(last(e.sent, 'setHotkey'), { combo: 'Ctrl+Alt+J' });
    var s = savedSettings(e);
    eq([s.autostart, s.privacy.hideFromCapture, s.privacy.hotkey], [false, false, 'Ctrl+Alt+J']);
    done();
  });

  test('app: notices are listed and announced', function () {
    var e = mk(at(12, 10, 0)), seen = [];
    QJZ.app.on('notice', function (m) { seen.push(m.type); });
    e.bridge.emit({ type: 'storageError', file: 'settings', reason: 'unreadable' });
    e.bridge.emit({ type: 'storageError', file: 'settings', reason: 'unreadable' });
    e.bridge.emit({ type: 'storageError', file: 'history', reason: 'unreadable' });
    e.bridge.emit({ type: 'hotkeyFailed', combo: 'Ctrl+Alt+H', reason: 'taken', active: null });
    eq(QJZ.app.state.storageErrors, ['settings', 'history'], 'each file once');
    eq(seen, ['storageError', 'storageError', 'storageError', 'hotkeyFailed']);
    QJZ.app.setHotkey('Ctrl+Alt+J');
    eq(QJZ.app.state.hotkeyFailed, null, 'a new combo clears the old failure');
    done();
    eq(QJZ.app.state.storageErrors, []);
  });

  test('panels DOM: a start with seconds shows 08:37 and 17:37 everywhere', function () {
    var r = QJZ.day.empty('2026-11-12'); r.startMs = at(12, 8, 37, 58); r.startSource = 'auto';
    var h = { version: 1, days: { '2026-11-12': r } };
    var e = mk(at(12, 10, 0), { history: h });
    eq(QJZ.app.state.today.startMs, at(12, 8, 37));
    e.menu('settings');
    $(e, '[data-tab=time]').click();
    ok(text(e, '[data-o=endHint]').indexOf('今天 08:37 開始，17:37 就可以下班') === 0, text(e, '[data-o=endHint]'));
    $(e, '[data-tab=time]').click();
    ok(text(e, '[data-o=todayStart]').indexOf('08:37') >= 0, text(e, '[data-o=todayStart]'));
    done();
  });
})();
