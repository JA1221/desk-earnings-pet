using System;
using System.Drawing;
using System.Text;
using System.Windows.Forms;

// Whether something runs full screen (spec 5.1, 6; 1.1.1 item 7). On when either
// - Windows reports a fullscreen app or presentation mode (SHQueryUserNotificationState, no permission needed): a
//   projector or a meeting-room screen is outside the capture guard's protection, so reminders wait; or
// - the foreground window covers its whole monitor (the monitor rect, not the work area) and is not the desktop, the
//   shell or this app's own window (IsFullscreen, Probe).
// Here: that full-screen foreground window is on the pet window's monitor. Monitor and Window name it while it is full
// screen. QUNS alone names no monitor, so it is on without here. AppHost steps the pet window back behind a window
// that is here (topmost off through ApplyTopmost, below it in the z-order) and sends the page fullscreen {on, here}.
// Polled every 2 s on the UI thread, and whenever the host asks (Poll: a user action, a layout switch, a drop);
// Changed fires only when on or here flips.
public class Presentation : IDisposable
{
    const int PollMs = 2000;
    // QUERY_USER_NOTIFICATION_STATE values that hold reminders
    const int QUNS_BUSY = 2;                      // a fullscreen app (or one that asked not to be disturbed)
    const int QUNS_RUNNING_D3D_FULL_SCREEN = 3;   // a Direct3D fullscreen game or video
    const int QUNS_PRESENTATION_MODE = 4;         // presentation settings / a slide show
    // Foreground windows of the desktop and the shell, which cover a monitor without being full screen: the desktop
    // (Progman, WorkerW), the taskbars, Start / Search / the action centre (CoreWindow), Alt+Tab and Task View.
    static readonly string[] ShellClasses = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow", "XamlExplorerHostIslandWindow", "MultitaskingViewFrame", "TaskSwitcherWnd", "ForegroundStaging" };
    static readonly uint OwnPid = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    readonly Func<int> query;
    readonly Func<Foreground> foreground;
    readonly Func<Rectangle?> petMonitor;
    System.Windows.Forms.Timer timer;

    // One look at the foreground window (Probe in the app, fakes in tests). Physical px.
    public struct Foreground
    {
        public IntPtr Hwnd;
        public Rectangle Bounds;    // its window rect
        public Rectangle Monitor;   // the whole monitor it is on (not the work area)
        public bool Ignored;        // the desktop, the shell, this app's own, or not visible / minimized / cloaked
        public bool Maximized;
        public bool Framed;         // a caption or a sizing frame (WS_DLGFRAME / WS_THICKFRAME)
    }

    // QUNS only (tests of the QUNS rule).
    public Presentation(Func<int> query) : this(query, null, null)
    {
    }

    // query: the current QUNS state, or -1 when unknown (Query). foreground: the foreground window now
    // (ProbeForeground). petMonitor: the monitor rect the pet window is on, null before it has a place.
    public Presentation(Func<int> query, Func<Foreground> foreground, Func<Rectangle?> petMonitor)
    {
        this.query = query;
        this.foreground = foreground;
        this.petMonitor = petMonitor;
    }

    public event Action Changed;

    // Something is full screen (false until a poll says otherwise): the page holds its reminders.
    public bool On { get; private set; }

    // The full-screen foreground window is on the pet window's monitor: the window steps back behind it.
    public bool Here { get; private set; }

    // The monitor (rect) of the full-screen foreground window, null when none (QUNS alone, or off).
    public Rectangle? Monitor { get; private set; }

    // The full-screen foreground window, IntPtr.Zero when none.
    public IntPtr Window { get; private set; }

    // Ruling: 7 (QUNS_APP, a Store app in the foreground) is not busy, so a windowed Store app does not hold reminders.
    // 1 (locked, screen saver, another user) is the session's business (session lock / unlock).
    public static bool IsBusy(int state)
    {
        return state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE;
    }

    // A foreground window is full screen when it covers its whole monitor. A maximized window with a frame is not: on
    // a monitor without a taskbar its rect (invisible borders included) covers the monitor too.
    public static bool IsFullscreen(Foreground fg)
    {
        if (fg.Hwnd == IntPtr.Zero || fg.Ignored || (fg.Maximized && fg.Framed)) return false;
        return fg.Monitor.Width > 0 && fg.Monitor.Height > 0 && fg.Bounds.Contains(fg.Monitor);
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

    // The foreground window now. A dev build takes QJZ_FAKE_FOREGROUND (a window handle, decimal) instead, so a live
    // check can stand a full-screen test window in front without ever activating it; once that window is gone it is
    // not visible, so nothing is full screen.
    public static Foreground ProbeForeground()
    {
        return Probe(FakeForeground != IntPtr.Zero ? FakeForeground : Native.GetForegroundWindow());
    }

    static readonly IntPtr FakeForeground = ReadFakeForeground();

    static IntPtr ReadFakeForeground()
    {
        if (Payload.IsRelease) return IntPtr.Zero;
        long h;
        string v = Environment.GetEnvironmentVariable("QJZ_FAKE_FOREGROUND");
        return !string.IsNullOrEmpty(v) && long.TryParse(v, out h) ? new IntPtr(h) : IntPtr.Zero;
    }

    // What IsFullscreen needs to know about hwnd. Never throws.
    public static Foreground Probe(IntPtr hwnd)
    {
        Foreground fg = new Foreground();
        fg.Hwnd = hwnd;
        if (hwnd == IntPtr.Zero) return fg;
        try
        {
            uint pid;
            Native.GetWindowThreadProcessId(hwnd, out pid);
            int cloaked;
            fg.Ignored = pid == OwnPid || hwnd == Native.GetDesktopWindow() || hwnd == Native.GetShellWindow() || ShellClass(ClassOf(hwnd))
                || !Native.IsWindowVisible(hwnd) || Native.IsIconic(hwnd)
                || (Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0);
            if (fg.Ignored) return fg;
            Native.RECT r;
            if (!Native.GetWindowRect(hwnd, out r)) { fg.Ignored = true; return fg; }
            fg.Bounds = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            fg.Monitor = Screen.FromHandle(hwnd).Bounds;
            fg.Maximized = Native.IsZoomed(hwnd);
            fg.Framed = (Native.GetWindowLong(hwnd, Native.GWL_STYLE) & (Native.WS_DLGFRAME | Native.WS_THICKFRAME)) != 0;
        }
        catch (Exception) { fg.Ignored = true; }
        return fg;
    }

    static string ClassOf(IntPtr hwnd)
    {
        StringBuilder sb = new StringBuilder(256);
        return Native.GetClassName(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : null;
    }

    // Polls once now (so the first init already knows), then every PollMs.
    public void Start()
    {
        if (timer != null) return;
        Poll();
        timer = new System.Windows.Forms.Timer();
        timer.Interval = PollMs;
        timer.Tick += delegate { Poll(); };
        timer.Start();
    }

    public void Poll()
    {
        bool busy = IsBusy(query());
        Foreground fg = foreground != null ? foreground() : new Foreground();
        bool full = IsFullscreen(fg);
        Rectangle? pet = full && petMonitor != null ? petMonitor() : null;
        bool on = busy || full;
        bool here = full && pet.HasValue && pet.Value == fg.Monitor;
        Monitor = full ? fg.Monitor : (Rectangle?)null;
        Window = full ? fg.Hwnd : IntPtr.Zero;
        if (on == On && here == Here) return;
        On = on;
        Here = here;
        Action h = Changed;
        if (h != null) h();
    }

    public void Dispose()
    {
        if (timer == null) return;
        timer.Stop();
        timer.Dispose();
        timer = null;
    }
}
