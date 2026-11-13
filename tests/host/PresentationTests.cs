using System;
using System.Collections.Generic;
using System.Drawing;

public static class PresentationTests
{
    static readonly Rectangle Display1 = new Rectangle(-1080, -445, 1080, 1920);   // the left portrait monitor
    static readonly Rectangle Display3 = new Rectangle(0, 0, 1920, 1080);         // the primary
    static readonly IntPtr Video = new IntPtr(0x1234);

    // A borderless window covering monitor exactly (a slide show, a video or a game in full screen).
    static Presentation.Foreground FullscreenOn(Rectangle monitor)
    {
        Presentation.Foreground f = new Presentation.Foreground();
        f.Hwnd = Video;
        f.Bounds = monitor;
        f.Monitor = monitor;
        return f;
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

    // 1.1.1 item 7: besides QUNS, the foreground window counts as full screen when it covers its whole monitor (the
    // monitor rect, not the work area).
    public static void Test_ForegroundCoveringItsMonitor()
    {
        Assert.True(Presentation.IsFullscreen(FullscreenOn(Display1)), "borderless, exactly the monitor");
        Presentation.Foreground f = FullscreenOn(Display3);
        f.Bounds = Rectangle.Inflate(Display3, 8, 8);
        Assert.True(Presentation.IsFullscreen(f), "larger than the monitor");
        f.Maximized = true;
        Assert.True(Presentation.IsFullscreen(f), "a borderless window maximized over the whole monitor");
        f.Framed = true;
        Assert.True(!Presentation.IsFullscreen(f), "a maximized window with a frame on a monitor without a taskbar is not full screen");
        f.Maximized = false;
        Assert.True(Presentation.IsFullscreen(f), "a framed window covering the monitor without being maximized counts");
        f = FullscreenOn(Display3);
        f.Bounds = new Rectangle(0, 0, 1920, 1032);
        Assert.True(!Presentation.IsFullscreen(f), "the work area only (the taskbar shows): not full screen");
        f.Bounds = new Rectangle(1, 0, 1920, 1080);
        Assert.True(!Presentation.IsFullscreen(f), "one px short of the left edge");
        f = FullscreenOn(Display1);
        f.Ignored = true;
        Assert.True(!Presentation.IsFullscreen(f), "the desktop, the shell, this app's own window, a hidden / minimized / cloaked one");
        f = FullscreenOn(Display1);
        f.Hwnd = IntPtr.Zero;
        Assert.True(!Presentation.IsFullscreen(f), "no foreground window");
        f = FullscreenOn(Display1);
        f.Monitor = Rectangle.Empty;
        Assert.True(!Presentation.IsFullscreen(f), "no monitor");
        Assert.True(!Presentation.IsFullscreen(new Presentation.Foreground()), "nothing at all");
    }

    // The desktop and the shell cover a monitor too: never full screen.
    public static void Test_ShellClasses()
    {
        foreach (string c in new[] { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow",
            "XamlExplorerHostIslandWindow", "MultitaskingViewFrame", "TaskSwitcherWnd", "ForegroundStaging" })
            Assert.True(Presentation.ShellClass(c), c + " is the shell");
        foreach (string c in new[] { "screenClass", "Chrome_WidgetWin_1", "ApplicationFrameWindow", "WindowsForms10.Window.8.app.0.1", "", null })
            Assert.True(!Presentation.ShellClass(c), (c ?? "null") + " is not");
    }

    // Here: the full-screen window is on the pet window's monitor. Changed fires when on or here flips; Monitor and
    // Window name the full-screen window and its monitor.
    public static void Test_HereOnlyOnThePetsMonitor()
    {
        Presentation.Foreground fg = new Presentation.Foreground();
        Rectangle? pet = Display1;
        var changes = new List<string>();
        using (var p = new Presentation(delegate { return 5; }, delegate { return fg; }, delegate { return pet; }))
        {
            p.Changed += delegate { changes.Add(p.On + "/" + p.Here); };
            p.Poll();
            Assert.True(!p.On && !p.Here, "nothing full screen");
            Assert.True(!p.Monitor.HasValue && p.Window == IntPtr.Zero, "no monitor, no window");
            fg = FullscreenOn(Display1);
            p.Poll();
            Assert.True(p.On && p.Here, "full screen on the pet's monitor");
            Assert.Eq((Rectangle?)Display1, p.Monitor, "reports the monitor");
            Assert.Eq(Video, p.Window, "and the window");
            p.Poll();
            pet = Display3;
            p.Poll();
            Assert.True(p.On && !p.Here, "the pet on another monitor: on, not here");
            Assert.Eq((Rectangle?)Display1, p.Monitor, "still that monitor");
            fg = FullscreenOn(Display3);
            p.Poll();
            Assert.True(p.On && p.Here, "a full-screen window on the pet's monitor again");
            pet = null;
            p.Poll();
            Assert.True(p.On && !p.Here, "no pet window yet: never here");
            fg = new Presentation.Foreground();
            p.Poll();
            Assert.True(!p.On && !p.Here, "over");
            Assert.True(!p.Monitor.HasValue && p.Window == IntPtr.Zero, "nothing reported");
            Assert.Eq("True/True,True/False,True/True,True/False,False/False", string.Join(",", changes.ToArray()), "one Changed per flip");
        }
    }

    // QUNS alone (presentation mode, or a full-screen app it saw but no covering foreground window) is on, not here:
    // reminders wait, the pet stays. A covering foreground window counts without QUNS.
    public static void Test_QunsAndForegroundCombine()
    {
        int state = 4;
        Presentation.Foreground fg = new Presentation.Foreground();
        using (var p = new Presentation(delegate { return state; }, delegate { return fg; }, delegate { return (Rectangle?)Display1; }))
        {
            p.Poll();
            Assert.True(p.On && !p.Here, "presentation mode: on, not here");
            fg = FullscreenOn(Display1);
            p.Poll();
            Assert.True(p.On && p.Here, "and a full-screen window on the pet's monitor: here");
            state = 5;
            p.Poll();
            Assert.True(p.On && p.Here, "the covering window alone");
            fg.Ignored = true;
            p.Poll();
            Assert.True(!p.On && !p.Here, "the shell in front: off");
        }
    }
}
