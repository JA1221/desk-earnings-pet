// Minimal test harness. Globals: test, eq, near, ok. Results are written to <pre id="results">.
(function (g) {
  var tests = [];
  g.test = function (name, fn) { tests.push({ name: name, fn: fn }); };
  function fmt(v) {
    if (typeof v === 'number' && (v !== v || v === Infinity || v === -Infinity)) return String(v);
    if (v === undefined) return 'undefined';
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  function same(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b || (a !== a && b !== b);
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
    var aa = Array.isArray(a), ba = Array.isArray(b);
    if (aa !== ba) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!same(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }
  g.eq = function (actual, expected, msg) {
    if (!same(actual, expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + fmt(expected) + ' but got ' + fmt(actual));
    }
  };
  g.near = function (actual, expected, eps, msg) {
    if (typeof actual !== 'number' || isNaN(actual) || Math.abs(actual - expected) > eps) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + expected + ' +/- ' + eps + ' but got ' + actual);
    }
  };
  g.ok = function (cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); };
  g.scriptErrors = g.scriptErrors || [];
  g.runAllTests = function () {
    var pass = 0, fail = 0, lines = [];
    for (var i = 0; i < tests.length; i++) {
      try { tests[i].fn(); pass++; }
      catch (e) { fail++; lines.push('FAIL ' + tests[i].name + ': ' + (e && e.message ? e.message : e)); }
    }
    for (var j = 0; j < g.scriptErrors.length; j++) { fail++; lines.push('FAIL script error: ' + g.scriptErrors[j]); }
    var out = document.getElementById('results');
    out.textContent = 'TESTS PASS ' + pass + ' FAIL ' + fail + (lines.length ? '\n' + lines.join('\n') : '');
  };
})(window);
