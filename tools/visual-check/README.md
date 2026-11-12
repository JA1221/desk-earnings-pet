# Visual checks for PetWindow

Scripted on-screen checks for the transparent, click-through `PetWindow`. They capture the real screen and
send real mouse input. Results and the method are written up in `docs/spikes/transparency.md`.

| File | What it does |
|---|---|
| `spiketool.cs` | Helper exe (per-monitor-v2 aware, physical px). It can open a busy-pattern backdrop window that logs the clicks it receives, capture the screen, click, drag, hover, and inspect or move windows (`hittest`, `info`, `find`, `above`, `settop`, …). Run it without arguments for usage. |
| `common.ps1` | Dot-sourced helpers. It builds `spiketool.exe` into `build\visual-check\` the first time and again whenever `spiketool.cs` changes, and it starts and stops the backdrop and `build\錢進中.exe --spike`. |
| `verify.ps1` | One full pass against `src/web/spike.html`. It checks the window size against `-Scale`, captures the window over the backdrop, then clicks transparent, semi-transparent and opaque points (it reports which window got each click). Then it drags the card and toggles topmost with the page button. Output goes to `build\visual-check\runs\<Tag>\` (`result.txt`, PNGs). |
| `analyze.py` | Per-pixel numbers for a run: changed pixels in transparent and opaque regions, and a glow fit that tells true alpha from a colour-key fringe. It also writes zoomed crops. Needs Python 3 with Pillow and numpy. |

## Run

```powershell
.\build.ps1                                             # builds build\錢進中.exe
.\tools\visual-check\verify.ps1 -Tag t100               # 100 % monitor, defaults: backdrop 200,150 1000x600, pet at 400,300
.\tools\visual-check\verify.ps1 -Tag t150 -BdX -1060 -BdY 100 -BdW 1000 -BdH 900 -PetX -1000 -PetY 200 -Scale 1.5 -DragDY 150
python -I tools\visual-check\analyze.py build\visual-check\runs\t100 200 150 1.0 build\visual-check\runs\t100 t100
```

`-Scale` is the page DPR you expect (monitor scale × any page zoom). The coordinates above are for this
machine's monitors, so pick a backdrop and pet position inside one monitor of yours.

## Before running

- **The capture guard must be off** (Task 7: `privacy.hideFromCapture` / `SetWindowDisplayAffinity`). With it
  on, the pet is excluded from screen captures and every capture-based check reports a false "transparent".
- The session must be **unlocked**. While locked, captures show the lock screen. Do not send input then either: it would go to the lock screen.
- The scripts move the real cursor for about 30 s per pass (they put it back afterwards). Do not use the mouse while they run.
- Never change Windows display settings (scaling, Text size, …) for a check. Use a monitor that already has
  the scale you need, or page zoom (`WebView2.ZoomFactor` in a temporary dev build) for a non-1 DPR.
- The test points in `verify.ps1` and the regions in `analyze.py` are `spike.html` CSS coordinates. Adapt them for other pages.
- `Stop-All` only kills the backdrop and `--spike` instances, never a normal 錢進中 run.
