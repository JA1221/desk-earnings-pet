test('sound is silent and safe when disabled', function () {
  QJZ.sound.setEnabled(false);
  eq(QJZ.sound.coin(), false);
  eq(QJZ.sound.meow(), false);
  eq(QJZ.sound.squeak(), false);
  eq(QJZ.sound.jingle(), false);
});
test('sound.setVolume clamps and tolerates junk', function () {
  QJZ.sound.setVolume(2); eq(QJZ.sound.getVolume(), 1);
  QJZ.sound.setVolume(-1); eq(QJZ.sound.getVolume(), 0);
  QJZ.sound.setVolume(0.25); eq(QJZ.sound.getVolume(), 0.25);
  QJZ.sound.setVolume(NaN); eq(QJZ.sound.getVolume(), 0.6);
});
