window.QJZ = window.QJZ || {};
// The pomodoro countdown ring around the pet (spec §4.3 「寵物外面一圈」, §5.2 倒數圈; mockups C2_U1_f/b, C2_U7_f/b): a
// circle whose arc is the time left of the focus (tomato red) or of the break (green, class rest), with a pill under
// it: the phase's icon and 「還剩 N 分」. Hidden while no phase runs.
//   markup(cls)    the ring's HTML, hidden: root [data-pring] (class "pring" plus cls), its svg with a track and the
//                  arc [data-ring-arc], and the pill's text [data-ring-label]. Nothing in it takes clicks.
//   update(el, r)  r = {phase: 'focus' | 'break' | null, fraction, label} (QJZ.layouts' model().ring). fraction is the
//                  elapsed share of the phase (QJZ.pomodoro.fraction), so the arc covers 1 - fraction of the circle
//                  and shrinks as the time runs out. Writes only what changed (the arc at 0.1 of a unit); the caller
//                  runs it at most once a second. The arc has no CSS transition: it steps, it never animates.
QJZ.ring = (function () {
  var R = 46, LEN = 2 * Math.PI * R;
  var seen = new WeakMap();   // el -> what was last written

  function markup(cls) {
    var ic = QJZ.icons.svg;
    return '<div class="pring' + (cls ? ' ' + cls : '') + '" data-pring hidden aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" focusable="false">' +
        '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="#3D2C24" stroke-width="7.4"/>' +
        '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="#FFF8EC" stroke-width="4.2" opacity=".9"/>' +
        '<circle class="pr-arc" data-ring-arc cx="50" cy="50" r="' + R + '" fill="none" stroke-width="4.2" stroke-dasharray="0 ' +
          LEN.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
      '</svg>' +
      '<span class="ptime">' + ic('tom', 'pi-foc') + ic('rest', 'pi-brk') + '<b data-ring-label></b></span></div>';
  }

  function update(el, r) {
    if (!el) return;
    var phase = r && (r.phase === 'focus' || r.phase === 'break') ? r.phase : null;
    var c = seen.get(el);
    if (!c) {
      c = { phase: undefined, dash: null, label: null, arc: el.querySelector('[data-ring-arc]'), text: el.querySelector('[data-ring-label]') };
      seen.set(el, c);
    }
    if (c.phase !== phase) {
      c.phase = phase;
      el.hidden = !phase;
      el.classList.toggle('rest', phase === 'break');
    }
    if (!phase) return;
    var f = typeof r.fraction === 'number' && isFinite(r.fraction) ? Math.min(Math.max(r.fraction, 0), 1) : 0;
    var dash = (LEN * (1 - f)).toFixed(1) + ' ' + LEN.toFixed(1);
    if (c.dash !== dash && c.arc) { c.dash = dash; c.arc.setAttribute('stroke-dasharray', dash); }
    var label = typeof r.label === 'string' ? r.label : '';
    if (c.label !== label && c.text) { c.label = label; c.text.textContent = label; }
  }

  return { markup: markup, update: update, LEN: LEN };
})();
