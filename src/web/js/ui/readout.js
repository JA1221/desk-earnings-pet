window.QJZ = window.QJZ || {};
// Minimal stand-in view for the shell (date, time, status, worked time, rolling amount).
// Real layouts replace this in a later task; it exists so index.html / dev.html show live state.
QJZ.readout = (function () {
  var STATUS = { before: '尚未開工', working: '工作中', lunch: '午休中', done: '工時已滿', ended: '已下班' };
  var WD = '日一二三四五六';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hms(sec) {
    sec = Math.max(0, Math.floor(sec));
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
  }

  function mount(root) {
    root.innerHTML =
      '<div class="win ro">' +
        '<div class="bar"><span class="logo">$</span><span>錢進中</span><span class="date" data-ro="date"></span></div>' +
        '<div class="ro-body">' +
          '<div class="ro-row"><span class="status"><i></i><span data-ro="status"></span></span><span class="clock" data-ro="clock"></span></div>' +
          '<div class="money-label">今天已賺</div>' +
          '<div class="money-box" data-ro="box"><div class="money"><span class="cur">NT$</span><span class="odo" data-ro="odo"></span></div></div>' +
          '<div class="rate" data-ro="rate"></div>' +
          '<div class="prog-top"><span>已工作 <b data-ro="worked">00:00:00</b></span><b data-ro="pct">0%</b></div>' +
          '<div class="track"><div class="fill" data-ro="fill"></div></div>' +
          '<div class="rate" data-ro="hint"></div>' +
          '<div class="ro-q" data-ro="q" hidden></div>' +
        '</div>' +
        '<div class="fx" data-ro="fx"></div>' +
      '</div>';
    var $ = function (n) { return root.querySelector('[data-ro="' + n + '"]'); };
    var odo = QJZ.odometer.create($('odo'));
    var app = QJZ.app;

    function render() {
      var st = app.state, snap = st.snap;
      if (!snap) return;
      var d = new Date(app.nowMs());
      $('date').textContent = d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '（' + WD.charAt(d.getDay()) + '）';
      $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      $('status').textContent = STATUS[snap.status] || snap.status;
      $('worked').textContent = hms(snap.workedSec);
      $('pct').textContent = (snap.pct * 100).toFixed(1) + '%';
      $('fill').style.width = (snap.pct * 100) + '%';
      odo.set(QJZ.odometer.format(snap.earned));
      $('rate').textContent = '每秒 NT$ ' + st.rates.perSecond.toFixed(4) + '　可領零食 ' + st.snacks;
      $('hint').textContent = st.startHint === 'appstart' ? '開工時間依開啟程式推算（可手動調整）' : '';
    }
    var shownQ = null;
    function renderQuestion() {
      var box = $('q'), q = app.state.pendingQuestion;
      var key = q ? q.day + '|' + q.lockMs : null;
      if (key === shownQ) return;
      shownQ = key;
      box.innerHTML = '';
      if (!q) { box.hidden = true; return; }
      box.hidden = false;
      var t = new Date(q.lockMs);
      var msg = document.createElement('div');
      msg.textContent = q.day + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' 鎖定後就沒再開機，那是下班時間嗎？';
      var yes = document.createElement('button'); yes.type = 'button'; yes.setAttribute('data-a', '1'); yes.textContent = '是，那時下班';
      var no = document.createElement('button'); no.type = 'button'; no.setAttribute('data-a', '0'); no.textContent = '不是';
      box.appendChild(msg); box.appendChild(yes); box.appendChild(no);
    }
    root.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === '1' || a === '0') app.answerEarlyLeave(a === '1');
    });

    app.on('tick', render);
    app.on('change', function () { render(); renderQuestion(); });
    app.on('second', function (snap) {
      if (snap.status === 'working' && app.state.rates.perSecond > 0) QJZ.fx.plus($('box'), '+' + app.state.rates.perSecond.toFixed(2));
    });
    return { fxHost: $('fx'), box: $('box') };
  }

  return { mount: mount };
})();
