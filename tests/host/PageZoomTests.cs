using System;
using System.Drawing;

// 1.1.5 item 1: 縮放比例, one global setting (50–150 %, every 10 %), applied as the WebView2 ZoomFactor.
public static class PageZoomTests
{
    public static void Test_ParseSnapsToTheSteps()
    {
        Assert.Eq(100, PageZoom.Parse(null), "missing");
        Assert.Eq(100, PageZoom.Parse("120"), "a string is not a number");
        Assert.Eq(100, PageZoom.Parse(true), "a bool is not a number");
        Assert.Eq(50, PageZoom.Parse(50), "min");
        Assert.Eq(150, PageZoom.Parse(150), "max");
        Assert.Eq(150, PageZoom.Parse(400), "clamped to max");
        Assert.Eq(50, PageZoom.Parse(10), "clamped to min");
        Assert.Eq(50, PageZoom.Parse(44.9), "below 50 reads as 50");
        Assert.Eq(50, PageZoom.Parse(-30), "negative");
        Assert.Eq(70, PageZoom.Parse(74), "nearest step");
        Assert.Eq(80, PageZoom.Parse(75), "a half step rounds up, as the page's Math.round does");
        Assert.Eq(130, PageZoom.Parse(130.0m), "a decimal from JavaScriptSerializer");
        Assert.Eq(110, PageZoom.Parse(110.4), "a double");
        Assert.Eq(120, PageZoom.Parse(120L), "a long");
    }

    public static void Test_FitKeepsTheChosenZoomWhenItFits()
    {
        Rectangle area = new Rectangle(0, 0, 1920, 1040);
        Assert.Eq(1.5, PageZoom.Fit(150, new Size(300, 560), 1.0, area), "560 x 1.5 = 840 fits");
        Assert.Eq(0.5, PageZoom.Fit(50, new Size(300, 560), 1.0, area), "50 %");
        Assert.Eq(1.0, PageZoom.Fit(100, new Size(300, 560), 1.0, area), "100 %");
        Assert.Eq(1.3, PageZoom.Fit(130, new Size(300, 560), 1.5, new Rectangle(-1080, -445, 1080, 1880)), "on a 150 % monitor");
    }

    // No window larger than the work area: the zoom is lowered for this window until it fits, never below 100 % (what
    // 1.1.4 showed) or below the chosen zoom.
    public static void Test_FitLowersTheZoomUntilTheWindowFits()
    {
        Rectangle laptop = new Rectangle(0, 0, 1920, 1032);   // 1920 x 1080 at 150 %, taskbar 48 px
        double z = PageZoom.Fit(150, new Size(300, 560), 1.5, laptop);
        Assert.True(z < 1.5 && z >= 1.0, "lowered: " + z);
        Assert.True(PetGeometry.WindowSize(300, 560, 1.5 * z).Height <= 1032, "fits");
        Assert.True(PetGeometry.WindowSize(300, 560, 1.5 * (z + 0.02)).Height > 1032, "and not lowered more than needed: " + z);
        Assert.Eq(1.0, PageZoom.Fit(150, new Size(300, 900), 1.5, laptop), "even 100 % does not fit: 100 % as before (the placer pushes it in)");
        Assert.Eq(0.8, PageZoom.Fit(80, new Size(300, 900), 1.5, laptop), "a zoom below 100 % is never lowered");
        Assert.Eq(1.2, PageZoom.Fit(150, new Size(1600, 100), 1.0, new Rectangle(0, 0, 1920, 1040)), "the width counts too");
    }

    public static void Test_FitAlwaysFitsWhenItCan()
    {
        int[] widths = { 120, 300, 333, 520, 640, 999 };
        int[] heights = { 44, 260, 459, 633, 700 };
        double[] scales = { 1.0, 1.25, 1.5, 1.75, 2.0 };
        Rectangle[] areas = { new Rectangle(0, 0, 1366, 728), new Rectangle(0, 0, 1920, 1032), new Rectangle(-1080, -445, 1080, 1880), new Rectangle(0, 0, 2560, 1400) };
        for (int p = 50; p <= 150; p += 10)
            foreach (int w in widths)
                foreach (int h in heights)
                    foreach (double s in scales)
                        foreach (Rectangle a in areas)
                        {
                            double z = PageZoom.Fit(p, new Size(w, h), s, a);
                            Size size = PetGeometry.WindowSize(w, h, s * z);
                            bool fitsAt100 = PetGeometry.WindowSize(w, h, s * Math.Min(1.0, p / 100.0)).Width <= a.Width &&
                                PetGeometry.WindowSize(w, h, s * Math.Min(1.0, p / 100.0)).Height <= a.Height;
                            string at = p + "% " + w + "x" + h + " @" + s + " in " + a.Size;
                            Assert.True(z <= p / 100.0 + 1e-9, "never above the chosen zoom: " + at);
                            Assert.True(z >= Math.Min(1.0, p / 100.0) - 1e-9, "never below 100 % or the chosen zoom: " + at);
                            if (fitsAt100) Assert.True(size.Width <= a.Width && size.Height <= a.Height, "fits: " + at + " -> " + size);
                        }
    }

    public static void Test_FitWithoutAnAreaOrSizeIsTheChosenZoom()
    {
        Assert.Eq(1.4, PageZoom.Fit(140, new Size(0, 0), 1.0, new Rectangle(0, 0, 100, 100)), "no size yet");
        Assert.Eq(1.4, PageZoom.Fit(140, new Size(300, 500), 1.0, Rectangle.Empty), "no work area");
        Assert.Eq(1.4, PageZoom.Fit(140, new Size(300, 500), 0, new Rectangle(0, 0, 100, 100)), "no scale");
    }
}
