window.QJZ = window.QJZ || {};
QJZ.odometer = (function () {
  // 1231.6149 -> '1,231.61'. Negative / NaN / Infinity / non-numbers -> '0.00'.
  // Works in whole cents so rounding and grouping never depend on toLocaleString.
  function format(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '0.00';
    var cents = Math.round(n * 100 + 1e-6);
    var whole = Math.floor(cents / 100), frac = cents % 100;
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s + '.' + (frac < 10 ? '0' : '') + frac;
  }

  function shape(str) { return str.replace(/\d/g, '0'); }

  // Rolling-digit display. The DOM is rebuilt only when the shape (digit count / separators) changes;
  // otherwise each column just gets a new --n and CSS rolls it.
  function create(el) {
    var cols = [], last = '';
    function build(str) {
      el.innerHTML = '';
      cols = [];
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i), node;
        if (/\d/.test(ch)) {
          node = document.createElement('span'); node.className = 'd';
          var strip = document.createElement('span'); strip.className = 's';
          var h = '';
          for (var k = 0; k < 10; k++) h += '<b>' + k + '</b>';
          strip.innerHTML = h;
          node.appendChild(strip);
          cols.push(strip);
        } else {
          node = document.createElement('span'); node.className = 'c'; node.textContent = ch;
          cols.push(null);
        }
        el.appendChild(node);
      }
    }
    function set(text) {
      var str = String(text);
      if (shape(str) !== shape(last) || !cols.length) build(str);
      for (var i = 0; i < str.length; i++) if (cols[i]) cols[i].style.setProperty('--n', str.charAt(i));
      if (str !== last) el.setAttribute('aria-label', str);
      last = str;
    }
    return { set: set };
  }

  return { format: format, create: create };
})();
