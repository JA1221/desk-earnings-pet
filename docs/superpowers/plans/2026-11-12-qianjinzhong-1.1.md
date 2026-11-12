# 錢進中 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 錢進中 1.1.0 on top of the simplified 1.0: one 休息提醒 (stand up, and drink while you're at it) with cup counting, a 番茄鐘, the health calendar, the layouts U10 / U12 / U13, 省電模式, and the two 1.0 residual fixes, without changing any 1.0 behaviour or user data.

**Architecture:** Same shape as 1.0: a thin C# host and a WebView2 page of classic scripts on `QJZ`.
- Three new pure core modules decide everything from the wall clock and are tested with fake clocks:
  - `reminders.js`: the one reminder timer;
  - `pomodoro.js`: the focus / break state machine;
  - `prompt.js`: the one-bubble arbiter (queue, gates, re-wave, answers, copy).
- `ui/care.js` wires them to `QJZ.app`, the bridge and the session, and stores counts in history.json.
- The host gains fullscreen state, raise-without-activate, U10 docking and snapping, grow-inside resizing, and the new menu items.
- The UI adds the A picks, the prompt bubbles, the ring, the new layouts, the 健康 tab and the calendar.

**Tech Stack:** unchanged from 1.0. C# 5 / .NET Framework 4.8 WinForms (in-box `csc.exe`), the WebView2 SDK already in `vendor\`, vanilla JS (ES2017 classic scripts), PowerShell build and test scripts, headless Edge for web tests.

**Spec:** `docs/superpowers/specs/2026-11-12-qianjinzhong-1.1-design.md`. It is binding, including §4.9 (the user's simplifications), §4.10 (the simplified 1.0 this plan starts from) and every §5 「我的決定」.
- Context: `docs/superpowers/specs/2026-11-11-qianjinzhong-design.md`, `docs/superpowers/plans/2026-11-11-qianjinzhong.md`, and `.superpowers/sdd/2026-11-11-qianjinzhong/simplify-decisions.md`.
- Mockups: `docs/prototypes/v1.1/index.html` (serve `docs/prototypes/v1.1/` with `python -m http.server`).
  - The ids cited per task are keys of its `MOCKS` object.
  - Its CSS is in the same file; the icon sprite (`<symbol id="i-…">`) is at lines 606–639; the draft pet props (`EXTRA`) are at lines 707–800.
  - The mockups predate the simplifications. Where they conflict, spec §4.9 / §4.10 wins.

**Execution notes:**
- Work on branch `feat/qianjinzhong-v1.1`, cut from `feat/qianjinzhong-v1` at execution time, in a worktree (superpowers:using-git-worktrees).
- **Before Task 1,** confirm the starting point and record the baseline counts from `test.ps1`. If anything here is missing, stop and report.
  - The cat skins are present: `cat-h2.js` and `cat-s4.js`, and `SKINS.cat` has 5 entries. The H2 skins are named 貪吃鼠 / 貪吃貓.
  - The 1.0 simplification (spec §4.10) has landed:
    - `panels.js` has 4 tabs (薪水和時間, 寵物, 畫面, 其他);
    - the menu has one status-following 開始上班／下班／繼續上班 item, a 「版型 ▶」 submenu holding 縮成迷你 and 永遠在最上層, and 餵食 (with its snack count) in the top group;
    - the app starts in the last-used layout;
    - U1 has no date row, no 已上班 card, and no 月薪 text;
    - U3 has one alternating card.
- Note the message the simplified 1.0 uses for its live menu labels. 1.1 sends its own (`healthMenu`, Task 9) and does not touch that one.
- Tasks run in order, except Task 17 (art).
  - Task 17 may start in its own worktree after Task 7 is merged.
  - It edits only `src/web/js/pets/**`, `src/web/css/pets.css`, `src/web/poses-review.html`, `tools/inline-page.ps1` and `tests/web/pets.test.js`.
  - It runs its tests with `-EdgeProfile` (Task 1) and is merged back before Task 18.
- **GATE (Task 17):** the controller publishes the self-contained pose review page and waits for the user's OK. Only then do the skins declare the new poses. Task 18's release build needs those declarations.
- **Ruling** marks this plan's decision where the spec left a choice or where spec, mockup and code disagreed.

## Global Constraints

- **Carried over from 1.0** (spec §3):
  - Windows 10 1903+ / 11, with only in-box .NET 4.8 and the Evergreen WebView2 Runtime; one exe; no admin rights.
  - Writes only to `%AppData%\錢進中`, `%LocalAppData%\錢進中` and the HKCU Run value `錢進中`.
  - Traditional Chinese; `NT$` with 2 decimals; the A1 palette and Fredoka; antivirus-friendly; no Windows toast; no downloads.
- **Host code.** C# 5, compiled by `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`. None of: `$""`, `?.` / `?[]`, `nameof`, expression-bodied members, auto-property initialisers, `using static`, exception filters.
- **Web code.** Classic scripts on `QJZ`, ES2017, no framework, no build step. Each new module is one IIFE (`window.QJZ = window.QJZ || {}; QJZ.x = (function () { … })();`). User text goes in only through `textContent` / `value`.
- **1.0 behaviour must not break**, including the simplified 1.0 (spec §3, §4.10):
  - earnings and start time, capture guard, hide hotkey, click-through, 相容模式;
  - focus rules: U7 / M3 / U10 never take focus; U1 / U3 / U5B / U12 / U13 / PANEL activate;
  - last-layout start, and topmost from the menu only.
  - The suite stays green after every task.
- **Upgrade (§5.5).**
  - A 1.0 `settings.json`, `history.json` and `window.json` keep every value. New keys appear only when the page next saves.
  - Both reminders stay off until `health.asked` is true.
- **Spec values, exact (§4.1, §4.9, §5.1–5.4):**
  - one reminder timer, every 50 min (20–120, step 5); 一天 8 杯 (1–20);
  - 專心 25 (10–90, step 5); 短休息 5 (1–30); 長休息 15 (5–60, step 5); 每 4 顆長休息 (2–8).
  - 起來動目標 = floor(hoursPerDay·60 / every), at least 1 (8 h, 50 min → 9). 番茄每日目標 = 每幾顆長休息.
  - A lock of 5 min or more = one 起來動 and the timer restarts. 「等一下」 = 10 min. Re-wave every 2 min.
  - A queued bubble appears 3 s after the blocking condition ends. Reminders run only while the work status is `working`, which includes the sprint.
- **Showing counts (§4.9 #8).**
  - Cups show only when the 喝水 reminder is on or a cup was logged today.
  - Tomatoes show only when one was completed today or a focus is running.
  - The 開始番茄鐘 buttons always show, and U12 always shows its rings.
- **Prompts.** At most one prompt bubble, and no chatter while it shows. A prompt never takes keyboard focus. No sound, no toast.
- **Timing.** Every timer is derived from the wall clock (`QJZ.app.nowMs()`) on each step, never from a long `setTimeout`. Every rule can be tested with a fake clock.
- **Animation.** The new UI never animates continuously while nothing happens. Rings and the capsule update at most once a second, and the ring arc has no CSS transition.
- **Pet art (§5.8).**
  - Until a skin declares the new poses, they fall back: wave→celebrate, holdCup/sip→coffee, focus→typing.
  - `build.ps1 -Release` fails while any of the 10 skins lacks one. `-DraftPoses` overrides this for measurement builds only; such a build is never handed out.
- **Version** 1.1.0 (`AppHost.Version`). Quoted Chinese strings in this plan are exact copy; keep them verbatim.
- **Running tests.** The PowerShell tool is broken here, so run everything from Bash in the worktree root.
  - Tests: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./test.ps1`. A pass prints `WEB: <n> passed, 0 failed`, `HOST: <n> passed, 0 failed` and exits 0.
  - Builds: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./build.ps1` (or `-Release`).
  - Never run two web test runs at once: `test.ps1` kills every msedge whose command line contains its Edge profile path. A second worktree passes `-EdgeProfile <own dir>`.
- **The user works on this PC while agents run.**
  - No synthetic input: no SendInput, mouse_event or keybd_event, and never spiketool `click` / `drag` / `hover` / `hovercap`. PostMessage and window-state queries are fine.
  - On-screen windows go only on DISPLAY1, the left portrait monitor: DPI-unaware about −1080,−445 720×1280; physical −1080,−445 1080×1920 at 150 %, work-area bottom 1403.
    - Keep test windows small and short-lived; never activate them; never use the middle or right monitor.
    - Prefer headless screenshots (`tools/shot.ps1`).
  - Never change Windows settings.
  - App runs use a test profile (`QJZ_PROFILE`, Task 8), so `%AppData%\錢進中` is never touched. If a test ever swaps it, restore it byte-identically, checked by hash.
  - Leave no HKCU Run value and no stray 錢進中 or msedgewebview2 process (close by PostMessage `WM_CLOSE`; check by PID tree).
  - Never run or kill the user's `C:\Users\<user>\Desktop\錢進中.exe`. Launch no app before Task 8.
- **Git.**
  - LF line endings; stage files by explicit path only.
  - Every commit ends with:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: <session link>
    ```
    The pattern: `git commit -m "feat(core): …" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: <session link>"`

## Review Focus

1. **Sleep, or a long hidden spell across lunch or the end of the day.** Only working time counts. On return there is at most one bubble, 3 s after the window is back, and none after 下班. Tests: Task 1 `reminders: a long gap across lunch …`; Task 6 `care: a window hidden from 10:30 to 14:00 …`, `care: waking after 18:00 …`.
2. **The 04:00 day change, or a clock change, while a pomodoro or a bubble is open.** A tomato counts for its start day; the timer restarts; yesterday's bubble closes quietly; a clock set back never gives negative time. Tests: Task 1 `clock went back`; Task 2 `pomodoro: a tomato counts for the day it started`; Task 6 `care: the 04:00 rollover …`.
3. **Hand-edited or corrupt data** (out-of-range or wrong-type health settings, negative or float cups, a garbage pomodoro, an `endMs` days away). Everything is sanitised, with no NaN on screen and no crash. Tests: Task 4 ranges; Task 5 `health: … sanitized`; Task 2 `pomodoro: sanitize`.
4. **U10 and grow-inside on odd monitor layouts** (a portrait monitor at negative coordinates, a side or auto-hide taskbar, a monitor that is gone). The capsule, and a grown U5-B / U7 / M3, stays fully on an existing work area. Tests: Task 9 `CapsuleDockTests` (with `Test_AreaForAGoneMonitor`), `WindowPlacerTests.Test_FitAfterGrow_*`.
5. **Double presses, answers to a bubble already gone, and 記一杯水 from the tray while the bubble is open.** Exactly one cup per real press; stale answers do nothing; the bubble updates or closes quietly. Tests: Task 3 `prompt: stale and repeated answers do nothing`; Task 6 `care: a cup from the tray while the bubble is open …`.

---

## File Map

```
src/web/js/core/reminders.js   NEW  QJZ.reminders   the one reminder timer from the wall clock (pure)
src/web/js/core/pomodoro.js    NEW  QJZ.pomodoro    focus / break state machine (pure)
src/web/js/core/prompt.js      NEW  QJZ.prompt      one-bubble arbiter: queue, gates, re-wave, answers, copy (pure)
src/web/js/core/health.js      NEW  QJZ.health      per-day counts on history records, calendar model (pure)
src/web/js/core/settings.js    MOD  health section and derived goals, layouts U10/U12/U13, layout.capsule, display.powerSaver
src/web/js/core/history.js     MOD  parse keeps rec.health and history.pomodoro
src/web/js/ui/app.js           MOD  setHealth / setPomodoro (flushed), unstarted days with health kept, tickMs
src/web/js/ui/care.js          NEW  QJZ.care        runtime: timer + pomodoro + arbiter wired to app, bridge, session
src/web/js/ui/icons.js         NEW  QJZ.icons       drop / tom / stand / rest / hp / cup SVGs (mockup sprite)
src/web/js/ui/templates.js     NEW  QJZ.templates   layout markup moved out of layouts.js, plus U10 / U12 / U13
src/web/js/ui/ring.js          NEW  QJZ.ring        countdown ring markup + 1 Hz update
src/web/js/ui/promptview.js    NEW  QJZ.promptView  the prompt in each layout
src/web/js/ui/layouts.js       MOD  health bindings and visibility rules, care wiring, new layouts, U10 dock and hover
src/web/js/ui/panels.js        MOD  健康 tab, healthAsk panel, 省電模式 toggle, calendar card, QJZ.panels.kit
src/web/js/ui/panels-health.js NEW  QJZ.panelsHealth 健康 tab, onboarding step 3 / upgrade question, calendar card
src/web/js/pets/registry.js    MOD  NEW_POSES, FALLBACK, poseFor, missingPoses
src/web/js/pets/compose.js     MOD  states through poseFor; saver crayon texture
src/web/js/pets/behavior.js    MOD  Brain cues (focus / wave / holdCup / stretch), knock, saver idle rate
src/web/js/pets/lines.js       MOD  drank / waterGoal / standOk / focusPoke
src/web/js/pets/{states,props,rig}.js, skins/*.js, css/pets.css   MOD (Task 17 art only)
src/web/css/health.css         NEW  ported from docs/prototypes/v1.1/index.html
src/web/poses-review.html      NEW  dev page: 10 skins × the 4 new poses
src/web/index.html, dev.html, tests/web/run.html, tests/web/fixtures-v10.js   MOD / NEW
src/host/Presentation.cs       NEW  SHQueryUserNotificationState -> fullscreen / presentation, polled, change event
src/host/CapsuleDock.cs        NEW  U10 dock rectangles, snapping, area choice (pure)
src/host/AppHost.cs            MOD  wiring: fullscreen, raise, dock, grow-inside, healthMenu, exit stamp clear
src/host/AppPaths.cs, SingleInstance.cs   MOD  QJZ_PROFILE test profile
src/host/WindowPlacer.cs       MOD  FitAfterGrow / AfterShrink
src/host/PetWindow.cs          MOD  ToPhysical
src/host/TrayMenu.cs           MOD  記一杯水 / 開始番茄鐘 on top, U10/U12/U13 and 膠囊位置 in 版型 ▶
src/host/PauseGate.cs          MOD  ShowRescue: EffectiveTopmost, NoActivate U10, MenuShows
src/host/HostSettings.cs       MOD  layout list
src/host/Payload.cs, Program.cs, ExitStamp.cs   MOD  §5.10 fixes
src/host/Native.cs             MOD  SHQueryUserNotificationState
tools/test-profile.ps1, tools/shot.ps1, tools/cpu-measure.ps1, tools/inline-page.ps1   NEW
tools/visual-check/spiketool.cs  MOD  fg, post
build.ps1 (-Release pose check, -DraftPoses), test.ps1 (-EdgeProfile, -WebOnly, -HostOnly)   MOD
docs/使用說明.md, src/web/guide.txt   MOD
```

**Script order** in `index.html`, `dev.html` and `run.html` (run.html has no `bridge.js`). Each task adds its own files in this order:
- core: time, earnings, day, settings, health, pomodoro, history, rewards, mood, reminders, prompt
- ui: bridge, odometer, fx, sound, app, care, icons, ring
- pets: …, compose, behavior, lines
- ui: templates, promptview, layouts, panels, panels-health

**Start sequence:** `QJZ.layouts.start(root); QJZ.panels.start(); QJZ.care.start(); QJZ.app.start();`.

### Message protocol additions

- **Page → host:**
  - `raise {on}`;
  - `healthMenu {cups:'3/8'|null, pomodoro:{phase:'idle'|'focus'|'break'|'breakOver', endsMs:number|null}}`, sent after init and on change. `cups` is null when hidden by §4.9 #8;
  - `setLayout` gains `dock:'top'|'bottomLeft'|'bottomCenter'|'bottomRight'` (U10 only).
- **Host → page:**
  - `fullscreen {on}`, after every init and on change;
  - `capsuleDock {dock}`, after a U10 drag;
  - new `menu {action}` ids: `layout:U10`, `layout:U12`, `layout:U13`, `pomodoro`, `drink`, `capsule:top`, `capsule:bottomLeft`, `capsule:bottomCenter`, `capsule:bottomRight`.

---

### Task 1: The reminder timer, pure

**Files:**
- Create: `src/web/js/core/reminders.js`, `tests/web/reminders.test.js`
- Modify: `tests/web/run.html`, `src/web/index.html`, `src/web/dev.html`, `test.ps1`

**Interfaces:**
- Consumes: `QJZ.earn.snapshot`, `QJZ.earn.lunchRange`, `QJZ.time.dayKey`; settings `health` (Task 4 shape; the tests pass parsed settings).
- Produces `QJZ.reminders` (pure; it returns new objects):
  - `workMs(rec, settings, fromMs, toMs) -> number`: `(snapshot(to).workedSec − snapshot(from).workedSec) × 1000` with the same record. Lunch, before the start, past the 8 h, a 下班 and 今天休假 count 0. Returns 0 when `to <= from`.
  - `initial(day, nowMs) -> R`, with `R = {day, lastMs, ms, away, awayMs, awayWorking, msBeforeBreak, snoozeUntil}`.
  - `advance(r, nowMs, rec, settings) -> R`:
    - adds `workMs(lastMs, now)` to `ms` unless `away`;
    - when (lastMs, now] contains the end of lunch and the record started before it, `ms` becomes the working ms after the lunch end (0 while away), and `snoozeUntil` is cleared.
  - `goAway(r, ms, rec, settings) -> R` (lock or suspend): advances to `ms`, then sets `away`, `awayMs`, and `awayWorking = (snapshot(ms).status === 'working')`. A no-op when already away.
  - `comeBack(r, ms, rec, settings) -> {r, standup}`:
    - advances to `ms` while still away, then clears `away`;
    - when `ms − awayMs >= AWAY_STANDUP_MS && awayWorking`: `ms = 0`, `snoozeUntil = null`, `standup = true`;
    - when not away, `r` is unchanged and `standup` is false;
    - a stand-up counts whatever the switches say (§5.3).
  - `reset(r)`: `ms = 0`, snooze cleared.
  - `breakStarted(r)`: `msBeforeBreak = ms`, `ms = 0`.
  - `breakSkipped(r)`: `ms += msBeforeBreak`.
  - `snooze(r, nowMs)`: `snoozeUntil = nowMs + SNOOZE_MS`.
  - `ask(health, cups) -> {sit, water}`: what the bubble asks. `sit = health.sit.on`; `water = health.water.on && cups < health.water.goal`.
  - `due(r, nowMs, health, cups) -> {due, sit, water}`: the `ask` result plus `due = (sit || water) && ms >= health.every·60000 && !(snoozeUntil > nowMs)`.
  - `minutesToNext(r, health, cups) -> number|null`: null when nothing is asked; otherwise `max(0, ceil((every·60000 − ms) / 60000))`.
  - Constants: `AWAY_STANDUP_MS = 300000`, `SNOOZE_MS = 600000`.
- Produces `test.ps1 [-EdgeProfile <dir>] [-WebOnly] [-HostOnly]`. The default profile is `tests\web\.edge-profile`; the msedge cleanup matches only the profile in use.

- [ ] **Step 1: Add the three `test.ps1` parameters.** Run `test.ps1`. Expected: the baseline counts.
- [ ] **Step 2: Write the failing tests.** 2026-11-12 is a Thursday; the start is 09:00, so lunch is 12–13 and the day ends 18:00.

```js
var R = QJZ.reminders, D = '2026-11-12';
function at(h, m, s, ms) { return new Date(2026, 10, 12, h, m, s || 0, ms || 0).getTime(); }
function S(health) { return QJZ.settings.parse(JSON.stringify({ salary: { amount: 50000 }, health: health || { asked: true, sit: { on: true }, water: { on: true } } })).settings; }
var ALL = S(), H = ALL.health;
function started(h, m) { return QJZ.day.manualStart(QJZ.day.empty(D), at(h, m)); }
function run(rec, from, to) { return R.advance(R.initial(D, from), to, rec, ALL); }
function due(r, t, h, cups) { return R.due(r, t, h || H, cups || 0).due; }
test('reminders: working time excludes lunch, before the start, after 8 h, 休假, 下班; clock went back', function () {
  var r9 = started(9, 0);
  eq(R.workMs(r9, ALL, at(9, 0), at(10, 0)), 3600000); eq(R.workMs(r9, ALL, at(11, 30), at(13, 30)), 3600000, 'lunch');
  eq(R.workMs(r9, ALL, at(8, 0), at(9, 30)), 1800000, 'before the start'); eq(R.workMs(r9, ALL, at(17, 30), at(19, 0)), 1800000, 'ends 18:00');
  eq(R.workMs(QJZ.day.setOffDay(r9, true), ALL, at(9, 0), at(10, 0)), 0, '今天休假'); eq(R.workMs(QJZ.day.empty(D), ALL, at(9, 0), at(10, 0)), 0, 'not started');
  eq(R.workMs(QJZ.day.manualEnd(r9, at(15, 0)), ALL, at(14, 0), at(16, 0)), 3600000, '下班 15:00'); eq(R.workMs(r9, ALL, at(10, 0), at(9, 0)), 0, 'clock went back');
});
test('reminders: due after 50 working minutes, not a millisecond earlier', function () {
  var rec = started(9, 0);
  eq(due(run(rec, at(9, 0), at(9, 49, 59, 999)), at(9, 49, 59, 999)), false); eq(due(run(rec, at(9, 0), at(9, 50)), at(9, 50)), true);
});
test('reminders: what the bubble asks', function () {
  function ask(sit, water, cups) { return R.ask(S({ asked: true, sit: { on: sit }, water: { on: water } }).health, cups); }
  eq(ask(true, true, 3), { sit: true, water: true }); eq(ask(true, false, 3), { sit: true, water: false }); eq(ask(false, true, 3), { sit: false, water: true });
  eq(ask(true, true, 8), { sit: true, water: false }, 'goal reached'); eq(ask(false, true, 8), { sit: false, water: false }); eq(ask(false, false, 0), { sit: false, water: false });
  eq(due(run(started(9, 0), at(9, 0), at(15, 0)), at(15, 0), S({ asked: true, water: { on: true } }).health, 8), false, 'water only, goal reached: done for today');
});
test('reminders: the end of lunch restarts the timer (start 11:20 -> due 13:50, not 13:10)', function () {
  var r = started(11, 20);
  eq(due(run(r, at(11, 20), at(13, 49, 59)), at(13, 49, 59)), false); eq(due(run(r, at(11, 20), at(13, 50)), at(13, 50)), true);
});
test('reminders: a lock of 5:00 is a stand-up and restarts the timer, 4:59 is not; a lock during lunch is not', function () {
  var rec = started(9, 0), r30 = R.goAway(run(rec, at(9, 0), at(9, 30)), at(9, 30), rec, ALL);
  var short = R.comeBack(r30, at(9, 34, 59), rec, ALL); eq(short.standup, false);
  eq(due(R.advance(short.r, at(9, 54, 58), rec, ALL), at(9, 54, 58)), false); eq(due(R.advance(short.r, at(9, 54, 59), rec, ALL), at(9, 54, 59)), true);
  var long = R.comeBack(r30, at(9, 35), rec, ALL); eq([long.standup, long.r.ms], [true, 0]);
  eq(due(R.advance(long.r, at(10, 25), rec, ALL), at(10, 25)), true);
  eq(R.comeBack(R.goAway(run(rec, at(9, 0), at(12, 10)), at(12, 10), rec, ALL), at(12, 40), rec, ALL).standup, false, 'lunch');
});
test('reminders: 等一下 brings it back exactly 10 minutes later', function () {
  var rec = started(9, 0), r = R.snooze(run(rec, at(9, 0), at(9, 51)), at(9, 51));
  eq(due(R.advance(r, at(10, 0, 59, 999), rec, ALL), at(10, 0, 59, 999)), false); eq(due(R.advance(r, at(10, 1), rec, ALL), at(10, 1)), true);
});
test('reminders: reset; a break restarts the timer; skipping the break restores it', function () {
  var rec = started(9, 0), r = R.reset(run(rec, at(9, 0), at(9, 40)));
  eq(due(R.advance(r, at(10, 29, 59), rec, ALL), at(10, 29, 59)), false); eq(due(R.advance(r, at(10, 30), rec, ALL), at(10, 30)), true);
  r = R.breakStarted(run(rec, at(9, 0), at(9, 45))); eq(r.ms, 0);
  r = R.breakSkipped(R.advance(r, at(9, 46), rec, ALL)); eq(r.ms, 46 * 60000); eq(due(R.advance(r, at(9, 50), rec, ALL), at(9, 50)), true);
});
test('reminders: nothing asked, or a day that never started, is never due; minutes to the next one', function () {
  var off = S({ asked: true }).health, rec = started(9, 0);
  eq(due(run(rec, at(9, 0), at(15, 0)), at(15, 0), off), false); eq(due(run(QJZ.day.empty(D), at(9, 0), at(15, 0)), at(15, 0)), false);
  eq(R.minutesToNext(run(rec, at(9, 0), at(9, 42)), H, 0), 8); eq(R.minutesToNext(R.initial(D, at(9, 0)), off, 0), null);
});
test('reminders: a long gap across lunch counts only the working time after the lunch end', function () {
  var rec = started(9, 0); eq(R.advance(run(rec, at(9, 0), at(11, 0)), at(14, 0), rec, ALL).ms, 3600000);
});
```
- [ ] **Step 3: Run `test.ps1`.** Expected: FAIL (`failed to load reminders.js`).
- [ ] **Step 4: Implement `reminders.js`.**
- [ ] **Step 5: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 6: Commit** the six files as `feat(core): the reminder timer`.

---

### Task 2: Pomodoro state machine, pure

**Files:**
- Create: `src/web/js/core/pomodoro.js`, `tests/web/pomodoro.test.js`
- Modify: `tests/web/run.html`, `src/web/index.html`, `src/web/dev.html`

**Interfaces:**
- Consumes: `QJZ.time.dayKey`. `cfg = settings.health.pomodoro = {focus, short, long, longEvery}` (minutes / count).
- Produces `QJZ.pomodoro` (pure):
  - `P = {phase:'idle'|'focus'|'break'|'breakOver', startMs, endMs, day, long, done, notice:null|'break'|'breakEnd'}`.
    - `day`: the dayKey of the focus start.
    - `done`: that day's tomato count after this one.
    - `notice`: the bubble still owed to the user.
  - `idle()`.
  - `start(p, nowMs, cfg)`: only from idle or breakOver; any other phase is returned unchanged. A focus now → now + focus·60000, `day = dayKey(now)`, `notice` null.
  - `stop(p)`: idle; a stopped focus counts nothing.
  - `skipBreak(p, nowMs, cfg)`: break → a focus from now.
  - `ack(p)`: `notice = null`.
  - `advance(p, nowMs, cfg, countBefore) -> {p, events}` walks every phase that has ended, in order:
    - the focus end gives `{type:'focusDone', day:p.day, atMs}`, then `{type:'breakStart', day:dayKey(atMs), atMs, long}`. The break runs from `atMs` to `atMs + (long ? cfg.long : cfg.short)·60000`, with `long = (countBefore + 1) % cfg.longEvery === 0`, `done = countBefore + 1` and `notice = 'break'`.
    - the break end gives `{type:'breakDone', atMs}`, phase `breakOver`, `notice = 'breakEnd'`. It never starts by itself.
    - `countBefore` is the number of tomatoes already done on `p.day`.
  - `sanitize(raw) -> P|null`.
    - `idle` needs no times.
    - `null` for: a non-object; an unknown phase; non-finite times; `endMs <= startMs`; `endMs − startMs > 24 h`; a malformed day.
  - `remainingMs`, `minutesLeft` (ceil), `mmss` (`'mm:ss'`, seconds rounded up), `fraction` (elapsed share 0..1), all `(p, nowMs)`. Each is null when the phase is idle or breakOver.

- [ ] **Step 1: Write the failing tests** (`CFG = {focus:25, short:5, long:15, longEvery:4}`; `at()` as in Task 1):

```js
var P = QJZ.pomodoro, CFG = { focus: 25, short: 5, long: 15, longEvery: 4 };
function types(x) { return x.events.map(function (e) { return e.type; }); }
test('pomodoro: 25 minutes of focus, then the 5-minute break starts at once', function () {
  var p = P.start(P.idle(), at(9, 0), CFG); eq([p.phase, p.endMs, p.day], ['focus', at(9, 25), '2026-11-12']);
  eq(P.advance(p, at(9, 24, 59, 999), CFG, 0).events, []);
  var x = P.advance(p, at(9, 25), CFG, 0); eq(types(x), ['focusDone', 'breakStart']); eq(x.events[0].day, '2026-11-12');
  eq([x.p.phase, x.p.startMs, x.p.endMs, x.p.long, x.p.done, x.p.notice], ['break', at(9, 25), at(9, 30), false, 1, 'break']);
});
test('pomodoro: the break ends in breakOver and never starts the next one by itself', function () {
  var b = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 25), CFG, 0).p, x = P.advance(b, at(9, 30), CFG, 0);
  eq(types(x), ['breakDone']); eq([x.p.phase, x.p.notice], ['breakOver', 'breakEnd']); eq(P.advance(x.p, at(12, 0), CFG, 1).p.phase, 'breakOver');
});
test('pomodoro: every 4th tomato of its day gets the 15-minute long break', function () {
  var f = P.start(P.idle(), at(9, 0), CFG);
  eq([P.advance(f, at(9, 25), CFG, 3).p.long, P.advance(f, at(9, 25), CFG, 3).p.endMs], [true, at(9, 40)]);
  eq(P.advance(f, at(9, 25), CFG, 4).p.long, false); eq(P.advance(f, at(9, 25), CFG, 7).p.long, true);
  eq(P.advance(f, at(9, 25), { focus: 25, short: 5, long: 15, longEvery: 2 }, 1).p.long, true);
});
test('pomodoro: stop counts nothing; skip break starts a focus now; start again from breakOver', function () {
  var s = P.stop(P.start(P.idle(), at(9, 0), CFG)); eq([s.phase, s.notice], ['idle', null]); eq(P.advance(s, at(10, 0), CFG, 0).events, []);
  var b = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 25), CFG, 0).p, k = P.skipBreak(b, at(9, 26), CFG);
  eq([k.phase, k.startMs, k.endMs, k.notice], ['focus', at(9, 26), at(9, 51), null]);
  eq(P.start(P.advance(b, at(9, 30), CFG, 0).p, at(9, 40), CFG).endMs, at(10, 5)); eq(P.start(k, at(9, 30), CFG), k, 'a running focus is not restarted');
});
test('pomodoro: a restart catches up through every phase that ended while closed', function () {
  var x = P.advance(P.start(P.idle(), at(9, 0), CFG), at(9, 40), CFG, 0);
  eq(x.events.map(function (e) { return e.type + '@' + new Date(e.atMs).toTimeString().slice(0, 5); }), ['focusDone@09:25', 'breakStart@09:25', 'breakDone@09:30']);
  eq(x.p.phase, 'breakOver');
});
test('pomodoro: a tomato counts for the day it started', function () {
  var p = P.start(P.idle(), new Date(2026, 10, 12, 3, 50).getTime(), CFG); eq(p.day, '2026-11-11');
  eq(P.advance(p, new Date(2026, 10, 12, 4, 15).getTime(), CFG, 0).events[0].day, '2026-11-11');
});
test('pomodoro: sanitize', function () {
  var good = P.start(P.idle(), at(9, 0), CFG); eq(P.sanitize(JSON.parse(JSON.stringify(good))), good); eq(P.sanitize(P.idle()), P.idle());
  eq(P.sanitize('x'), null); eq(P.sanitize({ phase: 'zzz' }), null);
  eq(P.sanitize({ phase: 'focus', startMs: at(9, 0), endMs: at(8, 0), day: '2026-11-12' }), null);
  eq(P.sanitize({ phase: 'focus', startMs: at(9, 0), endMs: at(9, 0) + 3 * 86400000, day: '2026-11-12' }), null, 'days away');
});
test('pomodoro: ring text, minutes left and fraction', function () {
  var p = P.start(P.idle(), at(9, 0), CFG);
  eq(P.mmss(p, at(9, 25) - 1121200), '18:42'); eq(P.minutesLeft(p, at(9, 25) - 660001), 12); eq(P.fraction(p, at(9, 12, 30)), 0.5); eq(P.mmss(P.idle(), at(9, 0)), null);
});
```
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement `pomodoro.js`.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Commit** as `feat(core): pomodoro state machine`.

---

### Task 3: The prompt arbiter (one bubble), pure

**Files:**
- Create: `src/web/js/core/prompt.js`, `tests/web/prompt.test.js`
- Modify: `tests/web/run.html`, `src/web/index.html`, `src/web/dev.html`

**Interfaces:**
- Produces `QJZ.prompt` (pure):
  - `initial() -> Q`.
  - `step(q, c) -> {q, events}`, where:
    - `c = {nowMs, blocked, focus, working, due:{due, sit, water} (Task 1), notice:null|'break'|'breakEnd', noticeWater}`;
    - `blocked` = hidden, fullscreen, or PANEL open;
    - `Prompt = {kind:'both'|'sit'|'water'|'break'|'breakEnd', water:boolean, shownMs}`;
    - events: `{type:'show'|'update', prompt}`, `{type:'hide', quiet}`, `{type:'wave', prompt}`.
  - Rules:
    1. **What is wanted:**
       - nothing while `blocked`;
       - else a notice `{kind:notice, water: notice === 'break' && noticeWater && working}`;
       - else, when `working && !focus && due.due`, the reminder kind from `due.sit` / `due.water` (`both`, `sit` or `water`).
    2. **Gates:**
       - a notice first shows 3000 ms after `blocked` last ended;
       - a reminder first shows 3000 ms after `blocked || focus` last ended, or after the last prompt closed;
       - both gates are open at the first step.
    3. **While a prompt shows:**
       - other reminder parts → `update` (same `shownMs`, no gate);
       - a notice wanted while a reminder shows → `hide {quiet:true}`, then `show` the notice;
       - nothing wanted → `hide {quiet:true}`, and the gates restart.
    4. **Re-wave:** `wave` at `shownMs + k·WAVE_MS`. Never a second bubble.
  - `answer(q, buttonId, nowMs) -> {q, effects}`.
    - Afterwards nothing shows and the gates restart.
    - A button not on the prompt, or no prompt, gives `[]` and changes nothing.
    - Effect names: `standup` (count it and restart the timer), `drink`, `snooze`, `skipBreak`, `nextFocus`, `stopPomodoro`, `ackNotice`. The full mapping is the test `prompt: answers`.
    - **Ruling:** 「喝了」 on the break bubble records only a cup; the break already counted the stand-up.
  - `view(prompt, v) -> {kind, icon, title, sub, waterLine, buttons:[{id, label}]}`, with `v = {min, cups, cupGoal, breakMin, long, done, turn}`.
  - `LINES = {both, sit, water}`, 5 each. The title is `LINES[kind][turn % 5]`.
  - Constants: `GATE_MS = 3000`, `WAVE_MS = 120000`.
- **Copy (exact):**
  - `LINES.both` = 「起來動一動，順便喝口水～」「坐好久了～起來倒杯水吧！」「起來走走，順便把水杯裝滿～」「伸個懶腰、喝口水，再繼續加油！」「該起來囉～去裝杯水回來吧！」.
  - `LINES.sit` = 「坐好久了，起來動一動！」「屁股要長香菇了～起來走走吧！」「起來伸個懶腰吧～」「站起來動一動，等等腦袋更清楚！」「該讓椅子休息一下囉～」.
  - `LINES.water` = 「喝口水吧～」「水杯空了嗎？補一杯吧～」「補充水分，工作才有精神！」「咕嚕咕嚕～一起喝水吧！」「記得喝水，皮膚才會水噹噹～」.
  - Subtitles: both 「已經坐 {min} 分鐘囉・今天 {cups}/{cupGoal} 杯」; sit 「已經坐 {min} 分鐘囉」; water 「今天 {cups} 杯，目標 {cupGoal} 杯」.
  - The break bubble: 「休息 {breakMin} 分鐘！起來走走～」 (or 「長休息 {breakMin} 分鐘！起來走走～」), sub 「第 {done} 顆番茄完成」, water line 「順便喝口水吧～」.
  - The break-end bubble: 「休息結束～要開始下一顆嗎？」.
  - Buttons: `drink` 「喝了」, `up` 「起來了」, `later` 「等一下」, `ok` 「好」, `skip` 「跳過休息」, `next` 「開始」, `stop` 「先不要」.
    - both: drink, up, later. sit: up, later. water: drink, later.
    - break: ok, (drink), skip. breakEnd: next, stop.
  - Icons: both / sit `stand`, water `drop`, break `rest`, breakEnd `tom`.
- **Ruling:** the combined title rotates through 5 lines, the first being the user's 「起來動一動，順便喝口水～」 (§7: at least 5 lines per reminder).

- [ ] **Step 1: Write the failing tests.**

```js
var P = QJZ.prompt;
function c(t, o) { o = o || {}; var a = o.ask || '';
  return { nowMs: t, blocked: !!o.blocked, focus: !!o.focus, working: o.working !== false,
    due: { due: !!a, sit: a === 'both' || a === 'sit', water: a === 'both' || a === 'water' }, notice: o.notice || null, noticeWater: !!o.noticeWater }; }
function st(q, t, o) { return P.step(q, c(t, o)); }
function ty(x) { return x.events.map(function (e) { return e.type + (e.prompt && e.type !== 'wave' ? ':' + e.prompt.kind + (e.prompt.water ? '+w' : '') : '') + (e.quiet ? ':quiet' : ''); }); }
test('prompt: shows at once when nothing has blocked it', function () { var x = st(P.initial(), at(9, 50), { ask: 'both' }); eq(ty(x), ['show:both']); eq(x.events[0].prompt.shownMs, at(9, 50)); });
test('prompt: hidden / fullscreen / panel (blocked) queue; shown 3 s after it ends', function () {
  var x = st(st(P.initial(), at(9, 49), { blocked: true }).q, at(9, 50), { blocked: true, ask: 'both' }); eq(ty(x), []);
  x = st(x.q, at(9, 55), { ask: 'both' }); eq(ty(x), []); x = st(x.q, at(9, 55, 2, 999), { ask: 'both' }); eq(ty(x), []);
  eq(ty(st(x.q, at(9, 55, 3), { ask: 'both' })), ['show:both']);
});
test('prompt: focus queues the reminder until 3 s after it ends', function () {
  var x = st(st(P.initial(), at(9, 40), { focus: true }).q, at(9, 50), { focus: true, ask: 'sit' }); eq(ty(x), []);
  x = st(x.q, at(10, 16), { ask: 'sit' }); eq(ty(x), []); eq(ty(st(x.q, at(10, 16, 3), { ask: 'sit' })), ['show:sit']);
});
test('prompt: the break notice is not held by the focus; its water line only while working', function () {
  var q = st(P.initial(), at(9, 40), { focus: true }).q;
  eq(ty(st(q, at(10, 5), { notice: 'break', noticeWater: true })), ['show:break+w']);
  eq(ty(st(q, at(10, 5), { notice: 'break', noticeWater: true, working: false })), ['show:break']);
});
test('prompt: changed parts update the same bubble; nothing left closes it quietly', function () {
  var q = st(P.initial(), at(9, 50), { ask: 'both' }).q, x = st(q, at(9, 55), { ask: 'sit' });
  eq(ty(x), ['update:sit']); eq(x.events[0].prompt.shownMs, at(9, 50));
  eq(ty(st(st(P.initial(), at(9, 50), { ask: 'water' }).q, at(9, 55), {})), ['hide:quiet']);
});
test('prompt: re-waves every 2 minutes, never a second bubble', function () {
  var q = st(P.initial(), at(9, 50), { ask: 'both' }).q;
  eq(ty(st(q, at(9, 51, 59, 999), { ask: 'both' })), []); var x = st(q, at(9, 52), { ask: 'both' }); eq(ty(x), ['wave']);
  eq(ty(st(x.q, at(9, 53), { ask: 'both' })), []); eq(ty(st(st(x.q, at(9, 53), { ask: 'both' }).q, at(9, 54), { ask: 'both' })), ['wave']);
});
test('prompt: lunch / 下班 / 休假 close it quietly and keep it closed', function () {
  var x = st(st(P.initial(), at(11, 55), { ask: 'both' }).q, at(12, 0), { ask: 'both', working: false });
  eq(ty(x), ['hide:quiet']); eq(ty(st(x.q, at(12, 30), { ask: 'both', working: false })), []);
});
test('prompt: starting a focus puts the bubble back in the queue', function () {
  var x = st(st(P.initial(), at(9, 50), { ask: 'both' }).q, at(9, 51), { ask: 'both', focus: true }); eq(ty(x), ['hide:quiet']);
  x = st(x.q, at(10, 16), { ask: 'both' }); eq(ty(x), []); eq(ty(st(x.q, at(10, 16, 3), { ask: 'both' })), ['show:both']);
});
test('prompt: a pomodoro notice replaces the reminder; the reminder returns 3 s after the notice is answered', function () {
  var x = st(st(P.initial(), at(10, 0), { ask: 'water' }).q, at(10, 10), { ask: 'water', notice: 'breakEnd' });
  eq(ty(x), ['hide:quiet', 'show:breakEnd']); var a = P.answer(x.q, 'stop', at(10, 11)); eq(a.effects, ['ackNotice', 'stopPomodoro']);
  eq(ty(st(a.q, at(10, 11, 2, 999), { ask: 'water' })), []); eq(ty(st(a.q, at(10, 11, 3), { ask: 'water' })), ['show:water']);
});
test('prompt: pomodoro notices also show outside working hours', function () { eq(ty(st(P.initial(), at(19, 0), { notice: 'breakEnd', working: false })), ['show:breakEnd']); });
test('prompt: answers', function () {
  function ans(o, btn) { return P.answer(st(P.initial(), at(10, 0), o).q, btn, at(10, 1)).effects; }
  eq(ans({ ask: 'both' }, 'drink'), ['standup', 'drink']); eq(ans({ ask: 'both' }, 'up'), ['standup']); eq(ans({ ask: 'both' }, 'later'), ['snooze']);
  eq(ans({ ask: 'sit' }, 'up'), ['standup']); eq(ans({ ask: 'sit' }, 'later'), ['snooze']); eq(ans({ ask: 'sit' }, 'drink'), []);
  eq(ans({ ask: 'water' }, 'drink'), ['standup', 'drink']); eq(ans({ ask: 'water' }, 'later'), ['snooze']); eq(ans({ ask: 'water' }, 'up'), []);
  eq(ans({ notice: 'break' }, 'ok'), ['ackNotice']); eq(ans({ notice: 'break' }, 'skip'), ['ackNotice', 'skipBreak']); eq(ans({ notice: 'break' }, 'drink'), []);
  eq(ans({ notice: 'break', noticeWater: true }, 'drink'), ['ackNotice', 'drink']); eq(ans({ notice: 'break', noticeWater: true }, 'ok'), ['ackNotice']);
  eq(ans({ notice: 'breakEnd' }, 'next'), ['ackNotice', 'nextFocus']); eq(ans({ notice: 'breakEnd' }, 'stop'), ['ackNotice', 'stopPomodoro']);
});
test('prompt: stale and repeated answers do nothing', function () {
  eq(P.answer(P.initial(), 'drink', at(10, 0)).effects, []);
  var a = P.answer(st(P.initial(), at(10, 0), { ask: 'water' }).q, 'drink', at(10, 1)); eq(a.effects, ['standup', 'drink']);
  eq(P.answer(a.q, 'drink', at(10, 1)).effects, [], 'double press');
});
test('prompt: after any answer the next prompt waits 3 s', function () {
  var a = P.answer(st(P.initial(), at(9, 50), { ask: 'sit' }).q, 'up', at(9, 51));
  eq(ty(st(a.q, at(9, 51), { ask: 'water' })), []); eq(ty(st(a.q, at(9, 51, 3), { ask: 'water' })), ['show:water']);
});
test('prompt: view copy', function () {
  function lab(v) { return v.buttons.map(function (b) { return b.label; }); }
  var b = P.view({ kind: 'both' }, { min: 50, cups: 3, cupGoal: 8, turn: 0 });
  eq([b.title, b.sub, b.icon], ['起來動一動，順便喝口水～', '已經坐 50 分鐘囉・今天 3/8 杯', 'stand']); eq(lab(b), ['喝了', '起來了', '等一下']);
  eq(b.buttons.map(function (x) { return x.id; }), ['drink', 'up', 'later']); eq(P.view({ kind: 'both' }, { turn: 6 }).title, P.LINES.both[1]);
  ok(P.LINES.both.length >= 5 && P.LINES.sit.length >= 5 && P.LINES.water.length >= 5);
  var s = P.view({ kind: 'sit' }, { min: 50, turn: 0 }); eq([s.title, s.sub], ['坐好久了，起來動一動！', '已經坐 50 分鐘囉']); eq(lab(s), ['起來了', '等一下']);
  var w = P.view({ kind: 'water' }, { cups: 3, cupGoal: 8, turn: 0 }); eq([w.title, w.sub, w.icon], ['喝口水吧～', '今天 3 杯，目標 8 杯', 'drop']); eq(lab(w), ['喝了', '等一下']);
  var r = P.view({ kind: 'break', water: false }, { breakMin: 5, done: 3 }); eq([r.title, r.sub, r.waterLine], ['休息 5 分鐘！起來走走～', '第 3 顆番茄完成', null]); eq(lab(r), ['好', '跳過休息']);
  var l = P.view({ kind: 'break', water: true }, { breakMin: 15, long: true, done: 4 }); eq([l.title, l.waterLine], ['長休息 15 分鐘！起來走走～', '順便喝口水吧～']); eq(lab(l), ['好', '喝了', '跳過休息']);
  var e = P.view({ kind: 'breakEnd' }, {}); eq(e.title, '休息結束～要開始下一顆嗎？'); eq(lab(e), ['開始', '先不要']);
});
```
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement `prompt.js`.** Keep two gate times, `noticeReadyAt` and `remindReadyAt`, per rule 2.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Commit** as `feat(core): one-bubble prompt arbiter`.

---

### Task 4: Settings schema and the upgrade from 1.0 (§4.9, §5.4, §5.5)

**Starting point:** the 1.0 simplification has already made the app start in the last-used layout and removed the start-layout and topmost controls from settings (§4.10). Do not rebuild either. This task only adds the 1.1 keys and lets U10 / U12 / U13 into the lists the simplified code keeps.

**Files:**
- Create: `tests/web/fixtures-v10.js`
- Modify: `src/web/js/core/settings.js`, `tests/web/settings.test.js`, `tests/web/run.html`, `src/host/HostSettings.cs`, `tests/host/HostSettingsTests.cs`

**Interfaces:**
- Produces in `QJZ.settings`:
  - `DEFAULTS.health = {asked:false, every:50, sit:{on:false}, water:{on:false, goal:8}, pomodoro:{focus:25, short:5, long:15, longEvery:4}}`;
  - `DEFAULTS.layout.capsule = 'top'`: the stored dock, which settings never show;
  - topmost defaults `U10:true, U12:false, U13:false`;
  - `DEFAULTS.display.powerSaver = false`.
  - `LAYOUTS` gains `'U10','U12','U13'` (exported). `DOCKS = ['top','bottomLeft','bottomCenter','bottomRight']`.
  - `HEALTH_RANGES = {'every':[20,120,5], 'water.goal':[1,20,1], 'pomodoro.focus':[10,90,5], 'pomodoro.short':[1,30,1], 'pomodoro.long':[5,60,5], 'pomodoro.longEvery':[2,8,1]}`.
    - A non-number gives the default. Otherwise the value is clamped, then set to `min + round((v − min) / step)·step`.
    - A non-boolean gives the default.
  - `standGoal(settings) -> max(1, floor(hoursPerDay·60 / health.every))` and `tomatoGoal(settings) -> health.pomodoro.longEvery`.
- Produces in `HostSettings`: the layout list includes U10, U12 and U13; U10 is topmost by default. If the simplified 1.0 renamed its start-layout field, keep its name.
- Produces in `tests/web/fixtures-v10.js`:
  - `window.V10 = {settingsText, settingsParsed}`.
  - `settingsText` is a settings.json with every value set away from the defaults, written by released 1.0.0.
  - `settingsParsed` is `JSON.stringify(QJZ.settings.parse(settingsText).settings)`, recorded once with the branch's `settings.js` before this task changes it.

- [ ] **Step 1: Create `fixtures-v10.js`** (the record step above). Then write the failing tests:

```js
test('settings: health defaults and the derived goals (§4.9, §5.4)', function () {
  var d = QJZ.settings.parse(null).settings;
  eq(d.health, { asked: false, every: 50, sit: { on: false }, water: { on: false, goal: 8 }, pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4 } });
  eq(QJZ.settings.standGoal(d), 9); eq(QJZ.settings.tomatoGoal(d), 4);
  eq(QJZ.settings.standGoal(QJZ.settings.parse('{"hoursPerDay":7.5}').settings), 9); eq(QJZ.settings.standGoal(QJZ.settings.parse('{"health":{"every":120}}').settings), 4);
  eq(QJZ.settings.standGoal(QJZ.settings.parse('{"health":{"every":20}}').settings), 24);
});
test('settings: health ranges and steps', function () {
  function h(o) { return QJZ.settings.parse(JSON.stringify({ health: o })).settings.health; }
  eq(h({ every: 53 }).every, 55); eq(h({ every: 52 }).every, 50); eq(h({ every: 10 }).every, 20); eq(h({ every: 500 }).every, 120); eq(h({ every: '50' }).every, 50);
  eq(h({ water: { goal: 0 } }).water.goal, 1); eq(h({ water: { goal: 8.6 } }).water.goal, 9); eq(h({ water: { goal: 99 } }).water.goal, 20);
  eq(h({ pomodoro: { focus: 7 } }).pomodoro.focus, 10); eq(h({ pomodoro: { focus: 93 } }).pomodoro.focus, 90);
  eq(h({ pomodoro: { short: 0 } }).pomodoro.short, 1); eq(h({ pomodoro: { short: 31 } }).pomodoro.short, 30);
  eq(h({ pomodoro: { long: 7 } }).pomodoro.long, 5); eq(h({ pomodoro: { long: 62 } }).pomodoro.long, 60);
  eq(h({ pomodoro: { longEvery: 1 } }).pomodoro.longEvery, 2); eq(h({ pomodoro: { longEvery: 9 } }).pomodoro.longEvery, 8);
  eq(h({ sit: { on: 'yes' } }).sit.on, false); eq(h({ asked: 1 }).asked, false); eq(h([]).every, 50);
});
test('settings: new layouts, the stored capsule dock, 省電模式', function () {
  var d = QJZ.settings.parse(null).settings;
  eq([d.layout.topmost.U10, d.layout.topmost.U12, d.layout.topmost.U13, d.layout.capsule, d.display.powerSaver], [true, false, false, 'top', false]);
  eq(QJZ.settings.parse('{"layout":{"capsule":"bottomRight"}}').settings.layout.capsule, 'bottomRight');
  eq(QJZ.settings.parse('{"layout":{"capsule":"left"}}').settings.layout.capsule, 'top');
  ok(['U10', 'U12', 'U13'].every(function (l) { return QJZ.settings.LAYOUTS.indexOf(l) >= 0; }));
});
test('settings: a 1.0 settings.json keeps every value; reminders stay off until asked', function () {
  var s = QJZ.settings.parse(V10.settingsText).settings, back = JSON.parse(JSON.stringify(s));
  delete back.health; delete back.layout.capsule; delete back.display.powerSaver; ['U10', 'U12', 'U13'].forEach(function (k) { delete back.layout.topmost[k]; });
  eq(back, JSON.parse(V10.settingsParsed)); eq([s.health.asked, s.health.sit.on, s.health.water.on], [false, false, false]);
});
```

  In `HostSettingsTests.Test_NewLayoutsAndTheirTopmost`:
  - `TopmostByLayout()` has U10 true, and U12 / U13 false;
  - a settings text naming U12 as the last or start layout is accepted;
  - `"U99"` falls back to U1.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement** the sanitiser additions (a `ranged(v, range, def)` helper), the two goal functions and the host list.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS. Update the old assertions that pin the layout list or the topmost map; the diff shows only those lines.
- [ ] **Step 5: Commit** as `feat(settings): health section with derived goals, new layouts, capsule dock, power saver`.

---

### Task 5: Health records and durability (§5.6)

**Files:**
- Create: `src/web/js/core/health.js`, `tests/web/health.test.js`
- Modify: `src/web/js/core/history.js`, `src/web/js/ui/app.js`, `tests/web/history.test.js`, `tests/web/app.test.js`, `tests/web/run.html`, `src/web/index.html`, `src/web/dev.html`

**Interfaces:**
- Produces `QJZ.health` (pure):
  - `of(rec) -> {cups, cupGoal, tomatoes, standups}`: zeros and `cupGoal: null` when the record has no health.
  - `sanitize(raw) -> health|null`. Counts are integers, floored, 0..999. `cupGoal` is an integer 1..20, else null. A non-object gives null.
  - `has(rec)`: any count above 0.
  - `add(h, field, delta)`: never below 0.
  - `withHealth(rec, h)`.
  - `seal(rec, goal)`: sets `cupGoal` when the record has health and its `cupGoal` is null.
- Produces in `QJZ.history.parse`:
  - each record keeps `health` when `sanitize` is non-null, and drops it otherwise;
  - the top level keeps `pomodoro` only when `QJZ.pomodoro.sanitize` is non-null; otherwise the key is absent.
- Produces in `QJZ.app`:
  - `setHealth(day, h)`: the sanitised `h` goes on `history.days[day]`.
    - Today's record goes through `setToday`; another existing record is updated in place.
    - A missing earlier day is created as `QJZ.history.closeDay(QJZ.day.empty(day))`, i.e. earned 0.
    - Then `markHistory()`, `flush()` at once, and `change`.
  - `setPomodoro(p)`: `history.pomodoro = p` (the key is deleted for null), then `markHistory()`, `flush()`, `change`.
  - `retire()` keeps an unstarted record that has health (closed with earned 0) and still drops one without (1.0 behaviour). Every closed record with health is sealed with `settings.health.water.goal`.

- [ ] **Step 1: Write the failing tests:**
  - `health: counts of a record, sanitized`:
    - `of({})` → zeros with `cupGoal` null;
    - `sanitize({cups:-2, cupGoal:'x', tomatoes:2.7, standups:'4'})` → `{cups:0, cupGoal:null, tomatoes:2, standups:0}`;
    - `sanitize('nope')` → null; `sanitize({cups:1e9}).cups` → 999;
    - `has` is true for a record with `cups:1`, and false for all-zero counts or no health.
  - `history: parse keeps health and a valid pomodoro, drops the rest`:
    - a good `health` is kept and a `health:'x'` is dropped;
    - a valid focus `pomodoro` is kept;
    - `'pomodoro' in` the parsed history is false both for no key and for `{phase:'zzz'}`.
  - `app: setHealth on today is saved at once`: the last `saveHistory` is sent synchronously and has `"cups":1`.
  - `app: setHealth on an earlier day without a record creates it closed`: earned 0, cups 1.
  - `app: an unstarted day with health is kept and closed at the rollover; one without is dropped as in 1.0`:
    - Saturday 11-14, not started, has cups 2; 11-13 is unstarted with no health;
    - after the clock moves to 11-15 05:00 and `tickNow()` runs, 11-14 is `{earned:0, health.cups:2, health.cupGoal:8}` and 11-13 is gone.
  - `app: the sealed cup goal does not follow a later change`: `saveSettings({health:{water:{goal:10}}})` leaves 11-14's `cupGoal` at 8.
  - `app: setPomodoro is saved at once and comes back at init`.
  - `app: a 1.0 history keeps its days unchanged`: after init and `flush()`, the closed 1.0 days deep-equal the input.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Commit** as `feat(core): daily health counts in history, saved at once`.

---

### Task 6: `QJZ.care`: the runtime

**Files:**
- Create: `src/web/js/ui/care.js`, `tests/web/care.test.js`
- Modify: `src/web/index.html`, `src/web/dev.html` (add the script, and `QJZ.care.start()` before `QJZ.app.start()`), `tests/web/run.html`

**Interfaces:**
- Consumes:
  - Tasks 1–5;
  - `QJZ.app.state` / `on('change'|'second')` / `nowMs` / `setHealth` / `setPomodoro`;
  - bridge `session`, `visibility`, `fullscreen` and `menu`.
- Produces `QJZ.care`:
  - `start(opts)`, with `opts = {bridge, now (default QJZ.app.nowMs), heartbeat (default true)}`.
    - It steps on the app's `second` event and on a 10 s `setInterval` heartbeat.
    - The heartbeat keeps the pomodoro counting and saved while the page is hidden or locked.
  - `stepNow()` (tests).
  - `state = {ready, visible, fullscreen, panel, away, r, p, q, prompt, breakWater, health:{cups, cupGoal, tomatoes, standups}, goals:{cups, tomatoes, standups}, turn}`.
    - `visible` is false until the host's `visibility` message arrives.
    - `goals` come from `water.goal`, `tomatoGoal()` and `standGoal()`.
  - `on(name, fn)`, events:
    - `change`;
    - `prompt` `{type, prompt, view}`;
    - `cue` (`'focus'|'wave'|'holdCup'|'stretch'|null`);
    - `drank` `{cups, goalReached}`, where `goalReached` is true only on the cup that reaches the goal;
    - `standup` `{count}`.
  - `drink()`: +1 cup today at any time, through `setHealth` with `cupGoal`. When only 喝水 is on (`!health.sit.on`), it also calls `reminders.reset` (§5.1).
  - `setCups(n)`: n ≥ 0.
  - `toggleFocus()`: idle or breakOver → start; focus or break → stop.
  - `answer(buttonId)` applies `QJZ.prompt.answer`, then each effect:
    - `standup`: standups +1 today, `reminders.reset`, event `standup`;
    - `drink`: `drink()`;
    - `snooze`: `reminders.snooze`;
    - `skipBreak`: `pomodoro.skipBreak`, `reminders.breakSkipped`, and −1 standup on the break's day;
    - `nextFocus`: `pomodoro.start`;
    - `stopPomodoro`: `pomodoro.stop`;
    - `ackNotice`: `pomodoro.ack`.
  - `setPanel(open)`: while open, prompts wait.
  - `minutesToStand()`.
  - `view()`: the view of the showing prompt, or null. `turn` increments on each reminder show.
  - `_dev(o)`: dev.html seeds `{cups, tomatoes, standups, pomo, prompt}`.
  - `_reset()`.
- **Each step,** in order:
  1. Day change → `r = initial(today)`.
  2. `pomodoro.advance(p, now, cfg, tomatoes on p.day)`.
     - `focusDone` → tomatoes +1 on `ev.day`.
     - `breakStart`:
       - first set `breakWater = reminders.due(r, ev.atMs, …).due && .water`, the water line of a queued reminder (§5.2);
       - then standups +1 on `ev.day`, and `reminders.breakStarted` when `r.day === ev.day`.
     - Then `setPomodoro`.
  3. `reminders.advance`.
  4. `prompt.step` with:
     - `blocked = !visible || fullscreen || panel`;
     - `focus = p.phase === 'focus'`;
     - `working = snapshot(now).status === 'working'` (computed here, because the heartbeat also runs while the app tick is paused);
     - `due` from `reminders.due`;
     - `notice = p.notice`, `noticeWater = breakWater`.
  5. Emit `prompt` events. Send `raise {on:true}` on show and `raise {on:false}` on hide. Emit `cue`:
     - focus phase → `'focus'`;
     - a both or water prompt → `'holdCup'` (捧著水杯揮手);
     - a sit prompt → `'wave'`;
     - a break notice → `'stretch'`;
     - otherwise null.
- **Session, menu and host messages:**
  - `lock` / `suspend` → `goAway`.
  - `unlock` / `logon`, and `resume` while the session is not locked → `comeBack`. A stand-up counts one standup today.
  - `menu drink` → `drink()`; `menu pomodoro` → `toggleFocus()`.
  - `healthMenu {cups, pomodoro}` is sent after init and on every change.
    - `cups` is `'3/8'` when cups show (§4.9 #8: 喝水 on, or cups > 0), else null.
    - `endsMs` is null in idle and breakOver.

- [ ] **Step 1: Write the failing tests** in `care.test.js`.
  - **Fake bridge:** an array of handlers per type.
  - **`mk(now, settings, history)`:**
    - `_reset` both app and care;
    - `care.start({bridge, now, heartbeat:false})`, then `app.start({bridge, now, tick:false})`;
    - emit `init`, then `visibility {visible:true}`.
  - **`go(t)`:** set the clock, then `app.tickNow(); care.stepNow()`.
  - **Defaults:** settings `{salary 50000, onboarded, health:{asked:true, sit:{on:true}, water:{on:true}}}`; work starts 09:00 on Thursday 11-12.
  - The tests:
  - `care: the reminder shows at 09:50:00, asks both and raises the window`: nothing at 09:49:59; `show:both` at 09:50; `raise {on:true}`; cue `'holdCup'`.
  - `care: 起來了 counts a stand-up; the next reminder is at 10:40`: `answer('up')` at 09:50 → standups 1, `raise {on:false}`; nothing at 10:39:59; show at 10:40.
  - `care: 喝了 counts a cup and a stand-up, saved at once`: cups 1 and standups 1; a `saveHistory` with `"cups":1` is sent before any later step; the next reminder is at 10:40.
  - `care: 等一下 brings it back at 10:00:00`.
  - `care: only one switch on asks only that`:
    - `sit` only → `show:sit` with cue `'wave'`;
    - `water` only → `show:water`;
    - water only, with a tray cup at 09:40 → the reminder is at 10:30 (the cup restarted the timer).
  - `care: at the cup goal the bubble stops asking water`: both on with 8/8 cups → `show:sit`; water only with 8/8 → no reminder all day.
  - `care: a lock of 5:00 is a stand-up, 4:59 is not`: `lock` 09:30 → `unlock` 09:35 gives standups 1 and the reminder at 10:25; `unlock` 09:34:59 gives standups 0 and the reminder at 09:54:59.
  - `care: suspend / resume while unlocked is the same as a lock; a resume while locked waits for the unlock`:
    - `suspend` 09:30, `resume` 09:35 → standups 1;
    - `lock` 09:30, `suspend` 09:31, `resume` 09:40 → 0; `unlock` 09:41 → 1.
  - `care: hidden → no bubble and no raise; shown again → 3 s later`: `visibility false` 09:49; nothing at 09:50; `visibility true` 09:55; show at 09:55:03, not 09:55:02.
  - `care: fullscreen queues the same way`: on at 09:49, off at 09:55 → show at 09:55:03.
  - `care: PANEL blocks prompts`: `setPanel(true)` 09:49; `setPanel(false)` 09:52 → show at 09:52:03.
  - `care: focus from 09:40 holds the reminder; at 10:05 a tomato, a stand-up and the break bubble with the water line`:
    - at 10:05: tomatoes 1, standups 1, prompt `{kind:'break', water:true}`, `r.ms === 0`;
    - cues `'focus'` at 09:40, then `'stretch'` at 10:05.
  - `care: 跳過休息 restores the timer and undoes the stand-up`: from the previous test, `answer('skip')` at 10:06 → `p.endMs` 10:31, standups 0, `r.ms === 66·60000`; nothing shows until the focus ends.
  - `care: a restart after the focus ended counts the tomato; the break bubble shows 3 s after the window is visible`: `history.pomodoro` focus 09:00–09:25, init at 09:27 → tomatoes 1, phase `break`, prompt at 09:27:03.
  - `care: a restart after the break ended asks 休息結束 and never starts by itself`: init 09:40 → `breakEnd` at 09:40:03; at 10:30 still `breakOver`.
  - `care: a tomato started 03:50 counts for the day before`: `history.days['2026-11-11'].health.tomatoes === 1` after a step at 04:15.
  - `care: the 04:00 rollover closes yesterday's bubble and restarts the timer`: 11-11 started by hand at 20:30; prompt at 21:20; at 11-12 04:00:00 `hide:quiet`, `raise {on:false}`, `r.day === '2026-11-12'`.
  - `care: lunch closes the bubble quietly`: start 11:05; prompt 11:55; hide 12:00.
  - `care: a pomodoro after work shows its bubbles, no water line`: focus 18:30 → at 18:55 `{kind:'break', water:false}`; standups +1 and tomatoes +1 on 11-12.
  - `care: a window hidden from 10:30 to 14:00 shows one bubble 3 s after it is back (the lunch end restarted the timer)`:
    - `visibility false` 10:30, `true` 14:00;
    - after the 10:30 hide, exactly one `show:both`, at 14:00:03;
    - `r.ms` at 14:00 is 60·60000.
  - `care: waking after 18:00 shows nothing`.
  - `care: a cup from the tray while the bubble is open`:
    - both on, 7/8 cups, bubble at 09:50; `menu drink` → cups 8; next step `update:sit`;
    - water only, 7/8 → `menu drink` → `hide:quiet`;
    - each press counts once.
  - `care: menu pomodoro starts and stops; healthMenu follows`: `{cups:'0/8', pomodoro:{phase:'focus', endsMs:10:25}}` after a start at 10:00, then `phase 'idle'`, `endsMs null`; with water off and no cups, `cups` is null.
  - `care: reaching the cup goal`: 7 of 8, `drink()` → `drank {cups:8, goalReached:true}`; again → false.
  - `care: a 1.0 user is never reminded before answering`: settings without `health` → nothing at 09:50.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement `care.js`.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Commit** as `feat(web): care runtime (reminder, pomodoro, prompts, persistence)`.

---

### Task 7: Pet behaviour: cues, pose fallbacks, new lines, the release pose check

**Files:**
- Modify: `src/web/js/pets/behavior.js`, `registry.js`, `compose.js`, `lines.js`; `tests/web/behavior.test.js`, `tests/web/pets.test.js`; `build.ps1`

**Interfaces:**
- Produces in `QJZ.pets`:
  - `NEW_POSES = ['wave','holdCup','sip','focus']`;
  - `FALLBACK = {wave:'celebrate', holdCup:'coffee', sip:'coffee', focus:'typing'}`;
  - `poseFor(id, state)`: a new pose is returned as itself only when its state exists in `QJZ.pets.states` AND (the skin def's `poses11` includes it OR `QJZ.pets.previewPoses === true`); otherwise its fallback. Other states are unchanged.
  - `missingPoses()`: `['hamster:p0 wave', …]`.
  - `compose()` resolves `opts.state` through `poseFor`.
- Produces in `QJZ.behavior.Brain`:
  - `cue(name|null, nowMs)`, `knock(nowMs)`; constants `WAVE_MS = 4000`, `STRETCH_MS = 4000`, `SIP_MS = 3000`.
  - `focus`: replaces typing / sprint / idle / lunch / celebrate / waitBag. When it clears with the status `done` or `ended`, the status clock restarts: `celebrate` for 8 s, then `waitBag`, and `change.quiet` is false. That way the jingle and the backpack wait for the focus (§5.2).
  - `wave` / `holdCup`: the pose for `WAVE_MS` after the cue and after each `knock`, then `idle` (wave) or `holdCup` (holdCup holds; `knock` replays its wave).
  - `stretch`: for `STRETCH_MS`, then the base state.
  - While a cue is on there are no idle actions; overlays still win.
  - `sip` goes through `show('sip', now, SIP_MS)`.
- Produces in `QJZ.lines`: `drank`, `waterGoal` and `standOk` (5+ lines each), plus `focusPoke`; a placeholder `{goal}`.
  - `focusPoke` is exactly 「專心中～」.
  - `waterGoal`'s first line is 「{goal} 杯喝滿了！你好棒～」 (`B_after_goal`).
- Produces in `build.ps1 -Release`:
  - it fails with `1.1 pet poses missing: …` unless all 10 `src/web/js/pets/skins/*.js` have a `poses11: [...]` line naming the four poses;
  - `-DraftPoses` skips the check and prints `DRAFT BUILD (fallback poses) - not for release`.

- [ ] **Step 1: Write the failing tests:**
  - `behavior: the focus cue replaces typing and sprint`: `update(t, {status:'working', minutesToEnd:20})` → `'focus'`.
  - `behavior: 可以下班 during a focus waits; celebrate for 8 s after the focus, then waitBag`:
    - status `done` from T while focused; `focus` until T+600000;
    - `cue(null, T+600000)`;
    - T+601000 → `celebrate`, with `change.quiet === false`;
    - T+609000 → `waitBag`.
  - `behavior: wave for 4 s after the cue and each knock, idle between; holdCup holds; stretch for 4 s`:
    - wave: t → `wave`; t+4000 → `idle`; `knock(t+120000)` → `wave`;
    - holdCup: t+60000 → `holdCup`;
    - stretch: t+3999 → `stretch`; t+4000 → base.
  - `behavior: no idle actions while a cue is on`: seeded rng, one update a second for 120 s.
  - `pets: undeclared new poses fall back`: wave → celebrate; holdCup and sip → coffee; focus → typing; `compose('cat:p4','petonly',{state:'wave'})` has `st-celebrate`.
  - `pets: missingPoses lists every skin without poses11`: `length === 40` (Task 17 changes this to 0).
  - `lines: drank / waterGoal / standOk have 5+ lines with no unfilled placeholder; focusPoke is 專心中～; waterGoal with goal 8 mentions 8 杯`.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement**, including the `build.ps1` check (a regex over the 10 skin files, before compiling).
- [ ] **Step 4: Verify.**
  - `test.ps1` passes.
  - `build.ps1 -Release` fails with `1.1 pet poses missing:`.
  - `build.ps1 -Release -DraftPoses` builds and prints the DRAFT line.
  - Run `build.ps1` again afterwards, so `build\` holds a dev exe.
- [ ] **Step 5: Commit** as `feat(pets): 1.1 cues, pose fallbacks, lines, release pose check`.

---

### Task 8: Host: fullscreen state, raise without activation, test profile

**Files:**
- Create: `src/host/Presentation.cs`, `tests/host/PresentationTests.cs`, `tests/host/AppPathsTests.cs`, `tools/test-profile.ps1`
- Modify: `src/host/Native.cs`, `AppHost.cs`, `PauseGate.cs`, `AppPaths.cs`, `SingleInstance.cs`; `tests/host/PauseGateTests.cs`; `src/web/spike.html`; `tools/visual-check/spiketool.cs`; `test.ps1` (`$HostTestSources` += `src\host\Presentation.cs`, `src\host\SingleInstance.cs`)

**Interfaces:**
- **`Presentation : IDisposable`:**
  - `Presentation(Func<int> query)`, `event Action<bool> Changed`, `bool Busy`;
  - `Start()`: a 2000 ms WinForms timer; `Poll()`;
  - `static bool IsBusy(int state)`: true for QUNS 2, 3 and 4;
  - `static int Query()`: `SHQueryUserNotificationState`, or −1.
  - **Ruling:** 7 (QUNS_APP) is not busy, so a windowed Store app does not hold reminders.
- **`ShowRescue`:**
  - `EffectiveTopmost(bool layoutTopmost, bool raised) => layoutTopmost || raised`;
  - `NoActivateLayout` includes `U10`;
  - `MenuShows` is false for `drink` and `pomodoro` (quick actions never un-hide the window) and true for `capsule:*`;
  - `MenuActivatesNow` is false for `capsule:*`.
- **Test profile.**
  - `AppPaths.Profile`; `AppPaths.FolderName(profile)`: `QJZ_PROFILE` matching `^[A-Za-z0-9]{1,16}$` → `錢進中-<profile>` under both data roots; anything else → `錢進中`.
  - `SingleInstance.MutexNameFor` / `EventNameFor(profile)`: `Local\QianJinZhong[-p]`, plus `.Show` for the event.
  - It applies in dev and release builds. With a profile set, AppHost never touches the Run value (same path as `devPage`).
- **AppHost:**
  - sends `fullscreen {on}` after every init and on `Presentation.Changed`;
  - on `raise {on}`, sets `promptRaised`. Every topmost assignment (SetLayout, setTopmost, the rescue) goes through `ApplyTopmost()` = `EffectiveTopmost(the layout's topmost, promptRaised)`;
  - `raise {on:true}` while `ShownToUser()` also calls `RaiseWithoutActivation()`. It never shows a hidden window and never activates one;
  - the tray check mark shows the layout's own topmost.
- **`tools/test-profile.ps1 -Name <p> [-Settings <json>] [-Window <json>] [-History <file>] | -Remove -Name <p>`:**
  - The base settings: salary 50000 monthly, onboarded, `health.asked:true`, `autostart:false`, `privacy:{hideFromCapture:false, hotkey:'Ctrl+Alt+F11'}`. `-Settings` is merged on top.
  - The default `window.json` puts every layout on DISPLAY1: U1 (−599,463), U3 (−1000,700), U5B (−1000,1100), U7 (−470,960), M3 (−372,1082), PANEL (−1000,300), U10 (−900,−400), U12 (−1000,300), U13 (−1000,300).
  - `-Remove` deletes both of the profile's data folders.
- **spiketool** gains `fg` (the foreground hwnd) and `post <hwnd> <msg> <wParam> <lParam>`.
- **`spike.html?raise=<ms>`** sends `raise {on:true}` after `<ms>`, then `{on:false}` 4 s later.

- [ ] **Step 1: Write the failing tests:**
  - `PresentationTests.Test_BusyStates`: false for 1, 5, 6, 7, 0 and −1; true for 2, 3 and 4.
  - `PresentationTests.Test_ChangedOnlyOnChange`: query values 5, 2, 2, 5 → `Changed` gives `"True,False"`.
  - `PauseGateTests.Test_EffectiveTopmost`: the three cases.
  - Extend `Test_MenuActionsThatShowTheWindow`: `drink` / `pomodoro` no; `capsule:top` yes.
  - Extend `Test_MenuActionsThatActivateTheCurrentLayout`: `capsule:bottomRight` no.
  - Extend `Test_StartLayoutNoActivate`: U10 true; U12 and U13 false.
  - `AppPathsTests.Test_ProfileFolder`: null → `錢進中`; `t11` → `錢進中-t11`; `../x`, `""` and 17 characters → `錢進中`.
  - `AppPathsTests.Test_ProfileMutex`.
- [ ] **Step 2: Run `test.ps1`.** Expected: HOST does not compile.
- [ ] **Step 3: Implement.** Add the P/Invoke `[DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state)`. Start `Presentation` in `Run`; stop it in `Shutdown`.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify live on DISPLAY1** (dev build, no input):
  1. `tools/test-profile.ps1 -Name t11`.
  2. Start `QJZ_PROFILE=t11 QJZ_TRACE=1 build/錢進中.exe --page "spike.html?layout=U1&raise=3000"`.
  3. With `spiketool find 錢進中` / `info`, check:
     - the window is on DISPLAY1;
     - exstyle has no TOPMOST bit at 1 s, has it at 4 s, and has none at 8 s;
     - `spiketool fg` gives the same window before and after.
  4. The profile's trace shows `"type":"fullscreen","on":false` after `-> init`.
  5. `spiketool post <hwnd> 0x0010 0 0`.
  6. Check: no process of the tree is left; the Run value is unchanged; the user's own 錢進中 (if running) has the same PID.
  7. `tools/test-profile.ps1 -Remove -Name t11`.
- [ ] **Step 6: Commit** as `feat(host): fullscreen state, raise without focus, QJZ_PROFILE test profile`.

---

### Task 9: Host: U10 dock and snap, grow-inside, menu items

**Starting point:** the 1.0 simplification has already rebuilt the menu (§4.10):
- one status-following 開始上班／下班／繼續上班 item;
- 「版型 ▶」 holding the layouts, 縮成迷你 and 永遠在最上層;
- 餵食 with its count in the top group.

This task adds only the 1.1 items to it.

**Files:**
- Create: `src/host/CapsuleDock.cs`, `tests/host/CapsuleDockTests.cs`
- Modify: `src/host/WindowPlacer.cs`, `PetWindow.cs`, `AppHost.cs`, `TrayMenu.cs`; `tests/host/WindowPlacerTests.cs`, `TrayMenuTests.cs`; `src/web/spike.html`; `test.ps1` (`$HostTestSources` += `src\host\CapsuleDock.cs`)

**Interfaces:**
- **`static class CapsuleDock`:**
  - `Docks`; `Parse(string)` (unknown → `"top"`).
  - `Rect(dock, Rectangle workArea, Size size, int margin)`:
    - top: centred (integer division), `y = Top + margin`;
    - the bottom docks: `y = Bottom − h − margin`, with x `Left + margin`, centred, or `Right − w − margin`;
    - a window bigger than the area is moved in with `ScreenFit.MoveInside`.
  - `Nearest(Rectangle window, Rectangle workArea, int margin)`: the dock whose rect centre is closest to the window's centre.
  - `AreaFor(Rectangle window, Rectangle[] areas)`: `ScreenFit.NearestArea`, so a gone monitor gives the nearest existing one.
  - The margin is 6 CSS px × the window's scale.
  - **Ruling:** with an auto-hide taskbar the work area is the whole monitor, so the capsule sits one margin above the screen edge and leaves the reveal strip free.
- **`WindowPlacer`:**
  - `FitAfterGrow(Rectangle before, Size after, Rectangle[] areas)`: keeps `before.Location`, unless `before` was fully inside its nearest area and the grown rect is not; then the rect is moved inside that area. An overhang the user chose is kept.
  - `AfterShrink(Point now, Point? growFrom, Point? growTo)`: `growFrom` when `now == growTo`, else `now`.
- **`PetWindow.ToPhysical(Size css) -> Size`.**
- **AppHost:**
  - **Layout switch.** SetLayout reads `placer.SavedSize(name)` before `RememberSize`. A switch whose saved CSS size differs applies `FitAfterGrow` to the old physical size and remembers the moved spot (§5.7, U5-B).
  - **Same-layout size change.** It applies `FitAfterGrow` and keeps `growFrom` / `growTo`; a later shrink calls `AfterShrink` (U7 / M3 while a prompt shows).
  - **U10 setLayout.** The window goes to `Rect(Parse(dock), AreaFor(window.Bounds, WorkAreas()), size, margin)` and the spot is remembered. `PrePlace` has put the window on the saved monitor.
  - **U10 `OnMoveEnded`:**
    - area = `AreaFor`;
    - dock = `Nearest`;
    - move to `Rect`;
    - remember the spot;
    - send `capsuleDock {dock}`, then `dragEnd {}`.
  - **`healthMenu`** → `tray.SetHealth(cups, phase, endsMs)`.
- **`TrayMenu` changes** (on top of the simplified 1.0 menu):
  - **The top group** starts with 「記一杯水」 (`drink`; its `ShortcutKeyDisplayString` is the cups text, empty when null) and 「開始番茄鐘」 (`pomodoro`), followed by 1.0's 餵食.
  - **`PomodoroLabel(phase, endsMs, nowMs)`:** focus or break → 「停止番茄鐘（還剩 N 分）」, with N = max(1, ceil((endsMs − now) / 60000)); otherwise 「開始番茄鐘」. The label is computed when the menu opens.
  - **「版型 ▶」** gains 「U10 頂端小膠囊」 `layout:U10`, 「U12 健康儀表板」 `layout:U12` and 「U13 番茄鐘優先」 `layout:U13`, after 1.0's layouts.
  - **「膠囊位置 ▶」** (name `capsule`) goes inside 「版型 ▶」. It holds 「上方正中間」 `capsule:top`, 「左下」 `capsule:bottomLeft`, 「中下」 `capsule:bottomCenter` and 「右下」 `capsule:bottomRight`. It is visible only in U10, and the current dock is checked.
  - **`SetState`** gains an optional `string dock = null`, so the existing calls keep working. `CloseInnermost` and the font scaling cover the new submenus.

- [ ] **Step 1: Write the failing tests:**
  - `CapsuleDockTests.Test_FourDocksOnThePrimary`: area (0,0,1920,1032), size 460×150, margin 6 → top (730,6), bottomLeft (6,876), bottomCenter (730,876), bottomRight (1454,876).
  - `Test_SideAndAutoHideTaskbars`: (0,0,1858,1080) bottomRight → (1392,924); (0,0,1920,1080) bottomCenter → (730,924).
  - `Test_PortraitMonitorAtNegativeCoordinates`: area (−1080,−445,1080,1848), size 690×225, margin 9 → top (−885,−436), bottomRight (−699,1169).
  - `Test_NearestDock` (primary, 460×150): (1400,850) → bottomRight; (700,400) → top; (100,300) → bottomLeft.
  - `Test_ParseUnknownIsTop`.
  - `Test_AreaForAGoneMonitor`: (9000,300,460,150) with {Primary, the portrait area} → Primary; a window centred on the portrait area → that area.
  - `WindowPlacerTests`:
    - `Test_FitAfterGrow_PushesBackInside`: (1440,900,480,120) → 545 wide → (1375,900);
    - `_FitsAsIs`: x 100 stays;
    - `_KeepsAnOverhangTheUserChose`: (1700,100,400,300) → 465 wide → (1700,100);
    - `_Bottom`: (100,900,300,120) → height 200 → y 832;
    - `Test_AfterShrink`: three cases.
  - `TrayMenuTests`:
    - **`Test_HealthItemsLeadTheMenu`:** the first two top-level labels are 「記一杯水」 and 「開始番茄鐘」, and the rest equals the 1.0 order recorded before this task.
    - **`Test_LayoutSubmenu`:** 「版型 ▶」 ends with the three new layouts. 膠囊位置 is visible after `SetState("U10", true, true, "bottomRight")`, where `capsule:bottomRight` is checked, and hidden for `"U1"`.
    - **`Test_EachItemSendsItsActionId`:** add the ten new ids.
    - **`Test_PomodoroLabel`:**
      - `("idle",0,now)` → 「開始番茄鐘」;
      - `("focus", now+12·60000, now)` → 「停止番茄鐘（還剩 12 分）」;
      - `now+11·60000+1` → 12;
      - `("break", now+3·60000, now)` → 3;
      - `now−5000` → 1;
      - `"breakOver"` and null → 「開始番茄鐘」.
    - **`Test_CupsCount`:** `SetHealth("3/8", …)` → shortcut text 「3/8」; null → empty.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.** `spike.html?layout=U10&dock=<d>` reports `dock`.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify live on DISPLAY1** (profile `t11`, no input).
  - `spike.html?layout=U10&dock=top`: the rect = `Rect("top", DISPLAY1 work area, size, 9)`.
  - The same with `dock=bottomRight`.
  - Close and remove the profile. The real-drag snap is a user-only check (Task 18).
- [ ] **Step 6: Commit** as `feat(host): U10 dock and snap, grow-inside, 1.1 menu items`.

---

### Task 10: UI: icons, templates split, the A picks with the visibility rule, the countdown ring

**Starting point:** the 1.0 simplification has already changed these layouts (§4.10). Build on its markup; do not redo it.
- U1 has no date row, no 已上班 card, and only 「每秒 +NT$ x.xxx」 under the amount.
- U3 has one alternating card.

**Files:**
- Create: `src/web/js/ui/icons.js`, `templates.js`, `ring.js`, `src/web/css/health.css`, `tools/shot.ps1`
- Modify: `src/web/js/ui/layouts.js`, `src/web/css/layouts.css`, `src/web/index.html`, `src/web/dev.html`, `tests/web/run.html`, `tests/web/layouts.test.js`

**Interfaces:**
- **`QJZ.icons.svg(name)`** for drop, tom, stand, rest, hp and cup: inline SVG with class `ic`, paths from the mockup sprite.
- **`QJZ.templates`:** the `TEMPLATES` object moved verbatim from `layouts.js`, with `parts` (BAR, MONEY, PILL).
- **`QJZ.ring`:** `markup(cls)` (track, `[data-ring-arc]`, `[data-ring-label]`) and `update(el, {phase:'focus'|'break'|null, fraction, label})`.
  - Hidden when there is no phase; class `rest` (green) for a break.
  - It writes only what changed. The arc has no transition.
- **`layouts.util.model(st, ms, cs)`** with `cs = QJZ.care.state`, adds:
  - `cups` `'3/8'`, `cupsLong` `'3/8 杯'`, `tomatoes` `'×3'`;
  - `showCups = health.water.on || cups > 0` and `showTomatoes = tomatoes > 0 || p.phase === 'focus'` (§4.9 #8);
  - `pomoBtn`: 「▶ 番茄鐘」 when idle or breakOver, otherwise 「■ 停止」;
  - the status pill reads 「專心中」 / 「休息中」 during a pomodoro (`C2_U1_f` / `C2_U1_b`);
  - `ring {phase, fraction, label:'還剩 N 分'}`, `mmss`, `nth` 「第 N 顆」, `standIn` 「N 分後」 (empty when nothing is asked).
- **`data-act`:** `drink` → `QJZ.care.drink()`, `pomo` → `QJZ.care.toggleFocus()`.
- **`tools/shot.ps1 -Page <dev.html?…> -Out <png> [-Size W,H]`:** headless Edge with `build\shots\.edge-profile`; it stops only that profile's msedge; there is never a visible window.
- **dev.html** gains `?cups=&tom=&stand=&pomo=focus|break|breakOver&water=on`.
- **Markup** (an element hidden by the visibility rule keeps no space):
  - U1 (`A_U1_3`): under the 「每秒 +NT$」 line, three pills:
    - 「💧 3/8 杯」 (`drink`, shown with `showCups`);
    - 「🍅 ×3」 (shown with `showTomatoes`);
    - 「▶ 番茄鐘」 / 「■ 停止」 (`pomo`, always).
  - U3 (`A_U3_2`, with the user's change): right of the money box, the tomato button (`pomo`, always), whose caption 「×3」 shows with `showTomatoes`; beside it the same-style water button (`drink`) with 「3/8」, shown with `showCups`. No bottle.
  - U5-B (`A_U5_2`): a right column with the big tomato button (`pomo`, always; 「×3」 with `showTomatoes`) and 「💧 3/8」 (`drink`, with `showCups`). About 65 px wider.
  - U7 (`A_U7`): a display-only tag line 「💧 3/8・🍅 ×3」. Each part follows its rule, and the line is gone when both parts are hidden.
  - M3 (`A_M3`): display-only stickers 「💧3/8」 (top-left) and 「🍅×3」 (top-right), each following its rule. No `data-act` (§5.3).
  - The ring (`C2_U1_f/b`, `C2_U7_f/b`): around the pet in U1, U3, U5-B and U7, with the 「還剩 N 分」 pill. Use `[data-pring]`.
  - M3 (`C_M3_f/b`): during a pomodoro, `.ring` gets `p-foc` / `p-brk` and its `--p` from the pomodoro. The sub line reads 「專心中 · 還剩 N 分」 / 「休息中 · 還剩 N 分」.

- [ ] **Step 1: Move `TEMPLATES` into `templates.js` unchanged.** Run `test.ps1`. Expected: PASS with the same counts.
- [ ] **Step 2: Write the failing tests** in `layouts.test.js`. DOM tests also start `QJZ.care` on the same fake bridge (`heartbeat:false`).
  - `layouts: model health fields`:
    - water on, cups 3/8, tomatoes 3, focus 09:40, now 09:52:30 → `cups '3/8'`, `tomatoes '×3'`, `pomoBtn '■ 停止'`, `ring.label '還剩 13 分'`, `status '專心中'`, `nth '第 4 顆'`;
    - idle → `pomoBtn '▶ 番茄鐘'` and `ring.phase` null.
  - `layouts: unused counts are hidden (§4.9 #8)`:
    - water off, 0 cups, 0 tomatoes, idle → U1 shows only 「▶ 番茄鐘」 in the row; U7 has no tag line; M3 has no sticker;
    - a cup logged → cups show;
    - a focus started → tomatoes show.
  - `layouts: U1 pills drink and start`: drink → cups 1; `pomo` → phase focus, and the pill reads 「■ 停止」.
  - `layouts: U3 tomato and water buttons share one row, no bottle`.
  - `layouts: U5-B is about 65 px wider`: its setLayout width is in 542–562; 1.0 sends 487.
  - `layouts: U7 tag line and M3 stickers have no data-act`.
  - `layouts: the ring follows the pomodoro once a second, red then green, without transitions`: computed `transition-duration` is `0s`; a break gives `rest`; idle hides it.
  - `layouts: M3 outer ring counts down during a pomodoro`.
- [ ] **Step 3: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 4: Implement.** Port `.mpills/.mp`, `.tom-btn`, `.tomslot`, `.rcol`, `.hline`, `.mb`, `.pr-ov`, `.ptime` and `.donut` from the mockup CSS, renaming any that collide.
- [ ] **Step 5: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 6: Verify.**
  - **Shots** (`tools/shot.ps1`): U1, U3, U5B, U7 and M3 with `cups=3&tom=3&water=on`, with `pomo=focus` / `break`, and in the unused state. Compare with `A_U1_3`, `A_U3_2` (no bottle), `A_U5_2`, `A_U7`, `A_M3`, `C2_*` and `C_M3_*`. The unused state matches the simplified 1.0 look.
  - **Live U5-B growth** (profile `t11`, DISPLAY1):
    1. U5B is saved flush against the work area's right edge, with its 1.0 `w` / `h`.
    2. Start the app: the window keeps its top and is pushed left until its right edge meets the work-area edge.
    3. Close and remove the profile.
- [ ] **Step 7: Commit** as `feat(web): cups, tomatoes and the countdown ring in U1 U3 U5-B U7 M3`.

---

### Task 11: UI: the prompt in each 1.0 layout

**Files:**
- Create: `src/web/js/ui/promptview.js`, `tests/web/promptview.test.js`
- Modify: `src/web/js/ui/layouts.js`, `templates.js`, `src/web/css/health.css`, `src/web/dev.html`, `src/web/index.html`, `tests/web/run.html`

**Interfaces:**
- **`QJZ.promptView`:**
  - `render(layoutEl, layoutName, view)`: buttons carry `data-answer="<id>"` and `data-hit`; it never calls `focus()`.
  - `clear(layoutEl)`.
  - `wave(layoutEl, layoutName)`: one M3 knock, or one U5-B wobble; never a loop.
  - Slots: `[data-prompt]`, and `[data-prompt-line]` in U5-B's `.mtop`.
- **layouts.js:**
  - `care.setPanel(cur === 'PANEL')` on every `show`.
  - `cue` → `brain.cue`; `wave` → `brain.knock` + `promptView.wave`.
  - While a prompt shows: no chatter; the speech bubble is hidden; a user-rank `say()` becomes `fx.banner`.
  - `drank` → `brain.show('sip', now, SIP_MS)`, 「+1」 `fx.plus` on the cups element, and a `drank` line. With `goalReached`: `petted` + hearts + a `waterGoal` line instead.
  - `standup` from 「起來了」 → `petted` 2 s + a `standOk` line.
  - A poke during a focus answers 「專心中～」 once per focus: no petted reaction, sound or hearts.
  - **Ruling:** 「只回一次」 means once per focus.
- **Looks** (§5.1 table):
  - U1 (`B_U1_s` / `B_U1_w`): a big bubble at the top right that covers the status row.
  - U3 (`C_U3_b`): a big bubble over the scene.
  - U7 (`B_U7_s` / `B_U7_w`): beside the pet. **Ruling:** on the right, where 1.0's speech bubble is. `.prompting` makes the window grow right while the bubble shows (Task 9's grow-inside).
  - U5-B (`C_U5_b`): the `.mtop` text becomes the title, wobbling on show and on each re-wave, with the small buttons on the same line. Same window size.
  - M3 (`B_M3_s` / `B_M3_w`): the ring knocks on show and re-wave; a small `.rbub.sm` with the buttons. **Ruling:** on the right; the window grows right.
  - Every bubble shows `title`, `sub`, `waterLine`, and `buttons` in order. Port the style from `.rbub` / `.rb-btns`.

- [ ] **Step 1: Write the failing tests** (app + care + layouts on one fake bridge and clock):
  - `promptView: U1 shows the combined bubble and answers care`: at 09:50, `[data-prompt]` has 「起來動一動，順便喝口水～」, 「已經坐 50 分鐘囉・今天 0/8 杯」 and the buttons 「喝了」「起來了」「等一下」; 起來了 → standups 1, and the slot is empty.
  - `promptView: the pet holds the cup while the bubble shows (fallback coffee); sit-only waves (fallback celebrate)`.
  - `promptView: U5-B uses the status line and keeps its size`.
  - `promptView: U7 and M3 grow right while prompting and return after`: the buttons are inside the sent hit rects.
  - `promptView: no chatter and no second bubble while it shows; a user-rank say becomes a banner`.
  - `promptView: the bubble never takes the keyboard`: `document.activeElement` is unchanged.
  - `promptView: a poke during focus says 專心中～ once`.
  - `promptView: after 喝了 the cups pill shows +1 and the pet sips`.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.** dev.html gains `?prompt=both|sit|water|break|breakEnd`.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify with shots** of the five layouts × both / sit / water / break, compared with `B_U1_s`, `B_U1_w`, `B_U7_s`, `B_U7_w`, `B_M3_s`, `B_M3_w`, `C_U3_b` and `C_U5_b` (with the new button labels).
- [ ] **Step 6: Commit** as `feat(web): reminder and pomodoro bubbles in the 1.0 layouts`.

---

### Task 12: New layouts U10 頂端小膠囊, U12 健康儀表板, U13 番茄鐘優先

**Files:**
- Modify: `src/web/js/ui/templates.js`, `layouts.js`, `promptview.js`, `src/web/css/health.css`, `src/web/dev.html`, `tests/web/layouts.test.js`, `tests/web/promptview.test.js`

**Interfaces:**
- **Wiring:**
  - U10, U12 and U13 join the main-layout list that the simplified 1.0 keeps; the last-used start covers them with no extra code.
  - U10's setLayout sends `dock: settings.layout.capsule`.
  - `capsuleDock {dock}` and `menu capsule:<dock>` → `saveSettings({layout:{capsule}})` and a re-render.
  - The U7 hover logic is generalised from `.dpet` to `[data-hover]`.
  - New templates must not use the class names `.dpet` or `.side`.
- **U10** (`G_U10_pos/work/hover/rem/foc`):
  - **The window.** One fixed size (the footprint of the widest state). The capsule sits at the top edge for `top` and at the bottom edge for the bottom docks, aligned left, centre or right to match. It expands away from that edge.
  - **States:**
    - collapsed 230×36: avatar, status dot, 「NT$ 1,287」, then 💧 3 and 🍅 3 chips (§4.9 #8);
    - hover (about 440×100): the full information, with chips 💧 「3/8 杯」 (`drink`, rule), 🍅 「×3」 (rule) with an always-present 「▶」 (`pomo`), and 🧍 「N 分後」;
    - remind: the incoming-call width, with title, sub and buttons;
    - focus: donut, mm:ss, 「第 N 顆」, amount.
  - Only the capsule is a hit rect. NoActivate; topmost by default.
  - **Ruling:** the collapsed capsule shows whole dollars (`G_U10_work`); the expanded view shows 2 decimals.
- **U12** (`G_U12_work/rem/foc`), 360×330:
  - BAR 「錢進中 · 健康」; the pill, and 「還有 hh:mm 下班」; the money box.
  - Three rings, always shown (§4.9 #8):
    - 喝水（杯）: cups / `goals.cups`; a click is `drink`;
    - 番茄（顆）: tomatoes / `goals.tomatoes`; during a focus 「專心」 mm:ss 「第 N 顆」;
    - 起來動（次）: standups / `goals.standups`.
  - Below: the pet and 「再 N 分鐘起來動～」 (focus: 「專心中～提醒等休息再說」).
  - When a bubble shows, the matching ring glows (`hot`): stand for sit, water for water, stand and water for both, tomato for pomodoro bubbles. The bubble is `.rbub.sm.inl`.
  - It starts from the menu only.
  - **Ruling:** the mockup's 「番茄（這輪 3/4）」 label becomes 「番茄（顆）」 with the daily goal.
- **U13** (`G_U13_work/rem/foc`), 300×440:
  - BAR 「錢進中 · 番茄鐘」; pill; amount; 「還有 hh:mm 下班」 with a thin bar.
  - **The big ring:**
    - idle: the whole ring is `pomo`, showing 「下一顆 {focus} 分鐘」 `{focus}:00` 「▶ 開始專心」;
    - focus: 「專心中」 mm:ss 「第 N 顆」, plus 「■ 停止」;
    - break: green;
    - remind: the reminder sits inside the ring.
  - Tomato slots, always shown, one per `goals.tomatoes`: 「今天 ×N・每 {longEvery} 顆長休息」.
  - A line: 「💧 3/8 杯」 (rule) ・ 「🧍 N 分後起來動」 (while something is asked); during a focus 「提醒等休息再說」.
  - **Ruling:** the reminder goes inside the ring (`G_U13_rem`): the user-confirmed §4.5 wins over the §5.1 table's 「大泡泡」. 「⏭ 跳過這顆」 and the task label are left out (non-goal).

- [ ] **Step 1: Write the failing tests:**
  - `layouts: the main layouts include U10 U12 U13`.
  - `U10: one window size for collapsed / hover / remind / focus`.
  - `U10: dock classes and setLayout dock`:
    - `capsule:'bottomRight'` → the class and `dock`;
    - `capsuleDock {dock:'top'}` → saved;
    - `menu capsule:bottomLeft` → saved.
  - `U10: hover expands, leaving collapses, the hit rect follows; the chips follow the visibility rule`.
  - `U10: remind shows the buttons; focus shows mm:ss and 第 N 顆`.
  - `U12: rings from the three goals, always shown; the water ring drinks; the matching ring glows; the bottom line`:
    - cups 3/8 → `--p` 37.5;
    - standups 5 of `standGoal` 9 → 55.6 (to 1 decimal);
    - tomatoes 3/4 → 75;
    - 「再 8 分鐘起來動～」 at 09:42;
    - with water off and no cups the rings are still there.
  - `U13: the idle ring starts a focus; 第 1 顆 and 停止 during it; the reminder sits in the ring; four tomato slots`.
  - `new layouts: no infinite animation outside the pet while nothing happens`: `document.getAnimations()` for U10, U12 and U13, working, no prompt.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `.isl`, `.dash`, `.gauge3`, `.pomo1` and `.bigring`. dev.html gains `?dock=` and `?hover=1`.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify.**
  - Shots of each G state, compared with the mockups.
  - Live on DISPLAY1 (profile `t11`):
    - last layout U10 with `capsule:'top'` → top centre of DISPLAY1;
    - U12 and U13 each show visible, without TOPMOST or NOACTIVATE.
  - Close and remove the profile.
- [ ] **Step 6: Commit** as `feat(web): layouts U10 U12 U13`.

---

### Task 13: Panels: 設定 → 健康, onboarding step 3, the upgrade question, 省電模式

**Starting point:** the 1.0 simplification has already done this (§4.10). Do not plan or redo any of it.
- Settings has 4 tabs (薪水和時間, 寵物, 畫面, 其他), with 今天休假 and 調整起算時間 at the top of the first.
- 使用說明 and the licences open on click.
- The start-layout and topmost controls are removed from settings.

**Files:**
- Create: `src/web/js/ui/panels-health.js`
- Modify: `src/web/js/ui/panels.js`, `src/web/css/panels.css`, `src/web/index.html`, `src/web/dev.html`, `tests/web/run.html`, `tests/web/panels.test.js`

**Interfaces:**
- **`QJZ.panels.kit`:** the existing private helpers (`line`, `row`, `tgl`, `seg`, `hint`, `esc`, `out`, `q`, `qa`, `tglOn`, `segOn`, `save`, `avatar`, `petId`, and the stepper markup), now exposed.
- **`QJZ.panelsHealth`:**
  - `section()` / `update(c)` for the 健康 tab;
  - `onboardingStep()` / `readStep(c) -> {sit, water}`;
  - `askBuild(c)` / `askUpdate(c)` for the `healthAsk` panel kind;
  - `calendarCard()` / `calendarUpdate(c)` (Task 14).
- **Tabs:** `TABS` gets `['health','健康']` after 寵物, giving 薪水和時間, 寵物, 健康, 畫面, 其他.
- **`initialPanel`:**
  - the order is onboarding → question → `healthAsk`;
  - `healthAsk` is asked when `onboarded && !health.asked`, once per session, also after the question panel closes;
  - closing without answering saves nothing, so it is asked again at the next start (§5.5);
  - its button is 「確定」 (**Ruling**).
- **`onboardingPatch(f)`** takes `f.sit` / `f.water` and adds `health:{asked:true, sit:{on}, water:{on}}`.
- **The 健康 tab** (`D_settings` with §4.9 #7, §5.4). Steppers use `.stepper` and stop at the `HEALTH_RANGES` ends.
  - **Card 「休息提醒」:**
    - 「起來動」 toggle, with 「坐好久了，寵物會捧著水杯跳起來揮手。」;
    - 「喝水」 toggle;
    - 「每隔」 N 分鐘, with 「按「等一下」會晚一點再提醒；番茄鐘的休息也算一次起身。」;
    - 「一天幾杯」 N 杯, with 「喝滿目標寵物會很開心。」;
    - a hint 「起來動目標：每天 {standGoal} 次（工時 ÷ 間隔，自動算）」.
  - **Card 「番茄鐘」:**
    - 「從右鍵或 🍅 按鈕開始」;
    - 「專心」 N 分鐘, with 「專心時寵物戴上耳機、不聊天，提醒會等到休息時再說。」.
  - **「進階」** (closed by default; opens on click):
    - 「短休息」 N 分鐘, 「長休息」 N 分鐘, 「每幾顆番茄長休息一次」 N 顆, with 「每天目標就是一輪：{longEvery} 顆。」;
    - 「今天已喝」 − N ＋ 杯 (`care.setCups`, never below 0).
- **Onboarding step 3 and `healthAsk`** (`D_onboard`; the copy is updated for §4.9 #6):
  - 「要不要提醒你起來動、喝水？」 / 「上班一坐就是一整天，我可以幫你記著。」.
  - Two ticked checkboxes:
    - 「每 {every} 分鐘提醒我起來動一動」 + 「我會捧著水杯跳起來揮手，按「起來了」或「等一下」。」;
    - 「順便提醒我喝水」 + 「一天目標 {goal} 杯，喝了就按「喝了」記一杯。」.
  - The note 「🍅 想專心的時候，可以從右鍵選單開始番茄鐘（{focus} 分鐘專心、{short} 分鐘休息）。這些都能在 設定 → 健康 裡改。」.
  - The preview 「時間到會像這樣：」.
  - Step 2's 「開始！」 becomes 「下一步 →」; step 3 has 「← 上一步」, three dots and 「開始！」 (onboarding stays 3 steps, §4.6).
- **The 畫面 tab** gains only the 「省電模式」 toggle (`display.powerSaver`), with 「金額每秒跳 4 次、少一點動畫，比較省電；筆電建議打開。」, beside 1.0's 相容模式. There is no capsule position here (§4.9 #12).

- [ ] **Step 1: Write the failing tests:**
  - `panels: the first panel: onboarding, else the question, else the health question once`: `READY` (salary + onboarded) → `'healthAsk'`; with `health.asked` → null. Existing tests that expect no panel add `health:{asked:true}`.
  - `panels: onboarding has the reminder step; unticking water saves water off`.
  - `panels: the upgrade question saves only when answered`.
  - `panels: 健康 has two cards and a closed 進階`:
    - five controls are visible;
    - ＋ on every at 120 stays 120; − at 20 stays 20;
    - opening 進階 shows the other four;
    - 今天已喝 − at 0 stays 0, ＋ → cups 1;
    - the 起來動目標 hint reads 9 at 8 h / 50 min.
  - `panels: five tabs in order; 畫面 has 相容模式 and 省電模式 only`.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.** dev.html gains `?panel=healthAsk` and `?obstep=3`.
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify with shots** of the 健康 tab (closed and open 進階), `?firstrun=1&obstep=3` and `?panel=healthAsk`, against `D_settings` and `D_onboard` (as simplified).
- [ ] **Step 6: Commit** as `feat(web): 健康 settings, onboarding step 3, upgrade question, 省電模式 toggle`.

---

### Task 14: The health calendar in 紀錄 (§4.7, §5.6)

**Files:**
- Modify: `src/web/js/core/health.js`, `src/web/js/ui/panels-health.js`, `src/web/js/ui/panels.js` (history), `src/web/css/panels.css`, `tests/web/health.test.js`, `tests/web/panels.test.js`

**Interfaces:**
- **`QJZ.health.calendar(history, month, today, settings) -> {title, weeks, totals:{cups, tomatoes}, goal}`:**
  - `weeks`: arrays of 7 cells, Sunday first (`E_3`). A cell is `null` outside the month, or `{day, d, blank, level, full, tomatoes, today}`.
  - **Level:** `cups >= goal` → `full`, level 4. Else 0 when cups is 0, otherwise `1 + floor(3·cups / goal)` capped at 3. The goal is the day's `cupGoal`, or for today the current `water.goal`.
  - **Blank:** no record, or no health, and not today. Today always shows its live counts.
  - **Ruling:** the calendar shows the chart's month. 1.0's 紀錄 has no month switcher, so that is the current month; the `month` parameter is there for a future switcher.
- **The card** goes under the income chart, which is unchanged:
  - 「💧 健康月曆」 with 「🍅 = 當天番茄」;
  - level alphas .2 / .47 / .74, full `#4DA3FF` with 「✓」, the tomato count bottom-right;
  - 「少 ▢▢▢▢ 多（✓ = 喝滿 {goal} 杯）」 and 「本月 {cups} 杯 ・ {tomatoes} 顆」.

- [ ] **Step 1: Write the failing tests:**
  - `health: November 2026 starts on Sunday with five weeks`: `weeks[0][0].d === 1`, `weeks[4][1].d === 30`, `weeks[4][2] === null`.
  - `health: calendar levels use the day's own goal`:
    - goal 8: 0 → level 0 (not blank); 1 → 1; 3 → 2; 6 → 3; 7 → 3; 8 → full; 9 → full;
    - `cupGoal 6` with 6 cups is full while the setting is 10.
  - `health: blank days, today live, totals`.
  - `panels: the history panel shows the calendar under the chart`: the legend contains 「✓ = 喝滿 8 杯」.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify with a shot** of `dev.html?seed=history` (with health days added to the seed) against `E_3`.
- [ ] **Step 6: Commit** as `feat(web): health calendar in 紀錄`.

---

### Task 15: 省電模式 and CPU (§5.9)

**Files:**
- Create: `tools/cpu-measure.ps1`
- Modify: `src/web/js/ui/app.js`, `src/web/js/pets/behavior.js`, `compose.js`, `common.js`, `src/web/js/ui/layouts.js`, `src/web/css/base.css`, `layouts.css`, `pets.css`, `tests/web/app.test.js`, `behavior.test.js`, `pets.test.js`, `layouts.test.js`

**Interfaces:**
- `QJZ.app.tickMs() -> 100 | 250`: 250 with `display.powerSaver`. A settings change restarts the interval.
- `html.saver` while `powerSaver` is on.
- `Brain.setSaver(on)`: idle actions every 60–180 s instead of 20–60 s.
- `compose(…, {saver:true})`: crayon skins carry no `-crayon` filter reference, and get a static pattern grain instead.
- Under `html.saver`, CSS stops every decorative infinite animation outside `.pet-svg`.
- **`tools/cpu-measure.ps1 -Exe <path> -Pet <kind:skin> -Layout U7 [-PowerSaver] [-WebRoot <dir>] [-Seconds 60] [-Warmup 20]`.** The 1.0 method (ledger, `final-fix-host-report.md`, R-F5):
  1. Seed the `cpu` test profile, with U7 on DISPLAY1.
  2. Start the exe with `QJZ_PROFILE=cpu`, plus `QJZ_WEB_ROOT` for a dev build when `-WebRoot` is given.
  3. Warm up, then sum the `TotalProcessorTime` deltas of the PID tree over 60 s.
  4. Print `RESULT <pet> U7: <x> % of one core, <y> % of the machine`.
  5. Close with `post WM_CLOSE`, check the tree is gone, and remove the profile.
  6. No input.

- [ ] **Step 1: Write the failing tests:**
  - `app: the tick runs every 100 ms, every 250 ms with 省電模式`.
  - `behavior: saver idle actions come every 60–180 s`.
  - `pets: the saver crayon texture has no animated filter`.
  - `layouts: html.saver while 省電模式; no infinite animation outside the pet in U1 and U7 then`.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement the four §5.9 items.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Measure.**
  1. `build.ps1 -Release -DraftPoses`.
  2. Measure U7 for hamster:p0 and cat:s5, with 省電模式 off and on.
  3. The target: on, both at most 12 % of one core.
  4. If either misses, under `html.saver` try in order, measuring after each: (a) the pet's perpetual loops at half speed; (b) pause them between idle actions. Stop as soon as the target is met.
  5. Missing the target does not block the release (§5.9): report the numbers.
- [ ] **Step 6: Compare with 1.0** on the same host:
  1. `git archive <1.0 base> src/web | tar -x -C <scratch>/web10`, then copy `src/web/fonts` and `src/web/licenses` in.
  2. Run the dev build with `-WebRoot` set to the 1.0 copy, then to the 1.1 `src/web`; both pets, 省電模式 off.
  3. 1.1 must not be clearly above 1.0 (beyond ±2 points). If it is, find and remove the new continuous animation.
  4. Put the results table in the commit body.
- [ ] **Step 7: Run `build.ps1`** (dev). Commit as `feat(web): 省電模式; CPU measured (see body)`.

---

### Task 16: The two 1.0 residual fixes (§5.10)

**Files:**
- Modify: `src/host/Payload.cs`, `Program.cs`, `ExitStamp.cs`, `AppHost.cs`; `tests/host/PayloadTests.cs`, `ExitStampTests.cs`

**Interfaces:**
- **Unreadable DLL beside the exe.**
  - `Payload.ForeignCopies`: a WebView2 DLL beside the exe that exists but cannot be read (IOException / UnauthorizedAccessException) is listed as foreign.
  - `Program.ForeignWebView2Beside()`: in a release build, an exception from the whole check also refuses to start. It logs, shows `ForeignWebView2`, and returns true.
- **The session.json gap.**
  - `ExitStamp.ShouldClear(bool stampRead, bool initSent, bool historySaved)`: true only when all three are true.
  - AppHost no longer clears session.json in `Run()`. It clears it on the first `saveHistory` after init whose write completed (`!files.History.Pending`). Applying the exit twice is harmless (`QJZ.day.onExit` is idempotent).

- [ ] **Step 1: Write the failing tests:**
  - `PayloadTests.Test_ForeignCopies_UnreadableBesideIsForeign`: hold the beside `Microsoft.Web.WebView2.Core.dll` open with `FileShare.None` → it is listed; release the handle in a `finally`.
  - `ExitStampTests.Test_ShouldClear`: only `(true,true,true)` is true.
- [ ] **Step 2: Run `test.ps1`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `test.ps1`.** Expected: PASS.
- [ ] **Step 5: Verify live** with the dev build, `QJZ_PROFILE=t16`, and a seeded `session.json`:
  - 0.5 s after the window shows, the stamp is still there;
  - within 3 s it is `{"lastExitMs":null}`, after `history.json` was written.
- [ ] **Step 6: Commit** as `fix(host): unreadable WebView2 DLL beside the exe refuses to start; keep session.json until history is saved`.

---

### Task 17: New pet poses for all 10 skins, and the review page (ART GATE, §5.8)

**Files:**
- Create: `src/web/poses-review.html`, `tools/inline-page.ps1`
- Modify: `src/web/js/pets/states.js`, `props.js`, `rig.js`, `compose.js` (`speechAt`), `skins/*.js` (10 files), `src/web/css/pets.css`, `src/web/js/ui/layouts.js` (`PET_HIT_BY_STATE` only), `tests/web/pets.test.js`

**Interfaces:**
- **States:**
  - `wave` (跳起來揮手（敲窗）): the sit-only reminder; a jump, a waving arm and knock marks.
  - `holdCup` (捧著水杯揮手): reminders that ask water; holds the glass with knock marks, and `knock` replays its wave.
  - `sip` (喝一口): the glass at the mouth, eyes closed.
  - `focus` (戴耳機專心打字): typing with headphones.
  - Start from the mockup's `EXTRA.water` / `headphones` / `knock`. Hamsters stay armless. Everything is A1 sticker style, matching each skin's 1.0 poses.
- **`poses11: ['wave','holdCup','sip','focus']`** on each skin def, added only after the user's OK.
- **`poses-review.html`:** 10 skins × 4 poses; animated `petonly` on the U7 desktop background, with the `avatar` view under it; a pause button; `QJZ.pets.previewPoses = true`.
- **`tools/inline-page.ps1 -Page <page> -Out <file>`:** one self-contained HTML file; local scripts and stylesheets inlined; CSS `url()` fonts as base64 `data:` URIs.

- [ ] **Step 0: Draft gate on two skins first.**
  - Add the four poses for **hamster P0** (the default skin) and **cat P0** only.
  - Build a small review page of 2 skins × 4 poses with the inliner. Stop and report.
  - The controller publishes the page and gets the user's OK on the look before any other skin is drawn.
  - Ruling (cost): in 1.0, art drawn for every skin at once was the most expensive rework (25% of subagent output). Agreeing the look on 2 skins first keeps a rejected direction cheap.
- [ ] **Step 1: Roll out to the remaining 8 skins.** Add the states, props, CSS motion and `speechAt` for all 10 skins, following the approved look. `sip` is short and is not a loop.
- [ ] **Step 2: Add the tests.**
  - `pets: every skin composes the new poses`: with `previewPoses`, every skin × pose × view parses as SVG, has `.st-<pose>`, and has no slot comment left.
  - Add `PET_HIT_BY_STATE.wave` if the jump leaves `PET_HIT`.
- [ ] **Step 3: Run the tests:** `test.ps1` (main tree), or `test.ps1 -EdgeProfile build\.edge-art -WebOnly` (parallel worktree). Expected: PASS.
- [ ] **Step 4: Self-check.** Build `build\review\poses-review.html` with the inliner; shoot it row by row; fix clipped parts, floating paws, and wrong colours or eyes.
- [ ] **Step 5: Commit** as `feat(pets): 1.1 poses (wave, holdCup, sip, focus) for review`.
- [ ] **Step 6: GATE.**
  - Stop and report.
  - The controller publishes `build\review\poses-review.html` and asks the user to review it.
  - Apply the requested changes and republish until the user says OK. Nothing below runs before that OK.
- [ ] **Step 7: Declare the poses.**
  1. Add `poses11` to all 10 skins, and change the `missingPoses` test to expect `[]`.
  2. `test.ps1` passes.
  3. `build.ps1 -Release` (no `-DraftPoses`) builds.
  4. Run `build.ps1` (dev) again.
  5. Commit as `feat(pets): 1.1 poses approved`.

---

### Task 18: Version 1.1.0, the guide, the final release build, end-to-end checks

**Files:**
- Create: `tests/fixtures/v10/settings.json`, `history.json`, `window.json`. These are a profile written by released 1.0.0; fixture data, not the user's.
- Modify: `src/host/AppHost.cs` (`Version = "1.1.0"`), `docs/使用說明.md`, `src/web/guide.txt`

- [ ] **Step 1: Set `AppHost.Version = "1.1.0"`.** 設定 → 其他 → 關於 then shows 「版本 1.1.0」. The version is checked on the exe in Step 4.
- [ ] **Step 2: Update `docs/使用說明.md` and `src/web/guide.txt` the same way.**
  - New sections:
    - 「休息提醒怎麼開關」: the one reminder every 50 minutes; the two switches; 「喝了」, 「起來了」 and 「等一下」 (10 分鐘); 一天 8 杯; 設定 → 健康 and its 進階;
    - 「番茄鐘怎麼用」: 25–5–15, a long break every 4, starting from the top of the right-click menu and from the layout buttons;
    - 「三個新版型（U10 頂端小膠囊、U12 健康儀表板、U13 番茄鐘優先）」, with the capsule positions in 版型 ▶ 膠囊位置 and dragging.
  - The line 「全螢幕和簡報時提醒會先等著」: reminders wait while the app is hidden, during a focus, and in full-screen or presentation mode, and appear 3 seconds after.
  - 省電模式.
  - Unused counts stay hidden.
  - Check: `grep -c "番茄鐘" docs/使用說明.md src/web/guide.txt` and `grep -c "全螢幕和簡報時提醒會先等著" src/web/guide.txt` are each at least 1.
- [ ] **Step 3: Run `test.ps1`.** Expected: PASS, with both counts above the baseline.
- [ ] **Step 4: Run `build.ps1 -Release`.** Expected: no DRAFT line; `powershell.exe -NoProfile -Command "(Get-Item build\錢進中.exe).VersionInfo.FileVersion"` prints `1.1.0`. Record the size and sha256.
- [ ] **Step 5: End-to-end checks with the release exe.** Use `QJZ_PROFILE` profiles on DISPLAY1, no input; record each result in the commit body.
  1. **Fresh profile** (`onboarded:false`, salary 0, `hideFromCapture:false`): the onboarding panel shows (`spiketool printwindow`). Step 3 is covered by Task 13's DOM tests.
  2. **The `tests/fixtures/v10` profile:** the 健康 question shows. After `post WM_CLOSE`:
     - `settings.json` is byte-identical;
     - the closed days in `history.json` deep-equal the fixture;
     - `window.json` is unchanged.
  3. **A pomodoro that ended 2 minutes ago:** within 5 s of start, `history.json` has `tomatoes:1` and `pomodoro.phase:"break"`.
  4. **U10 as the last layout,** with `capsule` `top`, then `bottomRight`: the DISPLAY1 rect checks pass.
  5. **Each layout** (U1, U3, U5B, U7, M3, U10, U12, U13) starts visible on DISPLAY1, and `error.log` gains no line.
  6. **CPU again** with the final art (Task 15 tool): U7 for P0 and S5, 省電模式 off and on. Report the numbers.
  7. **Clean-up:** the Run value is unchanged, no PID-tree process is left, the profiles are removed, and the user's own 錢進中 is untouched.
- [ ] **Step 6: Hand over the user-only checks.** The controller gives the user this list:
  - a real reminder with the interval at 20 min: raised over Excel without losing typing focus; 喝了, 起來了 and 等一下;
  - a slideshow: no bubble, then one 3 s after it ends;
  - Ctrl+Alt+H: no bubble pops the window back;
  - a U10 drag between monitors snaps to the nearest dock;
  - the upgrade question on their own data;
  - the poses in place;
  - optionally, Win10.
  - Agents never overwrite `C:\Users\<user>\Desktop\錢進中.exe`.
- [ ] **Step 7: Commit** as `chore: 錢進中 1.1.0 (version, guide, release checks)`.
