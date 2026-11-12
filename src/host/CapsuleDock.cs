using System;
using System.Drawing;

// Where U10's capsule window goes (spec 5.7), in physical px. Four docks on a monitor's work area: top centre, and
// bottom left / centre / right. "Bottom" is the work area's bottom, so the capsule sits just above the taskbar
// wherever the taskbar is; a side taskbar is already outside the work area. With an auto-hide taskbar the work area
// is the whole monitor, so the capsule sits one margin above the screen edge and leaves the reveal strip free
// (Ruling). A drop snaps to the nearest dock of the monitor it landed on (Nearest, AreaFor), so the capsule can
// change monitors. Pure: the host passes the work areas and the margin (6 CSS px x the window's scale).
public static class CapsuleDock
{
    public static readonly string[] Docks = { "top", "bottomLeft", "bottomCenter", "bottomRight" };

    // The dock named d, else "top" (the default; also for a missing or misspelt one).
    public static string Parse(string d)
    {
        return Array.IndexOf(Docks, d) >= 0 ? d : "top";
    }

    // The window's rect at dock in workArea, margin px from the area's edges; a window larger than the area is moved
    // in like any other (ScreenFit.MoveInside).
    public static Rectangle Rect(string dock, Rectangle workArea, Size size, int margin)
    {
        string d = Parse(dock);
        int x = workArea.Left + (workArea.Width - size.Width) / 2;
        int y = workArea.Top + margin;
        if (d != "top")
        {
            y = workArea.Bottom - size.Height - margin;
            if (d == "bottomLeft") x = workArea.Left + margin;
            else if (d == "bottomRight") x = workArea.Right - size.Width - margin;
        }
        return ScreenFit.MoveInside(new Rectangle(x, y, size.Width, size.Height), workArea);
    }

    // The dock in workArea whose rect (at window's size) has its centre closest to window's centre; the first in
    // Docks on a tie.
    public static string Nearest(Rectangle window, Rectangle workArea, int margin)
    {
        double cx = window.X + window.Width / 2.0, cy = window.Y + window.Height / 2.0;
        string best = Docks[0];
        double bestD = double.MaxValue;
        foreach (string d in Docks)
        {
            Rectangle r = Rect(d, workArea, window.Size, margin);
            double dx = r.X + r.Width / 2.0 - cx, dy = r.Y + r.Height / 2.0 - cy;
            double dist = dx * dx + dy * dy;
            if (dist < bestD) { bestD = dist; best = d; }
        }
        return best;
    }

    // The work area the capsule belongs to: the one nearest window's centre, so a spot on a monitor that is gone
    // gives the nearest one that exists.
    public static Rectangle AreaFor(Rectangle window, Rectangle[] areas)
    {
        return ScreenFit.NearestArea(window, areas);
    }
}
