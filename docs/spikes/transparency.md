# Transparency spike (Task 2): per-pixel transparent, click-through pet window

**Result: GO.** On this machine, a borderless WebView2 window shows the desktop through every transparent
page pixel with true per-pixel alpha (no colour-key fringe). Clicks outside the page's hit rects reach the
window behind. Clicks inside them reach the page.

Machine: Windows 11 Pro 10.0.26100, WebView2 SDK 1.0.4191.47, .NET Framework 4.8 (csc C# 5), three monitors:
primary 1920×1080 at 100 % (96 dpi), a second 1920×1080 at 100 %, and a portrait 1080×1920 at **150 % (144 dpi)**.
The 150 % monitor was used as-is, so no display setting was changed.

## Final mechanism (`src/host/PetWindow.cs`)

| Part | How |
|---|---|
| Frame | `FormBorderStyle.None`, `ShowInTaskbar = false`, `AutoScaleMode.None`. |
| Rendering | `DwmEnableBlurBehindWindow` with an **empty** region (`CreateRectRgn(0,0,-1,-1)`, `fEnable = true`). This adds no blur, but DWM now composes the window surface with its alpha channel. The form's GDI background is **black** (GDI writes alpha 0, so black is fully transparent). WebView2 has `DefaultBackgroundColor = Transparent`, and its DirectComposition content is blended on top with its own alpha. |
| Click-through | The window is created `WS_EX_LAYERED` with `SetLayeredWindowAttributes(alpha 255, LWA_ALPHA)`. That renders identically, but it makes `WS_EX_TRANSPARENT` count for hit-testing. A 33 ms WinForms timer (about 30 Hz) checks `GetCursorPos` against the hit rects: outside every rect it sets `WS_EX_TRANSPARENT`, so the whole window, WebView2 child windows included, is skipped. Inside a rect it clears the flag. The timer runs only while the window is visible. |
| Hit rects | `SetHitRects(RectangleF[])` takes CSS-pixel rects, which are scaled by `GetDpiForWindow / 96` at test time. With no rects set (before the page reports any), the whole window clicks through. |
| Size / DPI | `SetContentSize(cssW, cssH)` sets the size to CSS size × DPI scale. `WM_DPICHANGED` keeps the suggested position but re-sizes from the stored CSS size. |
| Drag | `BeginDrag()` is deferred with `BeginInvoke` so the WebView2 event handler returns first. It does nothing if the primary button is already up (`GetAsyncKeyState`, honours swapped buttons), so the window can't stick to the cursor. Otherwise it calls `ReleaseCapture` + `WM_NCLBUTTONDOWN/HTCAPTION`. |
| Topmost | `TopMostEnabled` maps to `Form.TopMost`. |

Dev harness: `build\錢進中.exe --spike` opens `src/web/spike.html` in a `PetWindow`.
`Program.cs` wires a tiny string protocol for it: page → host `size W H`, `hits x y w h|…`, `drag`, `topmost`;
host → page `topmost 1|0`. Task 7 replaces this wiring.
The page contains an A1 sticker card (28 px radius, 3 px `#3D2C24` border, 7 px hard shadow), the P0 hamster
(`petOnlySVG('p0','hamster')`, outlined), the S4 hamster (no outlines), a soft radial glow (alpha 0.95 → 0),
and a fading `+NT$0.42` floater. Nothing sits behind any of them.

## Approaches tried

1. **A: colour key** (`TransparencyKey = BackColor = RGB(61,44,37)` + `WS_EX_TRANSPARENT` poll). Committed as WIP a966317.
   - Rendering: **perfect, true per-pixel alpha**, not a colour-key blend. DWM keys out the form's GDI surface
     and then composes the WebView2 DirectComposition visual with its own alpha. The glow fits
     "alpha over the real background" with mean error 0.24/255, against 39.2 for "alpha over the key colour".
     Measured glow alpha matches the CSS gradient at every radius (0.94/0.95, 0.52/0.52, 0.14/0.14).
   - Hit-testing: **fails**. Win32 hit-tests a colour-keyed layered window against its GDI surface, and that
     surface is the key colour everywhere (the page lives in a cross-process DirectComposition child that
     paints nothing in GDI). Every pixel counts as keyed, so clicks always fall through, even on the opaque card
     with `WS_EX_TRANSPARENT` cleared (`WindowFromPoint` returned the window behind). Pet click, card drag and
     the topmost button were unreachable. Painting the hit rects in a non-key colour would show as visible
     boxes wherever the page is transparent inside a rect, so it is not a fix.
2. **C: DWM blur-behind** (non-layered window, `WS_EX_TRANSPARENT` poll as in the brief).
   - Rendering: perfect, with the same per-pixel results as A.
   - Hit-testing: the hit areas work, but `WS_EX_TRANSPARENT` alone does nothing on a non-layered top-level
     window. The gap between card and pet still hit the WebView2, so nothing clicked through.
3. **C + layered alpha 255 (final).** Adding `WS_EX_LAYERED` with constant alpha 255 to C keeps C's rendering
   (verified: identical captures with and without `WS_EX_TRANSPARENT`), and `WS_EX_TRANSPARENT` now makes the
   whole window skip hit-testing.
   - Side checks: layered alpha 255 **without** blur-behind renders the transparent areas solid black, so
     blur-behind is required. A variant that switched `LWA_COLORKEY` ↔ `LWA_ALPHA` per state also worked, but
     it added nothing over a constant `LWA_ALPHA`, so it was dropped.
4. **B: visual hosting** (`CoreWebView2CompositionController` + DirectComposition). Not tried, because approach 3 works.

## Verification (approach 3)

Method: a scripted helper (per-monitor-v2 aware, all coordinates physical) opens a borderless "backdrop" window
showing a synthetic busy wallpaper (noise, stripes, rings, blocks). The script captures it, starts
`錢進中.exe --spike` topmost over it, and captures again (BitBlt + CAPTUREBLT from the screen). It then compares
the two captures pixel by pixel, sends real mouse clicks (`SetCursorPos` + `mouse_event`) and logs which window
received each click (the backdrop logs its own `MouseDown`s, and the foreground window is read back). It also
drags the card and toggles topmost with the page button. The real desktop could not be used: it was covered by
the user's maximized windows, and their windows were not minimized. Hit-testing does not care which window is
behind, though. One extra capture landed over a real Chrome window and looks the same.

| Check | 100 % (96 dpi) | 150 % (144 dpi) |
|---|---|---|
| Window size from page (520×340 CSS) | 520×340 | 780×510, page reports DPR 1.5 |
| Transparent regions (5 boxes) vs background | 0 changed pixels of 21 910 | 0 changed pixels of 49 560 |
| Opaque regions (card, belly) | all changed | all changed |
| Glow fringe fit: over-background / over-key | 0.24 / 39.2 → true alpha | 0.24 / 41.0 → true alpha |
| Click in gap card↔pet (outside hit rects) | **reached the window behind** (backdrop logged it, became foreground) | same |
| Click in empty corner (outside hit rects) | **reached the window behind** | same |
| Click on semi-transparent glow (outside hit rects) | **reached the window behind** | same |
| Click on transparent corner *inside* the P0 hit rect | page (expected: hit rects are rectangles) | page |
| Click on pet body | page; pet switched to happy eyes | same |
| Click on card | page; window became foreground | same |
| Drag card by (+200,+100) / (+200,+150) px | window moved exactly by that offset | same |
| Topmost on → activate backdrop | pet stays above (WS_EX_TOPMOST set) | same |
| Topmost off → activate backdrop | backdrop covers the pet (flag cleared) | same |

DPI changes: `SetWindowPos` onto the 150 % monitor gives 520×340 → 780×510, and moving back gives 520×340.
Dragging the card from the 100 % monitor onto the 150 % monitor and back (`WM_DPICHANGED` inside the move loop)
gives 520×340 @96 → 780×510 @144 → 520×340 @96. The page re-renders crisply at DPR 1.5.

CPU (30 s, spike page visible with its continuous paw, bob, blink and floater animations, 12 logical cores):
host `錢進中.exe` 0.02 % of the machine (0.3 % of one core: the 30 Hz poll); host + its 7 WebView2 processes
0.81 % of the machine (9.7 % of one core). The 3 % budget is for U7 only, so the real layouts must be
re-measured in their own tasks.

Evidence: everything is in `.superpowers/sdd/2026-11-11-qianjinzhong/`, which is git-ignored, so the files stay on this machine.
- `task-2-100-over-wallpaper.png`, `task-2-150-over-wallpaper.png`: the window over the busy wallpaper (the 150 % one is mid-blink).
- `task-2-{100,150}-zoom-glow-s4.png`, `-zoom-p0-ear.png`, `-zoom-card-corner.png`: 3–4× crops of un-outlined edges (S4, glow), outlined edges (P0 ear) and the card corner with its hard shadow.
- `task-2-{100,150}-pet-clicked-happy.png`: after clicking the pet.
- `task-2-{100,150}-after-drag.png`, `task-2-100-topmost-on.png`, `task-2-{100,150}-topmost-off-covered.png`.
- `task-2-cross-monitor-drag-150.png`: after the drag onto the 150 % monitor, over a real browser window.
- `task-2-A-colorkey-over-wallpaper.png`: approach A, which renders just as well but could not be clicked.

## Known limits / notes for later tasks

- **No fringe on any edge.** Outlined (P0), un-outlined (S4), soft glow and the fading text all blend with true
  alpha. The "key ≈ outline colour" trick is not needed, and art does not need outlines for transparency's sake.
- **Hit areas are rectangles.** Transparent pixels inside a hit rect (for example the corners of the pet's box)
  take the click. Pages should report tight rects (several per pet if needed) and leave bubbles and floaters
  out unless they are meant to be clickable.
- **Poll latency is up to 33 ms.** A click within about one tick of crossing a rect edge can go to the other
  window. Hover and `mousemove` reach the page only while the cursor is inside a hit rect.
- **Clicking the pet activates the window** and takes keyboard focus from the user's app. `WS_EX_NOACTIVATE`
  would avoid this but breaks typing in panels; that is a decision for Task 7 or 10.
- **Do not paint GDI on `PetWindow`** (keep `BackColor` black). Under blur-behind any non-black GDI pixel has
  alpha 0 and would show up as an additive colour cast.
- **Windows 10 is untested** (no Win10 machine). The APIs used exist there (`DwmEnableBlurBehindWindow` Vista+,
  DirectComposition children of layered windows Win8+, `GetDpiForWindow` 1607+), but the combination is only
  proven on this Win11 build.
- **Capture protection is untested here.** `SetWindowDisplayAffinity` (Task 7) on this layered window still
  needs its own check.
- Only 100 % and 150 % were tested, on real monitors. Other scales (125 %, 175 %) use the same code path.
