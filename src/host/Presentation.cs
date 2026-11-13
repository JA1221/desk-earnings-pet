using System;
using System.Collections.Generic;
using System.Drawing;
using System.Text;
using System.Windows.Forms;

// Whether something runs full screen (spec 5.1, 6; 1.1.1 item 7), per monitor.
// - A monitor is full screen when the first window in z-order (from the top) that overlaps any part of it covers the
//   whole monitor rect (not the work area), whether or not it is the foreground window (CoveringWindow). Skipped on the
//   way down: this app's own windows, the desktop and the shell, cloaked, invisible, minimized and zero-size windows,
//   tool windows (WS_EX_TOOLWINDOW) and click-through overlays. A maximized window with a title bar does not count: on a
//   monitor without a taskbar it covers the monitor too. Bounds are the visible frame, so a maximized window's invisible
//   borders never reach into the next monitor. PowerPoint with Presenter View: the slide show covers the projector
//   while the presenter view is the foreground window on the laptop.
// - On (the page holds its reminders): Windows reports a fullscreen app or presentation mode
//   (SHQueryUserNotificationState, no permission needed), or any monitor is full screen. A projector or a meeting-room
//   screen is outside the capture guard's protection.
// - Here: the pet window's monitor is full screen. AppHost steps the window back behind Window then (topmost off
//   through ApplyTopmost, below it in the z-order) and sends the page fullscreen {on, here}. Monitor is the full-screen
//   monitor that matters: the pet's when here, else the first full-screen one (null for QUNS alone).
// Checked every 2 s on the UI thread, 150 ms after a top-level window of another process comes to the foreground,
// shows, hides, moves or sizes, is minimized or restored, or is cloaked (WinEvent hooks, out of context), and whenever
// the host asks (Poll). Changed fires only when on or here flips.
public class Presentation : IDisposable
{
    const int PollMs = 2000;
    const int SettleMs = 150;     // window events within this long are one check
    const int MaxWindows = 4000;  // top-level windows looked at, at most
    // QUERY_USER_NOTIFICATION_STATE values that hold reminders
    const int QUNS_BUSY = 2;                      // a fullscreen app (or one that asked not to be disturbed)
    const int QUNS_RUNNING_D3D_FULL_SCREEN = 3;   // a Direct3D fullscreen game or video
    const int QUNS_PRESENTATION_MODE = 4;         // presentation settings / a slide show
    // WinEvents that can change what is in front of a monitor (hooked in these ranges)
    const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    const uint EVENT_SYSTEM_MINIMIZESTART = 0x0016, EVENT_SYSTEM_MINIMIZEEND = 0x0017;
    const uint EVENT_OBJECT_SHOW = 0x8002, EVENT_OBJECT_HIDE = 0x8003;
    const uint EVENT_OBJECT_LOCATIONCHANGE = 0x800B;
    const uint EVENT_OBJECT_CLOAKED = 0x8017, EVENT_OBJECT_UNCLOAKED = 0x8018;
    static readonly uint[][] HookRanges = {
        new[] { EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND }, new[] { EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND },
        new[] { EVENT_OBJECT_SHOW, EVENT_OBJECT_HIDE }, new[] { EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE },
        new[] { EVENT_OBJECT_CLOAKED, EVENT_OBJECT_UNCLOAKED } };
    const int OBJID_WINDOW = 0, CHILDID_SELF = 0;
    // The desktop and the shell, which cover a monitor without being full screen: the desktop (Progman, WorkerW), the
    // taskbars, Start / Search / the action centre (CoreWindow), Alt+Tab and Task View.
    static readonly string[] ShellClasses = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow", "XamlExplorerHostIslandWindow", "MultitaskingViewFrame", "TaskSwitcherWnd", "ForegroundStaging" };
    static readonly uint OwnPid = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    readonly Func<int> query;
    readonly Func<IList<TopWindow>> zOrder;
    readonly Func<Rectangle[]> monitors;
    readonly Func<Rectangle?> petMonitor;
    readonly List<IntPtr> hooks = new List<IntPtr>();
    Native.WinEventProc hookProc;   // kept alive while hooked
    System.Windows.Forms.Timer timer;
    System.Windows.Forms.Timer settle;

    // One top-level window, as the z-order walk sees it (ZOrder in the app, fakes in tests). Physical px.
    public struct TopWindow
    {
        public IntPtr Hwnd;
        public Rectangle Bounds;   // the visible frame
        public bool Skipped;       // ours, the desktop / shell, cloaked, invisible, minimized, a tool window or a click-through overlay
        public bool Maximized;
        public bool Framed;        // a caption or a sizing frame (WS_DLGFRAME / WS_THICKFRAME)
    }

    // What Decide found.
    public struct State
    {
        public bool On;
        public bool Here;
        public Rectangle? Monitor;
        public IntPtr Window;
    }

    // QUNS only (tests of the QUNS rule).
    public Presentation(Func<int> query) : this(query, null, null, null)
    {
    }

    // query: the current QUNS state, or -1 when unknown (Query). zOrder: the top-level windows, top first (ZOrder).
    // monitors: every monitor's rect (MonitorRects). petMonitor: the pet window's monitor rect, null before it has a place.
    public Presentation(Func<int> query, Func<IList<TopWindow>> zOrder, Func<Rectangle[]> monitors, Func<Rectangle?> petMonitor)
    {
        this.query = query;
        this.zOrder = zOrder;
        this.monitors = monitors;
        this.petMonitor = petMonitor;
    }

    public event Action Changed;

    // Something is full screen (false until a poll says otherwise): the page holds its reminders.
    public bool On { get; private set; }

    // The pet window's monitor is full screen: the window steps back behind Window.
    public bool Here { get; private set; }

    // The full-screen monitor that matters (the pet's when here, else the first one), null when none.
    public Rectangle? Monitor { get; private set; }

    // The window that covers the pet's monitor, IntPtr.Zero unless here.
    public IntPtr Window { get; private set; }

    // Ruling: 7 (QUNS_APP, a Store app in the foreground) is not busy, so a windowed Store app does not hold reminders.
    // 1 (locked, screen saver, another user) is the session's business (session lock / unlock).
    public static bool IsBusy(int state)
    {
        return state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE;
    }

    // The window that makes monitor full screen, or IntPtr.Zero: walking zOrder from the top, the first window that is
    // not skipped, has an area and overlaps monitor, when it covers the whole monitor rect and is not a maximized window
    // with a frame.
    public static IntPtr CoveringWindow(IList<TopWindow> zOrder, Rectangle monitor)
    {
        if (zOrder == null || monitor.Width <= 0 || monitor.Height <= 0) return IntPtr.Zero;
        foreach (TopWindow w in zOrder)
        {
            if (w.Skipped || w.Bounds.Width <= 0 || w.Bounds.Height <= 0 || !w.Bounds.IntersectsWith(monitor)) continue;
            return w.Bounds.Contains(monitor) && !(w.Maximized && w.Framed) ? w.Hwnd : IntPtr.Zero;
        }
        return IntPtr.Zero;
    }

    // On: qunsBusy or any monitor full screen. Here: petMonitor is full screen (Window covers it).
    public static State Decide(bool qunsBusy, IList<TopWindow> zOrder, Rectangle[] monitors, Rectangle? petMonitor)
    {
        State s = new State();
        if (petMonitor.HasValue)
        {
            s.Window = CoveringWindow(zOrder, petMonitor.Value);
            s.Here = s.Window != IntPtr.Zero;
            if (s.Here) s.Monitor = petMonitor.Value;
        }
        if (!s.Here && monitors != null)
            foreach (Rectangle m in monitors)
                if (CoveringWindow(zOrder, m) != IntPtr.Zero) { s.Monitor = m; break; }
        s.On = qunsBusy || s.Monitor.HasValue;
        return s;
    }

    // A WinEvent worth a check: a top-level window's own event (not a caret, the cursor or a child element) of a kind
    // that can change what is in front.
    public static bool Relevant(uint eventType, int idObject, int idChild, bool topLevel)
    {
        if (!topLevel || idObject != OBJID_WINDOW || idChild != CHILDID_SELF) return false;
        foreach (uint[] r in HookRanges)
            if (eventType >= r[0] && eventType <= r[1]) return true;
        return false;
    }

    // Window classes of the desktop and the shell (never full screen).
    public static bool ShellClass(string className)
    {
        return !string.IsNullOrEmpty(className) && Array.IndexOf(ShellClasses, className) >= 0;
    }

    // Windows' answer now, or -1 when the query fails.
    public static int Query()
    {
        try
        {
            int state;
            return Native.SHQueryUserNotificationState(out state) == 0 ? state : -1;
        }
        catch (Exception) { return -1; }
    }

    // Every monitor's rect (physical px).
    public static Rectangle[] MonitorRects()
    {
        Screen[] screens = Screen.AllScreens;
        Rectangle[] r = new Rectangle[screens.Length];
        for (int i = 0; i < screens.Length; i++) r[i] = screens[i].Bounds;
        return r;
    }

    // The top-level windows now, top of the z-order first. Never throws.
    public static IList<TopWindow> ZOrder()
    {
        List<TopWindow> list = new List<TopWindow>();
        try
        {
            IntPtr shell = Native.GetShellWindow(), desktop = Native.GetDesktopWindow();
            Native.EnumWindows(delegate(IntPtr h, IntPtr l)
            {
                list.Add(Describe(h, shell, desktop));
                return list.Count < MaxWindows;
            }, IntPtr.Zero);
        }
        catch (Exception) { }
        return list;
    }

    static TopWindow Describe(IntPtr h, IntPtr shell, IntPtr desktop)
    {
        TopWindow w = new TopWindow();
        w.Hwnd = h;
        w.Skipped = true;
        if (!Native.IsWindowVisible(h) || Native.IsIconic(h) || h == shell || h == desktop) return w;
        int ex = Native.GetWindowLong(h, Native.GWL_EXSTYLE);
        if ((ex & Native.WS_EX_TOOLWINDOW) != 0 || ((ex & Native.WS_EX_TRANSPARENT) != 0 && (ex & Native.WS_EX_LAYERED) != 0)) return w;
        uint pid;
        Native.GetWindowThreadProcessId(h, out pid);
        if (pid == OwnPid) return w;
        int cloaked;
        if (Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0) return w;
        if (ShellClass(ClassOf(h))) return w;
        w.Skipped = false;
        w.Bounds = CoverCheck.FrameBounds(h);
        w.Maximized = Native.IsZoomed(h);
        w.Framed = (Native.GetWindowLong(h, Native.GWL_STYLE) & (Native.WS_DLGFRAME | Native.WS_THICKFRAME)) != 0;
        return w;
    }

    static string ClassOf(IntPtr hwnd)
    {
        StringBuilder sb = new StringBuilder(256);
        return Native.GetClassName(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : null;
    }

    // Polls once now (so the first init already knows), then every PollMs, and SettleMs after window events.
    public void Start()
    {
        if (timer != null) return;
        Poll();
        timer = new System.Windows.Forms.Timer();
        timer.Interval = PollMs;
        timer.Tick += delegate { Poll(); };
        timer.Start();
        settle = new System.Windows.Forms.Timer();
        settle.Interval = SettleMs;
        settle.Tick += delegate { settle.Stop(); Poll(); };
        Hook();
    }

    // Out of context (delivered on this thread's message loop), other processes only; a range that cannot be hooked is
    // left to the 2 s poll.
    void Hook()
    {
        hookProc = OnWinEvent;
        foreach (uint[] r in HookRanges)
        {
            IntPtr h = Native.SetWinEventHook(r[0], r[1], IntPtr.Zero, hookProc, 0, 0,
                Native.WINEVENT_OUTOFCONTEXT | Native.WINEVENT_SKIPOWNPROCESS);
            if (h != IntPtr.Zero) hooks.Add(h);
        }
    }

    // The cursor and carets move all the time: those (no hwnd, or not OBJID_WINDOW) go before anything is asked.
    void OnWinEvent(IntPtr hook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
    {
        if (hwnd == IntPtr.Zero || idObject != OBJID_WINDOW || settle == null || settle.Enabled) return;
        if (Relevant(eventType, idObject, idChild, Native.GetAncestor(hwnd, Native.GA_ROOT) == hwnd)) settle.Start();
    }

    public void Poll()
    {
        bool busy = IsBusy(query());
        State s = Decide(busy, zOrder != null ? zOrder() : null, monitors != null ? monitors() : null, petMonitor != null ? petMonitor() : null);
        Monitor = s.Monitor;
        Window = s.Window;
        if (s.On == On && s.Here == Here) return;
        On = s.On;
        Here = s.Here;
        Action h = Changed;
        if (h != null) h();
    }

    public void Dispose()
    {
        foreach (IntPtr h in hooks) Native.UnhookWinEvent(h);
        hooks.Clear();
        if (settle != null) { settle.Stop(); settle.Dispose(); settle = null; }
        if (timer == null) return;
        timer.Stop();
        timer.Dispose();
        timer = null;
    }
}
