# 錢進中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 錢進中, a single-exe Windows desktop app that shows today's earnings ticking up live, with switchable cute pets (5 hamster + 3 cat skins) and switchable layouts (U1, U3, U5-B, U7, M3).

**Architecture:** A thin C# WinForms host (.NET Framework 4.8, built with the in-box `csc.exe`, C# 5) owns OS integration — windows, transparency, tray, autostart, session events, files — and embeds WebView2. All product logic and UI live in plain HTML/CSS/SVG/JS (classic scripts on a global `QJZ` namespace, no frameworks, no build step). Host and page talk through WebView2 JSON messages. Pure JS core logic is unit-tested in headless Edge; pure C# helpers are unit-tested by a tiny reflection test runner.

**Tech Stack:** C# 5 / .NET Framework 4.8 WinForms, Microsoft.Web.WebView2 SDK 1.0.4191.47, HTML/CSS/SVG/vanilla JS (ES2017, classic scripts), PowerShell build scripts, headless Microsoft Edge for JS tests, git.

**Spec:** `docs/superpowers/specs/2026-11-11-qianjinzhong-design.md` (Traditional Chinese). Art and layout source of truth: `docs/prototypes/converge.html`, `docs/prototypes/p0-hamster.html`, `docs/prototypes/shared.js`, `docs/prototypes/shared.css`. Executors read the spec and these prototypes before starting.

## Global Constraints

- Runs on Windows 10 1903+ and Windows 11 with nothing installed beyond in-box .NET Framework 4.8 and the Evergreen WebView2 Runtime; one `.exe`, no installer.
- Build machine has no .NET SDK, Node.js or Visual Studio. Compile with `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` (C# 5: no `$""`, no `?.`, no `nameof`, no expression-bodied members).
- Downloads (WebView2 SDK, Fredoka font) go into `vendor/` and are committed; ask the user before the first download.
- No admin rights anywhere. Autostart = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, value name `錢進中`.
- User data: `%AppData%\錢進中\settings.json`, `%AppData%\錢進中\history.json`. Extracted runtime files and WebView2 user data: `%LocalAppData%\錢進中\`.
- UI language Traditional Chinese; currency `NT$`, amounts shown with 2 decimals.
- A1 palette: background `#FFF8EC`, line/shadow `#3D2C24` (≈3px outline, hard offset shadow), accents `#FFC857` / `#FF8A3D` / `#FFB627`, status green `#8EE3B0`/`#1E9E5A`, heart `#FF5C7C`. Number font Fredoka (bundled), Chinese font Microsoft JhengHei UI.
- Spec defaults: divisor 22 (alt 30), 8 work hours/day, lunch 12:00–13:00 unpaid, Mon–Fri auto-start, day boundary 04:00, milestone NT$100, items 珍奶 65 / 便當 100 / 拿鐵 120, default layout U1, sound off, autostart on, capture protection on, hide hotkey Ctrl+Alt+H, pet names 小橘 (cat) / 金金 (hamster).
- Earnings depend only on the wall clock; lock/sleep never pause them. Earnings stop at 8 worked hours or at a manual 下班.
- No Windows toast notifications; off-work reminder is the pet celebrating only.
- Antivirus-friendly: no packers, no obfuscation, no injection into other processes; write only `%AppData%\錢進中`, `%LocalAppData%\錢進中` and the HKCU Run value. Defaults must be generic (no hard-coded salary) because coworkers will use it.
- Average CPU (host + WebView2 processes) below 3% while only U7 is shown; animations pause when hidden or the session is locked.
- Every git commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <session link>
  ```
  Pattern: ``git commit -m "feat: ..." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: <session link>"``
- Work on branch `feat/qianjinzhong-v1` (create it from `main` before Task 1).

## Review Focus

1. Sleep/resume and system-clock jumps (laptop wakes next morning, user changes the clock) — the day must roll over at 04:00, worked time is never negative and never above 8 h. Tests in Task 3 and Task 4.
2. Corrupt or hand-edited `settings.json` / `history.json` — app starts with defaults, keeps a `.corrupt-<timestamp>` copy, never crashes. Tests in Task 5 (parse) and Task 6 (backup).
3. Salary typed as `""`, `0`, `-5`, `abc`, `50,000`, `1e12` — clear validation message, never `NaN` on screen. Tests in Task 5.
4. Saved window position on a monitor that is gone or at a different DPI — window comes back fully inside a visible work area. Test in Task 7.
5. Launching the exe a second time (autostart + double-click) — second process exits, first window is shown. Verification step in Task 7.

---

## File Map

```
build.ps1                     build build\錢進中.exe (dev: loads src\web from disk; release: embedded)
test.ps1                      run JS tests (headless Edge) + host tests
tools\fetch-deps.ps1          download WebView2 SDK + Fredoka into vendor\
vendor\webview2\              Microsoft.Web.WebView2.Core.dll, .WinForms.dll, x64\ x86\ WebView2Loader.dll, LICENSE.txt
vendor\fonts\                 Fredoka-Variable.ttf, OFL.txt
src\host\                     C# host (one responsibility per file, see tasks)
src\web\index.html            single page; layout chosen at runtime
src\web\css\                  base.css (atoms, A1 tokens), layouts.css, panels.css, pets.css
src\web\js\core\              time.js earnings.js day.js settings.js history.js rewards.js mood.js   (pure, tested)
src\web\js\pets\              common.js room.js expressions.js skins\*.js registry.js compose.js behavior.js lines.js
src\web\js\ui\                bridge.js odometer.js fx.js sound.js layouts.js panels.js app.js
tests\web\                    harness.js run.html *.test.js
tests\host\                   TestRunner.cs *Tests.cs
docs\spikes\transparency.md   spike result
docs\使用說明.md               end-user guide (SmartScreen, data, uninstall)
```

---

### Task 1: Toolchain, dependencies, build/test harness, hello window

**Files:**
- Create: `tools/fetch-deps.ps1`, `build.ps1`, `test.ps1`, `src/host/Program.cs`, `src/host/WebRoot.cs`, `src/host/app.manifest`, `src/web/index.html`, `tests/web/harness.js`, `tests/web/run.html`, `tests/web/smoke.test.js`, `tests/host/TestRunner.cs`, `tests/host/SmokeTests.cs`
- Modify: `.gitignore` (add `/build/`, `tests/web/.edge-profile/`)

**Interfaces:**
- Produces: `build.ps1 [-Release]` → `build\錢進中.exe`; `test.ps1` exits 0 only when both suites pass and prints `WEB: <n> passed, 0 failed` and `HOST: <n> passed, 0 failed`.
- Produces JS test API (global): `test(name, fn)`, `eq(actual, expected, msg)`, `near(actual, expected, eps, msg)`, `ok(cond, msg)`. `run.html` loads every `src/web/js/core/*.js` then every `tests/web/*.test.js` (explicit `<script>` list, add new files as tasks create them) and writes `TESTS PASS <n> FAIL <m>` plus failure lines into `<pre id="results">`.
- Produces host test API: any `public static void Test_*()` in a class whose name ends with `Tests` is run; `Assert.Eq(object expected, object actual, string msg)`, `Assert.True(bool, string)`.
- Produces `WebRoot.Resolve() : string` — returns `%QJZ_WEB_ROOT%` if set, else `<repo>\src\web` when it exists two levels above the exe, else `null` (release path added in Task 14).

- [ ] **Step 1: Ask the user for permission to download** WebView2 SDK `Microsoft.Web.WebView2` 1.0.4191.47 (`https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.4191.47`, a few MB) and Fredoka (`https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf` + `OFL.txt`). Do not continue without a yes.
- [ ] **Step 2: Write `tools/fetch-deps.ps1`** that downloads the nupkg to a temp folder, unzips it, and copies `lib\net462\Microsoft.Web.WebView2.Core.dll`, `lib\net462\Microsoft.Web.WebView2.WinForms.dll` (use whichever `lib\net4*` folder the package actually has), `runtimes\win-x64\native\WebView2Loader.dll` → `vendor\webview2\x64\`, `runtimes\win-x86\native\WebView2Loader.dll` → `vendor\webview2\x86\`, and the license; downloads the font to `vendor\fonts\Fredoka-Variable.ttf` + `OFL.txt`. Run it; expected: those 7 files exist.
- [ ] **Step 3: Write the failing smoke tests** — `tests/web/smoke.test.js`: `test('harness works', function(){ eq(1+1, 2); });` and `tests/host/SmokeTests.cs`: `public static void Test_Harness(){ Assert.Eq(2, 1+1, "math"); }`.
- [ ] **Step 4: Run `.\test.ps1`** — expected: fails because harness/runner don't exist yet.
- [ ] **Step 5: Implement `harness.js`, `run.html`, `TestRunner.cs`, `test.ps1`.** `test.ps1` launches `msedge.exe --headless=new --disable-gpu --no-first-run --user-data-dir=<repo>\tests\web\.edge-profile --virtual-time-budget=5000 --dump-dom file:///.../tests/web/run.html` (a dedicated profile is required — without it Edge returns nothing while the user's Edge is open), parses `TESTS PASS n FAIL m`, then compiles `tests\host\*.cs` + the host source files listed in `$HostTestSources` (initially none) with csc into `build\tests-host.exe`, runs it, and propagates failures.
- [ ] **Step 6: Run `.\test.ps1`** — expected: `WEB: 1 passed, 0 failed`, `HOST: 1 passed, 0 failed`, exit 0.
- [ ] **Step 7: Implement the hello window** — `Program.cs` (`[STAThread] Main`): PerMonitorV2 via `app.manifest`, a 400×300 Form with a WebView2 control whose `CoreWebView2` maps virtual host `app.qjz` to `WebRoot.Resolve()` (`SetVirtualHostNameToFolderMapping`, `CoreWebView2HostResourceAccessKind.Allow`) and navigates to `https://app.qjz/index.html`; user-data folder `%LocalAppData%\錢進中\WebView2`; call `CoreWebView2Environment.SetLoaderDllFolderPath` with `vendor\webview2\x64` or `x86` by `Environment.Is64BitProcess`. `index.html` shows「錢進中」in Fredoka/JhengHei on `#FFF8EC`. `build.ps1` references the two WebView2 DLLs, `System.Web.Extensions.dll`, embeds `app.manifest`, copies DLLs next to the exe in dev builds.
- [ ] **Step 8: Verify** `.\build.ps1; .\build\錢進中.exe` — window shows 錢進中 with the Fredoka font. Close it.
- [ ] **Step 9: Commit** — `git add -A; git commit` with message `chore: build/test harness, deps, hello WebView2 window` + attribution.

---

### Task 2: Transparency spike — frameless, per-pixel transparent, click-through window (GO / NO-GO GATE)

**Files:**
- Create: `src/host/Native.cs` (P/Invoke), `src/host/PetWindow.cs`, `src/web/spike.html`, `docs/spikes/transparency.md`

**Interfaces:**
- Produces `class PetWindow : Form` used by every layout:
  - `PetWindow(string startUrl)` — borderless, no taskbar button, transparent wherever the page is transparent.
  - `void SetContentSize(int cssWidth, int cssHeight)` — resizes the window to the page's reported CSS size × the window's current DPI scale.
  - `void SetHitRects(RectangleF[] cssRects)` — areas that receive the mouse; everywhere else clicks fall through to whatever is behind.
  - `void BeginDrag()` — starts a native window move (release capture + `WM_NCLBUTTONDOWN`/`HTCAPTION`).
  - `bool TopMostEnabled { get; set; }`
  - `CoreWebView2 Web { get; }` and `event EventHandler WebReady`.

- [ ] **Step 1: Build `spike.html`** — transparent `body`, an A1 sticker card (rounded 28px, 3px `#3D2C24` border, 7px hard shadow) and the P0 hamster `petOnlySVG` copied from `docs/prototypes/shared.js` floating beside it with nothing behind; elements carry `data-hit`.
- [ ] **Step 2: Try approach A** — `FormBorderStyle.None`, `WebView2.DefaultBackgroundColor = Color.Transparent`, `BackColor = TransparencyKey = Color.FromArgb(61,44,37)` (≈ outline colour, so anti-aliased edges blend into the outline). Record: does the desktop show through? fringe quality on outlined vs un-outlined (S4) edges? are transparent pixels click-through?
- [ ] **Step 3: Try approach C if A fails** — `DwmEnableBlurBehindWindow` with an empty region (`CreateRectRgn(0,0,-1,-1)`, `fEnable=true`) + transparent WebView2 background; click-through by toggling `WS_EX_TRANSPARENT` from a 30 Hz cursor poll against the hit rects.
- [ ] **Step 4: Try approach B only if A and C both fail** — WebView2 visual hosting (`CoreWebView2CompositionController`) into a `WS_EX_NOREDIRECTIONBITMAP` window via DirectComposition interop.
- [ ] **Step 5: Verify the chosen approach on this Win11 machine at 100% and 150% scaling** — screenshot over a busy wallpaper; click a desktop icon through a transparent area; drag the card; toggle topmost.
- [ ] **Step 6: Write `docs/spikes/transparency.md`** — approaches tried, what worked, screenshots paths, known limits.
- [ ] **Step 7: GATE.** If no approach gives true per-pixel transparency with click-through, STOP and report to the user with the best fallback (window region clipped to the pet outline, or a small backing card) before any further task. If one works, implement the final `PetWindow` API above with it.
- [ ] **Step 8: Commit** — `feat(host): transparent click-through PetWindow (spike result)`.

---

### Task 3: Core — time and earnings math

**Files:**
- Create: `src/web/js/core/time.js`, `src/web/js/core/earnings.js`, `tests/web/earnings.test.js`
- Modify: `tests/web/run.html` (add scripts)

**Interfaces:**
- Produces `QJZ.time`:
  - `parseHM(s: "HH:MM") -> number` minutes since midnight.
  - `dayKey(ms: number, boundaryHour = 4) -> "YYYY-MM-DD"` (local; before 04:00 belongs to the previous date).
  - `atMinutes(day: string, minutes: number) -> number` epoch ms (local).
  - `weekday(day: string) -> 0..6` (0 = Sunday).
- Produces `QJZ.earn`:
  - `rates(salary: {mode:'monthly'|'hourly', amount:number, divisor:22|30}, hoursPerDay:number) -> {daily, hourly, perSecond}`.
  - `workedSeconds(startMs, untilMs, day, lunch:{start:"HH:MM", end:"HH:MM"}) -> number` — elapsed minus the overlap with lunch; `0` when `untilMs <= startMs`.
  - `endAtMs(startMs, day, hoursPerDay, lunch) -> number` — when worked seconds reach `hoursPerDay*3600`.
  - `snapshot({startMs, endMs, nowMs, day, salary, hoursPerDay, lunch}) -> {status, workedSec, earned, pct, remainingSec, endAtMs}`; `status ∈ 'before' | 'working' | 'lunch' | 'done' | 'ended'` (`ended` = manual 下班, `endMs` not null); `workedSec` capped at `hoursPerDay*3600`; `earned = workedSec * perSecond`.

- [ ] **Step 1: Write failing tests** in `earnings.test.js` (use `QJZ.time.atMinutes('2026-11-11', m)` for timestamps):
```js
test('monthly 50000 / 22 / 8h', function(){ var r=QJZ.earn.rates({mode:'monthly',amount:50000,divisor:22},8);
  near(r.daily,2272.727,0.001); near(r.hourly,284.0909,0.0001); near(r.perSecond,0.0789141,1e-7); });
test('divisor 30', function(){ near(QJZ.earn.rates({mode:'monthly',amount:30000,divisor:30},8).daily,1000,1e-9); });
test('hourly mode', function(){ var r=QJZ.earn.rates({mode:'hourly',amount:200,divisor:22},8); eq(r.hourly,200); eq(r.daily,1600); });
test('start 08:30 -> end 17:30', function(){ eq(QJZ.earn.endAtMs(T(8*60+30),D,8,L), T(17*60+30)); });
test('09:12 start, 14:32:07 now', function(){ var s=snap(T(9*60+12), null, T(14*60+32)+7000);
  eq(s.workedSec,15607); near(s.earned,1231.61,0.01); near(s.pct,0.5419,0.0001); eq(s.status,'working'); });
test('lunch is unpaid and paused', function(){ var s=snap(T(9*60), null, T(12*60+30)); eq(s.status,'lunch'); eq(s.workedSec,3*3600); });
test('start during lunch counts from 13:00', function(){ eq(snap(T(12*60+30),null,T(13*60+30)).workedSec,1800); });
test('start after lunch has no lunch deduction', function(){ eq(QJZ.earn.endAtMs(T(13*60+30),D,8,L), T(21*60+30)); });
test('clock earlier than start gives zero, not negative', function(){ var s=snap(T(9*60),null,T(8*60)); eq(s.workedSec,0); eq(s.earned,0); eq(s.status,'before'); });
test('now far past end caps at 8h', function(){ var s=snap(T(8*60+30),null,T(23*60)); eq(s.workedSec,28800); eq(s.status,'done'); eq(s.remainingSec,0); });
test('manual 下班 at 16:00', function(){ var s=snap(T(8*60+30),T(16*60),T(18*60)); eq(s.workedSec,23400); eq(s.status,'ended'); });
test('dayKey before 04:00 is previous day', function(){ eq(QJZ.time.dayKey(new Date(2026,10,12,3,59).getTime()),'2026-11-11'); eq(QJZ.time.dayKey(new Date(2026,10,12,4,0).getTime()),'2026-11-12'); });
```
  (helpers at top of file: `D='2026-11-11'`, `L={start:'12:00',end:'13:00'}`, `T=function(m){return QJZ.time.atMinutes(D,m)}`, `snap(start,end,now)` calls `QJZ.earn.snapshot` with salary 50000/22 and 8 h.)
- [ ] **Step 2: Run `.\test.ps1`** — expected: these tests FAIL (`QJZ.earn` undefined).
- [ ] **Step 3: Implement `time.js` and `earnings.js`** with the signatures above (each file: `window.QJZ = window.QJZ || {}; QJZ.earn = (function(){ ... })();`).
- [ ] **Step 4: Run `.\test.ps1`** — expected: all PASS.
- [ ] **Step 5: Commit** — `feat(core): time and earnings math`.

---

### Task 4: Core — day record state machine

**Files:**
- Create: `src/web/js/core/day.js`, `tests/web/day.test.js`
- Modify: `tests/web/run.html`

**Interfaces:**
- Consumes: `QJZ.time.*`, `QJZ.earn.endAtMs` (Task 3); settings shape from Task 5 (`startMode`, `workDays`, `hoursPerDay`, `lunch`) — tests pass plain objects.
- Produces `QJZ.day` (all functions pure, return new objects):
  - Record: `{day, startMs, startSource:'auto'|'manual'|null, adjusted:boolean, endMs, endSource:'manual'|'confirmed'|null, lastLockMs, offDay:boolean, snacksEaten:number, earned:number|null}`.
  - `empty(day) -> Record`
  - `onActivity(rec, {type:'logon'|'unlock'|'resume'|'appstart'|'probe', ms}, settings) -> Record` — sets `startMs = ms`, `startSource='auto'` only if `startMs` is null, `settings.startMode==='auto'`, weekday ∈ `settings.workDays`, not `offDay`; always clears `lastLockMs`.
  - `onLock(rec, ms) -> Record` — lock or suspend: sets `lastLockMs`.
  - `manualStart(rec, ms)`, `adjustStart(rec, ms)` (sets `adjusted=true`), `manualEnd(rec, ms)` (`endSource='manual'`), `setOffDay(rec, bool)`.
  - `earlyLeaveQuestion(prevRec, settings) -> null | {day, lockMs}` — non-null when `prevRec.startMs` set, `endMs` null, `lastLockMs` set and `< QJZ.earn.endAtMs(...)`.
  - `resolveEarlyLeave(prevRec, accept:boolean) -> Record` — accept: `endMs=lastLockMs`, `endSource='confirmed'`.
  - `rollover(rec, nowMs) -> {closed: Record|null, current: Record}` — when `QJZ.time.dayKey(nowMs) !== rec.day`, returns the old record as `closed` and `empty(newDay)` as `current`.

- [ ] **Step 1: Write failing tests** in `day.test.js`:
```js
test('first unlock on a weekday starts the day', function(){ var r=QJZ.day.onActivity(QJZ.day.empty('2026-11-11'),{type:'unlock',ms:T(8*60+41)},S); eq(r.startMs,T(8*60+41)); eq(r.startSource,'auto'); });
test('later unlocks keep the first start', function(){ var r=QJZ.day.onActivity(started(8*60+41),{type:'unlock',ms:T(10*60)},S); eq(r.startMs,T(8*60+41)); });
test('saturday does not auto start', function(){ eq(QJZ.day.onActivity(QJZ.day.empty('2026-11-14'),{type:'logon',ms:Date.parse('2026-11-14T09:00:00')},S).startMs,null); });
test('manual mode ignores activity', function(){ eq(QJZ.day.onActivity(QJZ.day.empty(D),{type:'logon',ms:T(540)},{startMode:'manual',workDays:[1,2,3,4,5]}).startMs,null); });
test('off day blocks auto start', function(){ var r=QJZ.day.setOffDay(QJZ.day.empty(D),true); eq(QJZ.day.onActivity(r,{type:'logon',ms:T(540)},S).startMs,null); });
test('adjust start marks adjusted', function(){ var r=QJZ.day.adjustStart(started(540),T(525)); eq(r.startMs,T(525)); ok(r.adjusted); });
test('unlock clears lastLockMs', function(){ var r=QJZ.day.onLock(started(510),T(960)); r=QJZ.day.onActivity(r,{type:'unlock',ms:T(970)},S); eq(r.lastLockMs,null); });
test('early leave question when last lock before end', function(){ var q=QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(started(510),T(962)),S); eq(q.lockMs,T(962)); });
test('no question when locked after end', function(){ eq(QJZ.day.earlyLeaveQuestion(QJZ.day.onLock(started(510),T(18*60)),S),null); });
test('accepting sets confirmed end', function(){ var r=QJZ.day.resolveEarlyLeave(QJZ.day.onLock(started(510),T(962)),true); eq(r.endMs,T(962)); eq(r.endSource,'confirmed'); });
test('resume after midnight past 04:00 starts a new day', function(){ var x=QJZ.day.rollover(started(510),new Date(2026,10,12,8,5).getTime()); eq(x.closed.day,D); eq(x.current.day,'2026-11-12'); eq(x.current.startMs,null); });
test('03:30 next morning is still the same day', function(){ eq(QJZ.day.rollover(started(510),new Date(2026,10,12,3,30).getTime()).closed,null); });
```
  (helpers: `D='2026-11-11'` (Wednesday), `S={startMode:'auto',workDays:[1,2,3,4,5],hoursPerDay:8,lunch:{start:'12:00',end:'13:00'}}`, `T` as in Task 3, `started(m)` = `onActivity(empty(D), {type:'logon', ms:T(m)}, S)`.)
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement `day.js`.**
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Commit** — `feat(core): day record state machine`.

---

### Task 5: Core — settings, history, rewards

**Files:**
- Create: `src/web/js/core/settings.js`, `src/web/js/core/history.js`, `src/web/js/core/rewards.js`, `tests/web/settings.test.js`, `tests/web/history.test.js`
- Modify: `tests/web/run.html`

**Interfaces:**
- Produces `QJZ.settings`:
  - `DEFAULTS` = `{version:1, salary:{mode:'monthly',amount:0,divisor:22}, hoursPerDay:8, lunch:{start:'12:00',end:'13:00'}, startMode:'auto', workDays:[1,2,3,4,5], pet:{kind:'hamster',skin:'p0',names:{cat:'小橘',hamster:'金金'}}, layout:{start:'U1',current:'U1',topmost:{U1:false,U3:false,U5B:false,U7:true,M3:true}}, milestone:100, items:[{name:'珍奶',price:65,icon:'🧋'},{name:'便當',price:100,icon:'🍱'},{name:'拿鐵',price:120,icon:'☕'}], sound:{enabled:false,volume:0.6}, autostart:true, privacy:{hideFromCapture:true,hotkey:'Ctrl+Alt+H'}, onboarded:false}` (`amount:0` = not set → onboarding).
  - `parse(text: string|null) -> {settings, corrupted:boolean}` — deep-merges onto `DEFAULTS`, coerces wrong types back to defaults; unparseable text → defaults + `corrupted:true`.
  - `validateSalary(text: string) -> {ok:true, value:number} | {ok:false, error:string}` — accepts digits with optional commas/decimals, range `1 ≤ value ≤ 10,000,000`; error strings: `'請輸入薪資'` (empty), `'薪資要大於 0'` (≤0), `'請輸入數字'` (non-numeric), `'金額太大了'` (>10M).
  - `skinsFor(kind) -> string[]` — `hamster: ['p0','p4','h2','s4','s5']`, `cat: ['p0','p4','s5']`.
- Produces `QJZ.history`:
  - Shape `{version:1, days:{[day]: Record}}`; `parse(text) -> {history, corrupted}` (same rules).
  - `closeDay(rec, settings) -> Record` — fills `earned` from `QJZ.earn.snapshot` at the record's end (endMs, else 8 h cap).
  - `monthTotal(history, month:"YYYY-MM", today: Record|null, todayEarned:number) -> number`.
  - `monthDays(history, month) -> [{day, earned}]` sorted; `monthTotals(history) -> [{month, total}]` newest first.
- Produces `QJZ.rewards`:
  - `milestones(earned, step) -> integer` (`Math.floor(earned/step)`).
  - `snacksAvailable(rec, earned, step) -> integer` (milestones − `rec.snacksEaten`, min 0).
  - `itemCount(earned, item) -> string` one decimal (e.g. `'18.9'`).

- [ ] **Step 1: Write failing tests** — `settings.test.js`:
```js
test('parse null gives defaults', function(){ var p=QJZ.settings.parse(null); eq(p.settings.salary.divisor,22); eq(p.settings.layout.start,'U1'); eq(p.corrupted,false); });
test('broken json gives defaults and flags corrupted', function(){ var p=QJZ.settings.parse('{bad json'); eq(p.corrupted,true); eq(p.settings.milestone,100); });
test('wrong types fall back', function(){ var s=QJZ.settings.parse('{"salary":{"amount":"abc"},"hoursPerDay":-3}').settings; eq(s.salary.amount,0); eq(s.hoursPerDay,8); });
test('partial settings keep defaults elsewhere', function(){ var s=QJZ.settings.parse('{"salary":{"mode":"hourly","amount":200}}').settings; eq(s.salary.divisor,22); eq(s.items.length,3); });
test('salary validation', function(){ var v=QJZ.settings.validateSalary;
  eq(v('').error,'請輸入薪資'); eq(v('0').error,'薪資要大於 0'); eq(v('-5').error,'薪資要大於 0');
  eq(v('abc').error,'請輸入數字'); eq(v('1e12').error,'請輸入數字'); eq(v('50,000').value,50000); eq(v('12345678').error,'金額太大了'); });
```
  `history.test.js`:
```js
test('month total sums closed days plus today', function(){ var h={version:1,days:{'2026-11-10':{day:'2026-11-10',earned:2272.73},'2026-10-31':{day:'2026-10-31',earned:999}}};
  near(QJZ.history.monthTotal(h,'2026-11',{day:'2026-11-11'},1231.61),3504.34,0.001); });
test('monthTotals newest first', function(){ var t=QJZ.history.monthTotals({version:1,days:{'2026-10-01':{day:'2026-10-01',earned:10},'2026-11-01':{day:'2026-11-01',earned:20}}}); eq(t[0].month,'2026-11'); });
test('closeDay without end uses the 8h cap', function(){ var r=QJZ.history.closeDay({day:'2026-11-11',startMs:QJZ.time.atMinutes('2026-11-11',510),endMs:null},SETTINGS_50000); near(r.earned,2272.73,0.01); });
test('milestones and snacks', function(){ eq(QJZ.rewards.milestones(1231.61,100),12); eq(QJZ.rewards.snacksAvailable({snacksEaten:5},1231.61,100),7); eq(QJZ.rewards.itemCount(1231.61,{price:65}),'18.9'); });
test('corrupt history', function(){ var p=QJZ.history.parse('[]x'); eq(p.corrupted,true); eq(Object.keys(p.history.days).length,0); });
```
  (`SETTINGS_50000` = `QJZ.settings.parse('{"salary":{"amount":50000}}').settings`.)
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement the three files.**
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Commit** — `feat(core): settings, history, rewards`.

---

### Task 6: Host — storage, autostart, session events, event-log probe, bridge

**Files:**
- Create: `src/host/AppPaths.cs`, `src/host/TextStore.cs`, `src/host/AutoStart.cs`, `src/host/SessionWatcher.cs`, `src/host/EventLogProbe.cs`, `src/host/Bridge.cs`, `tests/host/TextStoreTests.cs`, `tests/host/AutoStartTests.cs`, `tests/host/EventLogProbeTests.cs`, `tests/host/BridgeTests.cs`
- Modify: `test.ps1` (`$HostTestSources` += these sources)

**Interfaces:**
- Produces:
  - `AppPaths.DataDir` (`%AppData%\錢進中`), `AppPaths.LocalDir` (`%LocalAppData%\錢進中`), both created on first access.
  - `TextStore(string path)`: `string Read()` (null if missing), `void Write(string text)` (write `path.tmp` then `File.Replace`/move — never leaves a half file), `string BackupCorrupt()` (copies to `path.corrupt-yyyyMMdd-HHmmss`, returns that path).
  - `AutoStart(string runKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run")`: `bool IsEnabled()`, `void Set(bool on, string exePath)` — value name `錢進中`, data `"<exePath>"` quoted.
  - `SessionWatcher`: `event Action<string,long> Activity` with kinds `logon|unlock|lock|suspend|resume` and epoch ms; wraps `SystemEvents.SessionSwitch` and `SystemEvents.PowerModeChanged`.
  - `EventLogProbe.EarliestToday(DateTime dayStartLocal) : long?` — earliest System-log Winlogon 7001 (logon) or Power-Troubleshooter 1 (wake) at or after `dayStartLocal`; pure core `static long? Earliest(IEnumerable<ProbeRecord> records, DateTime dayStartLocal)` with `ProbeRecord{ string Source; int EventId; DateTime TimeLocal; }` is what tests exercise.
  - `Bridge(CoreWebView2 web)`: `void Send(string type, object payload)` (`{type, ...payload}` via `PostWebMessageAsJson`), `event Action<string, Dictionary<string,object>> Received` (parsed with `JavaScriptSerializer`; malformed JSON is ignored, never throws).
- Message protocol (both directions, all JSON objects with `type`) — later tasks use exactly these:
  - Host → web: `init {settings:string|null, history:string|null, probeMs:number|null, nowMs, version}`, `session {kind, ms}`, `menu {action}`, `visibility {visible:bool}`, `dragEnd {}`.
  - Web → host: `saveSettings {text}`, `saveHistory {text}`, `backupCorrupt {file:'settings'|'history'}`, `setLayout {layout, width, height}`, `hitRects {rects:[[x,y,w,h],...]}`, `dragStart {}`, `contextMenu {}`, `setTopmost {on}`, `setAutostart {on}`, `setCaptureGuard {on}`, `setHotkey {combo}`, `hide {}`, `quit {}`.

- [ ] **Step 1: Write failing tests:**
  - `TextStoreTests.Test_WriteThenRead_RoundTrips`, `Test_Read_Missing_ReturnsNull`, `Test_BackupCorrupt_CopiesFile` (temp dir).
  - `AutoStartTests.Test_SetOnAndOff` — use run-key path `Software\QJZTest\Run` (delete it in a `finally`); after `Set(true, @"C:\x\錢進中.exe")` the value equals `"\"C:\x\錢進中.exe\""`, `IsEnabled()` true; after `Set(false, ...)` false.
  - `EventLogProbeTests.Test_PicksEarliestAfterDayStart` — records at 03:50 (before 04:00 start, ignored), 08:41 logon, 08:12 wake → returns 08:12; `Test_IgnoresOtherEventIds`; `Test_NoneReturnsNull`.
  - `BridgeTests.Test_ParseMalformedIsIgnored`, `Test_ParseTypeAndFields` (test the static `Bridge.Parse(string json) : Dictionary<string,object>` which returns null on bad input).
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL (types missing).
- [ ] **Step 3: Implement the six files.**
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Commit** — `feat(host): storage, autostart, session events, probe, bridge`.

---

### Task 7: Host — window manager, menus, single instance, hotkey, capture guard

**Files:**
- Create: `src/host/AppHost.cs` (owns the one `PetWindow`, bridge wiring, layout switching), `src/host/TrayMenu.cs`, `src/host/HotKey.cs`, `src/host/CaptureGuard.cs`, `src/host/SingleInstance.cs`, `src/host/ScreenFit.cs`, `src/host/WebView2Check.cs`, `tests/host/ScreenFitTests.cs`
- Modify: `src/host/Program.cs`, `test.ps1`

**Interfaces:**
- Consumes: `PetWindow` (Task 2), `Bridge`, `TextStore`, `AutoStart`, `SessionWatcher`, `EventLogProbe` (Task 6).
- Produces:
  - `ScreenFit.Clamp(Rectangle win, Rectangle[] workAreas) : Rectangle` — if `win` is not ≥ 50% inside one work area, move it fully inside the work area nearest its centre (keep size; shrink only if larger than the area).
  - `CaptureGuard.Apply(IntPtr hwnd, bool on)` — `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE=0x11)`; if that fails (pre-2004) use `WDA_MONITOR=0x1`; `on=false` → `WDA_NONE`.
  - `HotKey.Register(IntPtr hwnd, string combo) : bool` — parses `Ctrl+Alt+H` style strings; toggles show/hide of the window.
  - `SingleInstance.TryStart() : bool` — named mutex `Local\QianJinZhong`; second instance signals the first (named event) to show itself, then exits.
  - `WebView2Check.IsAvailable() : bool` — `CoreWebView2Environment.GetAvailableBrowserVersionString()` non-null; env var `QJZ_FORCE_NO_WEBVIEW2=1` forces false.
  - `TrayMenu` — one `ContextMenuStrip` (A1 colours via a custom `ToolStripProfessionalRenderer`) shared by the tray icon and `contextMenu` messages. Items: 切換版型 ▸ U1 經典直式 / U3 遊戲畫面 / U5-B 橫向極簡 / U7 桌面寵物; 縮成迷你; 餵食; 開始上班; 調整起算時間; 下班; 永遠在最上層 ✓; 設定; 紀錄; 隱藏/顯示; 結束. Each item sends `menu {action}` with action ids `layout:U1|U3|U5B|U7`, `mini`, `feed`, `start`, `adjust`, `end`, `topmost`, `settings`, `history`, `toggleVisible`, `quit`.
  - `AppHost` behaviour: on `setLayout` resize via `SetContentSize`, restore the saved position for that layout through `ScreenFit.Clamp`, apply topmost. Window positions are owned by the host only, in `%AppData%\錢進中\window.json` (layout → x, y in physical px), saved on `WM_EXITSIZEMOVE`, which also sends `dragEnd`. Pause signal: send `visibility {visible:false}` when hidden or `lock`, `true` on show/unlock.

- [ ] **Step 1: Write failing tests** `ScreenFitTests`: `Test_OnScreenUnchanged` (win inside primary stays), `Test_GoneMonitorMovesToNearest` (win at x=3000 with only a 1920×1040 area → fully inside it), `Test_LargerThanAreaShrinks`.
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement the files; rewrite `Program.cs`**: `SingleInstance.TryStart()` → `WebView2Check.IsAvailable()` (else show a Traditional Chinese MessageBox: 「這台電腦缺少 Microsoft Edge WebView2 執行階段，錢進中需要它才能顯示畫面。請到 https://go.microsoft.com/fwlink/p/?LinkId=2124703 下載安裝後再開啟。」 and exit 0) → `new AppHost().Run()`.
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Manual verification** (`.\build.ps1`, run the exe): tray icon + menu appear; Ctrl+Alt+H hides/shows; with Windows Snipping Tool (Win+Shift+S) the window does not appear in the capture; run the exe a second time → no second window, first comes to front; `$env:QJZ_FORCE_NO_WEBVIEW2=1` → dialog then exit.
- [ ] **Step 6: Commit** — `feat(host): window manager, tray menu, hotkey, capture guard, single instance`.

---

### Task 8: Web shell — bridge client, app loop, odometer, effects, sound

**Files:**
- Create: `src/web/js/ui/bridge.js`, `src/web/js/ui/odometer.js`, `src/web/js/ui/fx.js`, `src/web/js/ui/sound.js`, `src/web/js/ui/app.js`, `src/web/css/base.css`, `src/web/dev.html`, `tests/web/odometer.test.js`
- Modify: `src/web/index.html`, `tests/web/run.html`

**Interfaces:**
- Consumes: all of `QJZ.time/earn/day/settings/history/rewards` (Tasks 3–5); host protocol (Task 6).
- Produces:
  - `QJZ.bridge`: `send(type, payload)`, `on(type, fn)`. Uses `window.chrome.webview` when present; otherwise a dev mock (`dev.html`) that answers `init` with `localStorage` data and logs sends, so every UI task can be checked in a normal browser.
  - `QJZ.app` (single source of truth): `state = {settings, history, today: Record, snap, rates, snacks}`; `start()`; `on('tick', fn)` fired every 100 ms with `snap`; `on('second', fn)`; `on('change', fn)` after any record/settings change; actions `startWork()`, `adjustStart(ms)`, `endWork()`, `setOffDay(bool)`, `feed()`, `saveSettings(patch)`; persists via `saveSettings`/`saveHistory` debounced 1 s; on `corrupted` parse sends `backupCorrupt` before the first save; handles `session` by `QJZ.day.onActivity/onLock` and `rollover`; on `init` with an `earlyLeaveQuestion` exposes `state.pendingQuestion`.
  - `QJZ.odometer.create(el) -> {set(text)}` — port of `Odo` in `docs/prototypes/shared.js` (rolling digits; last digit no transition); `QJZ.odometer.format(n) -> '1,231.61'`.
  - `QJZ.fx`: `plus(boxEl, text)`, `confetti(hostEl, x, y)`, `hearts(hostEl, x, y, n)`, `banner(hostEl, text)` — ported from prototypes.
  - `QJZ.sound`: `setEnabled(bool)`, `setVolume(0..1)`, `coin()`, `meow()`, `squeak()`, `jingle()` — Web Audio synthesis, silent when disabled.
  - Animation pause: on `visibility {visible:false}` add `paused` class to `<html>` (CSS `animation-play-state: paused` for everything) and stop the 100 ms tick.

- [ ] **Step 1: Write failing tests** `odometer.test.js`: `format(1231.6149)==='1,231.61'`, `format(0)==='0.00'`, `format(12345.5)==='12,345.50'`.
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement the files.** `base.css` ports the A1 atoms from `docs/prototypes/shared.css` (`.win`, `.bar`, `.status`, `.pill`, `.money`, `.track/.fill`, `.chip`, `.bubble`, odometer, keyframes) with `@font-face` for `fonts/Fredoka-Variable.ttf` (copy `vendor/fonts` into `src/web/fonts/` in `build.ps1`).
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Verify in the browser** — serve `src/web` with `python -m http.server`, open `dev.html`: amount ticks with rolling digits and “+0.08” floats; toggling sound plays a coin.
- [ ] **Step 6: Commit** — `feat(web): app state loop, bridge, odometer, fx, sound`.

---

### Task 9: Pets — port the 8 skins into a slot-based renderer (typing state)

**Files:**
- Create: `src/web/js/pets/common.js`, `src/web/js/pets/room.js`, `src/web/js/pets/expressions.js`, `src/web/js/pets/skins/hamster-p0.js`, `hamster-p4.js`, `hamster-h2.js`, `hamster-s4.js`, `hamster-s5.js`, `cat-p0.js`, `cat-p4.js`, `cat-s5.js`, `src/web/js/pets/registry.js`, `src/web/js/pets/compose.js`, `src/web/css/pets.css`, `src/web/pets-gallery.html`, `tests/web/pets.test.js`
- Modify: `tests/web/run.html` (load pets scripts too)

**Interfaces:**
- Consumes: art from `docs/prototypes/shared.js`: `p0HamV2`, `mochiHam`, `h2Ham`, `s4Ham`, `s5Ham`, `p0Cat`, `mochiCat`, `s5Cat`, `room` (modes `sticker`, `flat`, `crayon`), `commonDefs`, eye helpers. Appearance must match the prototypes (compare side by side).
- Produces:
  - Skin module contract (`QJZ.pets.register(def)`):
    `{id:'hamster:p0', kind:'hamster', skin:'p0', name:'Q版大眼', room:'sticker'|'flat'|'crayon', wrap:null|'crayon', build(uid) -> {defs, crop, seed:boolean, layers:{back, pre, front, post}, face:{eyes:[[x,y],[x,y]], eyeR:number, eyeStyle:'q'|'ham'|'gloss'|'dot'|'flat'|'crayon', mouth:[x,y], ink:string}}}` — layer strings contain the placeholders `<!--EYES-->` and `<!--MOUTH-->` inside the head group where eyes and mouth go, so head motion moves them.
  - `QJZ.pets.expr.eyes(face, expression, uid) -> svg` with expressions `open` (skin's own look), `happy`, `closed`, `sleepy`, `angry`, `surprised`; `QJZ.pets.expr.mouth(face, mouth) -> svg` with `neutral` (skin's own look), `smile`, `open`, `chew`, `yawn`, `pout`. Task 9 implements `open`+`happy` and `neutral` (the prototype looks); Task 12 adds the rest.
  - `QJZ.pets.compose(id, view:'scene'|'petonly'|'avatar', opts:{state:'typing', expression:'open', mouth:'neutral', props:[]}) -> svg string` — `view` matches prototype `sceneSVG` / `petOnlySVG` / `avatarSVG`.
  - `QJZ.pets.list(kind) -> defs` in the order hamster `p0,p4,h2,s4,s5`, cat `p0,p4,s5`.
  - CSS classes kept from prototypes: `pawL pawR head squish puff blink look tail eyes-open eyes-happy`, root `.pet-svg` + `.happy`.
- [ ] **Step 1: Write failing tests** `pets.test.js`: for every id in `QJZ.pets.list('hamster').concat(QJZ.pets.list('cat'))` and every view, `compose` returns a string that parses with `DOMParser` as `image/svg+xml` without a `parsererror`, contains `class="pawL"` and `class="pawR"` (or `pawL` inside `post` for skins without front paws), contains `eyes-happy`, and no leftover `<!--EYES-->` / `<!--MOUTH-->`; `list('hamster').length===5`, `list('cat').length===3`; two `compose` calls produce different ids (no duplicate `id=` across two SVGs).
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement the files** (one skin per file; shared helpers in `common.js`).
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Verify visually** — `pets-gallery.html` renders all 8 skins in the three views next to `docs/prototypes/converge.html`; screenshot both and confirm they match (P0 hamster = the 修改後 version, no teeth).
- [ ] **Step 6: Commit** — `feat(pets): slot-based renderer with 8 skins`.

---

### Task 10: Layouts U1, U3, U5-B, U7, M3 and switching

**Files:**
- Create: `src/web/js/ui/layouts.js`, `src/web/css/layouts.css`
- Modify: `src/web/index.html`, `src/web/js/ui/app.js`

**Interfaces:**
- Consumes: `QJZ.app` (Task 8), `QJZ.pets.compose` (Task 9), host messages `setLayout`, `hitRects`, `dragStart`, `contextMenu`, `menu` (Tasks 6–7).
- Produces `QJZ.layouts`: `show(name: 'U1'|'U3'|'U5B'|'U7'|'M3'|'PANEL')`, `current()`. Each layout's markup and CSS follow `docs/prototypes/converge.html` (U1, U3, U5-B, U7, M3). After rendering it measures its root and sends `setLayout {layout, width, height}` (include the 7px shadow), then sends `hitRects` for every `[data-hit]` element (re-sent when bubbles/menus appear or on resize).
  - Data bindings for all layouts: date `YYYY/MM/DD（三）`, clock `HH:MM:SS`, status text `上班中 / 午休中 / 可以下班 / 已下班 / 還沒上班 / 休假日`, odometer amount, `+0.08` floats each second, progress % and 距離下班 `HH:MM:SS`, 已上班, item conversion rotating every 4 s, 本月累計, 心情 hearts and 體力 bolts, snack count with a 餵食 button (U1, U3, U5-B; U7/M3 via menu).
  - `settings.layout.current` always holds the last *main* layout (U1/U3/U5B/U7); M3 and PANEL are temporary and never stored there. App start shows `settings.layout.start`.
  - Interactions: mousedown on non-button areas → `dragStart`; right-click anywhere → `contextMenu`; double-click M3 → `show(settings.layout.current)`; `menu {action}` handling for every action id from Task 7.
  - Milestone crossing → `QJZ.fx.confetti` + `QJZ.sound.coin()` + snack +1 (via `QJZ.rewards`).
- [ ] **Step 1: Implement** the five layouts and wiring (no automated test; covered by Step 2–3 verification and Task 5/8 logic tests).
- [ ] **Step 2: Verify in the browser** (`dev.html?layout=U1` etc.) — each layout matches its prototype in `converge.html` with live data; status text changes correctly when the dev clock is set to 12:30 (午休中) and 18:00 (可以下班) via `dev.html?now=HH:MM`.
- [ ] **Step 3: Verify in the app** — `.\build.ps1`, run: starts in U1; menu → each layout switches, window resizes to fit, U7/M3 float transparent and on top, clicks pass through transparent areas, dragging moves the window, positions are remembered after restart.
- [ ] **Step 4: Commit** — `feat(web): layouts U1 U3 U5-B U7 M3 with switching`.

---

### Task 11: Panels — onboarding, settings, history, early-leave question

**Files:**
- Create: `src/web/js/ui/panels.js`, `src/web/css/panels.css`
- Modify: `src/web/js/ui/layouts.js` (`PANEL` layout), `src/web/js/ui/app.js`

**Interfaces:**
- Consumes: `QJZ.settings.validateSalary`, `QJZ.history.monthDays/monthTotals`, `QJZ.pets.compose(..., 'avatar')`, `QJZ.app` actions, host messages `setAutostart`, `setCaptureGuard`, `setHotkey`, `setTopmost`.
- Produces `QJZ.panels.open('onboarding'|'settings'|'history')`, `QJZ.panels.close()` (returns to the previous layout). A1-styled panel (≈400×640) shown through layout `PANEL`.
  - Onboarding (when `settings.salary.amount===0` or `!onboarded`): 薪資方式 月薪/時薪, 金額 (validated, error text from `validateSalary` under the field), 日薪除數 22/30, pick pet (avatars of all 8 skins), then 開始.
  - Settings sections exactly as spec §5.3: 薪資, 工時 (每日工時, 午休起訖), 起算 (自動/手動, 工作日 checkboxes, 今天休假, 調整今天起算時間), 寵物 (8 skin previews + names), 版型 (預設版型, 置頂), 動力加成 (里程碑金額, 物品清單 add/remove/edit), 音效 (開關 default off, 音量), 開機自動啟動, 隱私 (分享螢幕時隱形, 快速隱藏快捷鍵). Changes apply immediately and persist.
  - History: this month's daily bar chart (bars in `#FFC857` with `#3D2C24` outline), 本月合計, previous months' totals list.
  - Early-leave question (from `state.pendingQuestion`): pet avatar + 「昨天是不是 16:02 就下班了？」 with buttons 「對，用那個時間」/「沒有，照原本的算」 → `QJZ.day.resolveEarlyLeave`.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser** — first load with empty storage shows onboarding; entering `abc` shows 請輸入數字 and blocks 開始; `50,000` accepted; every settings control persists across reload; history panel shows seeded data (`dev.html?seed=history`); `dev.html?seed=earlyleave` shows the question and both answers update the record.
- [ ] **Step 3: Verify in the app** — autostart toggle adds/removes the HKCU Run value (`reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v 錢進中`); capture toggle takes effect; hotkey change works.
- [ ] **Step 4: Commit** — `feat(web): onboarding, settings, history, early-leave panels`.

---

### Task 12: Pet state art — prototype page and USER REVIEW GATE

**Files:**
- Create: `src/web/pet-states.html`
- Modify: `src/web/js/pets/expressions.js`, skin files, `src/web/js/pets/compose.js`, `src/web/css/pets.css`

**Interfaces:**
- Consumes: Task 9 contracts.
- Produces: full expression/mouth sets (Task 9 list) and states for `compose(..., {state})`:
  `idle` (發呆), `doze` (打瞌睡), `typing`, `stretch` (伸懶腰), `yawn` (打哈欠), `coffee` (喝咖啡), `stare` (盯螢幕), `scratch` (抓頭), `sprint` (衝刺：快打字＋汗/火), `lunchSleep` (趴桌睡 Zzz), `lunchEat` (吃便當), `celebrate` (跳＋彩帶), `waitBag` (背包包等你), `petted` (開心＋愛心), `angry` (鼓臉冒煙), `eat` (吃零食：貓小魚乾、鼠瓜子), `hop` (里程碑跳一下), `dangle` (被拎起來晃，U7 拖曳時).
  Poses = transforms of existing layer groups + expression/mouth swaps + prop overlays; `lunchSleep` and `dangle` may need new body drawings per skin.
- [ ] **Step 1: Implement all states for all 8 skins**; `pet-states.html` shows a grid (rows = skins, columns = states) of animated `petonly` views on the U7 desktop background, each cell clickable to enlarge.
- [ ] **Step 2: Self-check** — open the page, screenshot each row, fix anything broken (clipped parts, missing eyes, wrong skin colours).
- [ ] **Step 3: Commit** — `feat(pets): all state poses for review`.
- [ ] **Step 4: GATE — stop and ask the user to review** `pet-states.html` (serve `src/web` and give the URL). Apply requested changes, re-show, and continue to Task 13 only after the user says the states are OK.

---

### Task 13: Behaviour engine — moods, interactions, speech

**Files:**
- Create: `src/web/js/core/mood.js`, `src/web/js/pets/behavior.js`, `src/web/js/pets/lines.js`, `tests/web/mood.test.js`, `tests/web/behavior.test.js`
- Modify: `src/web/js/ui/layouts.js`, `src/web/js/ui/app.js`, `tests/web/run.html`

**Interfaces:**
- Consumes: Task 12 states; `QJZ.app` events; host `dragStart`/`dragEnd`.
- Produces:
  - `QJZ.mood`: `initial() -> {energy:100, mood:70}`; `tick(m, dtSec, status) -> m` — `working`: energy −60/28800 per s (100→40 over 8 h); `lunch`: energy +30/3600 per s; mood drifts toward 50 by 10/h; all values clamped 0–100; `pet(m)` mood +5; `feed(m)` mood +15, energy +10; `hearts(m) -> 0..5` (`round(mood/20)`); `bolts(m) -> 0..5` (`round(energy/20)`).
  - `QJZ.behavior`: `base(status, minutesToEnd) -> state` (`before`→`idle`, `working`→`typing` or `sprint` when `minutesToEnd ≤ 30`, `lunch`→`lunchSleep`, `done`/`ended`→`celebrate` for 8 s then `waitBag`); `pickIdle(m, rng) -> state|null` — every 20–60 s while working pick one of `stretch|yawn|coffee|stare|scratch` for 3–5 s, `yawn` weight ×3 when `energy < 40`; `Poker` with `poke(nowMs) -> 'petted'|'angry'` (5 pokes within 2000 ms → `angry` for 4 s, mood −5).
  - `QJZ.lines.pick(state, ctx:{name, kind, minutesToLunch, minutesToEnd, earned, rng}) -> string` — at least 5 lines per base state, cat lines end with 喵 often, hamster with 吱; includes time-aware lines (「再 {n} 分鐘就午休了！」) and money lines (「已經賺到 {item} 了！」); `waitBag` lines include 「可以走了！」.
- [ ] **Step 1: Write failing tests** — `mood.test.js`: 8 h of `working` ticks from 100 → `near(energy, 40, 0.5)`; 1 h `lunch` from 40 → 70; clamp at 100 after feeding at 95; `hearts({mood:70})===4`. `behavior.test.js`: `base('working', 31)==='typing'`, `base('working', 30)==='sprint'`, `base('lunch',0)==='lunchSleep'`; poker: four pokes → `petted`, fifth within 2 s → `angry`, poke after 5 s → `petted`; `pickIdle` with seeded rng returns only allowed states; every base state has ≥5 lines and `pick` never returns an unfilled `{` placeholder.
- [ ] **Step 2: Run `.\test.ps1`** — expected FAIL.
- [ ] **Step 3: Implement**, then wire into layouts: state changes re-compose the pet (keep the same DOM node, swap SVG only when state changes), speech bubbles every 7–15 s and on events, feed button consumes a snack and plays `eat`, U7 `dragStart` → `dangle` until `dragEnd`, milestone → `hop`, sounds via `QJZ.sound` (`meow`/`squeak` on pet, `jingle` on 可以下班).
- [ ] **Step 4: Run `.\test.ps1`** — expected PASS.
- [ ] **Step 5: Verify in the app** — with `dev.html?now=` at 09:00, 11:45, 12:30, 17:10, 18:00 the pet shows typing, typing with idle actions, lunch sleep, sprint, celebrate→waitBag; poking fast makes it angry; feeding decrements snacks.
- [ ] **Step 6: Commit** — `feat(pets): behaviour engine, moods, interactions, lines`.

---

### Task 14: Single-exe packaging, user guide, end-to-end verification

**Files:**
- Create: `src/host/Payload.cs`, `docs/使用說明.md`
- Modify: `build.ps1` (`-Release`), `src/host/WebRoot.cs`, `src/host/Program.cs`

**Interfaces:**
- Consumes: everything above.
- Produces: `.\build.ps1 -Release` → `build\錢進中.exe` alone (no DLLs beside it). Resources embedded: `web.zip` (all of `src/web` + fonts), `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`, `x64/WebView2Loader.dll`, `x86/WebView2Loader.dll`. `Payload.Ensure() : string` extracts to `%LocalAppData%\錢進中\app\<first 12 hex of SHA-256 of web.zip>\` (skip when present; delete older hash folders), sets the loader folder, and `AppDomain.AssemblyResolve` loads the two managed DLLs from resources. `WebRoot.Resolve()` returns the extracted `web` folder when no dev root exists.
- [ ] **Step 1: Implement** `Payload.cs` and the release build.
- [ ] **Step 2: Verify packaging** — copy `build\錢進中.exe` alone to an empty folder, run it: app works; `%LocalAppData%\錢進中\app\<hash>\` exists; second run starts without re-extracting.
- [ ] **Step 3: Write `docs/使用說明.md`** (Traditional Chinese): what it is, first run (SmartScreen 「其他資訊 → 仍要執行」), WebView2 requirement and link, where data lives (`%AppData%\錢進中`), how to turn off autostart, hide hotkey and capture protection, how to uninstall (關閉程式、刪除 exe、刪除 `%AppData%\錢進中` 與 `%LocalAppData%\錢進中`、設定裡關閉開機啟動).
- [ ] **Step 4: End-to-end checklist on this Win11 machine** — record results in the commit message body:
  - fresh profile (rename `%AppData%\錢進中`) → onboarding → enter 50000 → amount ticks;
  - sign out and back in → autostarts, start time = logon time; lock 1 min, unlock → start unchanged;
  - adjust start to 08:30 → 可以下班 time shows 17:30;
  - 下班 button → amount stops, status 已下班;
  - every layout + every skin renders; U7 click-through works over desktop icons;
  - Teams/Snipping Tool capture does not show the window; Ctrl+Alt+H toggles;
  - corrupt `settings.json` by hand (`{bad`) → app starts with defaults and a `.corrupt-*` copy exists;
  - CPU: show only U7 for 2 minutes, sum `TotalProcessorTime` deltas of `錢進中` + its `msedgewebview2` children / (120 s × logical CPUs) < 3%.
- [ ] **Step 5: Commit** — `feat: single-exe release build and user guide`.
