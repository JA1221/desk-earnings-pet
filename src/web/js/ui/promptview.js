window.QJZ = window.QJZ || {};
// The reminder and pomodoro prompt in the layouts (spec §4.2 大泡泡 / 寵物捧著水杯, §5.1 不同版型的提醒長什麼樣, §5.2).
// QJZ.care decides what shows and when (its prompt events, QJZ.prompt.view); this only draws it, in the slots of the
// layout markup (QJZ.templates), ported from the mockup's .rbub / .rb-btns (docs/prototypes/v1.1: B_U1_s/w, C_U3_b,
// B_U7_s/w, B_M3_s/w, C_U5_b; 1.1's layouts G_U10_rem, G_U12_rem, G_U13_rem):
//   [data-prompt]       U1, U3, U7, M3, U12: one big bubble (M3's is the small one, .sm; U12's the small one in the row
//                       beside the pet, .sm.inl). U1 / U3: at the top right, the tail down at the pet; U7 / M3 / U12: right
//                       of the pet, the tail back at it (health.css grows U7 / M3 right).
//   [data-prompt-line]  U5-B's top line: the title as a pill, the small buttons after it on the same line.
//   [data-prompt-call]  U10's capsule, like an incoming call: the title over the sub (and the water line), the buttons
//                       after them.
//   [data-prompt-ring]  inside U13's big ring (Ruling C4): the icon, the sub, the title, the water line, the buttons.
// The layout root carries .prompting while a prompt shows. Nothing here loops or takes the keyboard.
//   render(layoutEl, layoutName, view)  draws view = {kind, icon, title, sub, waterLine, buttons:[{id, label}]}: the
//       title, sub, water line and buttons in order (U5-B: the title and the buttons). Each button is a
//       <button data-answer="<id>" data-hit>. Texts go in through textContent; focus() is never called. A null view
//       clears. -> true when the layout has a slot for it.
//   clear(layoutEl)  empties the slots and drops .prompting.
//   wave(layoutEl, layoutName)  one knock (§4.2 敲窗): M3's ring, U13's big ring, U5-B's pill, U10's capsule (a pop, as
//       a call rings), else the bubble. Each call is one run that replaces the last, never a loop. -> the Animation, or
//       null.
QJZ.promptView = (function () {
  var TAIL = { U1: 't-bl', U3: 't-bl', U7: 't-l', M3: 't-l', U12: 't-l' };
  var SMALL = { M3: ' sm', U12: ' sm inl' };
  var KNOCKS = { M3: '.ring', U13: '.bigring', U10: '.isl' };   // what knocks instead of the bubble
  var TONE = { drop: 'w', rest: 'r', tom: 't' };       // the icon disc's colour (stand: the bar's yellow)
  var BTN = { drink: 'drink', up: 'ok', ok: 'ok', next: 'ok' };   // 喝了 water blue, the main answer yellow
  var KNOCK_ID = 'qjz-knock', KNOCK_MS = 900;
  var knocking = typeof WeakMap === 'function' ? new WeakMap() : null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function icon(name, cls) {
    var n = el('span', cls);
    n.innerHTML = QJZ.icons ? QJZ.icons.svg(name) : '';   // static markup (QJZ.icons)
    return n;
  }
  function buttons(list, tag) {
    var row = el(tag, 'rb-btns');
    (list || []).forEach(function (b) {
      var n = el('button', BTN[b.id] || '', b.label);
      n.type = 'button';
      n.setAttribute('data-answer', b.id);
      n.setAttribute('data-hit', '');
      row.appendChild(n);
    });
    return row;
  }
  function waterLine(view, cls) {
    var w = el('small', cls);
    w.innerHTML = QJZ.icons ? QJZ.icons.svg('drop') : '';   // static markup (QJZ.icons)
    w.appendChild(document.createTextNode(view.waterLine));
    return w;
  }
  function bubble(view, name) {
    var b = el('div', 'rbub ' + (TAIL[name] || 't-bl') + (SMALL[name] || ''));
    b.setAttribute('data-hit', '');
    b.appendChild(icon(view.icon, 'rb-ic' + (TONE[view.icon] ? ' ' + TONE[view.icon] : '')));
    b.appendChild(el('b', 'rb-t', view.title));
    if (view.sub) b.appendChild(el('small', 'rb-s', view.sub));
    if (view.waterLine) b.appendChild(waterLine(view, 'rb-w'));
    b.appendChild(buttons(view.buttons, 'div'));
    return b;
  }
  function call(view) {
    var f = document.createDocumentFragment(), col = el('span', 'icol');
    col.appendChild(el('b', 'imsg', view.title));
    if (view.sub) col.appendChild(el('span', 'isub', view.sub));
    if (view.waterLine) col.appendChild(waterLine(view, 'isub'));
    f.appendChild(col);
    f.appendChild(buttons(view.buttons, 'span'));
    return f;
  }
  function ringed(view) {
    var f = document.createDocumentFragment();
    f.appendChild(icon(view.icon, 'rb-ic2'));
    if (view.sub) f.appendChild(el('small', 'rb-s', view.sub));
    f.appendChild(el('b', 'rb-t', view.title));
    if (view.waterLine) f.appendChild(waterLine(view, 'rb-w'));
    f.appendChild(buttons(view.buttons, 'div'));
    return f;
  }
  function line(view) {
    var f = document.createDocumentFragment(), call = icon(view.icon, 'call' + (TONE[view.icon] ? ' ' + TONE[view.icon] : ''));
    call.appendChild(el('span', 'ct', view.title));
    f.appendChild(call);
    f.appendChild(buttons(view.buttons, 'span'));
    return f;
  }
  var SLOTS = '[data-prompt],[data-prompt-line],[data-prompt-call],[data-prompt-ring]';
  function slots(layoutEl) { return Array.prototype.slice.call(layoutEl.querySelectorAll(SLOTS)); }

  function render(layoutEl, layoutName, view) {
    if (!layoutEl) return false;
    if (!view) { clear(layoutEl); return false; }
    var slot = layoutEl.querySelector(SLOTS);   // a layout has one
    if (!slot) return false;
    slot.textContent = '';
    slot.appendChild(slot.hasAttribute('data-prompt-line') ? line(view) : slot.hasAttribute('data-prompt-call') ? call(view) :
      slot.hasAttribute('data-prompt-ring') ? ringed(view) : bubble(view, layoutName));
    slot.hidden = false;
    layoutEl.classList.add('prompting');
    return true;
  }
  function clear(layoutEl) {
    if (!layoutEl) return;
    slots(layoutEl).forEach(function (s) { s.textContent = ''; s.hidden = true; });
    layoutEl.classList.remove('prompting');
  }

  // The mockup's rb-knock, once: a tilt left, right, left, settle; U10's capsule pops instead (the mockup's isl-pop).
  // Under reduced motion (QJZ.fx.motion) a third as far.
  function frames(layoutName) {
    var k = QJZ.fx && QJZ.fx.motion ? QJZ.fx.motion() : 1;
    function t(deg, y) { return 'rotate(' + (deg * k).toFixed(2) + 'deg)' + (y ? ' translateY(' + (y * k).toFixed(2) + 'px)' : ''); }
    function sc(f) { return 'scale(' + (1 + (f - 1) * k).toFixed(3) + ')'; }
    if (layoutName === 'U10') {
      return [{ transform: sc(1), offset: 0 }, { transform: sc(1.04), offset: 0.3 }, { transform: sc(0.98), offset: 0.6 },
        { transform: sc(1), offset: 1 }];
    }
    return [
      { transform: t(0), offset: 0 }, { transform: t(-3, -2), offset: 0.17 }, { transform: t(3), offset: 0.38 },
      { transform: t(-2, -1), offset: 0.58 }, { transform: t(1), offset: 0.79 }, { transform: t(0), offset: 1 }
    ];
  }
  function wave(layoutEl, layoutName) {
    if (!layoutEl) return null;
    var target = KNOCKS[layoutName] ? layoutEl.querySelector(KNOCKS[layoutName]) :
      layoutEl.querySelector('[data-prompt-line] .call') || layoutEl.querySelector('[data-prompt] .rbub');
    if (!target || typeof target.animate !== 'function' || !layoutEl.classList.contains('prompting')) return null;
    var prev = knocking ? knocking.get(target) : null;
    if (prev) prev.cancel();
    var a = target.animate(frames(layoutName), { duration: KNOCK_MS, easing: 'ease-in-out', iterations: 1, id: KNOCK_ID });
    if (knocking) knocking.set(target, a);
    return a;
  }

  return { render: render, clear: clear, wave: wave };
})();
