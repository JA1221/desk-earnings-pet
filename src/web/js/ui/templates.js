window.QJZ = window.QJZ || {};
// The markup of every layout, moved out of layouts.js: QJZ.templates[name]() is the HTML of layout name (U1 U3 U5B U7
// M3 PANEL), and QJZ.templates.parts the pieces several layouts share. layouts.js finds what it drives by data
// attributes (see its build()): [data-b=key] text from its model, [data-odo] the odometer, [data-fill] / [data-ring]
// the day's progress, [data-pet] the pet, [data-bubble] the speech bubble, [data-fx] / [data-fxwin] the effect layers,
// [data-hit] the hit rects, [data-act] the buttons.
// 1.1 (spec §4.4, the A picks; §4.3 the countdown ring): [data-show=cups|tomatoes|both|any] is hidden (and keeps no
// space) unless the model shows the cups / the tomatoes / both / either (§4.9 #8, decided by QJZ.care); [data-pring]
// is the countdown ring (QJZ.ring) around the pet. data-act drink logs a cup, pomo starts or stops the pomodoro. The
// U7 tag line and the M3 stickers only show (§5.3): no data-act. [data-cups] is where a logged cup pops 「+1」.
// The prompt (Task 11, QJZ.promptView): [data-prompt] holds the reminder / pomodoro bubble (U1, U3, U7, M3), U5-B's
// [data-prompt-line] the same in its top line; both are empty and hidden until a prompt shows.
QJZ.templates = (function () {
  function ic(name, cls) { return QJZ.icons.svg(name, cls); }
  var BAR = '<div class="bar"><span class="logo">$</span><span data-b="title">錢進中</span><div class="dots">' +
    '<i data-act="mini" title="縮成迷你"></i><i data-act="hide" title="隱藏"></i></div></div>';
  var MONEY = '<div class="money"><span class="cur">NT$</span><span class="odo" data-odo></span></div>';
  // During a pomodoro the pill reads 專心中 / 休息中 with its icon (health.css shows the one for the layout's p-foc / p-brk).
  var PILL = '<div class="status"><i></i>' + ic('hp', 'pi-foc') + ic('rest', 'pi-brk') + '<span data-b="status"></span></div>';
  function feedBtn(cls) {
    return '<button type="button" class="' + cls + '" data-act="feed" data-feed title="餵食"><span data-b="snack"></span> 餵食</button>';
  }
  // U1 (A_U1_3): cups, tomatoes, and the 番茄鐘 pill that is always there.
  function mpills() {
    return '<div class="mpills">' +
      '<button type="button" class="mp" data-act="drink" data-show="cups" data-cups title="記一杯水">' + ic('drop') + '<span class="n" data-b="cupsLong"></span></button>' +
      '<span class="mp" data-show="tomatoes">' + ic('tom') + '<span class="n" data-b="tomatoes"></span></span>' +
      '<button type="button" class="mp go" data-act="pomo" data-b="pomoBtn" title="番茄鐘"></button></div>';
  }
  // U3 (A_U3_2, with the user's change: no bottle): the water button beside the tomato button, the same style, each
  // with its count under it. The tomato button is always there; its count and the water slot follow the rule.
  function tomslots() {
    return '<div class="tomslots">' +
      '<div class="tomslot" data-show="cups"><button type="button" class="tom-btn wat" data-act="drink" data-cups title="記一杯水">' + ic('drop') +
        '</button><span class="n" data-b="cups"></span></div>' +
      '<div class="tomslot"><button type="button" class="tom-btn" data-act="pomo" title="番茄鐘">' + ic('tom') +
        '<span class="play" data-b="pomoGlyph"></span></button><span class="n" data-show="tomatoes" data-b="tomatoes"></span></div></div>';
  }
  // U5-B (A_U5_2): a right column, the big tomato button (its count on it) and the cups under it.
  function rcol() {
    return '<div class="rcol"><button type="button" class="tom-btn" data-act="pomo" title="番茄鐘">' + ic('tom') +
        '<span class="cnt" data-show="tomatoes" data-b="tomatoes"></span><span class="play" data-b="pomoGlyph"></span></button>' +
      '<button type="button" class="lbl2" data-act="drink" data-show="cups" data-cups title="記一杯水">' + ic('drop') + '<span class="n" data-b="cups"></span></button></div>';
  }
  // U7 (A_U7): one more line on the tag, 💧 3/8・🍅 ×3, each part by its rule; gone when neither shows.
  function hline() {
    return '<div class="hline" data-show="any"><span class="hpart" data-show="cups" data-cups>' + ic('drop') + '<span class="n" data-b="cups"></span></span>' +
      '<span class="dt" data-show="both">・</span><span class="hpart" data-show="tomatoes">' + ic('tom') + '<span class="n" data-b="tomatoes"></span></span></div>';
  }
  // M3 (A_M3): two stickers on the ring, cups top left and tomatoes top right.
  function stickers() {
    return '<span class="mb l" data-show="cups" data-cups data-hit>' + ic('drop') + '<span data-b="cups"></span></span>' +
      '<span class="mb r" data-show="tomatoes" data-hit>' + ic('tom') + '<span data-b="tomatoes"></span></span>';
  }
  function pring() { return QJZ.ring.markup(); }
  var PSLOT = '<div class="pslot" data-prompt hidden></div>';
  var TEMPLATES = {
    U1: function () {
      return '<div class="win u1 lay" data-hit>' + BAR + '<div class="body">' +
        '<div class="row-top"><div class="clock" data-b="clock"></div>' + PILL + '</div>' +
        '<div class="scene-wrap"><div class="scene" data-pet="scene"></div>' + pring() + '<div class="fx" data-fx><div class="bubble" data-bubble></div></div></div>' +
        '<div class="money-box" data-plus><div class="money-label">今天已經賺到</div>' + MONEY + '<div class="rate" data-b="rate"></div>' + mpills() + '</div>' +
        '<div><div class="prog-top"><span>今日進度 <b data-b="pct"></b></span><span>距離下班 <b data-b="remain"></b></span></div>' +
          '<div class="track"><div class="fill" data-fill></div></div></div>' +
        '<div class="chips"><div class="chip"><small data-b="itemLabel"></small><b data-b="item"></b></div>' +
          '<div class="chip"><small>本月累計</small><b data-b="month"></b></div></div>' +
        '<div class="vitals"><span>心情 <span class="hearts" data-b="hearts"></span></span><span>體力 <span class="bolt" data-bolts></span></span>' +
          feedBtn('feed') + '</div>' +
        '</div>' + PSLOT + '<div class="fx" data-fxwin></div></div>';
    },
    U3: function () {
      return '<div class="win u3 lay" data-hit><div class="scene" data-pet="hud"></div><div class="hud">' + pring() +
        '<div class="hud-top">' + PILL + '<div class="pill"><span data-b="clock"></span></div>' + feedBtn('pill feed') +
          '<button type="button" class="pill gear" data-act="settings" title="設定">⚙</button></div>' +
        '<div class="side" data-bubble-clear><div class="pill alt" data-alt><span data-b="card"></span>' +
          '<span class="alt-dots" aria-hidden="true"><i></i><i></i></span></div></div>' +
        '<div class="hud-bottom money-box" data-plus><div class="coin">$</div>' + MONEY +
          '<div class="xp"><span data-b="pct"></span><div class="track"><div class="fill" data-fill></div></div><span>下班 <b data-b="remain"></b></span></div>' +
          tomslots() + '</div>' +
        '</div>' + PSLOT + '<div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    U5B: function () {
      return '<div class="win u5b lay" data-hit><div class="po" data-pet="petonly"></div>' + pring() + '<div class="mid">' +
        '<div class="mtop"><span class="dot"></span><span class="mline"><span data-b="status"></span> ・ <span data-b="hm"></span></span>' +
          '<span class="pline" data-prompt-line hidden></span>' + feedBtn('feed') +
          '<button type="button" class="x" data-act="menu" title="選單">⋯</button></div>' +
        '<div class="money-box" data-plus>' + MONEY + '</div>' +
        '<div class="thin"><div class="fill" data-fill></div></div>' +
        '<div class="meta2"><span data-b="pct"></span><span data-b="remainPhrase"></span></div>' +
        '</div>' + rcol() + '<div class="fx" data-fx data-fxwin></div></div>';
    },
    U7: function () {
      return '<div class="u7 lay"><div class="dpet">' + pring() +
        '<div class="mtag money-box" data-plus data-hit>' + MONEY + '<div class="thin"><div class="fill" data-fill></div></div>' + hline() + '</div>' +
        '<div class="po" data-pet="petonly" data-hit="pet"></div>' +
        '<div class="tools" data-hit data-hit-if=".hover .tools"><button type="button" data-act="settings" title="設定">⚙</button>' +
          '<button type="button" data-act="hide" title="隱藏">✕</button></div>' +
        '</div>' + PSLOT + '<div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    M3: function () {
      return '<div class="m3 lay"><div class="ring" data-ring data-hit data-hit-shape="disc"><div class="av" data-pet="avatar"></div></div>' +
        '<div class="tagm" data-hit><div class="mmoney"><small>NT$</small> <span class="odo" data-odo></span></div></div>' +
        '<div class="sub" data-hit data-b="m3sub"></div>' + stickers() + PSLOT + '<div class="fx" data-fx data-fxwin></div></div>';
    },
    PANEL: function () {
      return '<div class="win panel lay" data-hit>' + BAR + '<div class="pbody" data-panel></div>' +
        '<div class="fx" data-fx data-fxwin></div></div>';
    }
  };
  TEMPLATES.parts = { BAR: BAR, MONEY: MONEY, PILL: PILL, feedBtn: feedBtn };
  return TEMPLATES;
})();
