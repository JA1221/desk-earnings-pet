window.QJZ = window.QJZ || {};
QJZ.rewards = (function () {
  function milestones(earned, step) {
    if (!(earned > 0) || !(step > 0)) return 0;
    return Math.floor(earned / step);
  }

  function snacksAvailable(rec, earned, step) {
    var eaten = rec && rec.snacksEaten > 0 ? rec.snacksEaten : 0;
    return Math.max(0, milestones(earned, step) - eaten);
  }

  function itemCount(earned, item) {
    if (!(earned > 0) || !(item.price > 0)) return '0.0';
    return (earned / item.price).toFixed(1);
  }

  return { milestones: milestones, snacksAvailable: snacksAvailable, itemCount: itemCount };
})();
