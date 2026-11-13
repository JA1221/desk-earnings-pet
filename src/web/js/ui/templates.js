window.QJZ = window.QJZ || {};
// The markup of every layout, moved out of layouts.js: QJZ.templates[name]() is the HTML of layout name (U1 U3 U5B U7
// M3 U10 U12 U13 PANEL), and QJZ.templates.parts the pieces several layouts share. layouts.js finds what it drives by data
// attributes (see its build()): [data-b=key] text from its model, [data-odo] the odometer, [data-fill] / [data-ring]
// the day's progress, [data-pet] the pet, [data-bubble] the speech bubble, [data-fx] / [data-fxwin] the effect layers,
// [data-hit] the hit rects, [data-act] the buttons.
// 1.1 (spec §4.4, the A picks; §4.3 the countdown ring): [data-show=cups|tomatoes|both|any] is hidden (and keeps no
// space) unless the model shows the cups / the tomatoes / both / either (§4.9 #8, decided by QJZ.care); [data-pring]
// is the countdown ring (QJZ.ring) around the pet. data-act drink logs a cup, pomo starts or stops the pomodoro. The
// U7 tag line and the M3 stickers only show (§5.3): no data-act. [data-cups] is where a logged cup pops 「+1」.
// The prompt (Task 11, QJZ.promptView): [data-prompt] holds the reminder / pomodoro bubble (U1, U3, U7, M3, U12), U5-B's
// [data-prompt-line] the same in its top line, U10's [data-prompt-call] on the capsule, U13's [data-prompt-ring] inside
// the big ring; all are empty and hidden until a prompt shows.
// 1.1 layouts (Task 12, spec §4.5; G_U10_*, G_U12_*, G_U13_*): [data-gauge=cups|tom|stand|pomo] is a ring whose --p
// layouts.js sets (cups, tomatoes, stand-ups against the day's goals; pomo the share of the pomodoro phase left), with
// class hot while a prompt asks for it; [data-tslots] the tomato slots; [data-hover] what the pointer expands (U7's pet
// and tag: the tools; U10's capsule: the full view); [data-show=stand] the time to the next stand-up (while one is
// asked), cupsStand both that and the cups. 1.1.1 item 6: U1, U3, U5-B and U7 show it compact, 🧍 N 分 ([data-show=standC],
// [data-b=standMin]; U7's tag line anyS / ctS), as a readout only.
QJZ.templates = (function () {
  function ic(name, cls) { return QJZ.icons.svg(name, cls); }
  function bar(title) {
    return '<div class="bar"><span class="logo">$</span><span data-b="title">' + title + '</span><div class="dots">' +
      '<i data-act="mini" title="縮成迷你"></i><i data-act="hide" title="隱藏"></i></div></div>';
  }
  var BAR = bar('錢進中');
  var MONEY = '<div class="money"><span class="cur">NT$</span><span class="odo" data-odo></span></div>';
  // During a pomodoro the pill reads 專心中 / 休息中 with its icon (health.css shows the one for the layout's p-foc / p-brk).
  var PILL = '<div class="status"><i></i>' + ic('hp', 'pi-foc') + ic('rest', 'pi-brk') + '<span data-b="status"></span></div>';
  function feedBtn(cls) {
    return '<button type="button" class="' + cls + '" data-act="feed" data-feed title="餵食"><span data-b="snack"></span> 餵食</button>';
  }
  // U1 (A_U1_3): cups, tomatoes, and the 番茄鐘 pill that is always there.
  // 1.1.1 item 6: the next stand-up, compact (🧍 N 分); it only shows.
  function standC(cls) {
    return '<span class="' + cls + '" data-show="standC" title="下次起來動">' + ic('stand') + '<span class="n" data-b="standMin"></span></span>';
  }
  function mpills() {
    return '<div class="mpills">' +
      '<button type="button" class="mp" data-act="drink" data-show="cups" data-cups title="記一杯水">' + ic('drop') + '<span class="n" data-b="cupsLong"></span></button>' +
      '<span class="mp" data-show="tomatoes">' + ic('tom') + '<span class="n" data-b="tomatoes"></span></span>' +
      '<button type="button" class="mp go" data-act="pomo" data-b="pomoBtn" title="番茄鐘"></button>' + standC('mp st') + '</div>';
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
  // U7 (A_U7): one more line on the tag, 💧 3/8・🍅 ×3・🧍 32 分, each part by its rule; gone when none shows.
  function hline() {
    return '<div class="hline" data-show="anyS"><span class="hpart" data-show="cups" data-cups>' + ic('drop') + '<span class="n" data-b="cups"></span></span>' +
      '<span class="dt" data-show="both">・</span><span class="hpart" data-show="tomatoes">' + ic('tom') + '<span class="n" data-b="tomatoes"></span></span>' +
      '<span class="dt" data-show="ctS">・</span>' + standC('hpart') + '</div>';
  }
  // M3 (A_M3): two stickers on the ring, cups top left and tomatoes top right.
  function stickers() {
    return '<span class="mb l" data-show="cups" data-cups data-hit>' + ic('drop') + '<span data-b="cups"></span></span>' +
      '<span class="mb r" data-show="tomatoes" data-hit>' + ic('tom') + '<span data-b="tomatoes"></span></span>';
  }
  function pring() { return QJZ.ring.markup(); }
  var PSLOT = '<div class="pslot" data-prompt hidden></div>';
  // U12 (G_U12_*): the three rings, each the day's count against its goal with the count in it and its label under it.
  // The water ring logs a cup (§5.3); the tomato ring counts the pomodoro down while one runs (§5.2); the stand-up label
  // turns 「該起來了！」 while the reminder asks for it.
  function gauges() {
    return '<div class="rings">' +
      '<button type="button" class="gauge3" data-gauge="cups" data-act="drink" data-cups title="記一杯水"><span class="rg">' + ic('drop') +
        '<b data-b="cups"></b></span><span class="gl">喝水（杯）</span></button>' +
      '<div class="gauge3" data-gauge="tom"><span class="rg"><span class="g-day">' + ic('tom') + '<b data-b="tomNum"></b></span>' +
        '<span class="g-run"><small data-b="phaseShort"></small><b data-b="mmss"></b><small data-b="nth"></small></span></span>' +
        '<span class="gl" data-b="tomLabel"></span></div>' +
      '<div class="gauge3" data-gauge="stand"><span class="rg">' + ic('stand') + '<b data-b="standups"></b></span>' +
        '<span class="gl" data-b="standLabel"></span></div></div>';
  }
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
        '<div class="hud-top">' + PILL + '<div class="pill"><span data-b="clock"></span></div>' + standC('pill st') + feedBtn('pill feed') +
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
          standC('st') + '<span class="pline" data-prompt-line hidden></span>' + feedBtn('feed') +
          '<button type="button" class="x" data-act="menu" title="選單">⋯</button></div>' +
        '<div class="money-box" data-plus>' + MONEY + '</div>' +
        '<div class="thin"><div class="fill" data-fill></div></div>' +
        '<div class="meta2"><span data-b="pct"></span><span data-b="remainPhrase"></span></div>' +
        '</div>' + rcol() + '<div class="fx" data-fx data-fxwin></div></div>';
    },
    U7: function () {
      return '<div class="u7 lay"><div class="dpet" data-hover>' + pring() +
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
    // U10 (G_U10_*): one fixed window, the dark capsule on its edge at the dock (layouts.js: class d-<dock>). Its views:
    // collapsed (whole dollars, the cups and tomatoes by the rule), a pomodoro's countdown, the full view while the
    // pointer is on it (2 decimals, the cups, the 番茄鐘 button, the next stand-up) and the call while a prompt shows.
    // Only the capsule takes clicks. No odometer: the capsule changes at most once a second.
    U10: function () {
      return '<div class="u10 lay"><div class="isl" data-hit data-hover><div class="av" data-pet="avatar"></div>' +
        '<span class="iv iv-c"><i class="gd"></i><span class="im" data-b="moneyWhole"></span>' +
          '<span class="ichip" data-show="cups" data-cups>' + ic('drop') + '<span data-b="cupsNum"></span></span>' +
          '<span class="ichip" data-show="tomatoes">' + ic('tom') + '<span data-b="tomNum"></span></span></span>' +
        '<span class="iv iv-f"><span class="donut" data-gauge="pomo"></span><span class="im" data-b="mmss"></span>' +
          '<span class="isub" data-b="phaseNote"></span><span class="im sm" data-b="moneyWhole"></span></span>' +
        '<span class="iv iv-x"><span class="icol"><span class="isub"><i class="gd"></i><span data-b="status"></span> · ' +
            '<span data-b="remainPhrase"></span></span><span class="im">NT$ <span data-b="money"></span></span>' +
            '<span class="ibar"><i data-fill></i></span></span>' +
          '<span class="icol"><button type="button" class="ichip" data-act="drink" data-show="cups" data-cups title="記一杯水">' + ic('drop') +
              '<span data-b="cupsLong"></span></button>' +
            '<button type="button" class="ichip" data-act="pomo" title="番茄鐘">' + ic('tom') +
              '<span data-show="tomatoes" data-b="tomatoes"></span><span class="go" data-b="pomoGlyph"></span></button>' +
            '<span class="ichip" data-show="stand">' + ic('stand') + '<span data-b="standIn"></span></span></span></span>' +
        '<span class="iv iv-r" data-prompt-call hidden></span></div>' +
        '<div class="fx" data-fx data-fxwin></div></div>';
    },
    // U12 健康儀表板 (G_U12_*): the money and the 下班 countdown, the three rings, the pet saying when the next stand-up
    // is; a prompt is the small bubble beside the pet (it takes the line's place) and its ring glows.
    U12: function () {
      return '<div class="win u12 dash lay" data-hit>' + bar('錢進中 · 健康') + '<div class="body">' +
        '<div class="dtop">' + PILL + '<span class="dl2" data-b="remainPhrase"></span></div>' +
        '<div class="money-box dmb" data-plus><div class="money-label">今天已經賺到</div>' + MONEY +
          '<div class="thin"><div class="fill" data-fill></div></div></div>' +
        gauges() +
        '<div class="dfoot"><div class="po" data-pet="petonly"></div><div class="say" data-show="stand" data-b="dsay"></div>' + PSLOT + '</div>' +
        '</div><div class="fx" data-fx data-fxwin></div></div>';
    },
    // U13 番茄鐘優先 (G_U13_*): the big ring. Idle it is one big 開始專心 button; it counts a focus (red) or a break
    // (green) down; a prompt sits inside it (Ruling C4). The pet sits on its edge, outside the button. Under it the
    // tomato slots (one per the day's goal), 停止 while a phase runs (its room is kept, so the window keeps its size),
    // and the cups and the next stand-up.
    U13: function () {
      return '<div class="win u13 pomo1 lay" data-hit>' + bar('錢進中 · 番茄鐘') + '<div class="body">' +
        '<div class="ptop">' + PILL + '<span class="pm money-box" data-plus><span class="cur">NT$</span> <span class="odo" data-odo></span></span></div>' +
        '<div class="ptop2"><span data-b="remainPhrase"></span><div class="thin"><div class="fill" data-fill></div></div></div>' +
        '<div class="ringwrap"><div class="bigring" data-gauge="pomo">' +
          '<button type="button" class="br-go" data-act="pomo" title="開始專心"><small data-b="nextFocus"></small><b data-b="focusFull"></b>' +
            '<span class="go">▶ 開始專心</span></button>' +
          '<span class="br-run"><small data-b="status"></small><b data-b="mmss"></b><small data-b="nth"></small></span>' +
          '<span class="br-rem" data-prompt-ring hidden></span></div>' +
          '<div class="po" data-pet="petonly"></div></div>' +
        '<div class="tslots"><span class="tsl" data-tslots></span><span data-b="tslotText"></span></div>' +
        '<div class="pbtns"><button type="button" class="stop" data-act="pomo">■ 停止</button></div>' +
        '<div class="pline"><span class="pp" data-show="cups" data-cups>' + ic('drop') + '<span data-b="cupsLong"></span></span>' +
          '<span class="dt" data-show="cupsStand">・</span><span class="pp" data-show="stand">' + ic('stand') + '<span data-b="standLine"></span></span></div>' +
        '</div><div class="fx" data-fx data-fxwin></div></div>';
    },
    PANEL: function () {
      return '<div class="win panel lay" data-hit>' + BAR + '<div class="pbody" data-panel></div>' +
        '<div class="fx" data-fx data-fxwin></div></div>';
    }
  };
  TEMPLATES.parts = { BAR: BAR, MONEY: MONEY, PILL: PILL, feedBtn: feedBtn };
  return TEMPLATES;
})();
