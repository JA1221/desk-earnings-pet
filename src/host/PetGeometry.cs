using System;
using System.Drawing;

// Pure maths for PetWindow: page CSS px <-> physical px. "scale" is physical px per CSS px. Once the page
// has reported it, scale is the page's devicePixelRatio, which can differ from window DPI / 96 (page zoom,
// Windows Text size).
public static class PetGeometry
{
    public static double DpiScale(int dpi)
    {
        return dpi > 0 ? dpi / 96.0 : 1.0;
    }

    public static Size WindowSize(int cssWidth, int cssHeight, double scale)
    {
        return new Size((int)Math.Round(cssWidth * scale, MidpointRounding.AwayFromZero),
                        (int)Math.Round(cssHeight * scale, MidpointRounding.AwayFromZero));
    }

    // Scale to use right after the window DPI changes, until the page reports its new DPR: keeps the ratio
    // k = scale / (oldDpi / 96) and applies it to the new DPI.
    public static double ScaleAfterDpiChange(double scale, int oldDpi, int newDpi)
    {
        if (scale <= 0 || oldDpi <= 0) return DpiScale(newDpi);
        return scale * newDpi / oldDpi;
    }

    // The window top-left that puts the page point grab (CSS px) under the cursor, or null when grab lies outside
    // the page (cssWidth x cssHeight), so a bad value never throws the window off screen.
    public static Point? GrabOrigin(int cursorX, int cursorY, PointF grab, int cssWidth, int cssHeight, double scale)
    {
        if (grab.X < 0 || grab.Y < 0 || grab.X > cssWidth || grab.Y > cssHeight) return null;
        return new Point(cursorX - (int)Math.Round(grab.X * scale, MidpointRounding.AwayFromZero),
                         cursorY - (int)Math.Round(grab.Y * scale, MidpointRounding.AwayFromZero));
    }

    // True when the cursor (physical screen px) lies in any hit rect (CSS px, page coordinates) of a window
    // whose top-left corner is at (windowLeft, windowTop) physical px.
    public static bool HitTest(RectangleF[] cssRects, int cursorX, int cursorY, int windowLeft, int windowTop, double scale)
    {
        if (cssRects == null || scale <= 0) return false;
        float x = (float)((cursorX - windowLeft) / scale);
        float y = (float)((cursorY - windowTop) / scale);
        foreach (RectangleF r in cssRects)
            if (r.Contains(x, y)) return true;
        return false;
    }
}
