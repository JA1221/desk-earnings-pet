using System;
using System.Collections.Generic;
using System.Drawing;

public static class PresentationTests
{
    static readonly Rectangle Laptop = new Rectangle(0, 0, 1920, 1080);           // monitor A: the laptop's own screen
    static readonly Rectangle LaptopWork = new Rectangle(0, 0, 1920, 1032);
    static readonly Rectangle Projector = new Rectangle(1920, 0, 1920, 1080);     // monitor B
    static readonly Rectangle Display1 = new Rectangle(-1080, -445, 1080, 1920);  // the left portrait monitor
    static readonly Rectangle[] Monitors = { Laptop, Projector, Display1 };
    static readonly IntPtr Slides = new IntPtr(0x51);
    static readonly IntPtr Presenter = new IntPtr(0x52);

    static Presentation.TopWindow W(IntPtr hwnd, Rectangle bounds)
    {
        Presentation.TopWindow w = new Presentation.TopWindow();
        w.Hwnd = hwnd;
        w.Bounds = bounds;
        return w;
    }

    static Presentation.TopWindow Skipped(Rectangle bounds)
    {
        Presentation.TopWindow w = W(new IntPtr(0x99), bounds);
        w.Skipped = true;
        return w;
    }

    // PowerPoint with Presenter View (the user's 「ppt投影」): the slide show covers the projector, and the presenter
    // view, the foreground window, is a maximized window with a title bar on the laptop. Top of the z-order first: our
    // pet (topmost; skipped), the taskbar (skipped), the presenter view, the slide show, the user's Excel.
    static List<Presentation.TopWindow> PresenterView()
    {
        Presentation.TopWindow presenter = W(Presenter, LaptopWork);
        presenter.Maximized = true;
        presenter.Framed = true;
        return new List<Presentation.TopWindow> {
            Skipped(new Rectangle(2500, 900, 491, 437)), Skipped(new Rectangle(0, 1032, 1920, 48)), presenter, W(Slides, Projector),
            W(new IntPtr(0x53), new Rectangle(100, 100, 1200, 800)) };
    }

    // SHQueryUserNotificationState: 2 busy (a fullscreen app), 3 Direct3D fullscreen, 4 presentation mode hold
    // reminders. 7 (a Store app in the foreground) does not: a windowed Store app must not hold them. 1 (locked,
    // screen saver) is the session's business; 0 / -1 mean the query failed.
    public static void Test_BusyStates()
    {
        foreach (int s in new[] { 1, 5, 6, 7, 0, -1 })
            Assert.True(!Presentation.IsBusy(s), s + " is not busy");
        foreach (int s in new[] { 2, 3, 4 })
            Assert.True(Presentation.IsBusy(s), s + " is busy");
    }

    public static void Test_ChangedOnlyOnChange()
    {
        int[] answers = { 5, 2, 2, 5 };
        int next = 0;
        var changes = new List<string>();
        using (var p = new Presentation(delegate { return answers[next++]; }))
        {
            p.Changed += delegate { changes.Add(p.On + "/" + p.Here); };
            Assert.True(!p.On, "not on before a poll");
            for (int i = 0; i < answers.Length; i++) p.Poll();
            Assert.Eq("True/False,False/False", string.Join(",", changes.ToArray()), "Changed fires on each flip only; QUNS names no monitor");
            Assert.True(!p.On, "on follows the last poll");
        }
    }

    // A monitor is full screen when the first window in z-order (from the top) that overlaps it, skipped ones aside,
    // covers the whole monitor rect (not the work area).
    public static void Test_TheFirstWindowOnAMonitorDecides()
    {
        var z = new List<Presentation.TopWindow> { W(Slides, Projector) };
        Assert.Eq(Slides, Presentation.CoveringWindow(z, Projector), "exactly the monitor");
        z = new List<Presentation.TopWindow> { W(Slides, Rectangle.Inflate(Projector, 8, 8)) };
        Assert.Eq(Slides, Presentation.CoveringWindow(z, Projector), "larger than the monitor");
        z = new List<Presentation.TopWindow> { W(new IntPtr(7), new Rectangle(2000, 100, 400, 300)), W(Slides, Projector) };
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(z, Projector), "a window above it on that monitor: not full screen");
        z = new List<Presentation.TopWindow> { W(new IntPtr(7), new Rectangle(100, 100, 400, 300)), W(Slides, Projector) };
        Assert.Eq(Slides, Presentation.CoveringWindow(z, Projector), "a window above it on another monitor does not count");
        z = new List<Presentation.TopWindow> { W(new IntPtr(7), new Rectangle(1919, 100, 400, 300)), W(Slides, Projector) };
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(z, Projector), "one that reaches 1 px into it does");
        z = new List<Presentation.TopWindow> { Skipped(new Rectangle(2000, 100, 400, 300)), W(Slides, Projector) };
        Assert.Eq(Slides, Presentation.CoveringWindow(z, Projector),
            "skipped windows (ours, the desktop / shell, cloaked, invisible, minimized, tool windows, click-through overlays)");
        z = new List<Presentation.TopWindow> { W(new IntPtr(7), new Rectangle(2000, 100, 0, 0)), W(Slides, Projector) };
        Assert.Eq(Slides, Presentation.CoveringWindow(z, Projector), "a zero-size window");
        z = new List<Presentation.TopWindow> { W(Slides, new Rectangle(1920, 0, 1920, 1032)) };
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(z, Projector), "the work area only (the taskbar shows)");
        z = new List<Presentation.TopWindow> { W(Slides, new Rectangle(1921, 0, 1920, 1080)) };
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(z, Projector), "1 px short");
        Presentation.TopWindow max = W(new IntPtr(8), Projector);
        max.Maximized = true;
        Assert.Eq(max.Hwnd, Presentation.CoveringWindow(new List<Presentation.TopWindow> { max }, Projector), "a borderless window maximized over the monitor");
        max.Framed = true;
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(new List<Presentation.TopWindow> { max }, Projector),
            "a maximized window with a frame (a title bar or just a sizing frame) on a monitor without a taskbar is not full screen");
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(new List<Presentation.TopWindow>(), Projector), "no windows");
        Assert.Eq(IntPtr.Zero, Presentation.CoveringWindow(null, Projector), "nothing known");
    }

    // The coordinator's cases: presenter view on monitor A, the slide show on B.
    public static void Test_PresenterViewWithThePetOnTheProjector()
    {
        Presentation.State s = Presentation.Decide(false, PresenterView(), Monitors, Projector);
        Assert.True(s.On && s.Here, "pet on B (the slide show): here");
        Assert.Eq(Slides, s.Window, "behind the slide show");
        Assert.Eq((Rectangle?)Projector, s.Monitor, "reports the projector");
    }

    public static void Test_PresenterViewWithThePetOnTheLaptop()
    {
        Presentation.State s = Presentation.Decide(false, PresenterView(), Monitors, Laptop);
        Assert.True(s.On && !s.Here, "pet on A (presenter view, not full screen): on, not here");
        Assert.Eq(IntPtr.Zero, s.Window, "nothing to step behind");
        Assert.Eq((Rectangle?)Projector, s.Monitor, "reports the projector, where the full-screen window is");
    }

    public static void Test_DecideCombinesQunsAndMonitors()
    {
        var nothing = new List<Presentation.TopWindow> { W(new IntPtr(9), new Rectangle(100, 100, 800, 600)) };
        Presentation.State s = Presentation.Decide(false, nothing, Monitors, Laptop);
        Assert.True(!s.On && !s.Here && !s.Monitor.HasValue && s.Window == IntPtr.Zero, "nothing full screen");
        s = Presentation.Decide(true, nothing, Monitors, Laptop);
        Assert.True(s.On && !s.Here && !s.Monitor.HasValue, "QUNS alone: on (reminders wait), no monitor, not here");
        var fullOnLeft = new List<Presentation.TopWindow> { W(Slides, Display1) };
        s = Presentation.Decide(false, fullOnLeft, Monitors, Display1);
        Assert.True(s.On && s.Here && s.Window == Slides, "full screen on the pet's monitor, without QUNS and whatever is foreground");
        s = Presentation.Decide(false, fullOnLeft, Monitors, null);
        Assert.True(s.On && !s.Here, "no pet window yet: never here");
        s = Presentation.Decide(false, fullOnLeft, Monitors, Laptop);
        Assert.True(s.On && !s.Here && s.Monitor == Display1, "on another monitor: on, not here");
        s = Presentation.Decide(false, fullOnLeft, new Rectangle[0], Display1);
        Assert.True(s.On && s.Here, "the pet's monitor counts even when the monitor list is missing");
    }

    // The flips over a fake z-order: Changed once per change of on or here; WindowChanged when another window covers the
    // pet's monitor while here stays true (review Minor 1: the pet must step behind that one too).
    public static void Test_HereFollowsTheZOrder()
    {
        List<Presentation.TopWindow> z = new List<Presentation.TopWindow>();
        Rectangle? pet = Display1;
        var changes = new List<string>();
        using (var p = new Presentation(delegate { return 5; }, delegate { return z; }, delegate { return Monitors; }, delegate { return pet; }))
        {
            p.Changed += delegate { changes.Add(p.On + "/" + p.Here); };
            p.WindowChanged += delegate { changes.Add("window " + p.Window); };
            p.Poll();
            z = new List<Presentation.TopWindow> { W(Slides, Display1) };
            p.Poll();
            Assert.True(p.On && p.Here && p.Window == Slides, "full screen on the pet's monitor");
            p.Poll();
            IntPtr video = new IntPtr(0x61);
            z = new List<Presentation.TopWindow> { W(video, Display1) };   // the slide show closed over a full-screen video
            p.Poll();
            Assert.True(p.On && p.Here && p.Window == video, "still here, behind another window");
            p.Poll();
            pet = Laptop;
            p.Poll();
            Assert.True(p.On && !p.Here, "the pet moved to another monitor");
            z = new List<Presentation.TopWindow>();
            p.Poll();
            Assert.True(!p.On && !p.Here && !p.Monitor.HasValue, "over");
            Assert.Eq("True/True,window " + video + ",True/False,False/False", string.Join(",", changes.ToArray()),
                "one Changed per flip, one WindowChanged per new covering window while here");
        }
    }

    // The desktop and the shell cover a monitor without being full screen (review Minor 6): the desktop, the taskbars,
    // Start / Search / the action centre, Alt+Tab and Task View (Windows 10 and 11).
    public static void Test_ShellClasses()
    {
        foreach (string c in new[] { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow",
            "XamlExplorerHostIslandWindow", "MultitaskingViewFrame", "TaskSwitcherWnd", "ForegroundStaging" })
            Assert.True(Presentation.ShellClass(c), c + " is the shell");
        foreach (string c in new[] { "screenClass", "Chrome_WidgetWin_1", "ApplicationFrameWindow", "WindowsForms10.Window.8.app.0.1",
            "progman", "", null })
            Assert.True(!Presentation.ShellClass(c), (c ?? "null") + " is not");
    }

    // The window events that can change what is in front (hooked with WINEVENT_OUTOFCONTEXT, own process skipped): only
    // a top-level window's own event counts (not the caret, the cursor or a child control).
    public static void Test_RelevantWindowEvents()
    {
        foreach (uint ev in new uint[] { 0x0003, 0x0016, 0x0017, 0x8002, 0x8003, 0x800B, 0x8017, 0x8018 })
            Assert.True(Presentation.Relevant(ev, 0, 0, true), ev.ToString("x") + " of a top-level window");
        Assert.True(!Presentation.Relevant(0x800B, -9, 0, false), "the cursor moving");
        Assert.True(!Presentation.Relevant(0x800B, -8, 0, true), "a caret moving");
        Assert.True(!Presentation.Relevant(0x800B, 0, 3, true), "a child element");
        Assert.True(!Presentation.Relevant(0x800B, 0, 0, false), "a child window");
        Assert.True(!Presentation.Relevant(0x8005, 0, 0, true), "focus inside an app");
    }
}
