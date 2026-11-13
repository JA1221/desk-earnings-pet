using System;
using System.Drawing;

public static class WindowPlacerTests
{
    static readonly Rectangle Primary = new Rectangle(0, 0, 1920, 1032);
    static readonly Rectangle Right = new Rectangle(1920, 0, 1920, 1032);
    static readonly Rectangle Left = new Rectangle(-1080, -445, 1080, 1848);   // 150 % portrait
    static readonly Rectangle[] Areas = { Primary, Right, Left };

    public static void Test_SavedPositionOnScreenIsKept()
    {
        bool hostChosen;
        Rectangle r = WindowPlacer.Decide(new Point(100, 200), null, new Size(380, 640), Areas, Primary, out hostChosen);
        Assert.Eq(new Rectangle(100, 200, 380, 640), r, "the user's spot");
        Assert.True(!hostChosen, "user's spot");
        // half inside (the user left it hanging over an edge): still the user's spot
        r = WindowPlacer.Decide(new Point(1700, 100), null, new Size(400, 300), new[] { Primary }, Primary, out hostChosen);
        Assert.Eq(new Rectangle(1700, 100, 400, 300), r, "55 % inside is kept");
        Assert.True(!hostChosen, "still the user's spot");
    }

    public static void Test_SavedPositionOnGoneMonitorIsClamped()
    {
        bool hostChosen;
        Rectangle r = WindowPlacer.Decide(new Point(9000, 300), null, new Size(520, 340), new[] { Primary }, Primary, out hostChosen);
        Assert.Eq(new Rectangle(1400, 300, 520, 340), r, "moved fully inside the remaining area");
        Assert.True(hostChosen, "host moved it");
        r = WindowPlacer.Decide(new Point(-5000, 800), null, new Size(780, 510), Areas, Primary, out hostChosen);
        Assert.Eq(new Rectangle(-1080, 800, 780, 510), r, "far left: into the left monitor");
    }

    public static void Test_NoSavedPositionKeepsTheWindowWhereItIs()
    {
        bool hostChosen;
        Rectangle r = WindowPlacer.Decide(null, new Point(1400, 400), new Size(700, 160), Areas, Primary, out hostChosen);
        Assert.Eq(new Rectangle(1220, 400, 700, 160), r, "current spot, moved fully inside its monitor (centre on the primary)");
        Assert.True(hostChosen, "host chose it");
        r = WindowPlacer.Decide(null, new Point(-900, 100), new Size(780, 510), Areas, Primary, out hostChosen);
        Assert.Eq(new Rectangle(-900, 100, 780, 510), r, "already inside the left monitor");
    }

    public static void Test_FirstEverPositionIsPrimaryBottomRight()
    {
        bool hostChosen;
        Rectangle r = WindowPlacer.Decide(null, null, new Size(520, 340), Areas, Primary, out hostChosen);
        Assert.Eq(new Rectangle(1920 - 520 - WindowPlacer.DefaultMargin, 1032 - 340 - WindowPlacer.DefaultMargin, 520, 340), r, "bottom-right, margin in");
        Assert.True(hostChosen, "host chose it");
        r = WindowPlacer.Decide(null, null, new Size(3000, 2000), Areas, Primary, out hostChosen);
        Assert.Eq(Primary, r, "a window larger than the area fills it");
    }

    // The hidden window starts where the start layout will appear, so the page loads at that monitor's DPR.
    public static void Test_StartBoundsUseTheSavedSpotOfTheStartLayout()
    {
        Rectangle r = WindowPlacer.StartBounds(new Point(-1000, 420), new Size(300, 300), Areas, Primary);
        Assert.Eq(new Rectangle(-1000, 420, 300, 300), r, "on the 150 % monitor, as saved");
        r = WindowPlacer.StartBounds(new Point(-5000, 800), new Size(300, 300), Areas, Primary);
        Assert.Eq(new Rectangle(-1080, 800, 300, 300), r, "a gone monitor: clamped like Place does");
    }

    public static void Test_StartBoundsWithoutSavedSpotIsPrimaryBottomRight()
    {
        // first-ever run: the same spot as Decide's fallback, so the hidden window is not left where CenterScreen
        // (under the cursor, maybe on another-DPI monitor) would put it
        Rectangle r = WindowPlacer.StartBounds(null, new Size(300, 300), Areas, Primary);
        Assert.Eq(new Rectangle(1920 - 300 - WindowPlacer.DefaultMargin, 1032 - 300 - WindowPlacer.DefaultMargin, 300, 300), r, "primary bottom-right, margin in");
        bool hostChosen;
        Assert.Eq(WindowPlacer.Decide(null, null, new Size(300, 300), Areas, Primary, out hostChosen), r, "same as the Decide fallback");
    }

    public static void Test_RefitAfterDpiChange()
    {
        // landed on the 150 % monitor and grew to 780x510, now hanging below its work area (bottom 1403)
        Rectangle grown = new Rectangle(-900, 1063, 780, 510);
        Assert.Eq(new Rectangle(-900, 893, 780, 510), WindowPlacer.Refit(grown, true, Areas), "a host-chosen spot stays fully inside");
        Assert.Eq(grown, WindowPlacer.Refit(grown, false, Areas), "the user's spot only gets the 50 % rule (67 % inside)");
        Rectangle mostlyOut = new Rectangle(-900, 1300, 780, 510);
        Assert.Eq(new Rectangle(-900, 893, 780, 510), WindowPlacer.Refit(mostlyOut, false, Areas), "user's spot under 50 % inside is clamped");
    }

    // Grow-inside (spec 5.7): a window that grows keeps its top-left and grows right / down; one that was fully inside
    // its work area and would now stick out is pushed back in.
    public static void Test_FitAfterGrow_PushesBackInside()
    {
        Assert.Eq(new Rectangle(1375, 900, 545, 120), WindowPlacer.FitAfterGrow(new Rectangle(1440, 900, 480, 120), new Size(545, 120), Areas),
            "U5-B 65 px wider at the right edge: pushed left, not onto the next monitor");
        // DISPLAY1 (150 %): U5-B saved flush against the right edge at its 1.0 width, 455 CSS px = 683 px, now 780 px
        Assert.Eq(new Rectangle(-780, 700, 780, 510), WindowPlacer.FitAfterGrow(new Rectangle(-683, 700, 683, 510), new Size(780, 510), Areas),
            "portrait monitor at negative coordinates");
    }

    public static void Test_FitAfterGrow_FitsAsIs()
    {
        Assert.Eq(new Rectangle(100, 900, 545, 120), WindowPlacer.FitAfterGrow(new Rectangle(100, 900, 480, 120), new Size(545, 120), Areas),
            "room to grow: the top-left stays");
        Assert.Eq(new Rectangle(1440, 900, 300, 100), WindowPlacer.FitAfterGrow(new Rectangle(1440, 900, 480, 120), new Size(300, 100), Areas),
            "smaller: the top-left stays");
    }

    public static void Test_FitAfterGrow_KeepsAnOverhangTheUserChose()
    {
        Assert.Eq(new Rectangle(1700, 100, 465, 300), WindowPlacer.FitAfterGrow(new Rectangle(1700, 100, 400, 300), new Size(465, 300), Areas),
            "already over the edge before it grew: left where the user put it");
        Assert.Eq(new Rectangle(1700, 100, 465, 300), WindowPlacer.FitAfterGrow(new Rectangle(1700, 100, 400, 300), new Size(465, 300), new[] { Primary }),
            "the same with no monitor beside it");
    }

    public static void Test_FitAfterGrow_Bottom()
    {
        Assert.Eq(new Rectangle(100, 832, 300, 200), WindowPlacer.FitAfterGrow(new Rectangle(100, 900, 300, 120), new Size(300, 200), Areas),
            "taller at the bottom: pushed up above the taskbar");
    }

    // A prompt grew the window and pushed it in; when it shrinks back it returns to where it was, unless the user
    // moved it meanwhile.
    public static void Test_AfterShrink()
    {
        Assert.Eq(new Point(1440, 900), WindowPlacer.AfterShrink(new Point(1375, 900), new Point(1440, 900), new Point(1375, 900)), "back to the spot before the push");
        Assert.Eq(new Point(1200, 500), WindowPlacer.AfterShrink(new Point(1200, 500), new Point(1440, 900), new Point(1375, 900)), "the user moved it: stays");
        Assert.Eq(new Point(1200, 500), WindowPlacer.AfterShrink(new Point(1200, 500), null, null), "never pushed: stays");
    }

    // Same-layout size changes while a prompt shows (U7 / M3 grow right): a partial shrink of a pushed window stays
    // inside (worked out from where it was pushed from), a second grow pushes further, and the full shrink goes back.
    public static void Test_ResizeInside_GrowPartialShrinkFullShrink()
    {
        Rectangle? from = null;
        Point? to = null;
        Point at = WindowPlacer.ResizeInside(new Rectangle(1440, 900, 480, 120), new Size(545, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1375, 900), at, "grow: pushed in");
        Assert.Eq((Rectangle?)new Rectangle(1440, 900, 480, 120), from, "pushed from the window as it was");
        Assert.Eq((Point?)new Point(1375, 900), to, "pushed to");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(545, 120)), new Size(520, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1400, 900), at, "partial shrink, still wider than before the grow: only as far in as needed, not back to 1440");
        Assert.True(Primary.Contains(new Rectangle(at, new Size(520, 120))), "still fully inside");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(520, 120)), new Size(600, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1320, 900), at, "grows again: pushed further");
        Assert.Eq((Rectangle?)new Rectangle(1440, 900, 480, 120), from, "still the first spot");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(600, 120)), new Size(480, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1440, 900), at, "full shrink: back where it was");
        Assert.True(!from.HasValue && !to.HasValue, "nothing outstanding");
    }

    public static void Test_ResizeInside_PartialShrinkThatFitsUnpushed()
    {
        Rectangle? from = null;
        Point? to = null;
        Point at = WindowPlacer.ResizeInside(new Rectangle(1400, 900, 480, 120), new Size(545, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1375, 900), at, "grow: pushed in by 25");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(545, 120)), new Size(500, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1400, 900), at, "fits at the old spot again: back there");
        Assert.True(!from.HasValue && !to.HasValue, "nothing outstanding");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(500, 120)), new Size(480, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1400, 900), at, "full shrink: stays");
        at = WindowPlacer.ResizeInside(new Rectangle(100, 900, 300, 120), new Size(300, 200), Areas, ref from, ref to);
        Assert.Eq(new Point(100, 832), at, "taller at the bottom: pushed up");
        at = WindowPlacer.ResizeInside(new Rectangle(at, new Size(300, 200)), new Size(300, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(100, 900), at, "and back down");
    }

    // Ruling S9: the user's own spot wins. Moved while grown: the shrink leaves it there, overhang and all; a grow from
    // an overhang the user chose keeps it.
    public static void Test_ResizeInside_KeepsWhatTheUserChose()
    {
        Rectangle? from = null;
        Point? to = null;
        Point at = WindowPlacer.ResizeInside(new Rectangle(1440, 900, 480, 120), new Size(545, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1375, 900), at, "pushed in");
        at = WindowPlacer.ResizeInside(new Rectangle(1600, 500, 545, 120), new Size(480, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(1600, 500), at, "dragged over the edge while grown: stays after the shrink");
        Assert.True(!from.HasValue && !to.HasValue, "the old push is forgotten");
        at = WindowPlacer.ResizeInside(new Rectangle(1700, 100, 400, 300), new Size(465, 300), Areas, ref from, ref to);
        Assert.Eq(new Point(1700, 100), at, "a grow from an overhang the user chose: kept");
        Assert.True(!from.HasValue && !to.HasValue, "not a push");
        at = WindowPlacer.ResizeInside(new Rectangle(100, 100, 480, 120), new Size(545, 120), Areas, ref from, ref to);
        Assert.Eq(new Point(100, 100), at, "room to grow: stays");
        Assert.True(!from.HasValue && !to.HasValue, "not a push");
    }

    // 1.1.1 (the user's own window.json): U1 on the left portrait monitor at 150 %, PANEL saved on the primary. A panel
    // opened from U1 used PANEL's own spot, so 設定 jumped to the other monitor. It now opens at the top-left of the
    // window it came from, moved fully inside that window's work area.
    public static void Test_PanelOpensBesideTheWindowItCameFrom()
    {
        Rectangle u1 = new Rectangle(-566, 501, 521, 914);   // saved {"x":-566,"y":501,"w":347,"h":609} at 150 %
        Size panel = new Size(611, 960);                    // 407 x 640 CSS px at 150 %
        Rectangle r = WindowPlacer.PanelBounds(u1, panel, Areas, Primary);
        Assert.Eq(new Rectangle(-611, 443, 611, 960), r, "beside U1, pushed in from the right edge and above the taskbar");
        Assert.True(Left.Contains(r), "on U1's monitor, not the primary where PANEL was saved (923, 364)");
        Rectangle u10 = new Rectangle(690, 914, 540, 112);   // U10 at bottomCenter on the primary (100 %)
        Assert.Eq(new Rectangle(690, 392, 407, 640), WindowPlacer.PanelBounds(u10, new Size(407, 640), Areas, Primary),
            "from U10 at the bottom: aligned left, lifted to fit above the taskbar");
        Assert.Eq(new Rectangle(300, 200, 407, 640), WindowPlacer.PanelBounds(new Rectangle(300, 200, 347, 593), new Size(407, 640), Areas, Primary),
            "room enough: exactly at the window's top-left");
    }

    public static void Test_PanelStaysOnTheMonitorOfTheWindowsCentre()
    {
        // a window hanging over the left monitor's right edge, its centre on the primary: the primary's panel
        Rectangle from = new Rectangle(-100, 100, 400, 300);
        Assert.Eq(new Rectangle(0, 100, 407, 640), WindowPlacer.PanelBounds(from, new Size(407, 640), Areas, Primary), "pushed onto the primary");
        // the other way round: centre on the left monitor
        from = new Rectangle(-300, 100, 400, 300);
        Assert.Eq(new Rectangle(-611, 100, 611, 960), WindowPlacer.PanelBounds(from, new Size(611, 960), Areas, Primary), "kept on the left monitor");
        // the window's monitor is gone: the nearest one that exists
        Assert.Eq(new Rectangle(1513, 300, 407, 640), WindowPlacer.PanelBounds(new Rectangle(5000, 300, 347, 593), new Size(407, 640), new[] { Primary }, Primary),
            "a gone monitor: the nearest work area");
        // a panel taller than the work area fills its height there
        Assert.Eq(new Rectangle(100, 0, 407, 1032), WindowPlacer.PanelBounds(new Rectangle(100, 500, 347, 593), new Size(407, 1500), Areas, Primary),
            "too tall: shrunk to the area");
    }

    // A first-ever start that opens with a panel (onboarding): no window to open beside, so the first-ever spot.
    public static void Test_PanelWithoutAWindowGoesWhereAFirstWindowGoes()
    {
        bool hostChosen;
        Assert.Eq(WindowPlacer.Decide(null, null, new Size(407, 640), Areas, Primary, out hostChosen),
            WindowPlacer.PanelBounds(null, new Size(407, 640), Areas, Primary), "primary bottom-right, margin in");
    }

    // The window a panel opens beside: the window as it is when a layout was shown (or the safety net showed one); at a
    // start that opens with a panel, the hidden window PrePlace put at the start layout's saved spot; none on a
    // first-ever start.
    public static void Test_PanelFrom()
    {
        Rectangle now = new Rectangle(-566, 501, 521, 914);
        Assert.Eq((Rectangle?)now, WindowPlacer.PanelFrom(true, false, now), "from a layout that showed");
        Assert.Eq((Rectangle?)now, WindowPlacer.PanelFrom(false, true, now), "the first layout is a panel: the start layout's saved spot");
        Assert.Eq((Rectangle?)null, WindowPlacer.PanelFrom(false, false, now), "first-ever start: nothing to open beside");
    }

    // PrePlace sizes the hidden window as the start layout will show (its saved CSS size at the scale of its monitor),
    // so the saved spot is kept or clamped exactly as Place will and the page loads on the monitor it shows on. With
    // the 300 x 300 default, U10 at bottomCenter was clamped 182 px up, and a spot near a monitor edge could be clamped
    // onto the next monitor.
    public static void Test_StartSizeIsTheSavedSizeAtItsMonitorsScale()
    {
        Assert.Eq(new Size(521, 914), WindowPlacer.StartSize(new Size(347, 609), 1.5, new Size(300, 300)), "U1 at 150 %");
        Assert.Eq(new Size(540, 112), WindowPlacer.StartSize(new Size(540, 112), 1.0, new Size(300, 300)), "U10 at 100 %");
        Assert.Eq(new Size(300, 300), WindowPlacer.StartSize(null, 1.5, new Size(300, 300)), "nothing saved: the window's own size");
        Assert.Eq(new Size(300, 300), WindowPlacer.StartSize(new Size(0, 609), 1.5, new Size(300, 300)), "an unusable size: the window's own size");
        Assert.Eq(new Size(347, 609), WindowPlacer.StartSize(new Size(347, 609), 0, new Size(300, 300)), "no scale known: 1");
        Rectangle u10 = WindowPlacer.StartBounds(new Point(690, 914), WindowPlacer.StartSize(new Size(540, 112), 1.0, new Size(300, 300)), Areas, Primary);
        Assert.Eq(new Rectangle(690, 914, 540, 112), u10, "the user's U10 at bottomCenter: exactly its spot");
    }

    // 1.1.2 item 1: every layout but U10 opens with its top-left at the one shared anchor.
    public static void Test_AtAnchor_EveryLayoutAtTheSameTopLeft()
    {
        Point a = new Point(-1000, 300);          // on DISPLAY1 (150 %)
        Size? set = new Size(521, 914);           // U1 was dropped there
        Assert.Eq(new Rectangle(-1000, 300, 521, 914), WindowPlacer.AtAnchor(a, set, new Size(521, 914), Areas), "U1 itself");
        Assert.Eq(new Rectangle(-1000, 300, 761, 603), WindowPlacer.AtAnchor(a, set, new Size(761, 603), Areas), "U3 fits: the same top-left");
        Assert.Eq(new Rectangle(-1000, 300, 263, 263), WindowPlacer.AtAnchor(a, set, new Size(263, 263), Areas), "M3: the same top-left");
        Assert.Eq(new Rectangle(-1000, 300, 611, 960), WindowPlacer.AtAnchor(a, set, new Size(611, 960), Areas), "a panel too");
    }

    // Pushed inside the work area only when it does not fit there; the push is not kept, so the next layout that fits
    // is back at the anchor.
    public static void Test_AtAnchor_PushedInsideOnlyWhenItDoesNotFit()
    {
        Point low = new Point(-1000, 1100);       // U5-B dropped low on DISPLAY1 (work-area bottom 1403)
        Assert.Eq(new Rectangle(-1000, 1403 - 914, 521, 914), WindowPlacer.AtAnchor(low, new Size(830, 240), new Size(521, 914), Areas),
            "U1 would reach under the taskbar: pushed up, x kept");
        Assert.Eq(new Rectangle(-1000, 1100, 830, 240), WindowPlacer.AtAnchor(low, new Size(830, 240), new Size(830, 240), Areas),
            "back to U5-B: at the anchor again, not where U1 was pushed to");
        Point edge = new Point(-500, 300);        // M3 near DISPLAY1's right edge
        Assert.Eq(new Rectangle(-761, 300, 761, 603), WindowPlacer.AtAnchor(edge, new Size(263, 263), new Size(761, 603), Areas),
            "U3 pushed left");
    }

    // "On the same monitor": a push goes into the work area of the window the anchor was set with, not into whichever
    // monitor the bigger window's centre would land on.
    public static void Test_AtAnchor_StaysOnTheMonitorItWasSetOn()
    {
        Point a = new Point(-200, 300);           // M3 dropped near DISPLAY1's right edge; its centre is on DISPLAY1
        Rectangle r = WindowPlacer.AtAnchor(a, new Size(263, 263), new Size(761, 603), Areas);
        Assert.Eq(new Rectangle(-761, 300, 761, 603), r, "U3 pushed back onto DISPLAY1");
        Assert.True(Left.Contains(r), "not onto the primary, where U3's own centre would be");
        Assert.Eq(new Rectangle(-200, 300, 100, 100), WindowPlacer.AtAnchor(a, new Size(263, 263), new Size(100, 100), Areas), "a smaller one fits");
    }

    // The window the anchor was set with (the drop, or 1.1.1's saved spot at the upgrade) comes back exactly as 1.1.1 kept
    // a saved spot: an overhang the user chose stays while at least half of it is inside one work area. Another size that
    // would hang over is pushed inside.
    public static void Test_AtAnchor_TheUsersOwnWindowKeepsItsOverhang()
    {
        Point a = new Point(1700, 100);
        Assert.Eq(new Rectangle(1700, 100, 400, 300), WindowPlacer.AtAnchor(a, new Size(400, 300), new Size(400, 300), new[] { Primary }),
            "the user's own overhang (55 % inside) is kept");
        Assert.Eq(new Rectangle(1455, 100, 465, 300), WindowPlacer.AtAnchor(a, new Size(400, 300), new Size(465, 300), new[] { Primary }),
            "another size: pushed inside");
        Assert.Eq(new Rectangle(1400, 300, 520, 340), WindowPlacer.AtAnchor(new Point(9000, 300), new Size(520, 340), new Size(520, 340), new[] { Primary }),
            "its monitor is gone: moved inside, like a saved spot");
        Assert.Eq(new Rectangle(1455, 100, 465, 300), WindowPlacer.AtAnchor(a, null, new Size(465, 300), new[] { Primary }),
            "the size it was set with is unknown: pushed inside when it hangs over");
        Assert.Eq(new Rectangle(1700, 100, 200, 300), WindowPlacer.AtAnchor(a, null, new Size(200, 300), new[] { Primary }), "and kept when it fits");
        Assert.Eq(new Rectangle(1700, 100, 200, 300), WindowPlacer.AtAnchor(a, new Size(200, 300), new Size(200, 300), new Rectangle[0]),
            "no monitors known: unchanged");
    }

    // No anchor yet. The upgrade: the layout's own saved spot from 1.1.1's window.json, at the size it was saved at (the
    // start layout's), so that start shows exactly where 1.1.1 showed it; else the window's top-left once a layout has
    // shown (moved inside); else the first-ever spot.
    public static void Test_SeedAnchor()
    {
        bool hostChosen;
        Rectangle u1 = WindowPlacer.SeedAnchor(new Point(-602, 520), new Size(521, 914), null, new Size(521, 914), Areas, Primary);
        Assert.Eq(new Rectangle(-602, 520, 521, 914), u1, "the user's U1 (window.json, 347 x 609 at 150 %)");
        Assert.Eq(WindowPlacer.Decide(new Point(-602, 520), null, new Size(521, 914), Areas, Primary, out hostChosen),
            WindowPlacer.AtAnchor(u1.Location, u1.Size, new Size(521, 914), Areas), "a start in U1: exactly where 1.1.1 put it");
        Rectangle m3 = WindowPlacer.SeedAnchor(new Point(-100, 300), new Size(263, 263), null, new Size(263, 263), Areas, Primary);
        Assert.Eq(new Rectangle(-100, 300, 263, 263), WindowPlacer.AtAnchor(m3.Location, m3.Size, new Size(263, 263), Areas),
            "an M3 the user left across two monitors stays across them");
        Assert.Eq(WindowPlacer.Decide(new Point(-100, 300), null, new Size(263, 263), Areas, Primary, out hostChosen),
            WindowPlacer.AtAnchor(m3.Location, m3.Size, new Size(263, 263), Areas), "as 1.1.1 kept it");
        Assert.Eq(new Rectangle(0, 118, 521, 914), WindowPlacer.AtAnchor(m3.Location, m3.Size, new Size(521, 914), Areas),
            "U1 from that M3: pushed inside the monitor M3 is mostly on");
        Assert.Eq(new Rectangle(-602, 520, 300, 300), WindowPlacer.SeedAnchor(new Point(-602, 520), null, null, new Size(300, 300), Areas, Primary),
            "no saved size: the window's own");
        Assert.Eq(new Rectangle(1220, 400, 700, 160), WindowPlacer.SeedAnchor(null, null, new Point(1400, 400), new Size(700, 160), Areas, Primary),
            "no saved spot: the window's top-left, moved fully inside its monitor");
        Assert.Eq(WindowPlacer.Decide(null, null, new Size(521, 914), Areas, Primary, out hostChosen),
            WindowPlacer.SeedAnchor(null, null, null, new Size(521, 914), Areas, Primary), "first-ever: the primary's bottom-right");
    }

    // What a layout change does with the window (1.1.2): U10 docks; a panel opens beside its window, or in place (the
    // same window, same spot and size) when the page asks for it; every other layout goes to the anchor.
    public static void Test_MoveFor()
    {
        foreach (string l in new[] { "U1", "U3", "U5B", "U7", "M3", "U12", "U13" })
        {
            Assert.Eq(LayoutMove.Anchor, WindowPlacer.MoveFor(l, false), l + ": the anchor");
            Assert.Eq(LayoutMove.Anchor, WindowPlacer.MoveFor(l, true), l + ": only a panel opens in place");
        }
        Assert.Eq(LayoutMove.Dock, WindowPlacer.MoveFor("U10", false), "U10 docks");
        Assert.Eq(LayoutMove.Dock, WindowPlacer.MoveFor("U10", true), "U10 docks even when asked otherwise");
        Assert.Eq(LayoutMove.Beside, WindowPlacer.MoveFor("PANEL", false), "a panel beside its window, as in 1.1.1");
        Assert.Eq(LayoutMove.InPlace, WindowPlacer.MoveFor("PANEL", true), "inPlace: the window as it is");
    }

    // The page's setLayout for 設定 / 紀錄 shown in the window of U1, U12 or U13 (1.1.2 protocol): only the JSON true asks
    // for in place; anything else is a panel beside its window, as in 1.1.1.
    public static void Test_InPlaceComesOnlyFromTrue()
    {
        Assert.Eq(LayoutMove.InPlace, MoveOf("{\"type\":\"setLayout\",\"layout\":\"PANEL\",\"inPlace\":true,\"width\":347,\"height\":609,\"dpr\":1.5}"), "inPlace:true");
        Assert.Eq(LayoutMove.Beside, MoveOf("{\"type\":\"setLayout\",\"layout\":\"PANEL\",\"width\":407,\"height\":640,\"dpr\":1.5}"), "no inPlace: beside");
        Assert.Eq(LayoutMove.Beside, MoveOf("{\"type\":\"setLayout\",\"layout\":\"PANEL\",\"inPlace\":false,\"width\":407,\"height\":640}"), "false");
        Assert.Eq(LayoutMove.Beside, MoveOf("{\"type\":\"setLayout\",\"layout\":\"PANEL\",\"inPlace\":\"true\",\"width\":407,\"height\":640}"), "a string");
        Assert.Eq(LayoutMove.Beside, MoveOf("{\"type\":\"setLayout\",\"layout\":\"PANEL\",\"inPlace\":1,\"width\":407,\"height\":640}"), "a number");
        Assert.Eq(LayoutMove.Anchor, MoveOf("{\"type\":\"setLayout\",\"layout\":\"U1\",\"inPlace\":true,\"width\":347,\"height\":609}"), "only a panel");
    }

    static LayoutMove MoveOf(string json)
    {
        System.Collections.Generic.Dictionary<string, object> d = Bridge.Parse(json);
        return WindowPlacer.MoveFor(Bridge.Str(d, "layout"), WindowPlacer.InPlaceAsked(d));
    }

    // A drag in any layout but U10 moves the anchor (a panel's too: it is the same window); U10 snaps to a dock instead.
    public static void Test_DragMovesTheAnchor()
    {
        foreach (string l in new[] { "U1", "U3", "U5B", "U7", "M3", "U12", "U13", "PANEL" })
            Assert.True(WindowPlacer.DragMovesAnchor(l), l + " moves the anchor");
        Assert.True(!WindowPlacer.DragMovesAnchor("U10"), "U10 snaps to a dock");
        Assert.True(!WindowPlacer.DragMovesAnchor(null), "no layout yet");
    }

    // The anchor's entry is not a layout's: a layout of that name (never sent by the page) may not overwrite it.
    public static void Test_LayoutEntries()
    {
        foreach (string l in new[] { "U1", "U3", "U5B", "U7", "M3", "U10", "U12", "U13" })
            Assert.True(WindowPlacer.LayoutEntry(l), l + " has its own entry");
        Assert.True(!WindowPlacer.LayoutEntry(WindowPositions.AnchorKey), "\"anchor\" is the anchor's");
        Assert.True(!WindowPlacer.LayoutEntry(null), "no layout");
    }

    public static void Test_RescueSizeIsSavedElseDefault()
    {
        Assert.Eq(new Size(347, 593), WindowPlacer.RescueSize(new Size(347, 593)), "the start layout's saved CSS size");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(null), "no saved size: default");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(new Size(0, 593)), "an unusable size: default");
        Assert.True(WindowPlacer.DefaultRescueCss.Width > 0 && WindowPlacer.DefaultRescueCss.Height > 0, "default is a real size");
    }
}
