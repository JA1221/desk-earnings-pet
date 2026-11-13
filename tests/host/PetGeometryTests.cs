using System;
using System.Drawing;

public static class PetGeometryTests
{
    static readonly RectangleF[] Card = { new RectangleF(14, 14, 250, 184) };

    public static void Test_WindowSizeIsCssTimesScale()
    {
        Assert.Eq(new Size(520, 340), PetGeometry.WindowSize(520, 340, 1.0), "100%");
        Assert.Eq(new Size(780, 510), PetGeometry.WindowSize(520, 340, 1.5), "150%");
        Assert.Eq(new Size(650, 425), PetGeometry.WindowSize(520, 340, 1.25), "zoom 1.25 at 100%");
        Assert.Eq(new Size(975, 638), PetGeometry.WindowSize(520, 340, 1.875), "637.5 rounds away from zero");
    }

    public static void Test_GrabOriginPutsTheGrabPointUnderTheCursor()
    {
        // U7 is 320 x 260 CSS px; the scruff tip at (160, 58)
        Assert.Eq((Point?)new Point(840, 442), PetGeometry.GrabOrigin(1000, 500, new PointF(160, 58), 320, 260, 1.0), "100%");
        Assert.Eq((Point?)new Point(760, 413), PetGeometry.GrabOrigin(1000, 500, new PointF(160, 58), 320, 260, 1.5), "150%");
        Assert.Eq((Point?)new Point(-1281, -202), PetGeometry.GrabOrigin(-1000, -100, new PointF(160.5f, 58.5f), 320, 260, 1.75),
            "negative monitor; 280.875 and 102.375 round to 281 and 102");
        Assert.True(!PetGeometry.GrabOrigin(1000, 500, new PointF(-1, 58), 320, 260, 1.0).HasValue, "left of the page");
        Assert.True(!PetGeometry.GrabOrigin(1000, 500, new PointF(160, 261), 320, 260, 1.0).HasValue, "below the page");
        Assert.True(PetGeometry.GrabOrigin(1000, 500, new PointF(320, 260), 320, 260, 1.0).HasValue, "the far corner is inside");
    }

    // 1.1.1: the hit poll tells the page pointer {inside} only when the cursor crosses onto or off the hit rects, so a
    // capsule the pointer left folds on time even when WebView2 sends no mouseout once the window clicks through.
    public static void Test_PointerEdgeReportsOnlyTheCrossings()
    {
        PointerEdge e = new PointerEdge();
        Assert.True(!e.Inside, "a new window starts outside (it clicks through until the cursor is on a hit rect)");
        Assert.True(!e.Step(false).HasValue, "still outside: nothing");
        Assert.Eq((bool?)true, e.Step(true), "onto a hit rect");
        Assert.True(!e.Step(true).HasValue && !e.Step(true).HasValue, "each 30 Hz poll while on it: nothing");
        Assert.Eq((bool?)false, e.Step(false), "off every hit rect");
        Assert.True(!e.Step(false).HasValue, "and nothing more while off");
        Assert.Eq((bool?)true, e.Step(true), "back on");
        Assert.True(e.Inside, "Inside follows");
        // as the poll uses it: the cursor against the capsule's rect, the window at (400, 300), 150 %
        RectangleF[] capsule = { new RectangleF(170, 0, 200, 36) };
        PointerEdge p = new PointerEdge();
        Assert.Eq((bool?)true, p.Step(PetGeometry.HitTest(capsule, 400 + 300, 300 + 30, 400, 300, 1.5)), "on the capsule");
        Assert.Eq((bool?)false, p.Step(PetGeometry.HitTest(capsule, 400 + 600, 300 + 30, 400, 300, 1.5)), "off it (400 CSS px)");
    }

    public static void Test_DpiScale()
    {
        Assert.Eq(1.0, PetGeometry.DpiScale(96), "96");
        Assert.Eq(1.5, PetGeometry.DpiScale(144), "144");
        Assert.Eq(1.0, PetGeometry.DpiScale(0), "unknown dpi");
    }

    public static void Test_HitTestUsesScale()
    {
        // window at (400,300); card (14..264, 14..198) CSS px
        Assert.True(PetGeometry.HitTest(Card, 600, 400, 400, 300, 1.0), "card at 100%");
        Assert.True(!PetGeometry.HitTest(Card, 680, 400, 400, 300, 1.0), "gap at 100%");
        // page DPR 1.25 at a 100% monitor: CSS (200,100) -> physical (650,425); CSS (280,100) -> (750,425)
        Assert.True(PetGeometry.HitTest(Card, 650, 425, 400, 300, 1.25), "card with DPR 1.25");
        Assert.True(!PetGeometry.HitTest(Card, 750, 425, 400, 300, 1.25), "gap with DPR 1.25");
        // same physical point means a different CSS point once the scale changes: CSS 280 at 1.0 -> 224 at 1.25
        Assert.True(PetGeometry.HitTest(Card, 680, 400, 400, 300, 1.25), "physical 280 is CSS 224 at 1.25");
    }

    public static void Test_HitTestNegativeMonitorCoordinates()
    {
        // 150% monitor left of and above the primary: window at (-1000,-200)
        Assert.True(PetGeometry.HitTest(Card, -700, 50, -1000, -200, 1.5), "card: CSS (200,166.7)");
        Assert.True(!PetGeometry.HitTest(Card, -580, -50, -1000, -200, 1.5), "gap: CSS (280,100)");
        Assert.True(!PetGeometry.HitTest(Card, -1001, -150, -1000, -200, 1.5), "left of the window");
    }

    public static void Test_HitTestEdgesAndEmpty()
    {
        Assert.True(PetGeometry.HitTest(Card, 414, 314, 400, 300, 1.0), "top-left corner is inside");
        Assert.True(!PetGeometry.HitTest(Card, 664, 400, 400, 300, 1.0), "right edge is outside");
        Assert.True(!PetGeometry.HitTest(new RectangleF[0], 600, 400, 400, 300, 1.0), "no rects");
        Assert.True(!PetGeometry.HitTest(null, 600, 400, 400, 300, 1.0), "null rects");
        Assert.True(!PetGeometry.HitTest(Card, 600, 400, 400, 300, 0), "unknown scale");
    }

    public static void Test_ScaleAfterDpiChangeKeepsPageRatio()
    {
        Assert.Eq(1.5, PetGeometry.ScaleAfterDpiChange(1.0, 96, 144), "k = 1, 100% -> 150%");
        Assert.Eq(1.875, PetGeometry.ScaleAfterDpiChange(1.25, 96, 144), "k = 1.25 (zoom), 100% -> 150%");
        Assert.Eq(1.25, PetGeometry.ScaleAfterDpiChange(1.875, 144, 96), "k = 1.25, 150% -> 100%");
        Assert.Eq(1.5, PetGeometry.ScaleAfterDpiChange(0, 96, 144), "unknown page scale -> DPI scale");
        Assert.Eq(1.5, PetGeometry.ScaleAfterDpiChange(1.25, 0, 144), "unknown old dpi -> DPI scale");
    }

    public static void Test_DpiChangeResize()
    {
        // zoom 1.25: 650x425 at 96 dpi; the window moves to a 144-dpi monitor -> provisional 975x638
        double s = PetGeometry.ScaleAfterDpiChange(1.25, 96, 144);
        Assert.Eq(new Size(975, 638), PetGeometry.WindowSize(520, 340, s), "zoomed page on the 150% monitor");
        Assert.Eq(new Size(780, 510), PetGeometry.WindowSize(520, 340, PetGeometry.ScaleAfterDpiChange(1.0, 96, 144)), "unzoomed");
    }
}
