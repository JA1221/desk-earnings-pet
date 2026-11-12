using System;
using System.Drawing;

public static class ScreenFitTests
{
    static readonly Rectangle Primary = new Rectangle(0, 0, 1920, 1040);
    // second monitor to the right, portrait monitor to the left and above (as on the dev machine)
    static readonly Rectangle Right = new Rectangle(1920, 0, 1920, 1032);
    static readonly Rectangle Left = new Rectangle(-1080, -668, 1080, 1848);

    public static void Test_KeepBottomInLiftsTheDeskAboveTheTaskbar()
    {
        // U7 at 100%: 327 x 291 px, the desk ends 16 px above the window bottom; work area 1920 x 1040 (taskbar below)
        Rectangle low = new Rectangle(1500, 820, 327, 291);   // desk bottom at 1095: 55 px below the work area
        Assert.Eq(new Rectangle(1500, 765, 327, 291), ScreenFit.KeepBottomIn(low, 16, Primary), "lifted: desk bottom at 1040");
        Rectangle ok = new Rectangle(1500, 700, 327, 291);
        Assert.Eq(ok, ScreenFit.KeepBottomIn(ok, 16, Primary), "inside: unchanged");
        Rectangle edge = new Rectangle(1500, 765, 327, 291);
        Assert.Eq(edge, ScreenFit.KeepBottomIn(edge, 16, Primary), "desk bottom exactly at the edge: unchanged");
        Rectangle high = new Rectangle(1500, 10, 327, 291);
        Assert.Eq(high, ScreenFit.KeepBottomIn(high, 16, Primary), "never moved down");
        // 150%: 491 x 437 px, margin 24 px
        Assert.Eq(new Rectangle(200, 627, 491, 437), ScreenFit.KeepBottomIn(new Rectangle(200, 900, 491, 437), 24, Primary), "150%");
    }

    public static void Test_KeepBottomInNeverAboveTheTopAndWorksOnOtherMonitors()
    {
        Rectangle small = new Rectangle(0, 0, 1920, 300);
        Assert.Eq(new Rectangle(10, 0, 327, 400), ScreenFit.KeepBottomIn(new Rectangle(10, 50, 327, 400), 16, small),
            "taller than the area: its top stops at the area's top");
        Assert.Eq(new Rectangle(-900, 905, 327, 291), ScreenFit.KeepBottomIn(new Rectangle(-900, 1000, 327, 291), 16, Left),
            "portrait monitor left and above: bottom 1180 + 16 - 291");
        Rectangle above = new Rectangle(-900, -800, 327, 291);
        Assert.Eq(above, ScreenFit.KeepBottomIn(above, 16, Left), "above the area: left alone (never moved down)");
    }

    public static void Test_OnScreenUnchanged()
    {
        Rectangle win = new Rectangle(100, 200, 380, 640);
        Assert.Eq(win, ScreenFit.Clamp(win, new[] { Primary }), "inside primary");
        Rectangle onLeft = new Rectangle(-900, -500, 380, 640);
        Assert.Eq(onLeft, ScreenFit.Clamp(onLeft, new[] { Primary, Right, Left }), "inside the left monitor");
    }

    public static void Test_GoneMonitorMovesToNearest()
    {
        // saved on a monitor at x >= 1920 that is gone: only the primary 1920x1040 area is left
        Rectangle got = ScreenFit.Clamp(new Rectangle(3000, 300, 380, 640), new[] { Primary });
        Assert.Eq(new Rectangle(1540, 300, 380, 640), got, "moved fully inside, same size, y kept");
        Assert.True(Primary.Contains(got), "fully inside");
    }

    public static void Test_LargerThanAreaShrinks()
    {
        Rectangle got = ScreenFit.Clamp(new Rectangle(5000, 5000, 2500, 1200), new[] { Primary });
        Assert.Eq(new Rectangle(0, 0, 1920, 1040), got, "shrunk to the area");
        Rectangle wide = ScreenFit.Clamp(new Rectangle(-3000, 100, 2400, 300), new[] { Primary });
        Assert.Eq(new Rectangle(0, 100, 1920, 300), wide, "only the too-large side shrinks");
    }

    public static void Test_HalfInsideStays()
    {
        // exactly 50 % inside the primary (hanging off the right edge): unchanged
        Rectangle half = new Rectangle(1720, 100, 400, 300);
        Assert.Eq(half, ScreenFit.Clamp(half, new[] { Primary }), "50 % inside stays");
        // 49 % inside: moved back in
        Rectangle less = new Rectangle(1724, 100, 400, 300);
        Assert.Eq(new Rectangle(1520, 100, 400, 300), ScreenFit.Clamp(less, new[] { Primary }), "under 50 % moves");
    }

    public static void Test_SplitAcrossTwoAreasUsesNearestToCentre()
    {
        // 32 % on the primary, 46 % on the right monitor, the rest below both: no single area has 50 %
        Rectangle win = new Rectangle(1760, 840, 400, 250);
        Rectangle got = ScreenFit.Clamp(win, new[] { Primary, Right });
        // centre (1960, 965) lies in the right monitor
        Assert.Eq(new Rectangle(1920, 782, 400, 250), got, "inside the right monitor");
    }

    public static void Test_PicksNearestOfSeveral()
    {
        // far above the left monitor: the left area is nearest to the centre
        Rectangle got = ScreenFit.Clamp(new Rectangle(-700, -2000, 300, 300), new[] { Primary, Right, Left });
        Assert.Eq(new Rectangle(-700, -668, 300, 300), got, "moved down into the left monitor");
        // far below the right monitor
        Rectangle got2 = ScreenFit.Clamp(new Rectangle(3700, 4000, 300, 300), new[] { Primary, Right, Left });
        Assert.Eq(new Rectangle(3540, 732, 300, 300), got2, "moved up and in, inside the right monitor");
    }

    public static void Test_NoAreasOrEmptyWindowIsSafe()
    {
        Rectangle win = new Rectangle(3000, 300, 380, 640);
        Assert.Eq(win, ScreenFit.Clamp(win, new Rectangle[0]), "no work areas: unchanged");
        Assert.Eq(win, ScreenFit.Clamp(win, null), "null work areas: unchanged");
        Assert.Eq(new Rectangle(1920, 300, 0, 0), ScreenFit.Clamp(new Rectangle(3000, 300, 0, 0), new[] { Primary }), "empty window off-screen moves in");
        Rectangle point = new Rectangle(10, 10, 0, 0);
        Assert.Eq(point, ScreenFit.Clamp(point, new[] { Primary }), "empty window on-screen stays");
    }

    public static void Test_MoveInsideKeepsFullyVisible()
    {
        // MoveInside always ends fully inside (used for a layout that has no saved position yet)
        Assert.Eq(new Rectangle(1220, 400, 700, 160), ScreenFit.MoveInside(new Rectangle(1600, 400, 700, 160), Primary), "pushed left");
        Assert.Eq(new Rectangle(100, 0, 380, 640), ScreenFit.MoveInside(new Rectangle(100, -50, 380, 640), Primary), "pushed down");
        Rectangle inside = new Rectangle(10, 10, 100, 100);
        Assert.Eq(inside, ScreenFit.MoveInside(inside, Primary), "already inside");
    }

    public static void Test_NearestArea()
    {
        Rectangle[] areas = { Primary, Right, Left };
        Assert.Eq(Right, ScreenFit.NearestArea(new Rectangle(2500, 500, 10, 10), areas), "centre inside right");
        Assert.Eq(Primary, ScreenFit.NearestArea(new Rectangle(900, 2000, 10, 10), areas), "below primary");
        Assert.Eq(Left, ScreenFit.NearestArea(new Rectangle(-2000, 0, 10, 10), areas), "left of everything");
    }
}
