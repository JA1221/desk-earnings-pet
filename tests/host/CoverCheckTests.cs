using System;
using System.Drawing;

public static class CoverCheckTests
{
    static readonly Rectangle Ours = new Rectangle(-599, 463, 521, 890);

    // A normal app window (Excel, say) right over ours.
    static CoverCheck.Above Excel()
    {
        CoverCheck.Above w = new CoverCheck.Above();
        w.Visible = true;
        w.Bounds = new Rectangle(-900, 300, 800, 900);
        return w;
    }

    public static void Test_AVisibleAppWindowOverlappingOursCoversIt()
    {
        Assert.True(CoverCheck.Covers(Excel(), Ours), "Excel over U1");
    }

    public static void Test_WindowsThatDoNotHideOursOrThatRaisingCannotBeat()
    {
        CoverCheck.Above w = Excel();
        w.Visible = false;
        Assert.True(!CoverCheck.Covers(w, Ours), "invisible");
        w = Excel(); w.Cloaked = true;
        Assert.True(!CoverCheck.Covers(w, Ours), "cloaked (another virtual desktop, a suspended Store app)");
        w = Excel(); w.Minimized = true;
        Assert.True(!CoverCheck.Covers(w, Ours), "minimized");
        w = Excel(); w.Topmost = true;
        Assert.True(!CoverCheck.Covers(w, Ours), "topmost (taskbar, overlays): raising ours cannot get above it");
        w = Excel(); w.ClickThrough = true;
        Assert.True(!CoverCheck.Covers(w, Ours), "a click-through overlay");
        w = Excel(); w.SameProcess = true;
        Assert.True(!CoverCheck.Covers(w, Ours), "our own windows (the menu)");
        w = Excel(); w.Bounds = new Rectangle(Ours.Right, Ours.Top, 300, 300);
        Assert.True(!CoverCheck.Covers(w, Ours), "only touching the edge");
        w = Excel(); w.Bounds = new Rectangle(1000, 0, 800, 600);
        Assert.True(!CoverCheck.Covers(w, Ours), "on another monitor");
        w = Excel(); w.Bounds = new Rectangle(Ours.X + 10, Ours.Y + 10, 0, 0);
        Assert.True(!CoverCheck.Covers(w, Ours), "empty");
    }

    // 1.1.1: stepping back behind a full-screen window. Two hidden windows (never shown): the one created later is
    // above. KeepBelow leaves a window that is already below alone (its place among the other windows is kept) and
    // otherwise puts it right below, without activating it.
    public static void Test_KeepBelow()
    {
        using (var a = new System.Windows.Forms.Form())
        using (var b = new System.Windows.Forms.Form())
        {
            IntPtr ha = a.Handle, hb = b.Handle;
            Assert.True(CoverCheck.IsAbove(ha, hb), "created later: above");
            Assert.True(!CoverCheck.IsAbove(hb, ha), "and not the other way round");
            Assert.True(!CoverCheck.KeepBelow(ha, hb), "already below: left alone");
            Assert.True(CoverCheck.IsAbove(ha, hb), "unchanged");
            Assert.True(CoverCheck.KeepBelow(hb, ha), "above it: moved");
            Assert.True(CoverCheck.IsAbove(hb, ha), "now below it");
            Assert.True(!CoverCheck.KeepBelow(hb, IntPtr.Zero), "no window to keep below");
            Assert.True(!a.Visible && !b.Visible, "nothing was shown");
        }
    }

    // A topmost window (U7, M3, U10, or a raised prompt) put below a full-screen window that is not topmost leaves the
    // topmost band in the same step, so it is never above that window on the way down.
    public static void Test_KeepBelowTakesATopmostWindowOutOfTheBand()
    {
        using (var fs = new System.Windows.Forms.Form())
        using (var pet = new System.Windows.Forms.Form())
        {
            IntPtr hf = fs.Handle, hp = pet.Handle;
            Native.SetWindowPos(hp, Native.HWND_TOPMOST, 0, 0, 0, 0, Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
            Assert.True((Native.GetWindowLong(hp, Native.GWL_EXSTYLE) & Native.WS_EX_TOPMOST) != 0, "topmost to begin with");
            Assert.True(CoverCheck.KeepBelow(hp, hf), "moved below");
            Assert.True(CoverCheck.IsAbove(hp, hf), "the full-screen window is above it");
            Assert.True((Native.GetWindowLong(hp, Native.GWL_EXSTYLE) & Native.WS_EX_TOPMOST) == 0, "no longer topmost");
        }
    }

    public static void Test_APartialOverlapCounts()
    {
        CoverCheck.Above w = Excel();
        w.Bounds = new Rectangle(Ours.Right - 1, Ours.Bottom - 1, 50, 50);
        Assert.True(CoverCheck.Covers(w, Ours), "one pixel of overlap");
    }
}
