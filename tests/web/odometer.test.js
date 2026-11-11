test('odometer.format basics', function () {
  eq(QJZ.odometer.format(1231.6149), '1,231.61');
  eq(QJZ.odometer.format(0), '0.00');
  eq(QJZ.odometer.format(12345.5), '12,345.50');
  eq(QJZ.odometer.format(999.99), '999.99');
  eq(QJZ.odometer.format(1000), '1,000.00');
});
test('odometer.format invalid input gives 0.00', function () {
  eq(QJZ.odometer.format(-5), '0.00');
  eq(QJZ.odometer.format(NaN), '0.00');
  eq(QJZ.odometer.format(Infinity), '0.00');
  eq(QJZ.odometer.format(undefined), '0.00');
  eq(QJZ.odometer.format(null), '0.00');
  eq(QJZ.odometer.format('abc'), '0.00');
});
test('odometer.format large values and rounding', function () {
  eq(QJZ.odometer.format(1234567.891), '1,234,567.89');
  eq(QJZ.odometer.format(9999999.995), '10,000,000.00');
  eq(QJZ.odometer.format(0.004), '0.00');
  eq(QJZ.odometer.format(0.005), '0.01');
  eq(QJZ.odometer.format(999.999), '1,000.00');
});
test('odometer.create handles digit count change', function () {
  var el = document.createElement('span');
  var o = QJZ.odometer.create(el);
  o.set('999.99');
  eq(el.querySelectorAll('.d').length, 5);
  o.set('1,000.00');
  eq(el.querySelectorAll('.d').length, 6);
  eq(el.querySelectorAll('.c').length, 2);
  eq(el.querySelectorAll('.d').item(0).firstChild.style.getPropertyValue('--n'), '1');
  o.set('999.99');
  eq(el.querySelectorAll('.d').length, 5);
  eq(el.childNodes.length, 6);
  eq(el.getAttribute('aria-label'), '999.99');
});
