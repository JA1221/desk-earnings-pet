// QJZ.panels: pure helpers (onboarding gating, validation glue, hotkey combos, history aggregation, the
// early-leave question), then the real panels inside the PANEL layout, driven by QJZ.app and QJZ.layouts with a
// fake bridge and a fake clock. 2026-11-12 is a Thursday, 11-11 a Wednesday, 11-09 a Monday.
(function () {
  var U = QJZ.panels.util;
  function at(d, h, m, s) { return new Date(2026, 10, d, h, m, s || 0, 0).getTime(); }
  function defaults(patch) { return QJZ.settings.parse(JSON.stringify(patch || {})).settings; }
  // READY: a 1.0 user (salary, onboarded) who has not answered the reminder question yet; SET_UP: one who has.
  var READY = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true };
  var SET_UP = { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, onboarded: true, health: { asked: true } };

  // ---------- gating ----------
  test('panels: onboarding shows until a salary is set and 開始 was pressed', function () {
    ok(U.needsOnboarding(defaults()), 'fresh defaults');
    ok(U.needsOnboarding(defaults({ salary: { amount: 50000 } })), 'salary but never onboarded');
    ok(U.needsOnboarding(defaults({ onboarded: true })), 'onboarded but the salary is 0');
    ok(!U.needsOnboarding(defaults(READY)));
  });

  test('panels: the first panel: onboarding, else the question, else the health question once', function () {
    var q = { day: '2026-11-11', lockMs: at(11, 15, 0) };
    eq(U.initialPanel({ settings: defaults(), pendingQuestion: q }), 'onboarding', 'onboarding first');
    eq(U.initialPanel({ settings: defaults(READY), pendingQuestion: q }), 'question', 'then the early-leave question');
    eq(U.initialPanel({ settings: defaults(READY), pendingQuestion: null }), 'healthAsk', 'then the reminder question');
    eq(U.initialPanel({ settings: defaults(SET_UP), pendingQuestion: q }), 'question');
    eq(U.initialPanel({ settings: defaults(SET_UP), pendingQuestion: null }), null, 'answered: none');
    eq(U.initialPanel(null), null);
  });

  // ---------- validation glue ----------
  test('panels: onboarding form -> settings patch, or the validateSalary error', function () {
    eq(U.onboardingPatch({ mode: 'monthly', amountText: 'abc', divisor: 22 }), { ok: false, error: '請輸入數字' });
    eq(U.onboardingPatch({ mode: 'monthly', amountText: '', divisor: 22 }), { ok: false, error: '請輸入薪資' });
    eq(U.onboardingPatch({ mode: 'monthly', amountText: '50,000', divisor: 22, pet: 'cat:p4', name: '阿橘', sit: true, water: true }), {
      ok: true,
      patch: { salary: { mode: 'monthly', amount: 50000, divisor: 22 }, pet: { kind: 'cat', skin: 'p4', names: { cat: '阿橘' } },
        health: { asked: true, sit: { on: true }, water: { on: true } }, onboarded: true }
    });
    eq(U.onboardingPatch({ mode: 'hourly', amountText: '１８３.５', divisor: 30, pet: 'hamster:h2', name: '  ', sit: false, water: true }), {
      ok: true,
      patch: { salary: { mode: 'hourly', amount: 183.5, divisor: 30 }, pet: { kind: 'hamster', skin: 'h2' },
        health: { asked: true, sit: { on: false }, water: { on: true } }, onboarded: true }
    }, 'full-width digits; a blank name keeps the default');
    var p = U.onboardingPatch({ mode: 'weekly', amountText: '1000', divisor: 7, pet: 'dog:x' });
    eq(p.patch, { salary: { mode: 'monthly', amount: 1000, divisor: 22 }, health: { asked: true, sit: { on: false }, water: { on: false } }, onboarded: true },
      'unknown values fall back; a reminder not ticked is off');
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

  test('panels: previous months, newest first, without the current month', function () {
    eq(U.previousMonths(sampleHistory(), '2026-11'), [
      { month: '2026-10', title: '2026 年 10 月', total: 1000, worked: 2 },
      { month: '2026-09', title: '2026 年 9 月', total: 100, worked: 1 }
    ]);
    eq(U.previousMonths({ version: 1, days: {} }, '2026-11'), []);
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
  // o: {settings (object, used as is; default SET_UP), history (object), start (today's start ms, null = not started),
  // first, care (true: QJZ.care runs too)}
  function mk(nowMs, o) {
    o = o || {};
    QJZ.panels._reset();
    QJZ.layouts._reset();
    QJZ.care._reset();
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
    if (o.care) QJZ.care.start({ bridge: bridge, now: function () { return clock.ms; }, heartbeat: false });
    QJZ.app.start({ bridge: bridge, now: function () { return clock.ms; }, tick: false });
    var h = o.history || { version: 1, days: {} }, day = QJZ.time.dayKey(nowMs);
    if (o.start !== null && !h.days[day]) h.days[day] = QJZ.day.manualStart(QJZ.day.empty(day), o.start === undefined ? at(12, 9, 0) : o.start);
    bridge.emit({ type: 'init', settings: JSON.stringify(o.settings === undefined ? SET_UP : o.settings), history: JSON.stringify(h),
      probeMs: null, nowMs: nowMs, version: 't', forceOpaque: !!o.forceOpaque });
    return { bridge: bridge, sent: sent, clock: clock, root: root,
      menu: function (a) { bridge.emit({ type: 'menu', action: a }); },
      tick: function (ms) { clock.ms = ms; QJZ.app.tickNow(); } };
  }
  function done() { QJZ.panels._reset(); QJZ.layouts._reset(); QJZ.care._reset(); QJZ.app._reset(); }
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
    $(e, '[data-pa=toHealth]').click();
    ok(visible($(e, '[data-step="3"]')), 'the reminder step');
    eq(QJZ.app.state.settings.onboarded, false, 'nothing saved before 開始');
    $(e, '[data-pa=go]').click();
    var s = QJZ.app.state.settings;
    eq(s.salary, { mode: 'monthly', amount: 50000, divisor: 30 });
    eq([s.pet.kind, s.pet.skin, s.pet.names.cat, s.onboarded], ['cat', 'p4', '<b>阿橘</b>', true]);
    eq([s.health.asked, s.health.sit.on, s.health.water.on], [true, true, true], 'both reminders, ticked by default');
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

  // §4.6, §4.9 #6: step 3 asks about the one reminder (起來動, and 喝水 with it); both ticked; a tick off is a reminder off.
  function checks(e, scope) {
    return $$(e, scope + ' [role=checkbox]').map(function (c) { return c.getAttribute('aria-checked'); });
  }
  test('panels: onboarding has the reminder step; unticking water saves water off', function () {
    var e = mk(at(12, 10, 0), { settings: null });
    type($(e, '[data-f=amount]'), '50,000');
    $(e, '[data-pa=next]').click();
    ok(visible($(e, '[data-step="2"]')));
    eq(text(e, '[data-step="2"] .pfoot .btn:last-child'), '下一步 →', 'step 2 goes on to step 3');
    eq($(e, '[data-step="2"] [data-pa=go]'), null, 'and does not finish');
    eq($$(e, '[data-step="2"] .stepdots i').length, 3, 'three steps');
    $(e, '[data-skin="cat:p4"]').click();
    $(e, '[data-pa=toHealth]').click();
    var s3 = $(e, '[data-step="3"]');
    ok(visible(s3), 'step 3');
    ok(!visible($(e, '[data-step="2"]')));
    eq(text(e, '[data-step="3"] .ptitle'), '要不要提醒你起來動、喝水？');
    ok(s3.textContent.indexOf('上班一坐就是一整天，我可以幫你記著。') >= 0);
    eq(checks(e, '[data-step="3"]'), ['true', 'true'], 'both ticked');
    eq(text(e, '[data-ck=sit] .lbl'), '每 50 分鐘提醒我起來動一動');
    eq(text(e, '[data-ck=sit] .hint'), '我會跳起來揮手，按「起來了」或「等一下」。', 'no cup for 起來動 (Ruling C8)');
    eq(text(e, '[data-ck=water] .lbl'), '順便提醒我喝水');
    eq(text(e, '[data-ck=water] .hint'), '我會捧著水杯來，一天目標 8 杯，喝了就按「喝了」記一杯。');
    eq(text(e, '[data-step="3"] .pnote'), '🍅 想專心的時候，可以從右鍵選單開始番茄鐘（25 分鐘專心、5 分鐘休息）。這些都能在 設定 → 健康 裡改。');
    eq(text(e, '[data-step="3"] .ob-prev .cap2'), '時間到會像這樣：');
    eq(text(e, '[data-step="3"] .ob-prev .rb-t'), QJZ.prompt.LINES.both[0], 'the preview: the reminder that asks both');
    eq($$(e, '[data-step="3"] .ob-prev .rb-btns button').map(function (b) { return b.textContent; }), ['喝了', '起來了', '等一下']);
    eq($$(e, '[data-step="3"] .ob-prev [data-answer]').length, 0, 'a picture: its buttons answer nothing');
    ok($(e, '[data-step="3"] .ob-prev .po svg') && $(e, '[data-step="3"] .hero .av svg'), 'the pet');
    ok($(e, '[data-step="3"] .ob-prev .po svg').classList.contains('kind-cat'), 'the pet picked on step 2');
    eq($$(e, '[data-step="3"] .stepdots i').map(function (i) { return i.className; }), ['', '', 'on'], 'the third of three');
    eq(text(e, '[data-step="3"] [data-pa=prev]'), '← 上一步');
    eq(text(e, '[data-step="3"] [data-pa=go]'), '開始！');
    $(e, '[data-ck=water]').click();
    eq(checks(e, '[data-step="3"]'), ['true', 'false'], 'water unticked');
    eq(text(e, '[data-step="3"] .ob-prev .rb-t'), QJZ.prompt.LINES.sit[0], 'the preview follows: 起來動 only');
    eq($$(e, '[data-step="3"] .ob-prev .rb-btns button').map(function (b) { return b.textContent; }), ['起來了', '等一下']);
    $(e, '[data-step="3"] [data-pa=prev]').click();
    ok(visible($(e, '[data-step="2"]')), 'back to the pet');
    $(e, '[data-pa=toHealth]').click();
    eq(checks(e, '[data-step="3"]'), ['true', 'false'], 'the ticks are kept');
    eq(QJZ.app.state.settings.onboarded, false);
    $(e, '[data-step="3"] [data-pa=go]').click();
    var h = QJZ.app.state.settings.health;
    eq([h.asked, h.sit.on, h.water.on], [true, true, false]);
    eq(savedSettings(e).health.water.on, false, 'persisted');
    eq(QJZ.reminders.ask(h, 0), { sit: true, water: false }, '起來動 only');
    eq(QJZ.layouts.current(), 'U1');
    done();
  });

  test('panels DOM: the health question comes after the early-leave question, once a session', function () {
    var e = mk(at(12, 10, 0), { settings: READY, history: yesterdayOpen([15, 0]) });
    ok($(e, '.panel.p-question'), 'the early-leave question first');
    $(e, '[data-pa=no]').click();
    ok($(e, '.panel.p-healthAsk'), 'then the reminder question');
    e.menu('layout:U3');   // away without an answer
    eq(QJZ.layouts.current(), 'U3');
    e.menu('settings');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U3', 'not again this session');
    eq(QJZ.app.state.settings.health.asked, false, 'nothing answered');
    done();
    var f = mk(at(12, 10, 0), { settings: READY });
    ok($(f, '.panel.p-healthAsk'), 'asked again at the next start');
    done();
    var g = mk(at(12, 10, 0));
    eq(QJZ.layouts.current(), 'U1', 'answered: never asked');
    done();
  });

  // §5.5: a 1.0 user is asked once, alone; both reminders stay off and nothing is saved until the answer.
  test('panels: the upgrade question saves only when answered', function () {
    function onlyKeysOf(v, shape) {   // v restricted to the keys of the 1.0 file
      if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return v;
      var o = {}; for (var k in shape) o[k] = onlyKeysOf(v[k], shape[k]); return o;
    }
    var simple = JSON.parse(V10.settings);
    simple.layout.mini = true;   // the simplified 1.0 (§4.10): left as the mini badge
    [['1.0', JSON.parse(V10.settings), 'U3'], ['simplified 1.0', simple, 'M3']].forEach(function (c) {
      var e = mk(at(12, 10, 0), { settings: c[1], history: JSON.parse(V10.history) });
      ok($(e, '.panel.p-healthAsk'), c[0] + ': asked at the first start');
      eq(text(e, '.p-healthAsk .ptitle'), '要不要提醒你起來動、喝水？');
      ok(text(e, '.p-healthAsk .hero').indexOf('上班一坐就是一整天，我可以幫你記著。') >= 0);
      eq(checks(e, '.p-healthAsk'), ['true', 'true'], c[0] + ': ticked');
      eq(text(e, '.p-healthAsk [data-ck=sit] .lbl'), '每 50 分鐘提醒我起來動一動');
      ok($(e, '.p-healthAsk .ob-prev .rbub'), 'the preview');
      eq([$(e, '.p-healthAsk .stepdots'), $(e, '.p-healthAsk [data-pa=prev]')], [null, null], 'one question, not a step');
      eq($$(e, '.p-healthAsk .pfoot button').map(function (b) { return b.textContent; }), ['確定']);
      eq(QJZ.reminders.ask(QJZ.app.state.settings.health, 0), { sit: false, water: false }, c[0] + ': off until answered');
      e.menu('settings');   // gone without an answer
      $(e, '[data-act=back]').click();
      eq(QJZ.layouts.current(), c[2], c[0] + ': back to its layout');
      eq(QJZ.app.state.settings.health.asked, false);
      QJZ.app.flush();
      of(e.sent, 'saveSettings').forEach(function (m) { eq(JSON.parse(m.p.text).health.asked, false, c[0] + ': never saved as asked'); });
      done();

      var f = mk(at(12, 10, 0), { settings: c[1], history: JSON.parse(V10.history) });
      ok($(f, '.panel.p-healthAsk'), c[0] + ': asked again at the next start');
      $(f, '.p-healthAsk [data-ck=sit]').click();
      eq(checks(f, '.p-healthAsk'), ['false', 'true']);
      $(f, '[data-pa=askOk]').click();
      eq(QJZ.layouts.current(), c[2], c[0] + ': answered, back to its layout');
      var s = savedSettings(f);
      eq([s.health.asked, s.health.sit.on, s.health.water.on], [true, false, true], c[0] + ': the answer is saved');
      eq(onlyKeysOf(s, c[1]), c[1], c[0] + ': every 1.0 value kept');
      eq(QJZ.reminders.ask(QJZ.app.state.settings.health, 0), { sit: false, water: true });
      f.menu('settings');
      $(f, '[data-act=back]').click();
      eq(QJZ.layouts.current(), c[2], 'never asked again');
      done();
    });
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

  // 1.1.2 review M-2: the question opens by itself (not on purpose, as 設定 and 紀錄 are), so with the money mask on its
  // two amounts are masked; the times are enough to answer.
  test('panels DOM: with the money mask on, the early-leave question shows no amount', function () {
    var s = JSON.parse(JSON.stringify(SET_UP));
    s.privacy = { maskMoney: true };
    var e = mk(at(12, 10, 0), { history: yesterdayOpen([15, 0]), settings: s });
    ok($(e, '.panel.p-question'), 'it asks');
    eq([text(e, '[data-o=qyes]'), text(e, '[data-o=qno]')], ['算到 15:00 ・ NT$ ***', '算到 18:00 ・ NT$ ***']);
    ok(!/\d\.\d\d/.test(e.root.textContent), 'no amount anywhere on it: ' + e.root.textContent);
    done();
    e = mk(at(12, 10, 0), { history: yesterdayOpen([15, 0]) });
    ok(/^算到 15:00 ・ NT\$ [\d,]+\.\d\d$/.test(text(e, '[data-o=qyes]')), 'unmasked: the amount ' + text(e, '[data-o=qyes]'));
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

  // #9: the ten sections of spec 5.3 plus 關於 in the four tabs of 1.0: 薪水和時間 (今天, 薪資, 工時, 起算), 寵物 (寵物, 音效),
  // 畫面 (版型, 動力加成), 其他 (開機, 隱私, 關於); 1.1 adds 健康 after 寵物.
  var PANES = { time: ['today', 'salary', 'hours', 'start'], pet: ['pet', 'sound'], health: ['health'], display: ['layout', 'zoom', 'boost'],
    other: ['autostart', 'privacy', 'about'] };
  test('panels DOM: settings has five tabs (薪水和時間, 寵物, 健康, 畫面, 其他) and remembers the tab', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    ok($(e, '.panel.p-settings'));
    eq(text(e, '.ptitle'), '設定');
    eq($$(e, '[data-tab]').map(function (b) { return b.textContent; }), ['薪水和時間', '寵物', '健康', '畫面', '其他']);
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
    eq(savedSettings(e).display, { opaque: true, powerSaver: false, dark: false });
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

  // §4.9 #7, §5.4: five controls in sight (起來動, 喝水, 每隔, 一天幾杯, 專心); 進階 holds the other four.
  test('panels: 健康 has two cards and a closed 進階', function () {
    var e = mk(at(12, 10, 0), { care: true });
    e.menu('settings');
    $(e, '[data-tab=health]').click();
    ok(visible($(e, '[data-pane=health]')));
    eq($$(e, '[data-pane=health] .card:not(.disc) .ttl').map(function (t) { return t.textContent; }), ['休息提醒', '番茄鐘'], 'two cards');
    function shown() {
      return $$(e, '[data-pane=health] [data-tgl], [data-pane=health] [data-num]').filter(visible).map(function (n) {
        return n.getAttribute('data-tgl') || n.getAttribute('data-num');
      });
    }
    eq(shown(), ['sit', 'water', 'every', 'water.goal', 'pomodoro.focus'], 'five controls');
    function row(sel) { return $(e, sel).closest('.line'); }
    function lbl(sel) { return row(sel).querySelector('.lbl').textContent; }
    eq([lbl('[data-tgl=sit]'), lbl('[data-tgl=water]'), lbl('[data-num=every]'), lbl('[data-num="water.goal"]'), lbl('[data-num="pomodoro.focus"]')],
      ['起來動', '喝水', '每隔', '一天幾杯', '專心']);
    eq(row('[data-tgl=sit]').querySelector('.hint').textContent, '坐好久了，寵物會跳起來揮手叫你。', 'no cup (Ruling C8)');
    eq(row('[data-tgl=water]').querySelector('.hint').textContent, '寵物會捧著水杯提醒你喝水。');
    eq(row('[data-num=every]').querySelector('.hint').textContent, '按「等一下」會晚一點再提醒；番茄鐘的休息也算一次起身。');
    eq(row('[data-num="water.goal"]').querySelector('.hint').textContent, '喝滿目標寵物會很開心。');
    eq(row('[data-num="pomodoro.focus"]').querySelector('.hint').textContent, '專心時寵物戴上耳機、不聊天，提醒會等到休息時再說。');
    ok(text(e, '[data-pane=health]').indexOf('從右鍵或 🍅 按鈕開始') >= 0);
    eq($$(e, '[data-num] [data-o]').filter(visible).map(function (b) { return b.textContent; }), ['50', '8', '25'], 'the defaults');
    eq($$(e, '[data-num] b + span').filter(visible).map(function (b) { return b.textContent; }), ['分鐘', '杯', '分鐘'], 'units');
    eq(text(e, '[data-o=standGoal]'), '起來動目標：每天 9 次（工時 ÷ 間隔，自動算）', '8 h / 50 min');

    // switches
    eq([$(e, '[data-tgl=sit]').getAttribute('aria-checked'), $(e, '[data-tgl=water]').getAttribute('aria-checked')], ['false', 'false']);
    $(e, '[data-tgl=water]').click();
    eq([QJZ.app.state.settings.health.water.on, $(e, '[data-tgl=water]').getAttribute('aria-checked')], [true, 'true']);
    $(e, '[data-tgl=sit]').click();
    eq(QJZ.app.state.settings.health.sit.on, true);

    // steppers: by HEALTH_RANGES, never past its ends
    function plus(k) { $(e, '[data-num="' + k + '"] [data-dir="+"]').click(); }
    function minus(k) { $(e, '[data-num="' + k + '"] [data-dir="-"]').click(); }
    function hs() { return QJZ.app.state.settings.health; }
    plus('every');
    eq(hs().every, 55, 'every 5');
    eq(text(e, '[data-o=standGoal]'), '起來動目標：每天 8 次（工時 ÷ 間隔，自動算）', 'follows: 480 / 55');
    QJZ.app.saveSettings({ health: { every: 120 } });
    plus('every');
    eq(hs().every, 120, '＋ at 120 stays 120');
    ok($(e, '[data-num=every] [data-dir="+"]').disabled, 'and cannot be pressed');
    QJZ.app.saveSettings({ health: { every: 20 } });
    minus('every');
    eq(hs().every, 15, '1.1.1: below 20 now');
    QJZ.app.saveSettings({ health: { every: 5 } });
    minus('every');
    eq(hs().every, 5, '− at 5 stays 5');
    ok($(e, '[data-num=every] [data-dir="-"]').disabled);
    eq(text(e, '[data-o=standGoal]'), '起來動目標：每天 96 次（工時 ÷ 間隔，自動算）', '480 / 5');
    plus('every');
    eq([hs().every, text(e, '[data-o="num.every"]')], [10, '10']);
    minus('water.goal');
    plus('pomodoro.focus');
    eq([hs().water.goal, hs().pomodoro.focus], [7, 30]);
    eq(savedSettings(e).health.pomodoro.focus, 30, 'saved at once');

    // 進階
    var adv = $(e, '[data-disc=adv]');
    ok(adv.textContent.indexOf('進階') >= 0);
    eq(adv.getAttribute('aria-expanded'), 'false', 'closed');
    adv.click();
    eq(shown(), ['sit', 'water', 'every', 'water.goal', 'pomodoro.focus', 'pomodoro.short', 'pomodoro.long', 'pomodoro.longEvery', 'cups'],
      'the other four');
    eq([lbl('[data-num="pomodoro.short"]'), lbl('[data-num="pomodoro.long"]'), lbl('[data-num="pomodoro.longEvery"]'), lbl('[data-num=cups]')],
      ['短休息', '長休息', '每幾顆番茄長休息一次', '今天已喝']);
    eq(['pomodoro.short', 'pomodoro.long', 'pomodoro.longEvery', 'cups'].map(function (k) { return text(e, '[data-o="num.' + k + '"]'); }),
      ['5', '15', '4', '0']);
    eq(row('[data-num="pomodoro.longEvery"]').querySelector('[data-o=roundGoal]').textContent, '每天目標就是一輪：4 顆。');
    plus('pomodoro.long');
    plus('pomodoro.longEvery');
    minus('pomodoro.short');
    eq([hs().pomodoro.long, hs().pomodoro.longEvery, hs().pomodoro.short], [20, 5, 4]);
    eq(text(e, '[data-o=roundGoal]'), '每天目標就是一輪：5 顆。');

    // 今天已喝: a correction of today's cups, never below 0
    function cups() { return QJZ.health.of(QJZ.app.state.today).cups; }
    minus('cups');
    eq([cups(), text(e, '[data-o="num.cups"]')], [0, '0'], '− at 0 stays 0');
    plus('cups');
    eq([cups(), text(e, '[data-o="num.cups"]')], [1, '1'], '＋ → 1 cup');
    eq(JSON.parse(last(e.sent, 'saveHistory').text).days['2026-11-12'].health.cups, 1, 'saved at once');
    $(e, '[data-tab=pet]').click();
    $(e, '[data-tab=health]').click();
    eq(adv.getAttribute('aria-expanded'), 'true', '進階 stays open while the panel is');
    done();

    // a 1.0 user who has not answered: the switches show off; one press is the answer
    var f = mk(at(12, 10, 0), { settings: { salary: READY.salary, onboarded: true, health: { sit: { on: true } } } });
    f.menu('settings');
    $(f, '[data-tab=health]').click();
    eq([$(f, '[data-tgl=sit]').getAttribute('aria-checked'), $(f, '[data-tgl=water]').getAttribute('aria-checked')], ['false', 'false'],
      'off until answered, whatever sit.on says');
    $(f, '[data-tgl=water]').click();
    var h = QJZ.app.state.settings.health;
    eq([h.asked, h.sit.on, h.water.on], [true, false, true], 'what the switches showed, now answered');
    done();
  });

  // 1.1.1 item 5: 「現在提醒我一次」 in the 休息提醒 card asks for a real reminder now (QJZ.care.remindNow). 設定 is open
  // and holds it (Ruling C1), so it shows 3 s after the panel closes, as the hint says. Nothing to ask: off, with a hint.
  test('panels: 現在提醒我一次 asks for a reminder; it shows 3 s after 設定 closes; off, with a hint, when nothing would be asked', function () {
    var on = { salary: READY.salary, onboarded: true, health: { asked: true, sit: { on: true }, water: { on: true } } };
    var e = mk(at(12, 10, 0), { care: true, settings: on });
    e.bridge.emit({ type: 'visibility', visible: true });
    e.menu('settings');
    $(e, '[data-tab=health]').click();
    var btn = $(e, '[data-remind]');
    ok(visible(btn), 'shown');
    eq(btn.closest('.card').querySelector('.ttl').textContent, '休息提醒', 'in the 休息提醒 card');
    eq([btn.tagName, btn.textContent, btn.disabled], ['BUTTON', '現在提醒我一次', false]);
    eq(text(e, '[data-o=remindHint]'), '關掉設定後就會跳出來。');
    btn.click();
    eq(QJZ.care.state.r.forced, true, 'asked for');
    eq(QJZ.care.state.prompt, null, '設定 holds it');
    $(e, '[data-act=back]').click();
    eq(QJZ.layouts.current(), 'U1', '完成');
    e.tick(at(12, 10, 0, 2));
    eq(QJZ.care.state.prompt, null);
    e.tick(at(12, 10, 0, 3));
    eq(QJZ.care.state.prompt && QJZ.care.state.prompt.kind, 'both', '3 s after 設定 closed: what the switches ask');
    ok($(e, '.u1').classList.contains('prompting'), 'the bubble');
    done();

    var f = mk(at(12, 10, 0), { care: true, settings: { salary: READY.salary, onboarded: true, health: { asked: true } } });
    f.menu('settings');
    $(f, '[data-tab=health]').click();
    btn = $(f, '[data-remind]');
    eq([btn.disabled, text(f, '[data-o=remindHint]')], [true, '起來動和喝水都關著，打開一個才能試。'], 'both switches off');
    btn.click();
    eq(QJZ.care.state.r.forced, false, 'and it does nothing');
    $(f, '[data-tgl=water]').click();
    eq([btn.disabled, text(f, '[data-o=remindHint]')], [false, '關掉設定後就會跳出來。'], 'one switch on');
    QJZ.care.setCups(8);
    eq([btn.disabled, text(f, '[data-o=remindHint]')], [true, '今天的水已經喝滿了，喝水提醒明天再來。'], 'water only and the goal reached');
    done();

    var g = mk(at(12, 10, 0), { care: true, settings: READY });   // a 1.0 user who has not answered
    g.menu('settings');
    $(g, '[data-tab=health]').click();
    eq($(g, '[data-remind]').disabled, true, 'not answered yet: off');
    done();
  });

  test('panels: five tabs in order; 畫面 has 深色模式, then the 版型 card with exactly 相容模式 and 省電模式; 動力加成 is unchanged', function () {
    var e = mk(at(12, 10, 0));
    e.menu('settings');
    eq($$(e, '[data-tab]').map(function (b) { return b.textContent; }), ['薪水和時間', '寵物', '健康', '畫面', '其他']);
    $(e, '[data-tab=display]').click();
    eq($$(e, '[data-sec=layout] .card').length, 2, '深色模式, then the 版型 card');
    eq($$(e, '[data-sec=layout] .card [data-tgl]').map(function (t) { return t.getAttribute('data-tgl'); }), ['dark', 'opaque', 'powerSaver']);
    eq($$(e, '[data-sec=layout] .card .row .lbl').map(function (l) { return l.textContent; }), ['深色模式', '相容模式（不透明背景）', '省電模式']);
    eq($$(e, '[data-sec=layout] .card [data-f], [data-sec=layout] .card [data-seg], [data-sec=layout] .card [data-num]').length, 0, 'nothing else');
    eq($(e, '[data-tgl=powerSaver]').closest('.line').querySelector('.hint').textContent, '金額每秒跳 4 次、少一點動畫，比較省電；筆電建議打開。');
    ok(text(e, '[data-pane=display]').replace(text(e, '[data-pane=display] .lays'), '').indexOf('膠囊') < 0, 'no capsule position (§4.9 #12; 1.1.9: only the layout card 6 頂端小膠囊)');
    var ps = $(e, '[data-tgl=powerSaver]');
    eq(ps.getAttribute('aria-checked'), 'false', 'off by default');
    ps.click();
    eq([QJZ.app.state.settings.display.powerSaver, ps.getAttribute('aria-checked')], [true, 'true']);
    eq(savedSettings(e).display, { opaque: false, powerSaver: true, dark: false });
    ps.click();
    eq(QJZ.app.state.settings.display.powerSaver, false);
    eq(QJZ.app.state.settings.display.opaque, false, '相容模式 untouched');
    // 動力加成: 里程碑金額 and 換算物品, as in 1.0
    eq($$(e, '[data-sec=boost] .card').length, 2);
    eq($$(e, '[data-sec=boost] [data-tgl], [data-sec=boost] [data-num]').length, 0);
    ok($(e, '[data-sec=boost] [data-f=milestone]') && $(e, '[data-sec=boost] [data-items]') && $(e, '[data-sec=boost] [data-pa=addItem]'));
    eq($$(e, '[data-sec=boost] .lbl').map(function (l) { return l.textContent; }), ['里程碑金額', '換算物品']);
    done();
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

  // 1.1.4 item 2: the pet section fits its window: in every layout's 設定 (in its window: 1 2 3 4; beside it: 5 6 7 8) and in
  // onboarding, every skin (its avatar, the ring round the one picked, its ✓ and its name) stays inside its card, nothing
  // scrolls sideways, and all ten are there.
  function petFits(e, where, scope) {
    var cards = $$(e, scope + ' .card').filter(function (c) { return c.querySelector('[data-skin]'); });
    eq(cards.length, 1, where + ': the picker card');
    var cr = cards[0].getBoundingClientRect(), cs = getComputedStyle(cards[0]);
    var L = cr.left + parseFloat(cs.borderLeftWidth), R = cr.right - parseFloat(cs.borderRightWidth);
    var skins = $$(e, scope + ' [data-skin]');
    eq(skins.length, 10, where + ': all ten skins');
    skins.forEach(function (b) {
      var av = b.querySelector('.av').getBoundingClientRect(), nm = b.querySelector('small').getBoundingClientRect(), br = b.getBoundingClientRect();
      var id = b.getAttribute('data-skin');
      ok(av.width >= 36, where + ' ' + id + ': the avatar stays big enough to see: ' + av.width);
      ok(av.left - 5 >= L && av.right + 5 <= R, where + ' ' + id + ': its avatar and the picked ring inside the card ' + JSON.stringify([av.left, av.right, L, R]));
      ok(nm.left >= L && nm.right <= R && nm.left >= br.left - 1 && nm.right <= br.right + 1, where + ' ' + id + ': its name inside it ' +
        JSON.stringify([nm.left, nm.right, br.left, br.right]));
      ok(br.right + 2 <= R, where + ' ' + id + ': its cell inside the card');
      ok(br.width >= 44, where + ' ' + id + ': a column as wide as a four-character name: ' + br.width);
      ok(nm.width <= br.width, where + ' ' + id + ': the name never reaches into the gap');
      if (b.classList.contains('on')) {   // the ✓ on the avatar's corner (review M-4), inside the card
        var ck = getComputedStyle(b.querySelector('.avw'), '::after'), w = b.querySelector('.avw').getBoundingClientRect();
        eq(ck.content, '"✓"', where + ': the ✓');
        ok(Math.abs(w.width - av.width) < 0.5 && Math.abs(w.left - av.left) < 0.5, where + ': on the avatar');
        ok(w.right - parseFloat(ck.right) <= R && w.top + parseFloat(ck.top) >= cr.top, where + ': the ✓ inside the card');
      }
    });
    var sc = $(e, '.pscroll');
    if (sc) ok(sc.scrollWidth <= sc.clientWidth, where + ': nothing scrolls sideways ' + sc.scrollWidth + ' > ' + sc.clientWidth);
    var win = $(e, '.win.panel').getBoundingClientRect();
    ok(cr.right <= win.right, where + ': the card inside the window');
    // the user's note: in a wide panel the five are not spread across the card (no gap much wider than the narrow ones')
    var avs = skins.slice(0, 5).map(function (b) { return b.querySelector('.av').getBoundingClientRect(); });
    for (var i = 1; i < 5; i++) ok(avs[i].left - avs[i - 1].right <= 14, where + ': the avatars sit close together: ' + (avs[i].left - avs[i - 1].right));
  }
  test('panels DOM: 1.1.4 item 2: the pet picker fits in every layout\'s 設定 and in onboarding', function () {
    ['U1', 'U3', 'U12', 'U13', 'U5B', 'U10', 'M3', 'U7'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { first: name });
      e.menu('settings');
      $(e, '[data-tab=pet]').click();
      $$(e, '[data-skin="cat:p4"]')[0].click();   // the picked one has the ring and the ✓
      petFits(e, name + ' 設定', '[data-sec=pet]');
      done();
    });
    var o = mk(at(12, 10, 0), { settings: null });
    type($(o, '[data-f=amount]'), '50,000');
    $(o, '[data-pa=next]').click();
    ok(visible($(o, '[data-step="2"]')), 'onboarding: the pet step');
    $$(o, '[data-step="2"] [data-skin="cat:p4"]')[0].click();
    petFits(o, 'onboarding', '[data-step="2"]');
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

    // #12: no start-layout picker, no topmost switches (the menu's 版型 ▶ 永遠在最上層), only 相容模式, 1.1's 省電模式 and 1.1.5's 深色模式
    $(e, '[data-tab=display]').click();
    eq([$(e, '[data-seg=layoutStart]'), $(e, '[data-tgl^="top."]')], [null, null]);
    eq($$(e, '[data-sec=layout] [data-tgl]').map(function (t) { return t.getAttribute('data-tgl'); }), ['dark', 'opaque', 'powerSaver']);
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
    var volLine = $(e, '[data-f=volume]').closest('.line');
    ok(volLine.hidden && !volLine.getClientRects().length, '1.1.3 C5: 音量 does not show while 音效 is off');
    $(e, '[data-tgl=sound]').click();
    ok(!volLine.hidden && volLine.getClientRects().length > 0, '音效 on: 音量 shows');
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

  test('panels DOM: history: 統計 opens on this month\'s 收入, a bar per date, 本月合計, previous months', function () {
    var h = sampleHistory();
    delete h.days['2026-11-12'];
    var e = mk(at(12, 10, 0), { history: h });
    e.menu('history');
    ok($(e, '.panel.p-history'));
    eq(text(e, '.ptitle'), '紀錄');
    eq(text(e, '[data-o=stTitle]'), '2026 年 11 月');
    eq($$(e, '[data-stseg] .on').map(function (b) { return b.textContent; }), ['月', '收入']);
    eq($$(e, '.hist-chart [data-bar]').length, 30, 'one slot per date');
    eq($$(e, '.hist-chart rect.bar').length, 4, '3 completed days that earned something + today; the 0 day has no bar');
    var zero = $$(e, '.hist-chart [data-bar]')[5];
    eq(zero.querySelector('rect.bar'), null, 'a closed off day with 0 draws nothing, not a 2px stub');
    ok(zero.querySelector('title').textContent.indexOf('NT$ 0.00') >= 0, 'but its tooltip still says 0');
    var total = QJZ.history.monthTotal(QJZ.app.state.history, '2026-11', QJZ.app.state.today, QJZ.app.state.snap.earned);
    eq(text(e, '[data-o=sumLabel]'), '本月合計');
    eq(text(e, '[data-o=total]'), 'NT$ ' + QJZ.odometer.format(total));
    eq(text(e, '[data-o=avg]'), 'NT$ 1,924.41', '(2000 + 1500.5 + 2272.73 the 5th, closed at start) / 3: the off day and today left out');
    eq(text(e, '[data-o=avgNote]'), '只算有紀錄的 3 天（今天還沒過完，不算）');
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

  // the drawn bars: their height and the value they stand for
  function bars(e) {
    return $$(e, '.hist-chart rect.bar').map(function (r) { return { h: +r.getAttribute('height'), v: +r.parentNode.getAttribute('data-v') }; });
  }
  test('panels DOM: 統計: 週 and each item, drawn to scale, the labels the values', function () {
    var h = sampleHistory();
    h.days['2026-11-09'] = QJZ.health.withHealth({ day: '2026-11-09', earned: 1000 }, { cups: 6, tomatoes: 3, standups: 4 });
    h.days['2026-11-10'] = QJZ.health.withHealth({ day: '2026-11-10', earned: 2000 }, { cups: 3, tomatoes: 0, standups: 2 });
    var e = mk(at(12, 10, 0), { history: h, care: true });
    QJZ.care.setCups(2);
    e.menu('history');
    $(e, '[data-stseg=period] [data-st=week]').click();
    eq(text(e, '[data-o=stTitle]'), '11/09 – 11/15');
    eq($$(e, '.hist-chart [data-bar]').length, 7);
    eq($$(e, '.hist-chart .xl').map(function (t) { return t.textContent; }).join(''), '一二三四五六日');
    eq(text(e, '[data-o=sumLabel]'), '本週合計');
    $(e, '[data-stseg=metric] [data-st=cups]').click();
    eq($$(e, '[data-stseg] .on').map(function (b) { return b.textContent; }), ['週', '喝水']);
    ok($(e, '.hist-chart svg').classList.contains('m-cups'));
    eq(text(e, '[data-o=total]'), '11 杯', '6 + 3 + today 2');
    eq(text(e, '[data-o=avg]'), '4.5 杯');
    var b = bars(e), ph = 150 - 14 - 20, top = QJZ.stats.top(6, 'cups');
    eq(b.map(function (x) { return x.v; }), [6, 3, 2]);
    b.forEach(function (x) { near(x.h, x.v / top * ph, 0.06, 'to scale: ' + x.v); });
    eq($$(e, '.hist-chart .yl').map(function (t) { return t.textContent; }), [String(top / 2), String(top)]);
    eq($$(e, '.hist-chart .vl').map(function (t) { return t.textContent; }), ['6', '3', '2'], 'the week shows each value on its bar');
    $(e, '[data-stseg=metric] [data-st=standups]').click();
    eq([text(e, '[data-o=total]'), text(e, '[data-o=avg]')], ['6 次', '3 次']);
    $(e, '[data-stseg=metric] [data-st=tomatoes]').click();
    eq([text(e, '[data-o=total]'), text(e, '[data-o=avg]')], ['3 顆', '3 顆'], 'the 0 day is no data for the average');
    $(e, '[data-stseg=metric] [data-st=earned]').click();
    var eb = bars(e), etop = QJZ.stats.top(2000, 'earned');
    eb.forEach(function (x) { near(x.h, x.v / etop * ph, 0.06, 'to scale: ' + x.v); });
    eq($$(e, '.hist-chart .yl').map(function (t) { return t.textContent; }), ['1,000', '2,000']);
    done();
  });

  // review I-2: a tick moves today's bar in place; the chart is not drawn again, so a tooltip held on a bar stays
  test('panels DOM: 統計: a tick moves only today\'s bar, its tip and the sums; the past bars stay the same elements', function () {
    var e = mk(at(12, 10, 0), { history: sampleHistory() });
    e.menu('history');
    var svg = $(e, '.hist-chart svg'), past = $$(e, '.hist-chart [data-bar]')[1], pastRect = past.querySelector('rect.bar');
    var today = $(e, '.hist-chart [data-today]'), h0 = +today.querySelector('rect.bar').getAttribute('height');
    var total0 = text(e, '[data-o=total]'), tip0 = today.querySelector('title').textContent;
    e.tick(at(12, 11, 0));
    ok($(e, '.hist-chart svg') === svg && $$(e, '.hist-chart [data-bar]')[1] === past && past.querySelector('rect.bar') === pastRect,
      'the same svg and past bar');
    ok($(e, '.hist-chart [data-today]') === today, 'today\'s bar is the same element');
    var h1 = +today.querySelector('rect.bar').getAttribute('height'), v1 = QJZ.app.state.snap.earned;
    ok(h1 > h0, 'taller: ' + h0 + ' -> ' + h1);
    near(h1, v1 / QJZ.stats.top(2272.73, 'earned') * (150 - 14 - 20), 0.06, 'still to scale');
    near(+today.querySelector('rect.bar').getAttribute('y') + h1, 150 - 20, 0.06, 'on the base line');
    ok(text(e, '[data-o=total]') !== total0 && today.querySelector('title').textContent !== tip0, 'the sum and its tip follow');
    eq(text(e, '[data-o=total]'), 'NT$ ' + QJZ.odometer.format(QJZ.history.monthTotal(QJZ.app.state.history, '2026-11', QJZ.app.state.today, v1)));
    $(e, '[data-stseg=metric] [data-st=cups]').click();
    ok($(e, '.hist-chart svg') !== svg, 'another item draws it again');
    done();
  });

  // 1.1.5 review: ◀ ▶
  test('panels DOM: 統計 ◀ ▶: back to the earliest period with a record, ▶ off at today\'s; a past period\'s sums', function () {
    var e = mk(at(12, 10, 0), { history: sampleHistory() });   // the earliest record: 2026-09-01
    e.menu('history');
    function nav() { return $$(e, '[data-stnav]').map(function (b) { return b.disabled; }); }
    function back() { $(e, '[data-stnav="-1"]').click(); }
    eq(nav(), [false, true], 'today\'s month: ▶ off');
    eq($(e, '[data-stnav="-1"]').getAttribute('aria-label'), '上一月');
    back();
    eq([text(e, '[data-o=stTitle]'), nav()], ['2026 年 10 月', [false, false]]);
    eq($$(e, '.hist-chart [data-bar]').length, 31);
    eq($$(e, '.hist-chart [data-today]').length, 0, 'no 今天 bar');
    eq(text(e, '[data-o=sumLabel]'), '合計');
    eq(text(e, '[data-o=total]'), 'NT$ 1,000.00', '999 + 1 (the open 10-29 is no data)');
    eq([text(e, '[data-o=avg]'), text(e, '[data-o=avgNote]')], ['NT$ 500.00', '只算有紀錄的 2 天'], 'no 今天還沒過完');
    $(e, '[data-stseg=metric] [data-st=cups]').click();
    eq(text(e, '[data-o=stTitle]'), '2026 年 10 月', 'another item keeps the period');
    eq([text(e, '[data-o=total]'), text(e, '[data-o=avg]'), text(e, '[data-o=avgNote]')], ['0 杯', '—', '這段時間沒有可以平均的日子']);
    $(e, '[data-stseg=metric] [data-st=earned]').click();
    back();
    eq([text(e, '[data-o=stTitle]'), nav()], ['2026 年 9 月', [true, false]], 'the earliest: ◀ off');
    back();
    eq(text(e, '[data-o=stTitle]'), '2026 年 9 月', 'a click on it does nothing');
    var svg = $(e, '.hist-chart svg');
    e.tick(at(12, 11, 0));
    ok($(e, '.hist-chart svg') === svg, 'a past period is not drawn again on a tick');
    $(e, '[data-stnav="1"]').click();
    $(e, '[data-stnav="1"]').click();
    eq([text(e, '[data-o=stTitle]'), nav(), text(e, '[data-o=sumLabel]')], ['2026 年 11 月', [false, true], '本月合計'], 'forward to today\'s');
    back();
    $(e, '[data-stseg=period] [data-st=week]').click();
    eq([text(e, '[data-o=stTitle]'), nav()[1]], ['11/09 – 11/15', true], '週 / 月 goes back to today\'s period');
    back();
    eq([text(e, '[data-o=stTitle]'), $(e, '[data-stnav="-1"]').getAttribute('aria-label')], ['11/02 – 11/08', '上一週']);
    done();
  });

  test('panels DOM: 統計 while the money is masked: *** for 收入, the bars stay; the counts show', function () {
    var s = JSON.parse(JSON.stringify(SET_UP));
    s.privacy = { maskMoney: true };
    var e = mk(at(12, 10, 0), { history: sampleHistory(), settings: s });
    e.menu('history');
    eq(text(e, '[data-o=total]'), 'NT$ ***');
    eq(text(e, '[data-o=avg]'), 'NT$ ***');
    ok($$(e, '.hist-chart rect.bar').length > 0, 'the bars stay');
    eq($$(e, '.hist-chart .yl').map(function (t) { return t.textContent; }), ['***', '***']);
    ok($$(e, '.hist-chart title').every(function (t) { return !/\d,\d|\d\.\d\d/.test(t.textContent); }), 'no amount in a tip');
    $(e, '[data-stseg=period] [data-st=week]').click();
    eq($$(e, '.hist-chart .vl').length, 0, 'no value on a bar');
    $(e, '[data-stseg=metric] [data-st=cups]').click();
    ok(/杯$/.test(text(e, '[data-o=total]')), 'a count is no money');
    done();
  });

  // 1.1.5 review: 之前的月份 follow 隱藏金額 too, and masking moves nothing in the list
  test('panels DOM: 之前的月份 read NT$ *** while masked, and keep their place', function () {
    var e = mk(at(12, 10, 0), { history: sampleHistory() });
    e.menu('history');
    var nums = function () { return $$(e, '[data-o=months] li .num'); };
    var rects = function () { return $$(e, '[data-o=months] li').map(function (li) { var r = li.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); }); };
    var numRects = function () { return nums().map(function (n) { var r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }); };
    eq(nums().map(function (n) { return n.textContent; }), ['NT$ 1,000.00', 'NT$ 100.00']);
    var before = rects(), nb = numRects();
    QJZ.app.saveSettings({ privacy: { maskMoney: true } });
    eq(nums().map(function (n) { return n.textContent; }), ['NT$ ***', 'NT$ ***']);
    ok(nums().every(function (n) { return n.getAttribute('data-ghost').indexOf('NT$ 1') === 0; }), 'each keeps its amount\'s room');
    eq(rects(), before, 'the rows do not move');
    ok(nums().every(function (n) { var t = n.parentNode.querySelector('.mt').getBoundingClientRect(), r = n.getBoundingClientRect();
      return Math.abs((r.top + r.bottom) / 2 - (t.top + t.bottom) / 2) < 5 && Math.abs(r.right - n.parentNode.getBoundingClientRect().right) < 2; }),
      'each on the line of its row, at its right end');
    eq(numRects(), nb, 'nor the amounts\' boxes');
    eq($$(e, '[data-o=months] li .md').map(function (n) { return n.textContent; }), ['上班 2 天', '上班 1 天'], 'the days still show');
    QJZ.app.saveSettings({ privacy: { maskMoney: false } });
    eq(nums()[0].textContent, 'NT$ 1,000.00', 'shown again');
    done();
  });

  test('panels DOM: 統計 fits the 300 px panel in U13\'s window', function () {
    var e = mk(at(12, 10, 0), { history: sampleHistory(), first: 'U13' });
    e.menu('history');
    var card = $(e, '[data-o=stats]'), svg = $(e, '.hist-chart svg');
    ok($(e, '.panel.inplace'), 'in place');
    ok(card.getBoundingClientRect().right <= $(e, '.panel').getBoundingClientRect().right, 'inside the panel');
    ok(+svg.getAttribute('width') <= card.clientWidth, 'the chart inside its card: ' + svg.getAttribute('width') + ' / ' + card.clientWidth);
    near(svg.getBoundingClientRect().width, +svg.getAttribute('width'), 1, 'drawn at its shown size (its text at 10 px)');
    $$(e, '[data-stseg] button').forEach(function (b) { ok(b.scrollWidth <= b.clientWidth + 1, 'a switch fits: ' + b.textContent); });
    $(e, '[data-stnav="-1"]').click();   // the longest title, 2026 年 10 月, between ◀ ▶ and beside 週 / 月
    var top = $(e, '.stats .hist-top'), cr = card.getBoundingClientRect();
    ok(top.scrollWidth <= top.clientWidth + 1, 'the title row fits: ' + top.scrollWidth + ' / ' + top.clientWidth);
    [$(e, '[data-stnav="1"]'), $(e, '[data-stseg=period]')].forEach(function (n) { ok(n.getBoundingClientRect().right <= cr.right - 2, 'inside the card'); });
    eq(Math.round($(e, '[data-stnav="-1"]').getBoundingClientRect().top), Math.round($(e, '[data-stnav="1"]').getBoundingClientRect().top), 'one line');
    done();
  });

  test('panels: the history panel shows the calendar under the chart', function () {
    var h = sampleHistory();
    h.days['2026-11-03'] = QJZ.health.withHealth(h.days['2026-11-03'], { cups: 8, cupGoal: 8, tomatoes: 2 });
    var e = mk(at(12, 10, 0), { history: h, care: true });
    e.menu('history');
    var card = $(e, '[data-o=cal]');
    ok(card && card.previousElementSibling && card.previousElementSibling.querySelector('[data-o=chart]'), 'under the chart card');
    ok(text(e, '[data-o=calLegend]').indexOf('✓ = 喝滿 8 杯') >= 0, text(e, '[data-o=calLegend]'));
    eq($$(e, '[data-o=calGrid] .cc').length, 30, 'a cell per day');
    var c3 = $$(e, '[data-o=calGrid] .cc')[2];
    ok(c3.classList.contains('full') && c3.textContent.indexOf('✓') >= 0 && c3.querySelector('.ct').textContent.indexOf('2') >= 0, 'full day, tomatoes 2');
    eq(text(e, '[data-o=calSum]'), '本月 8 杯 ・ 2 顆');
    ok($$(e, '[data-o=calGrid] .cc')[11].classList.contains('today'));
    QJZ.care.setCups(3);
    eq(text(e, '[data-o=calSum]'), '本月 11 杯 ・ 2 顆', 'today updates live');
    ok($$(e, '[data-o=calGrid] .cc')[11].classList.contains('l2'), 'level 2 for 3 of 8');
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
  // ---------- 1.1.5 item 3: 深色模式 ----------
  test('panels DOM: 深色模式 in 畫面: off by default, a press saves it and darkens the page at once', function () {
    var e = mk(at(12, 10, 0));
    var root = document.documentElement;
    eq(root.classList.contains('dark'), false, 'off by default');
    e.menu('settings');
    $(e, '[data-tab=display]').click();
    var t = $(e, '[data-tgl=dark]');
    eq(t.getAttribute('aria-checked'), 'false');
    eq(t.closest('.line').querySelector('.hint').textContent, '視窗、設定和紀錄換成深色；寵物的顏色不變。不會跟著 Windows 切換。');
    t.click();
    eq([QJZ.app.state.settings.display.dark, t.getAttribute('aria-checked'), root.classList.contains('dark')], [true, 'true', true]);
    eq(savedSettings(e).display, { opaque: false, powerSaver: false, dark: true });
    t.click();
    eq([QJZ.app.state.settings.display.dark, root.classList.contains('dark')], [false, false]);
    t.click();
    done();
    eq(root.classList.contains('dark'), false, 'a reset drops html.dark');
    var s = JSON.parse(JSON.stringify(SET_UP));
    s.display = { dark: true };
    mk(at(12, 10, 0), { settings: s });
    eq(root.classList.contains('dark'), true, 'from settings.json at start');
    done();
  });

  test('panels DOM: 深色模式 keeps the typeface of the clock and the money, and the money keeps an outline', function () {
    function look(dark) {
      var s = JSON.parse(JSON.stringify(SET_UP));
      s.display = { dark: dark };
      var e = mk(at(12, 10, 0), { settings: s, first: 'U1' });
      var m = getComputedStyle($(e, '.u1 .money')), c = getComputedStyle($(e, '.u1 .clock'));
      var out = { money: m.fontFamily, clock: c.fontFamily, weight: m.fontWeight, size: m.fontSize, shadow: m.textShadow, color: m.color };
      done();
      return out;
    }
    var light = look(false), dark = look(true);
    eq([dark.money, dark.clock, dark.weight, dark.size], [light.money, light.clock, light.weight, light.size], 'the same font, weight and size');
    ok(/Fredoka/.test(dark.money) && /Fredoka/.test(dark.clock), dark.money);
    ok(dark.shadow !== 'none' && (dark.shadow.match(/rgb/g) || []).length === 9, 'the same nine-part outline: ' + dark.shadow);
    ok(dark.shadow !== light.shadow && dark.color !== 'rgb(244, 233, 218)', 'in its dark colours, the digits still orange: ' + dark.color);
  });

  // WCAG contrast of two computed colours (rgb / rgba strings; alpha over the colour under it is the caller's job)
  function rgb(c) { var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; var p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function lum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function over(top, under) { var a = top.a; return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 }; }
  // The colour behind el: the solid (or blended) background colours of it and its ancestors, up to the first opaque one;
  // null when a background image (a gradient, the room) or nothing at all (a transparent window) is behind it.
  function backdrop(el, stop) {
    var stack = [];
    for (var n = el; n && n !== stop.parentNode; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') return null;
      var c = rgb(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    }
    if (!stack.length || stack[stack.length - 1].a < 1) return null;
    var out = stack.pop();
    while (stack.length) out = over(stack.pop(), out);
    return out;
  }
  // every shown element with text of its own in box, outside the pet and its room: [text, contrast]
  function contrasts(box) {
    var res = [];
    Array.prototype.forEach.call(box.querySelectorAll('*'), function (el) {
      if (el.closest('svg:not(.ic), .scene, .po, .av, [data-pet], [aria-hidden=true], .msk')) return;
      var own = el.tagName === 'SELECT' || Array.prototype.some.call(el.childNodes, function (t) { return t.nodeType === 3 && t.nodeValue.trim(); });
      if (!own || !el.getClientRects().length) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity < 1 || el.closest('[disabled], .inert, .nil, .done')) return;
      var bg = backdrop(el, box), fg = rgb(cs.color);
      if (!bg || !fg) return;
      var a = lum(over(fg, bg)), b = lum(bg);
      res.push([el.textContent.trim().slice(0, 16), (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)]);
    });
    return res;
  }
  function allLegible(e, where) {
    var list = contrasts(e.root), low = list.filter(function (x) { return x[1] < 4.5; });
    ok(list.length > 0, where + ': some text checked');
    eq(low.map(function (x) { return x[0] + ' ' + x[1].toFixed(2); }), [], where + ': every text at least 4.5:1');
  }

  test('panels DOM: 深色模式: every text on the 8 layouts, 設定 (each tab), 紀錄 and the onboarding is at least 4.5:1', function () {
    var s = JSON.parse(JSON.stringify(SET_UP));
    s.display = { dark: true };
    s.health = { asked: true, water: { on: true }, sit: { on: true } };
    ['U1', 'U3', 'U5B', 'U7', 'M3', 'U10', 'U12', 'U13'].forEach(function (name) {
      var e = mk(at(12, 10, 0), { settings: s, first: name, care: true, history: sampleHistory() });
      ok(document.documentElement.classList.contains('dark'), name);
      allLegible(e, name);
      if (name === 'U1' || name === 'U13') {
        e.menu('settings');
        ['time', 'pet', 'health', 'display', 'other'].forEach(function (t) { $(e, '[data-tab=' + t + ']').click(); allLegible(e, name + ' 設定 ' + t); });
        $(e, '[data-tab=display]').click();
        ok($(e, 'select.zoom') && contrasts($(e, '[data-pane=display]')).some(function (x) { return /%/.test(x[0]); }), name + ': the 縮放比例 list is checked');
        [['latest', '1.1.6'], ['newer', '1.2.0'], ['unknown', null]].forEach(function (u) {   // 檢查更新's three results
          $(e, '[data-tab=other]').click();
          e.bridge.emit({ type: 'updateResult', kind: u[0], version: u[1], install: u[0] === 'newer' });
          allLegible(e, name + ' 檢查更新 ' + u[0]);
        });
        QJZ.app.installUpdate();   // 1.1.6 一鍵更新: 更新 disabled, 下載中, then 更新失敗 and its link
        e.bridge.emit({ type: 'updateState', phase: 'downloading', percent: 42 });
        allLegible(e, name + ' 下載中');
        e.bridge.emit({ type: 'updateState', phase: 'failed' });
        allLegible(e, name + ' 更新失敗');
        $(e, '[data-act=back]').click();
        e.menu('history');
        allLegible(e, name + ' 紀錄');
        ['cups', 'standups', 'tomatoes'].forEach(function (m) { $(e, '[data-stseg=metric] [data-st=' + m + ']').click(); });
        $(e, '[data-stseg=period] [data-st=week]').click();
        allLegible(e, name + ' 紀錄 週');
      }
      done();
    });
    var o = JSON.parse(JSON.stringify(s));
    o.onboarded = false;
    var f = mk(at(12, 10, 0), { settings: o });
    ok($(f, '.panel.p-onboarding'));
    allLegible(f, 'onboarding 1');
    $(f, '[data-pa=next]').click();
    allLegible(f, 'onboarding 2');
    $(f, '[data-pa=toHealth]').click();
    allLegible(f, 'onboarding 3');
    done();
  });

})();
