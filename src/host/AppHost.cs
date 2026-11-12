using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

// The running app. Owns the one PetWindow and wires it to the page (Bridge messages), the tray menu, the
// hide hotkey, the capture guard, session events and the user's files (settings.json, history.json,
// window.json in %AppData%\錢進中).
//
// Window rules
// - The window is created hidden with the capture guard already on, and first shown after the page's first
//   setLayout, so it never flashes at a wrong size. Until then only the tray icon is visible.
// - Positions are per layout (physical px, window.json), owned by the host, saved when a move ends (which
//   also sends dragEnd). A layout switch restores that layout's position through ScreenFit.Clamp.
// - U7 and M3 never take focus when clicked; the other layouts activate normally (keyboard input).
// - While the window is hidden or the session is locked the page gets visibility {visible:false} and the hit
//   poll stops; showing / unlocking reverses both.
// Host-only menu actions: toggleVisible (a hidden page cannot show itself) and quit (sent to the page as
// menu {action:'quit'} so it can save and answer quit {}; the host exits anyway after QuitWaitMs).
public class AppHost
{
    public const string Version = "0.7.0-dev";
    const string Origin = "https://app.qjz/";
    const string DefaultHotkey = "Ctrl+Alt+H";
    const int MaxCssSize = 4096;     // largest page size accepted from setLayout, CSS px
    const int MaxHitRects = 64;
    const int MaxLayoutName = 32;
    const int DefaultMargin = 24;    // physical px from the work-area corner for a first-ever position
    const int ProbeWaitMs = 3000;    // longest wait for the event-log probe before init goes out without it
    const int QuitWaitMs = 1500;     // how long quit waits for the page's quit {}
    const int RetryMs = 10000;       // retry interval while a file write is pending
    const int MaxPageCrashes = 3;    // page reloads after renderer crashes allowed per minute

    readonly string startUrl;
    readonly bool devPage;
    readonly PetWindow window;
    readonly TrayMenu tray = new TrayMenu();
    readonly SavedText settings;
    readonly SavedText history;
    readonly SavedText windowFile;
    readonly AutoStart autoStart = new AutoStart();
    readonly PauseGate gate = new PauseGate();
    readonly Dictionary<string, bool> topmost = new Dictionary<string, bool>();   // per layout, learned from setTopmost
    readonly ApplicationContext context = new ApplicationContext();
    readonly System.Windows.Forms.Timer retryTimer = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer quitTimer = new System.Windows.Forms.Timer();
    WindowPositions positions = new WindowPositions();
    SessionWatcher session;
    Bridge bridge;
    bool pageReady;              // the current page has loaded and may receive messages
    int navigation;              // bumps on every navigation, so a slow init for an old page is dropped
    string layout;               // layout of the last setLayout; null before the first
    bool placed;                 // the window has a position
    bool wantVisible = true;     // the user's show/hide choice (hotkey, tray, menu, hide {})
    bool captureGuard = true;
    string hotkey;               // the registered combo; null when none is registered
    object hotkeyFailure;        // hotkeyFailed payload waiting for the page (startup registration failed)
    IntPtr focusBeforeMenu;      // foreground window to give focus back to after a no-activate context menu
    DateTime firstCrash;         // start of the current one-minute window of page crashes
    int crashes;
    SynchronizationContext ui;
    bool quitting;

    // page: file under the web root to load (index.html, or a dev page). devPage: a dev run (--page/--spike),
    // which never touches the autostart Run value.
    public AppHost(string page, bool devPage)
    {
        startUrl = Origin + page;
        this.devPage = devPage;
        topmost["U7"] = true;    // the floating layouts default to topmost, as in settings DEFAULTS
        topmost["M3"] = true;
        settings = new SavedText(new TextStore(Path.Combine(AppPaths.DataDir, "settings.json")), Logger("settings.json"));
        history = new SavedText(new TextStore(Path.Combine(AppPaths.DataDir, "history.json")), Logger("history.json"));
        windowFile = new SavedText(new TextStore(Path.Combine(AppPaths.DataDir, "window.json")), Logger("window.json"));

        window = new PetWindow(startUrl);
        window.StartPosition = FormStartPosition.Manual;   // the host places it
        window.HandleCreated += delegate { OnHandleCreated(); };
        window.InitFailed += delegate(string message) { Fatal("window init failed", message); };
        window.WebReady += delegate { OnWebReady(); };
        window.MoveEnded += delegate { OnMoveEnded(); };
        window.HotKeyPressed += delegate(int id) { if (id == HotKey.Id) ToggleVisible(); };
        window.FormClosing += OnClosing;

        retryTimer.Interval = RetryMs;
        retryTimer.Tick += delegate { FlushFiles(); };
        quitTimer.Interval = QuitWaitMs;
        quitTimer.Tick += delegate { Quit(); };
    }

    public void Run()
    {
        if (!(SynchronizationContext.Current is WindowsFormsSynchronizationContext))
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
        ui = SynchronizationContext.Current;
        settings.Load();
        history.Load();
        positions = WindowPositions.Parse(windowFile.Load());
        if (!devPage && !settings.ReadFailed) SetAutoStart(AutoStart.SettingOn(settings.Text));   // re-points a stale Run value

        tray.ItemClicked += OnMenu;
        tray.IconDoubleClick += delegate { ToggleVisible(); };
        tray.Menu.Closed += delegate { RestoreFocusAfterMenu(); };
        tray.ShowIcon();
        UpdateTray();

        session = new SessionWatcher();
        session.Activity += OnSession;
        SingleInstance.Listen(OnSecondInstance);

        window.CreateHidden();   // capture guard + hotkey (OnHandleCreated), then the page loads while hidden
        Application.Run(context);
    }

    // ---- window lifecycle ----

    void OnHandleCreated()
    {
        ApplyCaptureGuard();
        string combo = hotkey ?? DefaultHotkey;
        if (HotKey.Register(window.Handle, combo)) hotkey = combo;
        else
        {
            ErrorLog.Write("hotkey " + combo + " could not be registered (error " + Marshal.GetLastWin32Error() + ")");
            hotkey = null;
            hotkeyFailure = new { combo = combo, reason = "taken", active = (string)null };
        }
    }

    // The window cannot work (setup failed, WebView2 is gone): one short message, then quit.
    void Fatal(string what, string message)
    {
        ErrorLog.Write(what + ": " + message);
        if (quitting) return;
        MessageBox.Show("錢進中無法顯示畫面，需要關閉。\n\n" + message + "\n\n詳細資訊：" + ErrorLog.FilePath,
            "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Quit();
    }

    void OnWebReady()
    {
        CoreWebView2 web = window.Web;
        bridge = new Bridge(web);
        bridge.Received += OnPageMessageSafe;
        web.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
        {
            if (!e.Uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase)) { e.Cancel = true; return; }   // stay on the app's pages
            pageReady = false;
            navigation++;
        };
        web.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
        web.NavigationCompleted += delegate(object s, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess) { ErrorLog.Write("page failed to load: " + e.WebErrorStatus); return; }
            pageReady = true;
            SendInit(navigation);
        };
        web.ProcessFailed += delegate(object s, CoreWebView2ProcessFailedEventArgs e) { OnProcessFailed(e.ProcessFailedKind); };
    }

    // A crashed or hung page is reloaded (a few times per minute at most); without the browser process the
    // window is dead, so that is fatal.
    void OnProcessFailed(CoreWebView2ProcessFailedKind kind)
    {
        ErrorLog.Write("WebView2 process failed: " + kind);
        if (quitting) return;
        if (kind == CoreWebView2ProcessFailedKind.BrowserProcessExited) { Fatal("WebView2 browser process exited", "WebView2 已停止執行。"); return; }
        if (kind != CoreWebView2ProcessFailedKind.RenderProcessExited && kind != CoreWebView2ProcessFailedKind.RenderProcessUnresponsive) return;
        DateTime now = DateTime.UtcNow;
        if (crashes == 0 || now - firstCrash > TimeSpan.FromMinutes(1)) { firstCrash = now; crashes = 0; }
        if (++crashes > MaxPageCrashes) { Fatal("page keeps crashing", "畫面一直無法正常執行。"); return; }
        try { window.Web.Reload(); }
        catch (Exception ex) { ErrorLog.Write("reload after a page crash", ex); }
    }

    async void SendInit(int nav)
    {
        long? probe = null;
        try
        {
            DateTime dayStart = DayStart(DateTime.Now);
            Task<long?> t = Task.Run(delegate { return EventLogProbe.EarliestToday(dayStart); });
            if (await Task.WhenAny(t, Task.Delay(ProbeWaitMs)) == t) probe = t.Result;
        }
        catch (Exception ex) { ErrorLog.Write("event log probe", ex); }
        if (nav != navigation || !pageReady || quitting) return;   // the page changed meanwhile
        Send("init", new { settings = settings.Text, history = history.Text, probeMs = probe, nowMs = NowMs(), version = Version });
        Send("visibility", new { visible = gate.Running });
        if (hotkeyFailure != null)
        {
            Send("hotkeyFailed", hotkeyFailure);
            hotkeyFailure = null;
        }
    }

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        if (quitting) return;
        if (e.CloseReason == CloseReason.UserClosing)
        {
            // Alt+F4 on the window: hide it; the tray icon and the hotkey bring it back, 結束 quits.
            e.Cancel = true;
            wantVisible = false;
            ApplyVisibility();
            return;
        }
        Shutdown();   // Windows is ending the session (or the process is being closed): save what we have
        tray.Dispose();
        context.ExitThread();
    }

    // ---- page messages ----

    void OnPageMessageSafe(string type, Dictionary<string, object> d)
    {
        try
        {
            if (ErrorLog.Tracing) ErrorLog.Trace("<- " + type + (type.StartsWith("save") ? "" : " " + Bridge.BuildMessage(type, d)));
            OnPageMessage(type, d);
        }
        catch (Exception ex)
        {
            ErrorLog.Write("page message '" + type + "' failed", ex);   // one bad message must not take the host down
        }
    }

    void OnPageMessage(string type, Dictionary<string, object> d)
    {
        switch (type)
        {
            case "saveSettings": Save(settings, Bridge.Str(d, "text")); break;
            case "saveHistory": Save(history, Bridge.Str(d, "text")); break;
            case "backupCorrupt": BackupCorrupt(Bridge.Str(d, "file")); break;
            case "setLayout": SetLayout(d); break;
            case "hitRects": window.SetHitRects(Bridge.Rects(d, "rects", MaxHitRects), Dpr(d)); break;
            case "dragStart": window.BeginDrag(); break;
            case "contextMenu": ShowContextMenu(); break;
            case "setTopmost":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on == null) break;
                    if (layout != null) topmost[layout] = on.Value;
                    window.TopMostEnabled = on.Value;
                    UpdateTray();
                    break;
                }
            case "setAutostart":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on != null && !devPage) SetAutoStart(on.Value);
                    break;
                }
            case "setCaptureGuard":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on == null) break;
                    captureGuard = on.Value;
                    ApplyCaptureGuard();
                    break;
                }
            case "setHotkey": ChangeHotkey(Bridge.Str(d, "combo")); break;
            case "hide": wantVisible = false; ApplyVisibility(); break;
            case "quit": Quit(); break;
        }
    }

    void Send(string type, object payload)
    {
        if (bridge == null || !pageReady) return;
        try
        {
            if (ErrorLog.Tracing) ErrorLog.Trace(type == "init" ? "-> init" : "-> " + Bridge.BuildMessage(type, payload));
            bridge.Send(type, payload);
        }
        catch (Exception ex) { ErrorLog.Write("send '" + type + "' failed", ex); }
    }

    // ---- layout, position, topmost ----

    void SetLayout(Dictionary<string, object> d)
    {
        string name = Bridge.Str(d, "layout");
        double w = Bridge.Num(d, "width", 0), h = Bridge.Num(d, "height", 0);
        if (string.IsNullOrEmpty(name) || name.Length > MaxLayoutName || !(w >= 1) || !(h >= 1)) return;
        bool changed = name != layout;
        layout = name;
        window.NoActivate = name == "U7" || name == "M3";
        window.SetContentSize((int)Math.Ceiling(Math.Min(w, MaxCssSize)), (int)Math.Ceiling(Math.Min(h, MaxCssSize)), Dpr(d));
        if (changed)
        {
            Place();
            bool on;
            window.TopMostEnabled = topmost.TryGetValue(name, out on) && on;
        }
        UpdateTray();
        ApplyVisibility();   // the first setLayout shows the window
    }

    // Saved position for the layout (kept on screen by ScreenFit.Clamp); a layout without one stays where the
    // window is (fully inside its monitor); the very first one goes to the primary work area's bottom-right.
    void Place()
    {
        Rectangle[] areas = WorkAreas();
        Size size = window.Size;
        Point saved;
        Rectangle target;
        bool hostChosen;   // false: the user's own saved spot, kept as it is (Clamp left it alone)
        if (positions.TryGet(layout, out saved))
        {
            Rectangle user = new Rectangle(saved, size);
            target = ScreenFit.Clamp(user, areas);
            hostChosen = target != user;
        }
        else if (placed)
        {
            Rectangle here = new Rectangle(window.Location, size);
            target = ScreenFit.MoveInside(here, ScreenFit.NearestArea(here, areas));
            hostChosen = true;
        }
        else
        {
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            target = ScreenFit.MoveInside(new Rectangle(wa.Right - size.Width - DefaultMargin, wa.Bottom - size.Height - DefaultMargin, size.Width, size.Height), wa);
            hostChosen = true;
        }
        window.Bounds = target;
        placed = true;
        // Landing on a monitor with another DPI resizes the window (WM_DPICHANGED): a spot the host chose stays
        // fully inside, the user's own spot only gets the Clamp rule.
        Rectangle now = window.Bounds;
        Rectangle fit = hostChosen ? ScreenFit.MoveInside(now, ScreenFit.NearestArea(now, areas)) : ScreenFit.Clamp(now, areas);
        if (fit != now) window.Bounds = fit;
    }

    void OnMoveEnded()
    {
        if (layout != null)
        {
            positions.Set(layout, window.Location);
            Save(windowFile, positions.ToJson());
        }
        Send("dragEnd", null);
    }

    static Rectangle[] WorkAreas()
    {
        Screen[] screens = Screen.AllScreens;
        Rectangle[] areas = new Rectangle[screens.Length];
        for (int i = 0; i < screens.Length; i++) areas[i] = screens[i].WorkingArea;
        return areas;
    }

    static double Dpr(Dictionary<string, object> d)
    {
        double v = Bridge.Num(d, "dpr", 0);
        return v > 0 && v <= 8 ? v : 0;   // 0 = not reported
    }

    // ---- visibility and pause ----

    void ToggleVisible()
    {
        wantVisible = !wantVisible;
        ApplyVisibility();
    }

    void ApplyVisibility()
    {
        bool show = wantVisible && layout != null && !quitting;
        if (show && !window.Visible) window.Show();   // never activates (PetWindow.ShowWithoutActivation)
        else if (!show && window.Visible) window.Hide();
        if (gate.SetShown(window.Visible)) PauseChanged();
        UpdateTray();
    }

    void OnSession(string kind, long ms)
    {
        Send("session", new { kind = kind, ms = ms });
        if (kind == "lock" && gate.SetLocked(true)) PauseChanged();
        else if ((kind == "unlock" || kind == "logon") && gate.SetLocked(false)) PauseChanged();
    }

    void PauseChanged()
    {
        window.SuspendHitPolling(!gate.Running);
        Send("visibility", new { visible = gate.Running });
    }

    void OnSecondInstance()
    {
        if (quitting) return;
        wantVisible = true;
        ApplyVisibility();
        if (!window.Visible) return;
        if (window.NoActivate)
            Native.SetWindowPos(window.Handle, Native.HWND_TOP, 0, 0, 0, 0, Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
        else Native.SetForegroundWindow(window.Handle);   // allowed: the second instance called AllowSetForegroundWindow
    }

    void UpdateTray()
    {
        tray.SetState(layout, window.TopMostEnabled, wantVisible);
    }

    // ---- menu ----

    void OnMenu(string action)
    {
        if (action == "toggleVisible") { ToggleVisible(); return; }
        if (action == "quit") { BeginQuit(); return; }
        if (action != "topmost" && !wantVisible) { wantVisible = true; ApplyVisibility(); }   // the user wants to see the result
        Send("menu", new { action = action });
    }

    // The menu needs the foreground to close on an outside click (the same as the tray icon does); in the
    // no-activate layouts the previous foreground window gets focus back once it closes.
    void ShowContextMenu()
    {
        Point at = Cursor.Position;
        IntPtr fg = Native.GetForegroundWindow();
        focusBeforeMenu = window.NoActivate && fg != window.Handle ? fg : IntPtr.Zero;
        if (window.Visible) Native.SetForegroundWindow(window.Handle);
        tray.ShowAt(at);
    }

    void RestoreFocusAfterMenu()
    {
        IntPtr back = focusBeforeMenu;
        focusBeforeMenu = IntPtr.Zero;
        if (back != IntPtr.Zero && window.NoActivate && Native.GetForegroundWindow() == window.Handle) Native.SetForegroundWindow(back);
    }

    // ---- settings the page controls ----

    void ApplyCaptureGuard()
    {
        if (!window.IsHandleCreated) return;
        if (!CaptureGuard.Apply(window.Handle, captureGuard))
            ErrorLog.Write("capture guard " + (captureGuard ? "on" : "off") + " failed (error " + Marshal.GetLastWin32Error() + ")");
    }

    void ChangeHotkey(string combo)
    {
        string wanted = HotKey.Normalize(combo);
        if (wanted == null)
        {
            Send("hotkeyFailed", new { combo = combo, reason = "invalid", active = hotkey });
            return;
        }
        if (wanted == hotkey || !window.IsHandleCreated) return;
        if (HotKey.Register(window.Handle, wanted)) { hotkey = wanted; return; }
        ErrorLog.Write("hotkey " + wanted + " could not be registered (error " + Marshal.GetLastWin32Error() + ")");
        string previous = hotkey;   // Register dropped it; keep it working
        hotkey = previous != null && HotKey.Register(window.Handle, previous) ? previous : null;
        Send("hotkeyFailed", new { combo = wanted, reason = "taken", active = hotkey });
    }

    void SetAutoStart(bool on)
    {
        try { autoStart.Set(on, Application.ExecutablePath); }
        catch (Exception ex) { ErrorLog.Write("autostart " + (on ? "on" : "off"), ex); }
    }

    // ---- files ----

    void Save(SavedText file, string text)
    {
        if (text == null) return;
        if (!file.Save(text)) retryTimer.Start();   // kept in memory; retried on the next save or the timer
    }

    void FlushFiles()
    {
        bool done = settings.Flush() & history.Flush() & windowFile.Flush();
        if (done) retryTimer.Stop();
    }

    void BackupCorrupt(string file)
    {
        SavedText target = file == "settings" ? settings : file == "history" ? history : null;
        if (target == null) return;
        try { target.Store.BackupCorrupt(); }
        catch (Exception ex) { ErrorLog.Write("backup of corrupt " + file, ex); }
    }

    static Action<string, Exception> Logger(string name)
    {
        return delegate(string what, Exception ex) { ErrorLog.Write(name + ": " + what, ex); };
    }

    // ---- quit ----

    void BeginQuit()
    {
        if (quitting) return;
        if (!pageReady) { Quit(); return; }
        Send("menu", new { action = "quit" });   // the page saves and answers quit {}
        quitTimer.Start();
    }

    void Quit()
    {
        if (quitting) return;
        Shutdown();
        // Deferred: Quit runs inside WebView2 and menu event handlers, which must return before their objects go.
        ui.Post(delegate
        {
            tray.Dispose();   // removes the tray icon
            window.Close();
            window.Dispose();
            context.ExitThread();
        }, null);
    }

    // Saves and releases everything that outlives the window (files, hotkey, session events, the instance mutex).
    void Shutdown()
    {
        quitting = true;
        quitTimer.Stop();
        retryTimer.Stop();
        FlushFiles();
        if (window.IsHandleCreated) HotKey.Unregister(window.Handle);
        if (session != null) session.Dispose();
        SingleInstance.Stop();
    }

    // ---- time ----

    // The page's day starts at 04:00 local time.
    static DateTime DayStart(DateTime now)
    {
        DateTime d = now.Date.AddHours(4);
        return now >= d ? d : d.AddDays(-1);
    }

    static long NowMs()
    {
        return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }
}
