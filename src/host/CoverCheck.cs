using System;
using System.Drawing;
using System.Runtime.InteropServices;

// Is the window covered by another app's window? Used by the hide hotkey (ShowRescue.HotkeyHides): a covered window
// is raised instead of hidden. Only windows a raise can beat count: visible, on this desktop (not cloaked), not
// minimized, not topmost, not click-through overlays, not our own, and overlapping ours.
public static class CoverCheck
{
    const int MaxWalk = 2000;   // top-level windows above ours that are looked at, at most

    // One top-level window above ours in the z-order.
    public struct Above
    {
        public bool Visible;
        public bool Cloaked;
        public bool Minimized;
        public bool Topmost;
        public bool ClickThrough;
        public bool SameProcess;
        public Rectangle Bounds;   // physical px, the visible frame
    }

    public static bool Covers(Above w, Rectangle ours)
    {
        if (!w.Visible || w.Cloaked || w.Minimized || w.Topmost || w.ClickThrough || w.SameProcess) return false;
        return w.Bounds.Width > 0 && w.Bounds.Height > 0 && w.Bounds.IntersectsWith(ours);
    }

    // Walks the windows above hwnd (GW_HWNDPREV) until one covers it. False when hwnd has no area.
    public static bool IsCovered(IntPtr hwnd)
    {
        Rectangle ours = FrameBounds(hwnd);
        if (ours.Width <= 0 || ours.Height <= 0) return false;
        uint ourPid;
        Native.GetWindowThreadProcessId(hwnd, out ourPid);
        IntPtr h = hwnd;
        for (int i = 0; i < MaxWalk; i++)
        {
            h = Native.GetWindow(h, Native.GW_HWNDPREV);
            if (h == IntPtr.Zero) return false;
            if (Covers(Describe(h, ourPid), ours)) return true;
        }
        return false;
    }

    static Above Describe(IntPtr h, uint ourPid)
    {
        Above w = new Above();
        w.Visible = Native.IsWindowVisible(h);
        if (!w.Visible) return w;   // the rest is not needed
        int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
        w.Topmost = (ex & Native.WS_EX_TOPMOST) != 0;
        w.ClickThrough = (ex & Native.WS_EX_TRANSPARENT) != 0 && (ex & Native.WS_EX_LAYERED) != 0;
        w.Minimized = Native.IsIconic(h);
        int cloaked;
        w.Cloaked = Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0;
        uint pid;
        Native.GetWindowThreadProcessId(h, out pid);
        w.SameProcess = pid == ourPid;
        w.Bounds = FrameBounds(h);
        return w;
    }

    // Whether other is above hwnd in the z-order (walking up from hwnd, at most MaxWalk windows).
    public static bool IsAbove(IntPtr hwnd, IntPtr other)
    {
        if (hwnd == IntPtr.Zero || other == IntPtr.Zero) return false;
        IntPtr h = hwnd;
        for (int i = 0; i < MaxWalk; i++)
        {
            h = Native.GetWindow(h, Native.GW_HWNDPREV);
            if (h == IntPtr.Zero) return false;
            if (h == other) return true;
        }
        return false;
    }

    // Puts hwnd right below other in the z-order unless it is already below it (then its place among the other
    // windows is kept); never activates, moves or sizes it. True when it moved hwnd. Call with hwnd out of the topmost
    // band: placed below a topmost window it would join that band.
    public static bool KeepBelow(IntPtr hwnd, IntPtr other)
    {
        if (hwnd == IntPtr.Zero || other == IntPtr.Zero || IsAbove(hwnd, other)) return false;
        return Native.SetWindowPos(hwnd, other, 0, 0, 0, 0, Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
    }

    // The frame the user sees (without the invisible resize borders of Windows 10/11), else the window rect.
    static Rectangle FrameBounds(IntPtr h)
    {
        Native.RECT r;
        if (Native.DwmGetWindowAttribute(h, Native.DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(Native.RECT))) != 0
            && !Native.GetWindowRect(h, out r)) return Rectangle.Empty;
        return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
    }
}
