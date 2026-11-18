window.QJZ = window.QJZ || {};
// The markup of every layout, moved out of layouts.js: QJZ.templates[name]() is the HTML of layout name (U1 U3 U5B U7
// M3 U10 U12 U13 PANEL), and QJZ.templates.parts the pieces several layouts share. layouts.js finds what it drives by data
// attributes (see its build()): [data-b=key] text from its model, [data-odo] the odometer, [data-fill] / [data-ring]
// the day's progress, [data-pet] the pet, [data-bubble] the speech bubble, [data-fx] / [data-fxwin] the effect layers,
// [data-hit] the hit rects, [data-act] the buttons.
// 1.1 (spec §4.4, the A picks; §4.3 the countdown ring): [data-show=cups|tomatoes|both|any] is hidden (and keeps no
// space) unless the model shows the cups / the tomatoes / both / either (§4.9 #8, decided by QJZ.care); [data-pring]
// is the countdown ring (QJZ.ring) around the pet. data-act drink logs a cup, pomo starts or stops the pomodoro. The
// 1.1.6 item 3 (看得到就能點): whatever shows can be pressed: U7's 💧 (1.1.4 item 7) and 🍅, U13's 💧 and M3's stickers are
// water / pomodoro buttons like every other. [data-cups] is where a logged cup pops 「+1」.
// The prompt (Task 11, QJZ.promptView): [data-prompt] holds the reminder / pomodoro bubble (U1, U3, U7, M3, U12), U5-B's
// [data-prompt-line] the same in its top line, U10's [data-prompt-call] on the capsule, U13's [data-prompt-ring] inside
// the big ring; all are empty and hidden until a prompt shows.
// 1.1 layouts (Task 12, spec §4.5; G_U10_*, G_U12_*, G_U13_*): [data-gauge=cups|tom|stand|pomo] is a ring whose --p
// layouts.js sets (cups, tomatoes, stand-ups against the day's goals; pomo the share of the pomodoro phase left), with
// class hot while a prompt asks for it; [data-tslots] the tomato slots; [data-hover] what the pointer expands (U7's pet
// and tag: the tools; U10's capsule: the full view); [data-show=stand] the time to the next stand-up (while one is
// asked), cupsStand both that and the cups. 1.1.1 item 6: U1, U3, U5-B and U7 show it compact, 🧍 N 分 ([data-show=standC],
// [data-b=standMin]; U7's tag line anyS, its ・ cX / sT), as a readout only.
// 1.1.2 item 4: start and stop are one [data-act=pomo] button per layout, in a place nothing moves: U1's sits in the
// middle of its pills (the cups left of it, the tomatoes right; the countdown went up beside the status), U3's tomato
// count and U5-B's cups keep their room when they are not shown, U10's is the first chip (its count after its ▶ / ■,
// the chips' column as wide as its widest), and U13's is the big ring itself, 開始專心 or 停止 on the same spot.
// 1.1.2 item 7: every countdown chip (the compact one, U10's and U13's) is [data-hold]: a long press on it is
// 我剛起來動過了 (layouts.js), and during 等一下 it shows 💤 (.zz) instead of 🧍 (class snz).
// 1.1.3: the water buttons ([data-act=drink]) and the pomodoro buttons ([data-act=pomo]) take a long press too (layouts.js:
// water −1, the pomodoro stopped); [data-holdring] is where a button's ring goes when it is not the button itself (U12's
// rings, U13's ■ 停止). Item 1: U1's row is three fixed buttons, water, the 🧍 countdown and the pomodoro, always there
// (a count not shown leaves 喝水 / --, [data-nil] dims the --); U10's chips the same three in that order. Items 8 and 9:
// U3's and U5-B's water button is the same round button as their pomodoro one, always there, its badge on the same
// corner. Item 6: U12's 番茄 ring is a pomodoro button, and its pet stands on a stage (.dfoot) with its line beside it.
QJZ.templates = (function () {
  function ic(name, cls) { return QJZ.icons.svg(name, cls); }
  // The title bar (1.1.1 item 2): small round icon buttons in the sticker style, 設定 and 關閉 (hide); 1.1.2 item 5:
  // 釘選在最上層 first (pressed, .on and aria-pressed, while the layout is topmost). 1.1.3 C2: no 縮小 (the menu's
  // 7 迷你浮窗 does it). PANEL (noGear) has 關閉 only: it is 設定, or a panel of its own.
  function tb(act, icon, label, toggle) {
    return '<button type="button" class="tb ' + act + '" data-act="' + act + '" title="' + label + '" aria-label="' + label + '"' +
      (toggle ? ' aria-pressed="false"' : '') + '>' + ic(icon) + '</button>';
  }
  function bar(title, noGear) {
    return '<div class="bar"><span class="logo">$</span><span data-b="title">' + title + '</span><div class="tbtns">' +
      (noGear ? '' : tb('pin', 'tbPin', '釘選在最上層', true)) + (noGear ? '' : tb('settings', 'tbGear', '設定')) +
      tb('hide', 'tbClose', '關閉') + '</div></div>';
  }
  // The title of each layout with a title bar; PANEL in its window (1.1.2 item 3) keeps the one it was opened from.
  // 1.1.3 item 9: U3 has no title bar, and its panel in its window gets one, 錢進中, as U1's.
  var TITLES = { U1: '錢進中', U12: '錢進中 · 健康', U13: '錢進中 · 番茄鐘' };
  var INPLACE_TITLES = { U1: TITLES.U1, U3: '錢進中', U12: TITLES.U12, U13: TITLES.U13 };
  var BAR = bar(TITLES.U1);
  // [data-plus] (1.1.2 item 6): the amount itself, where the "+0.xx" goes up from (QJZ.fx.plus). [data-mask] (item 10):
  // a click there masks the money (.msk, *** in the odometer's place while the layout is .masked). 1.1.4 item 6: the
  // odometer and its *** share one slot (.mslot), as big as the bigger of the two in both states, so masking moves
  // nothing; the money texts that mask ([data-ghost], layouts.js) keep room for what they show in the other state.
  var MASK = ' data-mask title="點一下：遮住／顯示金額"', ODO = '<span class="mslot"><span class="odo" data-odo></span><span class="msk">***</span></span>';
  // 1.1.5: 可以買 (U1's chip, U3's card): a click shows the next item (layouts.js nextItem)
  var BUY = ' data-buy title="點一下換下一個"';
  function mv(key, tag) { return '<' + (tag || 'span') + ' class="mv" data-ghost data-b="' + key + '"></' + (tag || 'span') + '>'; }
  var MONEY = '<div class="money" data-plus' + MASK + '><span class="cur">NT$</span>' + ODO + '</div>';
  // During a pomodoro the pill reads 專心中 / 休息中 with its icon (health.css shows the one for the layout's p-foc / p-brk).
  var PILL = '<div class="status"><i></i>' + ic('hp', 'pi-foc') + ic('rest', 'pi-brk') + '<span data-b="status"></span></div>';
  function feedBtn(cls) {
    return '<button type="button" class="' + cls + '" data-act="feed" data-feed title="餵食"><span data-b="snack"></span> 餵食</button>';
  }
  // The countdown chips' icons, 🧍 or 💤 during 等一下, and their tip (1.1.2: the long press); the water and pomodoro
  // buttons' tips (1.1.3: their long press).
  var HOLD_TIP = '下次起來動（長按＝我剛起來動過了）', WATER_TIP = '記一杯水（長按＝少記一杯）', POMO_TIP = '番茄鐘（長按＝停止）';
  var DRINK = ' data-act="drink" data-cups title="' + WATER_TIP + '"', POMO = ' data-act="pomo" title="' + POMO_TIP + '"';
  function standIcons() { return ic('stand') + '<span class="zz" aria-hidden="true">💤</span>'; }
  // 1.1.1 item 6: the next stand-up, compact (🧍 N 分); it only shows (1.1.2: and takes a long press).
  function standC(cls) {
    return '<span class="' + cls + '" data-show="standC" data-hold title="' + HOLD_TIP + '">' + standIcons() + '<span class="n" data-b="standMin"></span></span>';
  }
  // U1 (1.1.3 item 1): three fixed buttons of one width, water, the 🧍 countdown and the 番茄鐘 (its tomatoes a badge on its
  // corner), always there; 喝水 / -- while their count does not show.
  function mpills() {
    return '<div class="mpills">' +
      '<button type="button" class="mp wat"' + DRINK + '>' + ic('drop') + '<span class="n" data-b="cupsBtn"></span></button>' +
      '<span class="mp st" data-hold data-nil="standC" title="' + HOLD_TIP + '">' + standIcons() + '<span class="n" data-b="standSlot"></span></span>' +
      '<button type="button" class="mp go"' + POMO + '>' + ic('tom') + '<span data-b="pomoBtn"></span><span class="cnt" data-show="tomatoes" data-b="tomatoes"></span></button></div>';
  }
  // U3 (A_U3_2, with the user's change: no bottle): the water button beside the tomato button, the same round button
  // with its badge on the same corner (＋, ▶ / ■), each with its count under it in the same caption (1.1.3 item 9). Both
  // are always there; the counts follow the rule, their lines kept.
  function waterBtn() { return '<button type="button" class="tom-btn wat"' + DRINK + '>' + ic('drop'); }
  function tomslots() {
    return '<div class="tomslots">' +
      '<div class="tomslot">' + waterBtn() + '<span class="play" aria-hidden="true">＋</span></button>' +
        '<span class="cap"><span class="n" data-show="cups" data-b="cups"></span></span></div>' +
      '<div class="tomslot"><button type="button" class="tom-btn"' + POMO + '>' + ic('tom') +
        '<span class="play" data-b="pomoGlyph"></span></button><span class="cap"><span class="n" data-show="tomatoes" data-b="tomatoes"></span></span></div></div>';
  }
  // U5-B (A_U5_2; 1.1.3 item 8): a right column of two round buttons, water above the tomato (the order of U1's row), each
  // with its count as a badge on its corner, both always there.
  function rcol() {
    return '<div class="rcol">' + waterBtn() + '<span class="cnt" data-show="cups" data-b="cups"></span><span class="play" aria-hidden="true">＋</span></button>' +
      '<button type="button" class="tom-btn"' + POMO + '>' + ic('tom') +
        '<span class="cnt" data-show="tomatoes" data-b="tomatoes"></span><span class="play" data-b="pomoGlyph"></span></button></div>';
  }
  // U7 (A_U7): one more line on the tag, 💧 3/8・🧍 32 分・🍅 ×3 (1.1.7 item 3: the order of every other layout), each part by
  // its rule, a ・ only between parts that show (layouts.js SHOW cX / sT); gone when none shows. 1.1.4 item 7: its 💧 is a
  // water button like every other (a tap a cup, a long press one off): it was a readout, and a tap on it fell through to
  // the money tag's mask. 1.1.6 item 3: its 🍅 is a pomodoro button the same way (a tap starts one; while one runs a tap
  // shows 「長按停止」 and a long press stops it).
  function hline() {
    return '<div class="hline" data-show="anyS"><button type="button" class="hpart wat" data-show="cups"' + DRINK + '>' + ic('drop') +
      '<span class="n" data-b="cups"></span></button>' +
      '<span class="dt" data-show="cX">・</span>' + standC('hpart') + '<span class="dt" data-show="sT">・</span>' +
      '<button type="button" class="hpart tom" data-show="tomatoes"' + POMO + '>' + ic('tom') + '<span class="n" data-b="tomatoes"></span></button></div>';
  }
  // M3 (A_M3): stickers on the ring's corners. 1.1.6 item 3: the cups and the tomatoes are the water and the pomodoro
  // buttons (at least 24 px tall, health.css); off the ring, so a double click on them is no 展開. 1.1.7 item 1: four
  // corners, 💧 top left, 🧍 top right (the compact countdown, standC's rule, its long press and tip), 🍅 bottom left and the
  // hover ⚙ bottom right (hoverGear).
  function stickers() {
    return '<button type="button" class="mb tl" data-show="cups"' + DRINK + ' data-hit>' + ic('drop') + '<span data-b="cups"></span></button>' +
      '<span class="mb tr" data-show="standC" data-hold data-hit title="' + HOLD_TIP + '">' + standIcons() + '<span data-b="standMin"></span></span>' +
      '<button type="button" class="mb bl" data-show="tomatoes"' + POMO + ' data-hit>' + ic('tom') + '<span data-b="tomatoes"></span></button>';
  }
  // 1.1.6 item 2: 設定 on U10 and M3 as on U7's tools: a round ⚙ that shows only while the pointer is on the window
  // ([data-hover]: U10's full view, M3's whole badge), placed where it covers no text and moves nothing (health.css).
  // M3's is outside its other hit rects, so it is one of its own while it shows (data-hit-if); U10's is on its capsule.
  function hoverGear(cls, hit) {
    return '<button type="button" class="hgear ' + cls + '" data-act="settings"' + (hit ? ' data-hit data-hit-if=".hover .hgear"' : '') +
      ' title="設定" aria-label="設定">' + ic('tbGear') + '</button>';
  }
  function pring() { return QJZ.ring.markup(); }
  var PSLOT = '<div class="pslot" data-prompt hidden></div>';
  // U12 (G_U12_*): the three rings, each the day's count against its goal with the count in it and its label under it.
  // The water ring logs a cup (§5.3); the tomato ring counts the pomodoro down while one runs (§5.2) and is a pomodoro
  // button (1.1.3 item 6: a tap starts one, a long press stops it); the stand-up label turns 「該起來了！」 while the
  // reminder asks for it. A long press's ring goes round the ring itself ([data-holdring]). 1.1.7 review o1: 喝水、起來動、番茄,
  // the 💧 🧍 🍅 order of every other layout.
  function gauges() {
    return '<div class="rings">' +
      '<button type="button" class="gauge3" data-gauge="cups"' + DRINK + '><span class="rg" data-holdring>' + ic('drop') +
        '<b data-b="cups"></b></span><span class="gl">喝水（杯）</span></button>' +
      '<div class="gauge3" data-gauge="stand"><span class="rg" data-hold="gauge" title="起來動（長按＝我剛起來動過了）">' + ic('stand') +
        '<b data-b="standups"></b></span>' +
        '<span class="gl" data-b="standLabel"></span></div>' +
      '<button type="button" class="gauge3" data-gauge="tom"' + POMO + '><span class="rg" data-holdring><span class="g-day">' + ic('tom') + '<b data-b="tomNum"></b></span>' +
        '<span class="g-run"><small data-b="phaseShort"></small><b data-b="mmss"></b><small data-b="nth"></small></span></span>' +
        '<span class="gl" data-b="tomLabel"></span></button></div>';
  }
  var TEMPLATES = {
    U1: function () {
      return '<div class="win u1 lay" data-hit>' + BAR + '<div class="body">' +
        '<div class="row-top"><div class="clock" data-b="clock"></div>' + PILL + '</div>' +
        '<div class="scene-wrap"><div class="scene" data-pet="scene"></div>' + pring() + '<div class="fx" data-fx><div class="bubble" data-bubble></div></div></div>' +
        '<div class="money-box"><div class="money-label">今天已經賺到</div>' + MONEY + '<div class="rate">' + mv('rate') + '</div>' + mpills() + '</div>' +
        '<div><div class="prog-top"><span>今日進度 <b data-b="pct"></b></span><span><span data-b="remainLbl">距離下班</span> <b data-b="remain"></b></span></div>' +
          '<div class="track"><div class="fill" data-fill></div></div></div>' +
        '<div class="chips"><div class="chip"' + BUY + '><small data-b="itemLabel"></small>' + mv('item', 'b') + '</div>' +
          '<div class="chip"><small>本月累計</small>' + mv('month', 'b') + '</div></div>' +
        '<div class="vitals"><span>心情 <span class="hearts" data-b="hearts"></span></span><span>體力 <span class="bolt" data-bolts></span></span>' +
          feedBtn('feed') + '</div>' +
        '</div>' + PSLOT + '<div class="fx" data-fxwin></div></div>';
    },
    U3: function () {
      return '<div class="win u3 lay" data-hit><div class="scene" data-pet="hud"></div><div class="hud">' + pring() +
        '<div class="hud-top">' + PILL + '<div class="pill"><span data-b="clock"></span></div>' + standC('pill st') + feedBtn('pill feed') +
          '<button type="button" class="pill gear" data-act="settings" title="設定" aria-label="設定">' + ic('tbGear') + '</button></div>' +
        '<div class="side" data-bubble-clear><div class="pill alt" data-alt' + BUY + '>' + mv('card') +
          '<span class="alt-dots" aria-hidden="true"><i></i><i></i></span></div></div>' +
        '<div class="hud-bottom money-box"><div class="coin">$</div>' + MONEY +
          '<div class="xp"><span data-b="pct"></span><div class="track"><div class="fill" data-fill></div></div><span><span data-b="remainTo">下班</span> <b data-b="remain"></b></span></div>' +
          tomslots() + '</div>' +
        '</div>' + PSLOT + '<div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    // U5-B: 1.1.7 item 6: the top line ends in a ⚙ (設定, as every other layout's), where its ⋯ (the menu) was; the
    // right-click menu is still everywhere.
    U5B: function () {
      return '<div class="win u5b lay" data-hit><div class="po" data-pet="petonly"></div>' + pring() + '<div class="mid">' +
        '<div class="mtop"><span class="dot"></span><span class="mline"><span data-b="status"></span> ・ <span data-b="hm"></span></span>' +
          standC('st') + '<span class="pline" data-prompt-line hidden></span>' + feedBtn('feed') +
          '<button type="button" class="x" data-act="settings" title="設定" aria-label="設定">' + ic('tbGear') + '</button></div>' +
        '<div class="money-box">' + MONEY + '</div>' +
        '<div class="thin"><div class="fill" data-fill></div></div>' +
        '<div class="meta2"><span data-b="pct"></span><span data-b="remainPhrase"></span></div>' +
        '</div>' + rcol() + '<div class="fx" data-fx data-fxwin></div></div>';
    },
    U7: function () {
      return '<div class="u7 lay"><div class="dpet" data-hover>' + pring() +
        '<div class="mtag money-box" data-hit' + MASK + '>' + MONEY + '<div class="thin"><div class="fill" data-fill></div></div>' + hline() + '</div>' +
        '<div class="po" data-pet="petonly" data-hit="pet"></div>' +
        '<div class="tools" data-hit data-hit-if=".hover .tools"><button type="button" data-act="settings" title="設定" aria-label="設定">' + ic('tbGear') + '</button>' +
          '<button type="button" class="hide" data-act="hide" title="隱藏視窗" aria-label="隱藏視窗">' + ic('tbClose') + '</button></div>' +
        '</div>' + PSLOT + '<div class="fx" data-fx data-fxwin><div class="bubble" data-bubble></div></div></div>';
    },
    M3: function () {
      return '<div class="m3 lay" data-hover><div class="ring" data-ring data-hit data-hit-shape="disc"><div class="av" data-pet="avatar"></div></div>' +
        '<div class="tagm" data-hit' + MASK + '><div class="mmoney"><small>NT$</small> ' + ODO + '</div></div>' +
        '<div class="sub" data-hit data-b="m3sub"></div>' + stickers() + hoverGear('mg', true) + PSLOT + '<div class="fx" data-fx data-fxwin></div></div>';
    },
    // U10 (G_U10_*): one fixed window, the dark capsule on its edge at the dock (layouts.js: class d-<dock>). Its views:
    // collapsed (1.1.7 review of item 5: the avatar and the whole dollars only, the least there is; the cups, 🧍 and
    // tomatoes are in the full view), a pomodoro's countdown, the full view while the
    // pointer is on it (2 decimals; 1.1.3 item 7: the water, 🧍 and 番茄鐘 chips, U1's row in a column, always there and
    // all as wide; 1.1.6 item 2: and a ⚙ on the avatar's corner) and the call while a prompt shows.
    // Only the capsule takes clicks. No odometer: the capsule changes at most once a second.
    U10: function () {
      return '<div class="u10 lay"><div class="isl" data-hit data-hover><div class="av" data-pet="avatar"></div>' +
        '<span class="iv iv-c"><i class="gd"></i><span class="im mv" data-ghost data-b="moneyWhole"' + MASK + '></span>' +
          '</span>' +
        '<span class="iv iv-f"><span class="donut" data-gauge="pomo"></span><span class="im" data-b="mmss"></span>' +
          '<span class="isub" data-b="phaseNote"></span><span class="im sm mv" data-ghost data-b="moneyWhole"' + MASK + '></span></span>' +
        '<span class="iv iv-x">' + hoverGear('ug') + '<span class="icol"><span class="isub"><i class="gd"></i><span data-b="status"></span> · ' +
            '<span data-b="remainPhrase"></span></span><span class="im"' + MASK + '>NT$ ' + mv('money') + '</span>' +
            '<span class="ibar"><i data-fill></i></span></span>' +
          '<span class="icol chips"><button type="button" class="ichip"' + DRINK + '>' + ic('drop') + '<span data-b="cupsBtn"></span></button>' +
            '<span class="ichip" data-hold data-nil="stand" title="' + HOLD_TIP + '">' + standIcons() + '<span data-b="standSlotX"></span></span>' +
            '<button type="button" class="ichip"' + POMO + '>' + ic('tom') +
              '<span class="go" data-b="pomoGlyph"></span><span data-show="tomatoes" data-b="tomatoes"></span></button></span></span>' +
        '<span class="iv iv-r" data-prompt-call hidden></span></div>' +
        '<div class="fx" data-fx data-fxwin></div></div>';
    },
    // U12 健康儀表板 (G_U12_*): the money and the 下班 countdown, the three rings, and (1.1.3 item 6) the pet on a stage of
    // its own under them, saying when the next stand-up is (or what it can); a prompt is the small bubble beside the pet
    // (it takes the line's place) and its ring glows.
    U12: function () {
      return '<div class="win u12 dash lay" data-hit>' + bar(TITLES.U12) + '<div class="body">' +
        '<div class="dtop">' + PILL + '<span class="dl2" data-b="remainPhrase"></span></div>' +
        '<div class="money-box dmb"><div class="money-label">今天已經賺到</div>' + MONEY +
          '<div class="thin"><div class="fill" data-fill></div></div></div>' +
        gauges() +
        '<div class="dfoot"><div class="po" data-pet="petonly"></div><div class="say" data-b="dsay"></div>' + PSLOT + '</div>' +
        '</div><div class="fx" data-fx data-fxwin></div></div>';
    },
    // U13 番茄鐘優先 (G_U13_*): the big ring is the one pomodoro button (spec §5.2, 1.1.2 item 4): idle it reads 下一顆 25
    // 分鐘 and ▶ 開始專心; it counts a focus (red) or a break (green) down with ■ 停止 on the same spot, and then only ■ 停止
    // stops it (1.1.2 review: the rest of the ring lets clicks through; layouts.js checks too). A prompt sits inside it
    // (Ruling C4). The pet sits on its edge, outside the button. Under it the tomato slots (one per the day's
    // goal), and the cups (1.1.6 item 3: a water button) and the next stand-up.
    U13: function () {
      return '<div class="win u13 pomo1 lay" data-hit>' + bar(TITLES.U13) + '<div class="body">' +
        '<div class="ptop">' + PILL + '<span class="pm money-box" data-plus="left"' + MASK + '><span class="cur">NT$</span> ' + ODO + '</span></div>' +
        '<div class="ptop2"><span data-b="remainPhrase"></span><div class="thin"><div class="fill" data-fill></div></div></div>' +
        '<div class="ringwrap"><div class="bigring" data-gauge="pomo">' +
          '<button type="button" class="br-go"' + POMO + '><span class="br-idle"><small data-b="nextFocus"></small><b data-b="focusFull"></b></span>' +
            '<span class="br-run"><small data-b="status"></small><b data-b="mmss"></b><small data-b="nth"></small></span>' +
            '<span class="go" data-holdring data-b="pomoGo"></span></button>' +
          '<span class="br-rem" data-prompt-ring hidden></span></div>' +
          '<div class="po" data-pet="petonly"></div></div>' +
        '<div class="tslots"><span class="tsl" data-tslots></span><span data-b="tslotText"></span></div>' +
        '<div class="pline"><button type="button" class="pp wat" data-show="cups"' + DRINK + '>' + ic('drop') + '<span data-b="cupsLong"></span></button>' +
          '<span class="dt" data-show="cupsStand">・</span><span class="pp" data-show="stand" data-hold title="' + HOLD_TIP + '">' + standIcons() +
            '<span data-b="standLine"></span></span></div>' +
        '</div><div class="fx" data-fx data-fxwin></div></div>';
    },
    // o.from (1.1.2 item 3): shown in the window of U1, U3 (1.1.3), U12 or U13, with that window's title bar (.inplace)
    PANEL: function (o) {
      var t = o && INPLACE_TITLES.hasOwnProperty(o.from) ? INPLACE_TITLES[o.from] : null;
      return '<div class="win panel lay' + (t ? ' inplace' : '') + '" data-hit>' + (t ? bar(t) : bar('錢進中', true)) +
        '<div class="pbody" data-panel></div><div class="fx" data-fx data-fxwin></div></div>';
    }
  };
  TEMPLATES.parts = { BAR: BAR, MONEY: MONEY, PILL: PILL, feedBtn: feedBtn };
  return TEMPLATES;
})();
