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

    public static void Test_RescueSizeIsSavedElseDefault()
    {
        Assert.Eq(new Size(347, 593), WindowPlacer.RescueSize(new Size(347, 593)), "the start layout's saved CSS size");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(null), "no saved size: default");
        Assert.Eq(WindowPlacer.DefaultRescueCss, WindowPlacer.RescueSize(new Size(0, 593)), "an unusable size: default");
        Assert.True(WindowPlacer.DefaultRescueCss.Width > 0 && WindowPlacer.DefaultRescueCss.Height > 0, "default is a real size");
    }
}

