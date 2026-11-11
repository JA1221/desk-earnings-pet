// Minimal test harness. Globals: test, eq, near, ok. Results are written to <pre id="results">.
(function (g) {
  var tests = [];
  g.test = function (name, fn) { tests.push({ name: name, fn: fn }); };
  function fmt(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  g.eq = function (actual, expected, msg) {
    if (fmt(actual) !== fmt(expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + fmt(expected) + ' but got ' + fmt(actual));
    }
  };
  g.near = function (actual, expected, eps, msg) {
    if (typeof actual !== 'number' || isNaN(actual) || Math.abs(actual - expected) > eps) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + expected + ' +/- ' + eps + ' but got ' + actual);
    }
  };
  g.ok = function (cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); };
  g.runAllTests = function () {
    var pass = 0, fail = 0, lines = [];
    for (var i = 0; i < tests.length; i++) {
      try { tests[i].fn(); pass++; }
      catch (e) { fail++; lines.push('FAIL ' + tests[i].name + ': ' + (e && e.message ? e.message : e)); }
    }
    var out = document.getElementById('results');
    out.textContent = 'TESTS PASS ' + pass + ' FAIL ' + fail + (lines.length ? '\n' + lines.join('\n') : '');
  };
})(window);
