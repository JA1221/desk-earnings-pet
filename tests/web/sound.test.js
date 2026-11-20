test('sound is silent and safe when disabled', function () {
  QJZ.sound.setEnabled(false);
  eq(QJZ.sound.coin(), false);
  eq(QJZ.sound.meow(), false);
  eq(QJZ.sound.squeak(), false);
  eq(QJZ.sound.jingle(), false);
});
// M14: the audio device is not kept busy: the context sleeps after ~5 s without sound and wakes for the next one.
test('sound: the AudioContext suspends after 5 s idle and resumes on play', function () {
  function noop() {}
  function param() { return { value: 1, setValueAtTime: noop, exponentialRampToValueAtTime: noop }; }
  var made = [];
  function Fake() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.log = []; made.push(this); }
  Fake.prototype.createGain = function () { return { gain: param(), connect: noop }; };
  Fake.prototype.createOscillator = function () { return { frequency: param(), connect: noop, start: noop, stop: noop }; };
  Fake.prototype.createBiquadFilter = function () { return { frequency: param(), connect: noop }; };
  Fake.prototype.suspend = function () { this.log.push('suspend'); this.state = 'suspended'; return Promise.resolve(); };
  Fake.prototype.resume = function () { this.log.push('resume'); this.state = 'running'; return Promise.resolve(); };
  var orig = window.AudioContext;
  window.AudioContext = Fake;
  QJZ.sound._reset();
  try {
    eq(QJZ.sound.IDLE_MS, 5000);
    QJZ.sound.setEnabled(true);
    eq(made.length, 1);
    var ctx = made[0];
    eq(ctx.state, 'running', 'switched on: awake');
    ok(QJZ.sound.coin());
    eq(QJZ.sound._idle(), true, 'an idle timer is waiting');
    eq(ctx.state, 'suspended', 'asleep after the idle time');
    eq(QJZ.sound._idle(), false, 'nothing more to do');
    ok(QJZ.sound.meow());
    eq(ctx.state, 'running', 'woken to play');
    eq(QJZ.sound._idle(), true);
    eq(ctx.state, 'suspended', 'asleep');
    document.dispatchEvent(new Event('pointerdown'));
    eq(ctx.state, 'suspended', '1.1.11: it has run once: a click no longer wakes it, no sound plays');
    ok(QJZ.sound.squeak());
    QJZ.sound.setEnabled(false);
    eq(ctx.state, 'suspended', 'switched off: asleep at once');
    eq(QJZ.sound._idle(), false);
    document.dispatchEvent(new Event('pointerdown'));
    eq(ctx.state, 'suspended', 'a click does not wake a switched-off sound');
    eq(made.length, 1, 'one context only');
  } finally {
    QJZ.sound.setEnabled(false);
    QJZ.sound._reset();
    window.AudioContext = orig;
  }
});
// 1.1.11: a context made outside a gesture (sound on at start-up) starts suspended: the first click unlocks it, once
test('sound: a click unlocks a context that has never run, once', function () {
  function noop() {}
  var made = [];
  function Fake() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.n = 0; made.push(this); }
  Fake.prototype.createGain = function () { return { gain: { value: 1 }, connect: noop }; };
  Fake.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
  Fake.prototype.resume = function () { this.n++; if (this.allow) this.state = 'running'; return Promise.resolve(); };
  var orig = window.AudioContext;
  window.AudioContext = Fake;
  QJZ.sound._reset();
  try {
    QJZ.sound.setEnabled(true);
    var ctx = made[0];
    eq(ctx.state, 'suspended', 'no gesture yet: refused');
    ctx.allow = true;   // the user clicks
    document.dispatchEvent(new Event('pointerdown'));
    eq(ctx.state, 'running', 'the click unlocks it');
    QJZ.sound._idle();
    var n = ctx.n;
    document.dispatchEvent(new Event('pointerdown'));
    eq([ctx.state, ctx.n], ['suspended', n], 'later clicks leave it asleep');
  } finally {
    QJZ.sound.setEnabled(false);
    QJZ.sound._reset();
    window.AudioContext = orig;
  }
});
test('sound.setVolume clamps and tolerates junk', function () {
  QJZ.sound.setVolume(2); eq(QJZ.sound.getVolume(), 1);
  QJZ.sound.setVolume(-1); eq(QJZ.sound.getVolume(), 0);
  QJZ.sound.setVolume(0.25); eq(QJZ.sound.getVolume(), 0.25);
  QJZ.sound.setVolume(NaN); eq(QJZ.sound.getVolume(), 0.6);
});
