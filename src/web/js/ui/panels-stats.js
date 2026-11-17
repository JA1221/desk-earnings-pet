window.QJZ = window.QJZ || {};
// 紀錄 → 統計 (1.1.5 item 2), drawn with QJZ.panels.kit inside panels.js's history panel (c: the mounted panel). It
// takes the place of 1.0's month income chart: one bar chart, 週 / 月 (this week, Monday to Sunday, or this month) and
// the item, 收入 / 喝水 / 起來動 / 番茄, picked above it; 合計 and 每天平均 under it (QJZ.stats.series: the average counts
// only the days with data, today left out while it is going, and says so).
//   card()       the card's markup.
//   update(c)    draws it again when anything it shows changed (the panel runs it every second).
//   click(c, el) -> true  a click on one of its switches.
// The SVG is built at the width it is shown at, so its text is the size it says (10 px) in U13's 300 px panel too.
// The bars are drawn to scale against a round top (QJZ.stats.top), with a line and a label at its half and at the top.
// 隱藏金額 (privacy.maskMoney): the 收入 numbers (the axis, the sums, the tips) read ***; the bars stay.
// The picks are kept for the session. Only numbers and fixed copy go into markup.
// Review I-2: the chart is drawn again only when what it is drawn from changes (the picks, the mask, its width, a past
// day, the scale's top, whether today has a bar); today's live 收入 only moves today's bar, its label and its tip, and the
// sums, in place, so a tooltip held on any bar stays.
QJZ.panelsStats = (function () {
  var K = QJZ.panels.kit;
  var PERIODS = [['week', '週'], ['month', '月']];
  var ITEMS = [['earned', '收入'], ['cups', '喝水'], ['standups', '起來動'], ['tomatoes', '番茄']];
  var UNIT = { cups: '杯', standups: '次', tomatoes: '顆' };
  var NAME = { earned: '收入', cups: '喝水', standups: '起來動', tomatoes: '番茄' };
  var WD = '日一二三四五六';
  var H = 150, T = 14, B = 20, R = 4;
  var period = 'month', metric = 'earned';

  function money(n) { return QJZ.odometer.format(n); }
  function md(key) { return key.slice(5, 7) + '/' + key.slice(8, 10); }
  function round1(v) { var r = Math.round(v * 10) / 10; return String(r); }
  // a value as the card says it: NT$ 1,234.56 / *** for 收入, "4.5 杯" for a count
  function valueText(v, m, mask) {
    if (m === 'earned') return 'NT$ ' + (mask ? '***' : money(v));
    return round1(v) + ' ' + UNIT[m];
  }
  // an axis or bar label: whole numbers (50,000 / 2,273), *** for 收入 while masked
  function shortText(v, m, mask) {
    if (m === 'earned' && mask) return '***';
    return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function seg(name, opts) {
    var h = '<div class="seg st-seg" data-stseg="' + name + '" role="group">';
    opts.forEach(function (o) { h += '<button type="button" data-st="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>'; });
    return h + '</div>';
  }
  function card() {
    return '<div class="card hist stats" data-o="stats"><div class="hist-top"><b data-o="stTitle"></b>' + seg('period', PERIODS) + '</div>' +
      seg('metric', ITEMS) +
      '<div class="hist-chart" data-o="chart"></div>' +
      '<div class="hist-sum"><small data-o="sumLabel"></small><b class="num" data-o="total"></b></div>' +
      '<div class="st-avg"><small>每天平均</small><b data-o="avg"></b></div>' +
      '<div class="hint" data-o="avgNote"></div></div>';
  }

  function title(s) {
    if (s.period === 'week') return md(s.from) + ' – ' + md(s.to);
    return s.from.slice(0, 4) + ' 年 ' + parseInt(s.from.slice(5, 7), 10) + ' 月';
  }

  // The chart: W px wide (the card's), H tall. s: QJZ.stats.series; mask: 收入 masked.
  function barH(v, top) { return Math.max(2, (Math.min(v, top) / top) * (H - T - B)); }
  function tipText(d, m, mask) {
    var tip = md(d.day) + '（' + WD.charAt(d.wd) + '）';
    tip += d.future ? ' 還沒到' : d.v === null ? ' 沒有紀錄' : ' ' + valueText(d.v, m, mask);
    return tip + (d.today ? '（今天，還在算）' : '');
  }
  function svg(s, W, mask) {
    var m = s.metric, top = QJZ.stats.top(s.max, m), week = s.period === 'week';
    var L = m === 'earned' ? (mask ? 26 : 38) : 22, pw = W - L - R, ph = H - T - B;
    var n = s.days.length, slot = pw / n, bw = Math.min(week ? 24 : 14, Math.max(3, slot * 0.62));
    var y = function (v) { return T + ph - (v / top) * ph; };
    var h = '<svg class="m-' + m + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      K.esc(title(s) + '每天的' + NAME[m]) + '"><defs><pattern id="qjz-st-today" width="6" height="6" patternUnits="userSpaceOnUse" ' +
      'patternTransform="rotate(-45)"><rect class="pa" width="6" height="6"/><rect class="pb" width="3" height="6"/></pattern></defs>';
    s.days.forEach(function (d, i) {
      if (d.wd === 0 || d.wd === 6) h += '<rect class="we" x="' + (L + i * slot).toFixed(1) + '" y="' + T + '" width="' + slot.toFixed(1) + '" height="' + ph + '"/>';
    });
    [top / 2, top].forEach(function (v) {
      h += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text class="yl" x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '">' + shortText(v, m, mask) + '</text>';
    });
    var todayI = -9;
    s.days.forEach(function (d, i) { if (d.today) todayI = i; });
    s.days.forEach(function (d, i) {
      var cx = L + (i + 0.5) * slot;
      h += '<g data-bar' + (d.today ? ' data-today' : '') + ' data-v="' + (d.v === null ? '' : d.v) + '"><title>' + K.esc(tipText(d, m, mask)) + '</title>';
      if (d.v !== null && d.v > 0) {   // 0 is no bar: a 2px stub would look like data
        var bh = barH(d.v, top);
        h += '<rect class="bar' + (d.today ? ' today' : '') + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + (T + ph - bh).toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5"/>';
        if (week && !(m === 'earned' && mask)) {
          h += '<text class="vl" x="' + cx.toFixed(1) + '" y="' + (T + ph - bh - 3).toFixed(1) + '">' + shortText(d.v, m, mask) + '</text>';
        }
      }
      h += '</g>';
      var lbl = week ? WD.charAt(d.wd) : (d.today || ((d.d === 1 || d.d % 5 === 0) && Math.abs(i - todayI) > 1)) ? String(d.d) : '';
      if (lbl) h += '<text class="xl' + (d.today ? ' now' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 5) + '">' + lbl + '</text>';
    });
    if (!(s.max > 0)) h += '<text class="none" x="' + (L + pw / 2).toFixed(1) + '" y="' + (T + ph / 2 + 4).toFixed(1) + '">這段時間還沒有' + NAME[m] + '的紀錄</text>';
    return h + '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '"/></svg>';
  }

  function on(c, name, v) {
    K.qa(c, '[data-stseg="' + name + '"] [data-st]').forEach(function (b) {
      var is = b.getAttribute('data-st') === v;
      b.classList.toggle('on', is);
      b.setAttribute('aria-pressed', is ? 'true' : 'false');
    });
  }

  function update(c) {
    var st = K.st(), chart = K.q(c, '[data-o=chart]');
    if (!chart) return;
    var mask = !!(st.settings.privacy && st.settings.privacy.maskMoney);
    var s = QJZ.stats.series(st.history, st.today, st.snap && st.snap.earned, period, metric);
    var W = Math.max(200, Math.round(chart.clientWidth || 340));
    var td = null, top = QJZ.stats.top(s.max, metric);
    s.days.forEach(function (d) { if (d.today) td = d; });
    var key = JSON.stringify([period, metric, mask, W, top, s.max > 0, td ? [td.day, td.v > 0] : null,
      s.days.map(function (d) { return d.today || d.v === null ? null : Math.round(d.v * 100); })]);
    if (c.cache.stats !== key) {
      c.cache.stats = key;
      on(c, 'period', period);
      on(c, 'metric', metric);
      K.out(c, 'stTitle', title(s));
      chart.innerHTML = svg(s, W, mask);
    } else if (td) patchToday(chart, td, top, metric, mask);
    K.out(c, 'sumLabel', (period === 'week' ? '本週' : '本月') + '合計');
    K.out(c, 'total', valueText(s.total, metric, mask));
    K.out(c, 'avg', s.avg === null ? '—' : valueText(s.avg, metric, mask));
    K.out(c, 'avgNote', s.avgDays ? '只算有紀錄的 ' + s.avgDays + ' 天（今天還沒過完，不算）' : '還沒有可以平均的日子（只算有紀錄的日子，今天不算）');
  }

  // Today's bar, its value on it (週) and its tip, moved to v where they are (the scale's top unchanged).
  function patchToday(chart, d, top, m, mask) {
    var g = chart.querySelector('[data-today]');
    if (!g) return;
    var v = d.v === null ? '' : String(d.v);
    if (g.getAttribute('data-v') === v) return;
    g.setAttribute('data-v', v);
    var t = g.querySelector('title'), tip = tipText(d, m, mask);
    if (t && t.textContent !== tip) t.textContent = tip;
    var r = g.querySelector('rect.bar');
    if (!r || !(d.v > 0)) return;
    var bh = barH(d.v, top), base = H - B;
    r.setAttribute('y', (base - bh).toFixed(1));
    r.setAttribute('height', bh.toFixed(1));
    var vl = g.querySelector('.vl');
    if (vl) { vl.setAttribute('y', (base - bh - 3).toFixed(1)); vl.textContent = shortText(d.v, m, mask); }
  }

  function click(c, t) {
    var b = t.closest('[data-stseg] [data-st]');
    if (!b) return false;
    var v = b.getAttribute('data-st');
    if (b.closest('[data-stseg]').getAttribute('data-stseg') === 'period') period = v; else metric = v;
    update(c);
    return true;
  }

  // Tests only.
  function reset() { period = 'month'; metric = 'earned'; }

  return { card: card, update: update, click: click, _reset: reset };
})();
