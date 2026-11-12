using System;

// Keeps a window out of screen shares, recordings and screenshots while it stays visible on the user's own
// screen (SetWindowDisplayAffinity).
public static class CaptureGuard
{
    // on: WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+: the window is simply absent from captures), falling back
    // to WDA_MONITOR (the window shows as a black box in captures) if that call fails. Note: before 2004 the
    // EXCLUDEFROMCAPTURE call usually does NOT fail, Windows silently treats it as WDA_MONITOR, so the fallback
    // branch rarely runs; either way the salary does not appear in a capture. off: WDA_NONE.
    // False when the window could not be protected (or unprotected).
    public static bool Apply(IntPtr hwnd, bool on)
    {
        if (!on) return Native.SetWindowDisplayAffinity(hwnd, Native.WDA_NONE);
        if (Native.SetWindowDisplayAffinity(hwnd, Native.WDA_EXCLUDEFROMCAPTURE)) return true;
        return Native.SetWindowDisplayAffinity(hwnd, Native.WDA_MONITOR);
    }
}
