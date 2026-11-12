using System;
using System.Drawing;

// U10's capsule (spec 5.7): four docks on a monitor's work area, so "bottom" is just above the taskbar wherever the
// taskbar is (side, auto-hide), and a drop snaps to the nearest dock of the monitor it lands on.
public static class CapsuleDockTests
{
    static readonly Rectangle Primary = new Rectangle(0, 0, 1920, 1032);
    static readonly Rectangle Portrait = new Rectangle(-1080, -445, 1080, 1848);   // DISPLAY1 at 150 %, work-area bottom 1403
    static readonly Size Capsule = new Size(460, 150);

    public static void Test_FourDocksOnThePrimary()
    {
        Assert.Eq(new Rectangle(730, 6, 460, 150), CapsuleDock.Rect("top", Primary, Capsule, 6), "top centre");
        Assert.Eq(new Rectangle(6, 876, 460, 150), CapsuleDock.Rect("bottomLeft", Primary, Capsule, 6), "bottom left, above the taskbar");
        Assert.Eq(new Rectangle(730, 876, 460, 150), CapsuleDock.Rect("bottomCenter", Primary, Capsule, 6), "bottom centre");
        Assert.Eq(new Rectangle(1454, 876, 460, 150), CapsuleDock.Rect("bottomRight", Primary, Capsule, 6), "bottom right");
        Assert.Eq("top|bottomLeft|bottomCenter|bottomRight", string.Join("|", CapsuleDock.Docks), "the four docks");
    }

    // The work area already leaves out a side taskbar; with an auto-hide taskbar it is the whole monitor, so the
    // capsule sits one margin above the screen edge (Ruling: the reveal strip stays free).
    public static void Test_SideAndAutoHideTaskbars()
    {
        Assert.Eq(new Rectangle(1392, 924, 460, 150), CapsuleDock.Rect("bottomRight", new Rectangle(0, 0, 1858, 1080), Capsule, 6),
            "taskbar on the right: the work area ends at 1858");
        Assert.Eq(new Rectangle(730, 924, 460, 150), CapsuleDock.Rect("bottomCenter", new Rectangle(0, 0, 1920, 1080), Capsule, 6),
            "auto-hide: one margin above the screen edge");
    }

    public static void Test_PortraitMonitorAtNegativeCoordinates()
    {
        Size big = new Size(690, 225);
        Assert.Eq(new Rectangle(-885, -436, 690, 225), CapsuleDock.Rect("top", Portrait, big, 9), "top centre, left of and above the primary");
        Assert.Eq(new Rectangle(-699, 1169, 690, 225), CapsuleDock.Rect("bottomRight", Portrait, big, 9), "bottom right: 1403 - 225 - 9");
        // a capsule larger than the area is moved in like any other window (ScreenFit.MoveInside)
        Rectangle tiny = new Rectangle(0, 0, 400, 100);
        Assert.Eq(new Rectangle(0, 0, 400, 100), CapsuleDock.Rect("top", tiny, Capsule, 6), "bigger than the area: moved in, each side cut to the area");
        Assert.True(tiny.Contains(CapsuleDock.Rect("bottomRight", tiny, Capsule, 6)), "stays inside the area");
    }

    public static void Test_NearestDock()
    {
        Assert.Eq("bottomRight", CapsuleDock.Nearest(new Rectangle(new Point(1400, 850), Capsule), Primary, 6), "dropped low right");
        Assert.Eq("top", CapsuleDock.Nearest(new Rectangle(new Point(700, 400), Capsule), Primary, 6), "dropped high in the middle");
        Assert.Eq("bottomLeft", CapsuleDock.Nearest(new Rectangle(new Point(100, 300), Capsule), Primary, 6), "dropped left");
        Assert.Eq("bottomCenter", CapsuleDock.Nearest(new Rectangle(new Point(-900, 1100), new Size(690, 225)), Portrait, 9),
            "on the portrait monitor");
    }

    public static void Test_ParseUnknownIsTop()
    {
        foreach (string d in CapsuleDock.Docks) Assert.Eq(d, CapsuleDock.Parse(d), "a known dock: " + d);
        Assert.Eq("top", CapsuleDock.Parse(null), "missing");
        Assert.Eq("top", CapsuleDock.Parse(""), "empty");
        Assert.Eq("top", CapsuleDock.Parse("bottomright"), "wrong case");
        Assert.Eq("top", CapsuleDock.Parse("left"), "not a dock");
        Assert.Eq(CapsuleDock.Rect("top", Primary, Capsule, 6), CapsuleDock.Rect("middle", Primary, Capsule, 6), "Rect reads an unknown dock as top");
    }

    public static void Test_AreaForAGoneMonitor()
    {
        Rectangle[] areas = { Primary, Portrait };
        Assert.Eq(Primary, CapsuleDock.AreaFor(new Rectangle(9000, 300, 460, 150), areas), "saved on a monitor that is gone: the nearest one");
        Rectangle onPortrait = new Rectangle(-1080 + (1080 - 460) / 2, -445 + (1848 - 150) / 2, 460, 150);
        Assert.Eq(Portrait, CapsuleDock.AreaFor(onPortrait, areas), "centred on the portrait monitor");
        Rectangle docked = CapsuleDock.Rect("bottomRight", CapsuleDock.AreaFor(new Rectangle(9000, 300, 460, 150), areas), Capsule, 6);
        Assert.True(Primary.Contains(docked), "the capsule ends fully on an existing work area");
    }
}
