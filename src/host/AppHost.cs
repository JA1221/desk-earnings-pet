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
//   page also gets the current state: visibility, fullscreen, a hotkey failure, unreadable files (storageError).
// - U7, M3 and U10 never take focus when clicked; the other layouts activate normally (keyboard input).
// - 1.1.2 item 1: every layout but U10 opens with its top-left at the one shared anchor, pushed inside the work area
//   only when it does not fit there (WindowPlacer.AtAnchor); a user's drop in any of them (a panel's too) moves the
//   anchor. A spot the window is pushed to is never saved (Ruling C5), only one the user drags it to. With no anchor in
//   window.json (the first 1.1.2 start), the start layout's own 1.1.1 spot becomes it, so that start shows exactly
//   where it did. U10's capsule sits at its dock (setLayout dock) on the work area of the monitor the window is on, and
//   a drop snaps it to the nearest dock of the monitor it landed on (CapsuleDock; the page learns it from capsuleDock);
//   leaving U10 goes back to the anchor. A window that grows within its layout stays inside its work area if it was
//   inside (WindowPlacer.ResizeInside, spec 5.7).
// - PANEL (設定, 紀錄, onboarding, the questions) opens beside the window it came from, inside that window's work area
//   (WindowPlacer.PanelBounds, 1.1.1). A start that opens with a panel opens it beside the hidden window, which
//   PrePlace put where the start layout shows, so the first thing shown is on the start layout's monitor.
// - fullscreen {on, here}: something runs full screen (Presentation: Windows reports a fullscreen app or presentation
//   mode, or a monitor's top window covers that whole monitor, foreground or not), sent after every init and on each
//   change; the page holds its reminders while on. here (1.1.1): the pet window's monitor is full screen (PowerPoint's
//   slide show on the projector counts while the presenter view has the keyboard). Then the window steps back: topmost
//   off (ApplyTopmost) and below that full-screen window in the z-order, never activated and never moved, and no raise
//   (a prompt's, a show's) may lift it above that window; the page shows no bubbles at all. The one exception (review
//   §4a): a panel the user opens from the tray or the menu then (設定, 紀錄, 調整起算時間) comes in front and takes the
//   keyboard; once it closes, the window steps back again. When full screen ends the page gets fullscreen {on:false}
//   and the window its topmost back. Only another monitor full screen is {on:true, here:false}:
//   the window stays as it is.
// - raise {on} from the page (a prompt bubble shows / is gone): the window is topmost while it is on, raised without
//   activation if the user sees it, and back to the layout's own 永遠在最上層 afterwards (ApplyTopmost). It never
//   shows a hidden window and never takes the keyboard.
// - Every show raises the window to the top of its band without activating it (stepped back for full screen: kept
//   behind that window). Shows and panels the user asked for from the tray or the menu also take the keyboard in the
//   activating layouts (U1/U3/U5B/PANEL). The hotkey hides only a window the user sees on top
//   (ShowRescue.HotkeyHides); a covered one is raised instead, but one stepped back for full screen is hidden.
// - While the window is hidden or the session is locked the page gets visibility {visible:false} and the hit
//   poll stops; showing / unlocking reverses both.
// - pointer {inside} (1.1.1): the 30 Hz hit poll saw the cursor cross onto (true) or off (false) every hit rect
//   (PetWindow.PointerChanged, PetGeometry's PointerEdge); sent only on a crossing, never repeated. Off them the window
//   clicks through and the page gets no mouse events, so this tells it the pointer has gone (U10's capsule folds on it)
//   even when WebView2 passes it no mouseout.
// - Alt+F4 hides the window. Any close from outside (WM_CLOSE, Windows ending the session) shuts the app down.
// - Every end (結束, a close from outside, Windows ending the session) records the time in session.json
//   (ExitStamp); the next start hands it to the page as init lastExitMs, with the .bak texts (init backups) and
//   whether the window had to go opaque (init forceOpaque).
// Host-only menu actions: toggleVisible (a hidden page cannot show itself) and quit (sent to the page as
// menu {action:'quit'} so it can save and answer quit {}; the host exits anyway after QuitWaitMs). Every other
// TrayMenu id goes to the page as menu {action}. The quick actions drink (記一杯水), undrink (少記一杯, 1.1.1: the page
// takes one cup off today, never below 0) and pomodoro do not show a hidden window (ShowRescue.MenuShows); 少記一杯
// is in the menu only while healthMenu's cups say today has a cup.
public class AppHost
{
    public const string Version = "1.1.1";   // also the exe's version block (AssemblyInfo.cs) and the page's 關於
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
    readonly bool ownsRunValue;   // false for a dev page or a test profile: the autostart Run value is left alone
    readonly PetWindow window;
    readonly TrayMenu tray = new TrayMenu();
    readonly UserFiles files;
    readonly WindowPlacer placer;
    readonly Bridge bridge;
    readonly AutoStart autoStart = new AutoStart();
    readonly PauseGate gate = new PauseGate();
    readonly Presentation presentation;
    readonly ApplicationContext context = new ApplicationContext();
    readonly System.Windows.Forms.Timer quitTimer = new System.Windows.Forms.Timer();
    readonly MenuEscape menuEscape;   // Esc for the menu while it cannot get the keyboard (no-activate layouts)
    readonly System.Windows.Forms.Timer firstShowTimer = new System.Windows.Forms.Timer();
    string startLayout = "U1";   // the layout used last (HostSettings.StartLayout): what the safety net sizes and places the window for
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
    bool initSent;               // init has gone to the page (the exit time in session.json is still there until history is saved)
    bool stampCleared;           // session.json's exit time is consumed
    long? lastExitMs;            // the previous run's end, read at start (init lastExitMs)
    bool exitRecorded;           // this run's end is in session.json
    DateTime activateUntil = DateTime.MinValue;   // UTC; a setLayout before then takes the keyboard (tray/menu action)
    bool promptRaised;           // the page's raise {on}: a prompt bubble shows, so the window is topmost (ApplyTopmost)
    bool steppedBack;            // stepped back behind a full-screen window on its monitor (ShowRescue.StepsBack): never topmost
    bool userPanel;              // the panel the user opened from the menu shows in front of that full-screen window (review §4a)
    DateTime panelAskedUntil = DateTime.MinValue;   // UTC; a PANEL setLayout before then is the one the user asked for
    Size layoutCss;              // the page size (CSS px) of the last setLayout
    string capsuleDock = "top";  // U10's dock: the page's setLayout dock, or where a drop snapped it
    Rectangle? growFrom;         // a same-layout grow pushed the window in from this rect to growTo; size changes while
    Point? growTo;               // it is still at growTo start from growFrom (WindowPlacer.ResizeInside)

    // page: file under the web root to load (index.html, or a dev page). devPage: a dev run (--page/--spike). Neither
    // a dev run nor a test profile (QJZ_PROFILE, AppPaths.Profile) touches the autostart Run value.
    public AppHost(string page, bool devPage)
    {
        startUrl = Origin + page;
        ownsRunValue = !devPage && AppPaths.Profile == null;
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
        window.PointerChanged += delegate(bool inside) { Send("pointer", new { inside = inside }); };
        window.HotKeyPressed += delegate(int id) { if (id == HotKey.Id) OnHotkey(); else menuEscape.OnHotKey(id); };
        window.SessionEnding += delegate { OnSessionEnding(); };
        menuEscape = new MenuEscape(
            delegate { return window.IsHandleCreated && Native.RegisterHotKey(window.Handle, MenuEscape.Id, Native.MOD_NOREPEAT, MenuEscape.VK_ESCAPE); },
            delegate { if (window.IsHandleCreated) Native.UnregisterHotKey(window.Handle, MenuEscape.Id); },
            delegate { return (Native.GetAsyncKeyState(MenuEscape.VK_ESCAPE) & 0x8000) != 0; },
            delegate { tray.CloseInnermost(); });
        window.CloseRequested += delegate { wantVisible = false; ApplyVisibility(); };   // Alt+F4: hide; 結束 quits
        window.FormClosing += OnClosing;
        presentation = new Presentation(Presentation.Query, Presentation.ZOrder, Presentation.MonitorRects, PetMonitor);

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
            ErrorLog.Trace("start: WebView2 assemblies " + typeof(CoreWebView2).Assembly.Location + ", " +
                typeof(Microsoft.Web.WebView2.WinForms.WebView2).Assembly.Location);
        exitStamp = new ExitStamp(System.IO.Path.Combine(AppPaths.DataDir, "session.json"));
        lastExitMs = exitStamp.Read();   // cleared on the first saveHistory after init (ClearStampAfterSave), not here
        files.LoadAll();
        placer.Load();
        // settings.json, or its .bak when settings.json is blank or does not parse (as the page reads it)
        HostSettings settings = HostSettings.Parse(HostSettings.Effective(files.Settings.Text, files.SettingsBackup));
        topmost = settings.TopmostByLayout();
        configuredHotkey = settings.Hotkey;
        captureGuard = settings.CaptureGuard;   // applied when the window handle exists, before the page loads
        // re-points a stale Run value; never from settings that could not be read or parsed (their defaults)
        if (ownsRunValue && HostSettings.SyncAutostart(files.Settings.Text, files.Settings.ReadFailed, files.SettingsBackup))
            SetAutoStart(settings.Autostart);

        tray.ItemClicked += OnMenu;
        tray.IconDoubleClick += delegate { ShowAndRaise(true); };   // always shows, never hides
        tray.Menu.Opened += delegate { OnMenuOpened(); };
        // A hidden page does not tick: it catches up (a new day, the snacks) and answers with menuState at once.
        tray.Menu.Opening += delegate { if (bridge.IsOpen && !quitting) Send("menuOpening", null); };
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
        presentation.Changed += OnFullscreenChanged;
        presentation.WindowChanged += delegate { if (steppedBack) StepBehind(); };   // another full-screen window in front here
        presentation.Start();   // after PrePlace: the window's monitor is the start layout's
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
            SetPromptRaised(false);   // the old page's bubble is gone with it; the new page sends its own raise
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
        initSent = true;
        ArmFirstShow();   // the page answers init with its first setLayout
        // the current state, after anything that was queued
        Send("visibility", new { visible = gate.Running });
        Send("fullscreen", FullscreenPayload());
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
            case "saveHistory":
                files.Save(files.History, Bridge.Str(d, "text"));
                ClearStampAfterSave();
                break;
            case "backupCorrupt": files.BackupCorrupt(Bridge.Str(d, "file")); break;
            case "setLayout": SetLayout(d); break;
            case "hitRects": window.SetHitRects(Bridge.Rects(d, "rects", MaxHitRects), Dpr(d)); break;
            case "dragStart": window.BeginDrag(Bridge.XY(d, "grab")); break;
            case "contextMenu": ShowContextMenu(); break;
            case "menuState":   // the menu's work item and snack count follow the page
                {
                    double snacks = Bridge.Num(d, "snacks", -1);
                    tray.SetWork(Bridge.Str(d, "work"));
                    tray.SetSnacks(snacks >= 0 && snacks <= 99999 ? (int)Math.Floor(snacks) : -1);
                    break;
                }
            case "healthMenu":   // 記一杯水's cups, 少記一杯 (cups > 0) and the 開始番茄鐘 / 停止番茄鐘 item follow the page
                {
                    object p;
                    Dictionary<string, object> pomodoro = d.TryGetValue("pomodoro", out p) ? p as Dictionary<string, object> : null;
                    tray.SetHealth(Bridge.Str(d, "cups"), Bridge.Str(pomodoro, "phase"), Bridge.Num(pomodoro, "endsMs", 0));
                    break;
                }
            case "setTopmost":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on == null) break;
                    if (layout != null) topmost[layout] = on.Value;
                    ApplyTopmost();
                    UpdateTray();
                    break;
                }
            case "raise":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on == null) break;
                    SetPromptRaised(on.Value);
                    if (on.Value) Raise(false);   // never shows or activates; never above a full-screen window here
                    break;
                }
            case "setAutostart":
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on != null && ownsRunValue) SetAutoStart(on.Value);
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
        bool shownBefore = layout != null || rescued;   // a layout was placed before this one (PanelFrom)
        layout = name;
        // Review §4a: the panel the user just asked for from the menu comes in front of a full-screen window on this
        // monitor; any other layout (that panel closed) steps back again.
        if (name != WindowPlacer.PanelLayout) userPanel = false;
        else if (DateTime.UtcNow < panelAskedUntil)
        {
            panelAskedUntil = DateTime.MinValue;
            userPanel = presentation.Here;
        }
        if (name == "U10") capsuleDock = CapsuleDock.Parse(Bridge.Str(d, "dock"));
        window.NoActivate = ShowRescue.NoActivateLayout(name);
        Size css = new Size((int)Math.Ceiling(Math.Min(w, MaxCssSize)), (int)Math.Ceiling(Math.Min(h, MaxCssSize)));
        layoutCss = css;
        Rectangle before = window.Bounds;
        window.SetContentSize(css.Width, css.Height, Dpr(d));
        if (changed)
        {
            growFrom = null;
            growTo = null;
            switch (WindowPlacer.MoveFor(name, false))
            {
                case LayoutMove.Beside:
                    // Beside the window it came from, on that monitor (1.1.1): at a start that opens with a panel, the
                    // hidden window PrePlace put where the start layout shows. PANEL's own saved spot is not used.
                    placer.PlacePanel(window, WindowPlacer.PanelFrom(shownBefore, placer.StartSpotKnown, before));
                    break;
                case LayoutMove.Dock:
                    DockCapsule(before);   // on the monitor the window is on
                    placer.RememberSize(name, css);
                    break;
                default:
                    {
                        // The anchor (1.1.2). Without one yet, this layout's own 1.1.1 spot becomes it, at the size it was
                        // saved at (the upgrade), else the window's top-left once a layout has shown.
                        Size? savedCss = placer.SavedSize(name);
                        placer.PlaceAtAnchor(window, name, savedCss.HasValue ? window.ToPhysical(savedCss.Value) : (Size?)null,
                            shownBefore ? before.Location : (Point?)null);
                        placer.RememberSize(name, css);   // the next start's PrePlace and the safety net size it so
                        break;
                    }
            }
            presentation.Poll();   // another monitor: is a full-screen window in front there?
            UpdateStepBack();
            ApplyTopmost();
        }
        else if (!window.Moving)   // a new size mid-drag (another DPI) is left to the drop (OnMoveEnded)
        {
            if (name == "U10") DockCapsule(before);
            else if (window.Size != before.Size) FitAfterResize(before);
        }
        UpdateStepBack();   // a panel the user asked for replaced another panel (no layout change)
        UpdateTray();
        ApplyVisibility();   // the first setLayout shows the window
        if (DateTime.UtcNow < activateUntil && ShownToUser())
        {
            activateUntil = DateTime.MinValue;
            Raise(true);   // the panel (or layout) the user picked from the tray or the menu gets the keyboard
        }
    }

    // The same layout changed size (a prompt bubble beside U7 / M3): a window that was inside stays fully inside through
    // every grow and partial shrink, and goes back to where it was once it fits there, unless the user moved it
    // meanwhile (WindowPlacer.ResizeInside). No spot is saved.
    void FitAfterResize(Rectangle before)
    {
        Point at = WindowPlacer.ResizeInside(before, window.Size, WindowPlacer.WorkAreas(), ref growFrom, ref growTo);
        if (at != window.Location) window.Location = at;
    }

    // U10's dock rect is 6 CSS px in from the work-area edges.
    const int CapsuleMarginCss = 6;

    int CapsuleMargin()
    {
        return (int)Math.Round(CapsuleMarginCss * window.CssScale, MidpointRounding.AwayFromZero);
    }

    // U10 goes to its dock on the work area nearest the centre of from (the window's rect before this change: the monitor
    // the window is on), and the spot is saved so the next start in U10 pre-places the window on that monitor.
    void DockCapsule(Rectangle from)
    {
        Rectangle area = CapsuleDock.AreaFor(from, WindowPlacer.WorkAreas());
        Point at = CapsuleDock.Rect(capsuleDock, area, window.Size, CapsuleMargin()).Location;
        if (at != window.Location) window.Location = at;
        placer.Remember("U10", at);
    }

    // A dropped U10 snaps to the nearest dock of the monitor it was dropped on (spec 5.7); the page saves that dock.
    void SnapCapsule()
    {
        Rectangle area = CapsuleDock.AreaFor(window.Bounds, WindowPlacer.WorkAreas());
        int margin = CapsuleMargin();
        capsuleDock = CapsuleDock.Nearest(window.Bounds, area, margin);
        Point at = CapsuleDock.Rect(capsuleDock, area, window.Size, margin).Location;
        if (at != window.Location) window.Location = at;
        placer.Remember("U10", at);
        UpdateTray();
        Send("capsuleDock", new { dock = capsuleDock });
        Send("dragEnd", null);
    }

    // U7's desk ends this many CSS px above the window bottom (layouts.css: .u7 bottom padding and the hard shadow).
    const int U7DeskMarginCss = 16;

    void OnMoveEnded()
    {
        try { EndMove(); }
        finally { presentation.Poll(); }   // dropped on another monitor: is a full-screen window in front there?
    }

    void EndMove()
    {
        if (layout == "U10") { SnapCapsule(); return; }
        // U7 hangs from its scruff tip while dragged, so a drop can leave the seated pet below the work area (over or
        // under the taskbar): lift it until the desk is inside the work area of the monitor the cursor is on.
        if (layout == "U7")
        {
            Rectangle area = Screen.FromPoint(Cursor.Position).WorkingArea;
            int margin = (int)Math.Round(U7DeskMarginCss * window.CssScale, MidpointRounding.AwayFromZero);
            Rectangle fit = ScreenFit.KeepBottomIn(window.Bounds, margin, area);
            if (fit.Location != window.Location) window.Location = fit.Location;
        }
        if (WindowPlacer.DragMovesAnchor(layout)) placer.SetAnchor(window.Bounds);   // 1.1.2: the spot of every layout but U10
        if (layout != WindowPlacer.PanelLayout)
        {
            // The layout's own 1.1.1 entry, no longer read for placement: kept up to date for a downgrade.
            placer.Remember(layout, window.Location);
            placer.RememberSize(layout, layoutCss);
        }
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
    // taking the keyboard from the user's app). Stepped back behind a full-screen window, a shown one is hidden: it may
    // not be raised above that window.
    void OnHotkey()
    {
        presentation.Poll();
        bool shown = ShownToUser();
        bool foreground = shown && Native.GetForegroundWindow() == window.Handle;
        bool top = window.TopMostEnabled;
        bool covered = shown && !foreground && !top && !steppedBack && CoverCheck.IsCovered(window.Handle);
        if (ShowRescue.HotkeyHides(shown, foreground, top, covered, steppedBack)) { wantVisible = false; ApplyVisibility(); }
        else ShowAndRaise(false);
    }

    void ShowAndRaise(bool activate)
    {
        if (quitting) return;
        presentation.Poll();   // the user's own action: what is in front now, not up to 2 s ago
        wantVisible = true;
        ApplyVisibility();   // raises it if it was hidden
        Raise(activate);
    }

    // To the top of its band (topmost or not) without activating; activate: also the foreground window, unless the
    // layout never takes focus (U7, M3, U10). Windows allows that right after the user's own input to this app (tray,
    // menu) or a second start's AllowSetForegroundWindow; when it refuses, the raise still holds. Stepped back for a
    // full-screen window on its monitor: kept below that window instead, and never activated (full screen wins).
    void Raise(bool activate)
    {
        if (!ShownToUser()) return;
        if (steppedBack) { StepBehind(); return; }
        window.RaiseWithoutActivation();
        if (activate && !window.NoActivate) Native.SetForegroundWindow(window.Handle);
    }

    void ApplyVisibility()
    {
        switch (ShowRescue.Visibility(wantVisible, layout != null, rescued, quitting, window.Visible, ShownToUser()))
        {
            case VisibilityAction.Show:
                if (steppedBack) StepBehind();   // behind the full-screen window before it shows, not a frame later
                window.Show();   // never activates (PetWindow.ShowWithoutActivation) and keeps the old z-order place
                Raise(false);
                break;
            case VisibilityAction.Hide: window.Hide(); break;
            case VisibilityAction.ForceShow:   // WinForms says shown, Windows disagrees (or minimized)
                if (steppedBack) StepBehind();
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
            if (WindowPlacer.MoveFor(startLayout, false) == LayoutMove.Dock) placer.PlaceAtOwnSpot(window, startLayout);   // U10: its last dock spot
            else placer.PlaceAtAnchor(window, startLayout, window.Size, null);
            window.NoActivate = ShowRescue.NoActivateLayout(startLayout);   // a rescued M3/U7/U10 must not take focus
            ApplyTopmost();   // the start layout's (no layout yet)
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
        // the check mark is the layout's own 永遠在最上層, never a prompt's raise; the menu offers 顯示 while nothing is visible
        tray.SetState(layout, LayoutTopmost(), ShownToUser(), capsuleDock);
    }

    // ---- topmost ----

    // The user's 永遠在最上層 for the current layout (the start layout before the page's first setLayout: what the
    // safety net shows).
    bool LayoutTopmost()
    {
        bool on;
        return topmost.TryGetValue(layout ?? startLayout, out on) && on;
    }

    // Every topmost change goes through here: the layout's own setting, or raised while a prompt shows; never while
    // stepped back for a full-screen window on the window's monitor.
    void ApplyTopmost()
    {
        window.TopMostEnabled = ShowRescue.EffectiveTopmost(LayoutTopmost(), promptRaised, steppedBack);
    }

    // ---- full screen ----

    // Something went full screen or stopped, or the full-screen window and the pet window met on one monitor or parted
    // (Presentation). Here: the window steps back, topmost off and below the full-screen window, without being
    // activated or moved; when that ends it comes back as it was (ApplyTopmost: the layout's topmost, a prompt's
    // raise). The page gets fullscreen {on, here}, or {on:false}.
    void OnFullscreenChanged()
    {
        if (ErrorLog.Tracing)
            ErrorLog.Trace("fullscreen on=" + presentation.On + " here=" + presentation.Here + " monitor=" +
                (presentation.Monitor.HasValue ? presentation.Monitor.Value.ToString() : "none") + " window=" + presentation.Window);
        if (!presentation.Here) userPanel = false;   // the full screen the user's panel came in front of is over
        UpdateStepBack();
        Send("fullscreen", FullscreenPayload());
    }

    // Steps back or comes forward when ShowRescue.StepsBack changed: behind the full-screen window first (from the topmost
    // band straight to below it, never above it in between), then topmost off; or the topmost it had before.
    void UpdateStepBack()
    {
        bool back = ShowRescue.StepsBack(presentation.Here, userPanel);
        if (back == steppedBack) return;
        steppedBack = back;
        if (ErrorLog.Tracing) ErrorLog.Trace("stepped back=" + back + (userPanel ? " (the user's panel is in front)" : ""));
        if (back) StepBehind();
        ApplyTopmost();
    }

    object FullscreenPayload()
    {
        return presentation.On ? (object)new { on = true, here = presentation.Here } : new { on = false };
    }

    // Below the full-screen window in the z-order, if the window is above it (its place among the other windows is
    // kept otherwise). Hidden or shown; never activates or moves it. ApplyTopmost then keeps it out of the topmost band.
    void StepBehind()
    {
        if (window.IsHandleCreated) CoverCheck.KeepBelow(window.Handle, presentation.Window);
    }

    // The monitor the pet window is on, by its rect (the hidden window PrePlace placed counts too).
    Rectangle? PetMonitor()
    {
        return Screen.FromRectangle(window.Bounds).Bounds;
    }

    void SetPromptRaised(bool on)
    {
        if (on == promptRaised) return;
        promptRaised = on;
        ApplyTopmost();
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
            if (ShowRescue.UserPanel(action)) panelAskedUntil = activateUntil;   // in front of full screen too (review §4a)
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

    // The previous exit time is consumed once the page has it AND its history is on the disk (§5.10): a crash or kill
    // from then on must not hand the same stamp over again, but a shutdown before that still finds it (the page's
    // QJZ.day.onExit is idempotent, so applying it twice is harmless). Called after each saveHistory.
    void ClearStampAfterSave()
    {
        // once this run's own exit is recorded, a late saveHistory must not overwrite the fresh stamp with null
        if (stampCleared || exitRecorded || exitStamp == null) return;
        if (!ExitStamp.ShouldClear(lastExitMs.HasValue, initSent, !files.History.Pending)) return;
        stampCleared = true;
        try { exitStamp.Clear(); }
        catch (Exception ex) { ErrorLog.Write("clearing the exit time in session.json", ex); }
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
        presentation.Dispose();
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
