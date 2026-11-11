window.QJZ = window.QJZ || {};
// Web Audio synthesis, no audio files. Silent unless enabled; never throws when AudioContext is missing.
QJZ.sound = (function () {
  var enabled = false, volume = 0.6, ctx = null, master = null, unlockBound = false;

  function resume() {
    try {
      if (ctx && ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; master = null; return null; }
      if (!unlockBound) {
        // A context created outside a user gesture starts suspended; the next click resumes it.
        unlockBound = true;
        document.addEventListener('pointerdown', resume, true);
      }
    }
    resume();
    return ctx;
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) ensure();   // normally called from a click, so the autoplay policy is satisfied
  }
  function setVolume(v) {
    v = typeof v === 'number' && isFinite(v) ? v : 0.6;
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  // One enveloped oscillator note.
  function note(type, f0, f1, t0, dur, peak, filterHz) {
    var o = ctx.createOscillator(), g = ctx.createGain(), out = g;
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    if (filterHz) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterHz;
      g.connect(f); out = f;
    }
    out.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function play(fn) {
    if (!enabled || volume <= 0) return false;
    try {
      if (!ensure()) return false;
      fn(ctx.currentTime + 0.01);
      return true;
    } catch (e) { return false; }
  }

  function coin() { return play(function (t) { note('square', 988, 988, t, 0.09, 0.25); note('square', 1319, 1319, t + 0.09, 0.28, 0.25); }); }
  function meow() { return play(function (t) { note('sawtooth', 520, 880, t, 0.18, 0.3, 2200); note('sawtooth', 880, 420, t + 0.18, 0.32, 0.3, 1800); }); }
  function squeak() { return play(function (t) { note('sine', 1500, 2400, t, 0.07, 0.3); note('sine', 2400, 1800, t + 0.07, 0.08, 0.25); }); }
  function jingle() {
    return play(function (t) {
      var f = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < f.length; i++) note('triangle', f[i], f[i], t + i * 0.11, i === f.length - 1 ? 0.5 : 0.16, 0.3);
    });
  }

  return {
    setEnabled: setEnabled, setVolume: setVolume, coin: coin, meow: meow, squeak: squeak, jingle: jingle,
    isEnabled: function () { return enabled; }, getVolume: function () { return volume; }
  };
})();
