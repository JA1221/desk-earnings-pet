using System;
using System.Drawing;

// 1.1.5 縮放比例: one global zoom for every layout and panel, settings.json zoom, a percent from Min to Max in Steps.
// The host applies it as the WebView2 ZoomFactor, so the page's devicePixelRatio is the monitor's scale x the zoom and
// every CSS px -> physical px step (PetGeometry, the hit rects, U10's dock margin, U7's desk) follows on its own; the page
// keeps its CSS sizes. Pure; the page snaps the value the same way (src/web/js/core/settings.js).
public static class PageZoom
{
    public const int Min = 70, Max = 150, Step = 10, Default = 100;   // 70: the user's floor (a stored 50 or 60 reads as 70)

    // A JSON number (as JavaScriptSerializer gives it) clamped to Min..Max and put on the nearest step, a half step
    // rounding up (the page's Math.round); anything else is Default.
    public static int Parse(object v)
    {
        double n;
        if (!Bridge.TryNumber(v, out n)) return Default;
        double c = Math.Min(Max, Math.Max(Min, n));
        return Min + (int)Math.Floor((c - Min) / Step + 0.5) * Step;
    }

    public static double Factor(int percent)
    {
        return percent / 100.0;
    }

    // The zoom factor for a page of css size on a monitor of scale (physical px per CSS px at zoom 1, its DPI / 96)
    // whose work area is area: the chosen one while the window fits the work area there; else lowered (to 0.01) just
    // enough that it fits, but never below the chosen zoom or 1 (100 %, where 1.1.4 left a window that does not fit to
    // the placer). Without a size, scale or area: the chosen one.
    public static double Fit(int percent, Size css, double scale, Rectangle area)
    {
        double z = Factor(percent);
        if (css.Width < 1 || css.Height < 1 || !(scale > 0) || area.Width < 1 || area.Height < 1) return z;
        Size at = PetGeometry.WindowSize(css.Width, css.Height, scale * z);
        if (at.Width <= area.Width && at.Height <= area.Height) return z;
        double fit = Math.Min(area.Width / (css.Width * scale), area.Height / (css.Height * scale));
        fit = Math.Floor(fit * 100) / 100;
        return Math.Max(Math.Min(z, 1.0), Math.Min(z, fit));
    }
}
