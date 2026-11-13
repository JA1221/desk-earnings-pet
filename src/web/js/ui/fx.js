window.QJZ = window.QJZ || {};
// One-shot effects, ported from docs/prototypes/shared.js. hostEl / boxEl must be positioned (relative/absolute).
// Reduced motion: html.calm mirrors (prefers-reduced-motion: reduce) for pets.css (it stops the pet's perpetual
// idle loops), and the confetti burst spreads, falls and spins 0.3 as far.
QJZ.fx = (function () {
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null, forced = null;
  function markCalm() { document.documentElement.classList.toggle('calm', !!(mq && mq.matches)); }
  if (mq) {
    markCalm();
    if (mq.addEventListener) mq.addEventListener('change', markCalm);
  }
  // 1, or 0.3 under reduced motion (tests force it with _motion(k), _motion(null) goes back to the media query).
  function motion() { return forced !== null ? forced : (mq && mq.matches ? 0.3 : 1); }

  function el(cls, text) {
    var e = document.createElement('span');
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function done(anim, node) {
    if (anim && anim.addEventListener) anim.addEventListener('finish', function () { node.remove(); });
    else node.remove();
  }

  // "+0.08" floating up from the amount (layouts.js: its [data-plus]; the cups' 「+1」 the same way), over its last
  // digits. data-plus="short": it rises less (U13's amount sits just under the title bar).
  function plus(boxEl, text) {
    if (!boxEl) return;
    var p = el('plus', text), short = boxEl.getAttribute && boxEl.getAttribute('data-plus') === 'short';
    p.style.right = (14 + Math.random() * 24) + 'px';
    p.style.top = '-4px';
    boxEl.appendChild(p);
    done(p.animate([
      { transform: 'translateY(6px)', opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform: short ? 'translateY(-8px)' : 'translateY(-18px)', opacity: 0 }
    ], { duration: 1200, easing: 'ease-out' }), p);
  }

  function hearts(hostEl, x, y, n) {
    if (!hostEl) return;
    n = n || 7;
    for (var k = 0; k < n; k++) {
      var h = el('heart', '♥');
      h.style.left = (x + Math.random() * 40 - 20) + 'px';
      h.style.top = y + 'px';
      hostEl.appendChild(h);
      var dx = Math.random() * 70 - 35, dy = -50 - Math.random() * 45, sc = 0.7 + Math.random() * 0.8;
      done(h.animate([
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx * 0.4 + 'px),calc(-50% + ' + dy * 0.4 + 'px)) scale(' + sc + ')', opacity: 1, offset: 0.3 },
        { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(' + sc * 0.8 + ')', opacity: 0 }
      ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }), h);
    }
  }

  var COLORS = ['#FFC857', '#FF8A3D', '#FF5C7C', '#8EE3B0', '#4DA3FF'];
  function confetti(hostEl, x, y) {
    if (!hostEl) return;
    var k = motion();
    for (var i = 0; i < 26; i++) {
      var c = el('confetti');
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.background = COLORS[i % COLORS.length];
      hostEl.appendChild(c);
      var ang = Math.random() * Math.PI * 2, dist = (50 + Math.random() * 90) * k;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30 * k, rot = (Math.random() * 720 - 360) * k;
      done(c.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) rotate(' + rot * 0.6 + 'deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(calc(-50% + ' + dx * 1.1 + 'px),calc(-50% + ' + (dy + 70 * k) + 'px)) rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }), c);
    }
  }

  function banner(hostEl, text) {
    if (!hostEl) return;
    var b = el('banner', text);
    hostEl.appendChild(b);
    done(b.animate([
      { transform: 'translateX(-50%) translateY(-14px) scale(.6)', opacity: 0 },
      { transform: 'translateX(-50%) translateY(0) scale(1.08)', opacity: 1, offset: 0.15 },
      { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1, offset: 0.85 },
      { transform: 'translateX(-50%) translateY(-8px) scale(.95)', opacity: 0 }
    ], { duration: 2400, easing: 'ease-out' }), b);
  }

  return {
    plus: plus, hearts: hearts, confetti: confetti, banner: banner, motion: motion,
    _motion: function (k) { forced = typeof k === 'number' ? k : null; }
  };
})();
