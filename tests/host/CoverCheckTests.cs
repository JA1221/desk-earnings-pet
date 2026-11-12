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

    public static void Test_APartialOverlapCounts()
    {
        CoverCheck.Above w = Excel();
        w.Bounds = new Rectangle(Ours.Right - 1, Ours.Bottom - 1, 50, 50);
        Assert.True(CoverCheck.Covers(w, Ours), "one pixel of overlap");
    }
}
