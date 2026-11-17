using System;
using System.Drawing;

// Keeps a window rectangle (physical px) on the screens that exist now: a position saved on a monitor that is
// gone, or at another DPI, comes back inside a visible work area.
public static class ScreenFit
{
    // Unchanged while at least 50 % of win lies inside one work area; otherwise moved fully inside the work area
    // nearest its centre (size kept, each side shrunk only when larger than that area). No areas: unchanged.
    public static Rectangle Clamp(Rectangle win, Rectangle[] workAreas)
    {
        if (workAreas == null || workAreas.Length == 0) return win;
        long winArea = (long)win.Width * win.Height;
        foreach (Rectangle a in workAreas)
        {
            if (winArea <= 0)
            {
                if (a.Contains(win.Location)) return win;
                continue;
            }
            Rectangle i = Rectangle.Intersect(win, a);
            if ((long)i.Width * i.Height * 2 >= winArea) return win;
        }
        return MoveInside(win, NearestArea(win, workAreas));
    }

    // win moved up just enough that its bottom less margin (physical px) lies inside area: what must stay visible
    // above the taskbar, such as U7's desk, which ends margin above the window bottom. Never moved down, and never
    // above area's top (a window taller than that keeps its top at area's top).
    public static Rectangle KeepBottomIn(Rectangle win, int margin, Rectangle area)
    {
        int y = Math.Min(win.Y, area.Bottom + margin - win.Height);
        if (y < area.Top) y = Math.Min(win.Y, area.Top);
        return new Rectangle(win.X, y, win.Width, win.Height);
    }

    // 1.1.5: U7 resized by 縮放比例 (before: its rect, beforeMargin: its desk's px above the window bottom then). Seated on
    // the taskbar edge (its desk on area's bottom, within EdgeSlack px), it stays seated: the new window's desk, margin px
    // above its bottom, goes on area's bottom (never above area's top). Seated higher, it keeps its top-left.
    public const int EdgeSlack = 2;

    public static Rectangle SettleDesk(Rectangle before, int beforeMargin, Size size, int margin, Rectangle area)
    {
        int desk = before.Bottom - beforeMargin;
        if (Math.Abs(desk - area.Bottom) > EdgeSlack) return new Rectangle(before.Location, size);
        int y = Math.Max(area.Top, area.Bottom + margin - size.Height);
        return new Rectangle(before.X, y, size.Width, size.Height);
    }

    // Moves win fully inside area (shrinking a side only when it is larger than the area).
    public static Rectangle MoveInside(Rectangle win, Rectangle area)
    {
        int w = Math.Min(Math.Max(win.Width, 0), area.Width);
        int h = Math.Min(Math.Max(win.Height, 0), area.Height);
        int x = Math.Max(area.Left, Math.Min(win.X, area.Right - w));
        int y = Math.Max(area.Top, Math.Min(win.Y, area.Bottom - h));
        return new Rectangle(x, y, w, h);
    }

    // The work area closest to the centre of win (distance 0 when the centre is inside); the first one on a tie.
    public static Rectangle NearestArea(Rectangle win, Rectangle[] workAreas)
    {
        if (workAreas == null || workAreas.Length == 0) return win;
        double cx = win.X + win.Width / 2.0, cy = win.Y + win.Height / 2.0;
        Rectangle best = workAreas[0];
        double bestD = double.MaxValue;
        foreach (Rectangle a in workAreas)
        {
            double dx = cx < a.Left ? a.Left - cx : (cx > a.Right ? cx - a.Right : 0);
            double dy = cy < a.Top ? a.Top - cy : (cy > a.Bottom ? cy - a.Bottom : 0);
            double d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = a; }
        }
        return best;
    }
}
