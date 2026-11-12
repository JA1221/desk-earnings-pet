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

    public static void Test_RescueSizeIsSavedElseDefault()
    {
        Assert.Eq(new Size(347, 593), WindowPlacer.RescueSize(new Size(347, 593)), "the start layout's saved CSS size");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(null), "no saved size: default");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(new Size(0, 593)), "an unusable size: default");
        Assert.True(WindowPlacer.DefaultRescueCss.Width > 0 && WindowPlacer.DefaultRescueCss.Height > 0, "default is a real size");
    }
}
