using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

// The running app: message routing between the page and the host, window visibility, and the app's lifecycle.
// It owns the one PetWindow, the tray menu, the hide hotkey, the capture guard and session events; window
// positions live in WindowPlacer, the user's files in UserFiles.
//
// - The window is created hidden with the capture guard already applied (settings.json privacy.hideFromCapture,
//   default on) and the configured hotkey (privacy.hotkey, default Ctrl+Alt+H) registered, and first shown after
//   the page's first setLayout, so it never flashes at a wrong size. Until then only the tray icon is visible.
// - Host -> page messages wait in the Bridge until the page's init, then go out in order. After every init the
//   page also gets the current state: visibility, a hotkey failure, unreadable files (storageError).
// - U7 and M3 never take focus when clicked; the other layouts activate normally (keyboard input).
// - Every show raises the window to the top of its band without activating it. Shows and panels the user asked
//   for from the tray or the menu also take the keyboard in the activating layouts (U1/U3/U5B/PANEL). The hotkey
//   hides only a window the user sees on top (ShowRescue.HotkeyHides); a covered one is raised instead.
// - While the window is hidden or the session is locked the page gets visibility {visible:false} and the hit
//   poll stops; showing / unlocking reverses both.
// - Alt+F4 hides the window. Any close from outside (WM_CLOSE, Windows ending the session) shuts the app down.
// - Every end (結束, a close from outside, Windows ending the session) records the time in session.json
//   (ExitStamp); the next start hands it to the page as init lastExitMs, with the .bak texts (init backups) and
//   whether the window had to go opaque (init forceOpaque).
// Host-only menu actions: toggleVisible (a hidden page cannot show itself) and quit (sent to the page as
// menu {action:'quit'} so it can save and answer quit {}; the host exits anyway after QuitWaitMs).
public class AppHost
{
    public const string Version = "1.0.0";   // also the exe's version block (AssemblyInfo.cs) and the page's 關於
    const string Origin = "https://app.qjz/";
    const int MaxCssSize = 4096;     // largest page size accepted from setLayout, CSS px
    const int MaxHitRects = 64;
    const int MaxLayoutName = 32;
    const int ProbeWaitMs = 3000;    // longest wait for the event-log probe before init goes out without it
    const int QuitWaitMs = 1500;     // how long quit waits for the page's quit {}
    const int MaxPageCrashes = 3;    // page reloads after renderer crashes allowed per minute
    const int FirstShowWaitMs = 4000;   // after navigation / init: no visible window by then -> safety net
    const int MenuActivateMs = 3000;    // a setLayout this soon after a tray/menu action is that action's (a panel)

    readonly string startUrl;
    readonly bool devPage;
    readonly PetWindow window;
    readonly TrayMenu tray = new TrayMenu();
    readonly UserFiles files;
    readonly WindowPlacer placer;
    readonly Bridge bridge;
    readonly AutoStart autoStart = new AutoStart();
    readonly PauseGate gate = new PauseGate();
    readonly ApplicationContext context = new ApplicationContext();
    readonly System.Windows.Forms.Timer quitTimer = new System.Windows.Forms.Timer();
    readonly MenuEscape menuEscape;   // Esc for the menu while it cannot get the keyboard (no-activate layouts)
    readonly System.Windows.Forms.Timer firstShowTimer = new System.Windows.Forms.Timer();
    string startLayout = "U1";   // settings.json layout.start: what the safety net sizes and places the window for
    bool firstShown;             // the window has been visible to the user (IsWindowVisible) at least once
    bool rescued;                // shown by the safety net before the page reported a layout
    bool rescueLogged;           // the first-show fallback line is written at most once per launch
    uint uiThread;
    Dictionary<string, bool> topmost = HostSettings.Parse(null).TopmostByLayout();   // per layout, from settings.json + setTopmost
    string configuredHotkey = HostSettings.DefaultHotkey;
    SessionWatcher session;
    int navigation;              // bumps on every navigation, so a slow init for an old page is dropped
    string layout;               // layout of the last setLayout; null before the first
    bool wantVisible = true;     // the user's show/hide choice (hotkey, tray, menu, hide {})
    bool captureGuard = true;
    string hotkey;               // the registered combo; null when none is registered
    object hotkeyFailure;        // the current hotkeyFailed payload, re-sent after every init; null when fine
    IntPtr focusBeforeMenu;      // foreground window to give focus back to after a no-activate context menu
    DateTime firstCrash;         // start of the current one-minute window of page crashes
    int crashes;
    SynchronizationContext ui;
    bool quitting;
    bool fatalShown;
    ExitStamp exitStamp;         // session.json
    long? lastExitMs;            // the previous run's end, read at start (init lastExitMs)
    bool exitRecorded;           // this run's end is in session.json
    DateTime activateUntil = DateTime.MinValue;   // UTC; a setLayout before then takes the keyboard (tray/menu action)

    // page: file under the web root to load (index.html, or a dev page). devPage: a dev run (--page/--spike),
    // which never touches the autostart Run value.
    public AppHost(string page, bool devPage)
    {
        startUrl = Origin + page;
        this.devPage = devPage;
        files = new UserFiles(AppPaths.DataDir, ErrorLog.Write);
        placer = new WindowPlacer(files);
        bridge = new Bridge(PostToPage, ErrorLog.Write);
        bridge.Received += OnPageMessage;

        window = new PetWindow(startUrl);
        window.StartPosition = FormStartPosition.Manual;   // WindowPlacer places it
        window.HandleCreated += delegate { OnHandleCreated(); };
        window.InitFailed += delegate(string message) { Fatal("window init failed", message); };
        window.WebReady += delegate { OnWebReady(); };
        window.MoveEnded += delegate { OnMoveEnded(); };
        window.HotKeyPressed += delegate(int id) { if (id == HotKey.Id) OnHotkey(); else menuEscape.OnHotKey(id); };
        window.SessionEnding += delegate { OnSessionEnding(); };
        menuEscape = new MenuEscape(
            delegate { return window.IsHandleCreated && Native.RegisterHotKey(window.Handle, MenuEscape.Id, Native.MOD_NOREPEAT, MenuEscape.VK_ESCAPE); },
            delegate { if (window.IsHandleCreated) Native.UnregisterHotKey(window.Handle, MenuEscape.Id); },
            delegate { return (Native.GetAsyncKeyState(MenuEscape.VK_ESCAPE) & 0x8000) != 0; },
            delegate { tray.CloseInnermost(); });
        window.CloseRequested += delegate { wantVisible = false; ApplyVisibility(); };   // Alt+F4: hide; 結束 quits
        window.FormClosing += OnClosing;

        quitTimer.Interval = QuitWaitMs;
        quitTimer.Tick += delegate { Quit(); };
        firstShowTimer.Interval = FirstShowWaitMs;
        firstShowTimer.Tick += delegate { firstShowTimer.Stop(); CheckFirstShow(); };
    }

    public void Run()
    {
        if (!(SynchronizationContext.Current is WindowsFormsSynchronizationContext))
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
        ui = SynchronizationContext.Current;
        uiThread = Native.GetCurrentThreadId();
        if (ErrorLog.Tracing)
            ErrorLog.Trace("start: domain " + AppDomain.CurrentDomain.FriendlyName + " base " + AppDomain.CurrentDomain.BaseDirectory +
                "; WebView2 assemblies " + typeof(CoreWebView2).Assembly.Location + ", " + typeof(Microsoft.Web.WebView2.WinForms.WebView2).Assembly.Location);
        exitStamp = new ExitStamp(System.IO.Path.Combine(AppPaths.DataDir, "session.json"));
        lastExitMs = exitStamp.Read();
        files.LoadAll();
        placer.Load();
        HostSettings settings = HostSettings.Parse(files.Settings.Text);
        topmost = settings.TopmostByLayout();
        configuredHotkey = settings.Hotkey;
        captureGuard = settings.CaptureGuard;   // applied when the window handle exists, before the page loads
        // re-points a stale Run value; never from settings that could not be read or parsed (their defaults)
        if (!devPage && HostSettings.SyncAutostart(files.Settings.Text, files.Settings.ReadFailed)) SetAutoStart(settings.Autostart);

        tray.ItemClicked += OnMenu;
        tray.IconDoubleClick += delegate { ShowAndRaise(true); };   // always shows, never hides
        tray.Menu.Opened += delegate { OnMenuOpened(); };
        tray.Menu.Closed += delegate
        {
            try { menuEscape.Stop(); }   // any way the menu closes releases Esc
            finally { RestoreFocusAfterMenu(); }
        };
        tray.ShowIcon();
        UpdateTray();

        session = new SessionWatcher();
        session.Activity += OnSession;
        SingleInstance.Listen(OnSecondInstance);

        startLayout = settings.StartLayout;
        placer.PrePlace(window, settings.StartLayout);   // on the monitor (and DPI) where the first layout will show
        window.CreateHidden();   // capture guard + hotkey (OnHandleCreated), then the page loads while hidden
        Application.Run(context);
    }

    // Fatal-error path (Program): removes the tray icon so no ghost icon stays behind. Any thread; never throws.
    public void RemoveTrayIcon()
    {
        tray.HideIcon();
    }

    // ---- window lifecycle ----

    void OnHandleCreated()
    {
        ApplyCaptureGuard();
        string combo = hotkey ?? configuredHotkey;
        int result = HotKey.TryRegister(window.Handle, combo);
        if (result == 0)
        {
            hotkey = combo;
            hotkeyFailure = null;
            return;
        }
        ErrorLog.Write("hotkey " + combo + " could not be registered (" + result + ")");
        hotkey = null;
        hotkeyFailure = new { combo = combo, reason = HotKey.FailureReason(result), active = (string)null };
    }

    // The window cannot work (setup failed, WebView2 is gone): one short message, then quit. Once only: the
    // MessageBox pumps messages, so a second failure could arrive while it is open.
    void Fatal(string what, string message)
    {
        ErrorLog.Write(what + ": " + message);
        if (quitting || fatalShown) return;
        fatalShown = true;
        tray.HideIcon();   // no working-looking tray icon beside the error dialog
        MessageBox.Show("錢進中無法顯示畫面，需要關閉。\n\n" + message + "\n\n詳細資訊：" + ErrorLog.FilePath,
            "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Quit();
    }

    void OnWebReady()
    {
        CoreWebView2 web = window.Web;
        bridge.Attach(web);
        web.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
        {
            if (!e.Uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase)) { e.Cancel = true; return; }   // stay on the app's pages
            bridge.Hold();   // the new page cannot listen yet
            navigation++;
        };
        web.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
        web.NavigationCompleted += delegate(object s, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                ErrorLog.Write("page failed to load: " + e.WebErrorStatus);
                if (e.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return;   // a navigation we cancelled ourselves (external link)
                RescueFirstShow("the page failed to load (" + e.WebErrorStatus + ")");   // show what WebView2 shows
                return;
            }
            ArmFirstShow();
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
        if (nav != navigation || quitting) return;   // the page changed meanwhile
        if (ErrorLog.Tracing)
            ErrorLog.Trace("init lastExitMs=" + (lastExitMs.HasValue ? lastExitMs.Value.ToString() : "null") + " forceOpaque=" + window.ForceOpaque +
                " backups settings=" + (files.SettingsBackup != null) + " history=" + (files.HistoryBackup != null));
        bridge.Open("init", new
        {
            settings = files.Settings.Text,
            history = files.History.Text,
            backups = new { settings = files.SettingsBackup, history = files.HistoryBackup },   // for a main text that does not parse
            lastExitMs = lastExitMs,   // the previous run's end (null: none recorded)
            forceOpaque = window.ForceOpaque,
            probeMs = probe,
            nowMs = NowMs(),
            version = Version
        });
        ArmFirstShow();   // the page answers init with its first setLayout
        // the current state, after anything that was queued
        Send("visibility", new { visible = gate.Running });
        if (hotkeyFailure != null) Send("hotkeyFailed", hotkeyFailure);
        foreach (string file in files.Unreadable) Send("storageError", new { file = file, reason = "unreadable" });
    }

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        if (quitting) return;
        // Not a quit, and not Alt+F4 (PetWindow turns that into CloseRequested): WM_CLOSE from outside or Windows
        // ending the session. Save what we have and end.
        Shutdown();
        tray.Dispose();
        context.ExitThread();
    }

    // ---- page messages ----

    void OnPageMessage(string type, Dictionary<string, object> d)
    {
        if (ErrorLog.Tracing) ErrorLog.Trace("<- " + type + (type.StartsWith("save") ? "" : " " + Bridge.BuildMessage(type, d)));
        switch (type)
        {
            case "saveSettings":
                {
                    string text = Bridge.Str(d, "text");
                    if (text == null) break;
                    files.Save(files.Settings, text);
                    topmost = HostSettings.Parse(text).TopmostByLayout();   // the page's own copy of layout.topmost
                    break;
                }
            case "saveHistory": files.Save(files.History, Bridge.Str(d, "text")); break;
            case "backupCorrupt": files.BackupCorrupt(Bridge.Str(d, "file")); break;
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
        bridge.Send(type, payload);   // queued until the page's init
    }

    void PostToPage(string json)
    {
        try
        {
            CoreWebView2 web = window.Web;
            if (web == null) return;
            if (ErrorLog.Tracing) ErrorLog.Trace(json.Contains("\"type\":\"init\"") ? "-> init" : "-> " + json);
            web.PostWebMessageAsJson(json);
        }
        catch (Exception ex) { ErrorLog.Write("send to the page failed", ex); }
    }

    // ---- layout ----

    void SetLayout(Dictionary<string, object> d)
    {
        string name = Bridge.Str(d, "layout");
        double w = Bridge.Num(d, "width", 0), h = Bridge.Num(d, "height", 0);
        if (string.IsNullOrEmpty(name) || name.Length > MaxLayoutName || !(w >= 1) || !(h >= 1)) return;
        bool changed = name != layout;
        layout = name;
        window.NoActivate = ShowRescue.NoActivateLayout(name);
        window.SetContentSize((int)Math.Ceiling(Math.Min(w, MaxCssSize)), (int)Math.Ceiling(Math.Min(h, MaxCssSize)), Dpr(d));
        if (changed)
        {
            placer.RememberSize(name, new Size((int)Math.Ceiling(Math.Min(w, MaxCssSize)), (int)Math.Ceiling(Math.Min(h, MaxCssSize))));
            placer.Place(window, name);
            bool on;
            window.TopMostEnabled = topmost.TryGetValue(name, out on) && on;
        }
        UpdateTray();
        ApplyVisibility();   // the first setLayout shows the window
        if (DateTime.UtcNow < activateUntil && ShownToUser())
        {
            activateUntil = DateTime.MinValue;
            Raise(true);   // the panel (or layout) the user picked from the tray or the menu gets the keyboard
        }
    }

    void OnMoveEnded()
    {
        placer.Remember(layout, window.Location);
        Send("dragEnd", null);
    }

    static double Dpr(Dictionary<string, object> d)
    {
        double v = Bridge.Num(d, "dpr", 0);
        return v > 0 && v <= 8 ? v : 0;   // 0 = not reported
    }

    // ---- visibility and pause ----

    // The menu's 隱藏/顯示: hides the window when the user can see it; otherwise (hidden, or still starting) it
    // shows it, raised and with the keyboard in an activating layout.
    void ToggleVisible()
    {
        if (ShowRescue.NextWantVisible(ShownToUser())) ShowAndRaise(true);
        else { wantVisible = false; ApplyVisibility(); }
    }

    // The hide hotkey: hides only a window the user sees on top; a hidden or covered one is shown and raised (without
    // taking the keyboard from the user's app).
    void OnHotkey()
    {
        bool shown = ShownToUser();
        bool foreground = shown && Native.GetForegroundWindow() == window.Handle;
        bool top = window.TopMostEnabled;
        bool covered = shown && !foreground && !top && CoverCheck.IsCovered(window.Handle);
        if (ShowRescue.HotkeyHides(shown, foreground, top, covered)) { wantVisible = false; ApplyVisibility(); }
        else ShowAndRaise(false);
    }

    void ShowAndRaise(bool activate)
    {
        if (quitting) return;
        wantVisible = true;
        ApplyVisibility();   // raises it if it was hidden
        Raise(activate);
    }

    // To the top of its band (topmost or not) without activating; activate: also the foreground window, unless the
    // layout never takes focus (U7, M3). Windows allows that right after the user's own input to this app (tray,
    // menu) or a second start's AllowSetForegroundWindow; when it refuses, the raise still holds.
    void Raise(bool activate)
    {
        if (!ShownToUser()) return;
        window.RaiseWithoutActivation();
        if (activate && !window.NoActivate) Native.SetForegroundWindow(window.Handle);
    }

    void ApplyVisibility()
    {
        switch (ShowRescue.Visibility(wantVisible, layout != null, rescued, quitting, window.Visible, ShownToUser()))
        {
            case VisibilityAction.Show:
                window.Show();   // never activates (PetWindow.ShowWithoutActivation) and keeps the old z-order place
                Raise(false);
                break;
            case VisibilityAction.Hide: window.Hide(); break;
            case VisibilityAction.ForceShow:   // WinForms says shown, Windows disagrees (or minimized)
                if (window.IsHandleCreated) Native.ShowWindow(window.Handle, Native.SW_SHOWNOACTIVATE);
                Raise(false);
                break;
        }
        if (gate.SetShown(window.Visible)) PauseChanged();
        if (!firstShown && ShownToUser())
        {
            firstShown = true;
            firstShowTimer.Stop();
        }
        UpdateTray();
    }

    // What the user sees: Windows' own visibility, not WinForms' Visible.
    bool ShownToUser()
    {
        return window.IsHandleCreated && Native.IsWindowVisible(window.Handle) && !Native.IsIconic(window.Handle);
    }

    // ---- first-show safety net ----
    // The window should become visible right after the page's first setLayout. If it is not visible
    // FirstShowWaitMs after navigation / init (or the page failed to load) while the user wants it, show it at the
    // start layout's saved or default size and log one line, so the user never ends up with nothing on screen.

    void ArmFirstShow()
    {
        if (firstShown || quitting) return;
        firstShowTimer.Stop();
        firstShowTimer.Start();
    }

    void CheckFirstShow()
    {
        if (firstShown) return;
        string reason = ShowRescue.Reason(quitting, wantVisible, ShownToUser(), layout != null);
        if (reason != null) RescueFirstShow(reason + " " + FirstShowWaitMs / 1000 + " s after init");
        else if (ShownToUser()) firstShown = true;
    }

    void RescueFirstShow(string reason)
    {
        firstShowTimer.Stop();
        if (firstShown || ShowRescue.Reason(quitting, wantVisible, ShownToUser(), layout != null) == null) return;
        if (layout == null)
        {
            Size css = WindowPlacer.RescueSize(placer.SavedSize(startLayout));
            window.SetContentSize(css.Width, css.Height, 0);
            placer.Place(window, startLayout);
            window.NoActivate = ShowRescue.NoActivateLayout(startLayout);   // a rescued M3/U7 must not take focus
            bool on;
            window.TopMostEnabled = topmost.TryGetValue(startLayout, out on) && on;
            rescued = true;
        }
        ApplyVisibility();
        if (!ShownToUser() && window.IsHandleCreated)
        {
            Native.ShowWindow(window.Handle, Native.SW_SHOWNOACTIVATE);   // WinForms thinks it is shown
            Raise(false);
        }
        firstShown = ShownToUser();
        if (!rescueLogged)
        {
            rescueLogged = true;
            ErrorLog.Write("first show fallback: " + reason + "; window " + (firstShown ? "shown" : "STILL NOT VISIBLE") + " at " + window.Bounds);
        }
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

    // Activation is allowed: the second instance called AllowSetForegroundWindow.
    void OnSecondInstance()
    {
        ShowAndRaise(true);
    }

    void UpdateTray()
    {
        tray.SetState(layout, window.TopMostEnabled, ShownToUser());   // the menu offers 顯示 while nothing is visible
    }

    // ---- menu ----

    void OnMenu(string action)
    {
        if (action == "toggleVisible") { ToggleVisible(); return; }
        if (action == "quit") { BeginQuit(); return; }
        if (ShowRescue.MenuShows(action))
        {
            // The user wants to see the result: shown and raised now, with the keyboard if the current layout takes
            // it and stays; the layout the page switches to for it (a panel, another layout) takes the keyboard when
            // its setLayout arrives, if it is an activating one.
            ShowAndRaise(ShowRescue.MenuActivatesNow(action));
            activateUntil = DateTime.UtcNow.AddMilliseconds(MenuActivateMs);
        }
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

    // A menu that cannot get the keyboard (no-activate layout, or the keyboard focus is outside our UI thread, for
    // example in the WebView2 child or the user's app) gets Esc through MenuEscape while it is open.
    void OnMenuOpened()
    {
        if (!quitting && MenuEscape.Needed(window.NoActivate, KeyboardThread(), uiThread)) menuEscape.Start();
    }

    // The thread whose window has the keyboard focus (or, without one, the active window); 0 when unknown.
    static uint KeyboardThread()
    {
        Native.GUITHREADINFO info = new Native.GUITHREADINFO();
        info.cbSize = Marshal.SizeOf(typeof(Native.GUITHREADINFO));
        if (!Native.GetGUIThreadInfo(0, ref info)) return 0;
        IntPtr hwnd = info.hwndFocus != IntPtr.Zero ? info.hwndFocus : info.hwndActive;
        if (hwnd == IntPtr.Zero) return 0;
        uint pid;
        return Native.GetWindowThreadProcessId(hwnd, out pid);
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
            hotkeyFailure = new { combo = combo, reason = HotKey.FailureReason(HotKey.InvalidCombo), active = hotkey };
            Send("hotkeyFailed", hotkeyFailure);
            return;
        }
        if (wanted == hotkey) { hotkeyFailure = null; return; }
        if (!window.IsHandleCreated) return;
        int result = HotKey.TryRegister(window.Handle, wanted);
        if (result == 0)
        {
            hotkey = wanted;
            hotkeyFailure = null;
            return;
        }
        ErrorLog.Write("hotkey " + wanted + " could not be registered (" + result + ")");
        string previous = hotkey;   // TryRegister dropped it; keep it working
        hotkey = previous != null && HotKey.Register(window.Handle, previous) ? previous : null;
        hotkeyFailure = new { combo = wanted, reason = HotKey.FailureReason(result), active = hotkey };
        Send("hotkeyFailed", hotkeyFailure);
    }

    void SetAutoStart(bool on)
    {
        try { autoStart.Set(on, Application.ExecutablePath); }
        catch (Exception ex) { ErrorLog.Write("autostart " + (on ? "on" : "off"), ex); }
    }

    // ---- quit ----

    void BeginQuit()
    {
        if (quitting) return;
        if (!bridge.IsOpen) { Quit(); return; }   // no page to wait for
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
            try
            {
                menuEscape.Dispose();   // first: the poll timer goes even if a later step throws
                tray.Dispose();   // removes the tray icon
                window.Close();
                window.Dispose();
                files.Dispose();
            }
            finally { context.ExitThread(); }
        }, null);
    }

    // Windows is ending the session (sign-out, shutdown, restart): the page's text and the exit time go to the disk
    // now, while the process is still sure to run. FormClosing follows (OnClosing) and ends the app.
    void OnSessionEnding()
    {
        files.FlushAll();
        RecordExit();
    }

    // The exit time for the next start (init lastExitMs). Synchronous and flushed; once per run.
    void RecordExit()
    {
        if (exitRecorded || exitStamp == null) return;
        exitRecorded = true;
        try { exitStamp.Write(NowMs()); }
        catch (Exception ex) { ErrorLog.Write("recording the exit time in session.json", ex); }
    }

    // Saves and releases everything that outlives the window (files, exit time, hotkey, session events, the
    // instance mutex).
    void Shutdown()
    {
        quitting = true;
        quitTimer.Stop();
        firstShowTimer.Stop();
        firstShowTimer.Dispose();
        menuEscape.Stop();   // quitting from the open menu: Esc must not stay registered
        files.FlushAll();
        RecordExit();
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
