using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
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
//   only when it does not fit there (WindowPlacer.AtAnchor); a user's drop in any of them moves the anchor, a panel's
//   only when it is shown in place (a panel beside its window leaves it). A spot the window is pushed to is never saved (Ruling C5), only one the user drags it to. With no anchor in
//   window.json (the first 1.1.2 start), the start layout's own 1.1.1 spot becomes it, so that start shows exactly
//   where it did. U10's capsule sits at its dock (setLayout dock) on the work area of the monitor the window is on, and
//   a drop snaps it to the nearest dock of the monitor it landed on (CapsuleDock; the page learns it from capsuleDock);
//   leaving U10 goes back to the anchor. A window that grows within its layout stays inside its work area if it was
//   inside (WindowPlacer.ResizeInside, spec 5.7).
// - PANEL (設定, 紀錄, onboarding, the questions) opens beside the window it came from, inside that window's work area
//   (WindowPlacer.PanelBounds, 1.1.1), at the size the page asks for. A start that opens with a panel opens it beside
//   the hidden window, which PrePlace put where the start layout shows, so the first thing shown is on the start
//   layout's monitor. setLayout {layout:'PANEL', inPlace:true, width, height, dpr} (1.1.2 item 3: 設定 / 紀錄 opened
//   from U1, U3 (1.1.3), U12 or U13, which the page shows in that same window; width / height are the window's CSS size): the
//   window keeps its spot and its size exactly, not moved, not resized (PetWindow.KeepSize). Closing the panel goes
//   back to the layout it came from at the anchor. A panel the user opens from the tray or the menu still comes in
//   front of a full-screen window (below), in place or not.
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
// - setTopmost {on} (after every layout change, from the menu's 永遠在最上層, and 1.1.2's pin in the title bar): the
//   current layout's 永遠在最上層, for a panel the layout it came from's (ShowRescue.TopmostLayout, as the page has it),
//   applied at once (ApplyTopmost) and shown as the menu's check. The page saves it in settings.json; a saved change
//   whose setTopmost has not come yet is applied too. The menu's item goes through the page (menu {action:'topmost'}),
//   so the page always knows the state: nothing is sent back.
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
// - 1.1.5 縮放比例: settings zoom (a percent, PageZoom) is the WebView2 ZoomFactor, set before the page loads and on the
//   page's setZoom {percent} (設定 → 畫面, Ctrl+wheel, Ctrl+± / Ctrl+0). The page's DPR includes it, so sizes, hit rects,
//   U10's dock margin and U7's desk follow. A window that would not fit its work area at the chosen zoom gets a lower
//   one, never below 100 % (PageZoom.Fit, again for every setLayout and after a drop on another monitor). A zoom change
//   resizes the window from its top-left, kept inside its work area (U10 re-docks; U7 seated on the taskbar edge stays
//   seated, ScreenFit.SettleDesk). Positions in window.json are unaffected (physical top-lefts; sizes are CSS).
// - 1.1.5 檢查更新: checkUpdate {} makes the app's one network request (UpdateCheck, at most one at a time) and answers
//   updateResult {kind, version}; openUpdate {} opens that result's page (the release's, or the Releases page) in the
//   default browser. Nothing else here ever goes online, but 一鍵更新:
// - 1.1.6 一鍵更新: updateResult also says install (a newer release whose exe UpdateInstall.Asset accepts, in a release
//   build). installUpdate {} downloads and checks that exe (UpdateInstall.Download, off the UI thread) and answers
//   updateState {phase:'downloading', percent} as it goes, then 'failed' (the file is gone) or 'restarting': the exe is
//   swapped (UpdateInstall.Swap), the app quits as usual (the page saves), and the new exe starts with
//   --after-update <pid> (Program.Main waits for this process before its single-instance check). 1.1.7 item 4: that
//   start's first init carries afterUpdate true, and the pet says 「已更新到 <version>」 once (layouts.js).
// menuState {work, snacks} (page -> host): the work item and the snack count. healthMenu {cups, pomodoro:{phase, endsMs}}:
// 記一杯水's cups and 開始 / 停止番茄鐘. (1.1.3 A2: the menu lost 隱藏金額, 少記一杯 and 我剛起來動過了, and with them the
// page's mask / undrink / stoodUp actions, menuState's masked and healthMenu's sitOn.)
// Host-only menu actions: toggleVisible (a hidden page cannot show itself) and quit (sent to the page as
// menu {action:'quit'} so it can save and answer quit {}; the host exits anyway after QuitWaitMs). Every other
// TrayMenu id goes to the page as menu {action} (ShowRescue.PageAction: layout:M3 as mini, and nothing in M3). The quick
// actions drink (記一杯水) and pomodoro do not show a hidden window (ShowRescue.MenuShows).
public class AppHost
{
    public const string Version = "1.1.9";   // also the exe's version block (AssemblyInfo.cs) and the page's 關於
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
    readonly MenuClickAway menuClickAway;   // a click on our own window closes the menu (1.1.2 item 2)
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
    string fromLayout;           // the last layout that is not a panel: a panel's 永遠在最上層 is its (TopmostLayout)
    bool panelInPlace;           // the panel showing was opened in place (setLayout inPlace): its drop moves the anchor
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
    int zoomPercent = PageZoom.Default;   // 1.1.5 縮放比例 (settings zoom)
    double sentZoom;                      // the ZoomFactor last told to the page (zoomApplied)
    EventHandler displayChanged;          // SystemEvents.DisplaySettingsChanged, removed on quit
    bool updateBusy;             // a 檢查更新 request is out (until it really ends, review M-1)
    bool updateAgain;            // pressed again while it was out: its answer goes to the page when it ends
    string updateUrl = UpdateCheck.ReleasesUrl;   // what openUpdate opens: the last result's page
    UpdateAsset updateAsset;     // 1.1.6: the last result's exe (null: no 更新)
    bool installing;             // 一鍵更新 is downloading, or has swapped the exe and is quitting
    string restartExe;           // the swapped exe: Quit starts it
    bool afterUpdate;            // 1.1.7 item 4: started by 一鍵更新 (--after-update): the first init says so, and only it

    // page: file under the web root to load (index.html, or a dev page). devPage: a dev run (--page/--spike). Neither
    // a dev run nor a test profile (QJZ_PROFILE, AppPaths.Profile) touches the autostart Run value. afterUpdate: started
    // with --after-update (UpdateInstall.WaitPid): the page's pet says 「已更新到 <Version>」 once.
    public AppHost(string page, bool devPage, bool afterUpdate)
    {
        this.afterUpdate = afterUpdate;
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
        // 1.1.5 review M-4: a new DPI (another monitor, a changed Windows scale) or new display settings (a monitor added,
        // removed or resized) fit the zoom again; during a drag the drop does it (OnMoveEnded)
        window.MonitorDpiChanged += delegate { RefitZoom(); };
        displayChanged = delegate { if (ui != null) ui.Post(delegate { RefitZoom(); }, null); };
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += displayChanged;
        window.PointerChanged += delegate(bool inside) { Send("pointer", new { inside = inside }); };
        window.HotKeyPressed += delegate(int id) { if (id == HotKey.Id) OnHotkey(); else menuEscape.OnHotKey(id); };
        window.SessionEnding += delegate { OnSessionEnding(); };
        menuEscape = new MenuEscape(
            delegate { return window.IsHandleCreated && Native.RegisterHotKey(window.Handle, MenuEscape.Id, Native.MOD_NOREPEAT, MenuEscape.VK_ESCAPE); },
            delegate { if (window.IsHandleCreated) Native.UnregisterHotKey(window.Handle, MenuEscape.Id); },
            delegate { return (Native.GetAsyncKeyState(MenuEscape.VK_ESCAPE) & 0x8000) != 0; },
            delegate { tray.CloseInnermost(); });
        menuClickAway = new MenuClickAway(
            delegate(int vk) { return Native.GetAsyncKeyState(vk); },
            CursorOverWindow,
            delegate { tray.CloseAll(); });
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
            try
            {
                menuClickAway.Stop();
                menuEscape.Stop();   // any way the menu closes releases Esc
            }
            finally { RestoreFocusAfterMenu(); }
        };
        tray.ShowIcon();
        UpdateTray();

        session = new SessionWatcher();
        session.Activity += OnSession;
        SingleInstance.Listen(OnSecondInstance);
        startLayout = settings.StartLayout;
        zoomPercent = settings.Zoom;
        placer.ZoomPercent = zoomPercent;
        placer.PrePlace(window, settings.StartLayout);   // on the monitor (and DPI) where the first layout will show
        // the page loads at the zoom its first layout will show at
        SetWindowZoom(PageZoom.Fit(zoomPercent, placer.SavedSize(startLayout) ?? Size.Empty, WindowPlacer.ScaleAt(window.Bounds),
            Screen.FromRectangle(window.Bounds).WorkingArea));
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
        long? probe = null, leave = null;
        try
        {
            DateTime dayStart = DayStart(DateTime.Now);
            long? exit = lastExitMs;
            Task<long?> t = Task.Run(delegate { return EventLogProbe.EarliestToday(dayStart); });
            // 1.1.5: the last sleep / shutdown after the previous run's end, on its day (the page asks 提早下班 at it)
            Task<long?> l = Task.Run(delegate { return EventLogProbe.LastLeave(exit, DayStart, EventLogProbe.ReadLeaves); });
            Task both = Task.WhenAll(t, l);
            await Task.WhenAny(both, Task.Delay(ProbeWaitMs));   // both bounded by one wait: start-up is not slower
            if (t.IsCompleted && !t.IsFaulted) probe = t.Result;
            if (l.IsCompleted && !l.IsFaulted) leave = l.Result;
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
            lastLeaveMs = leave,       // 1.1.5: the last sleep / shutdown after it, on its day (null: none found)
            forceOpaque = window.ForceOpaque,
            probeMs = probe,
            nowMs = NowMs(),
            version = Version,
            afterUpdate = afterUpdate   // 1.1.7 item 4: the first init after 一鍵更新 restarted the app (not after a page reload)
        });
        afterUpdate = false;
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
                    bool wasTopmost = LayoutTopmost();
                    topmost = HostSettings.Parse(text).TopmostByLayout();   // the page's own copy of layout.topmost
                    if (LayoutTopmost() != wasTopmost)
                    {
                        // a pin the page saved without its setTopmost (yet): the window and the menu's check follow
                        ApplyTopmost();
                        UpdateTray();
                    }
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
            case "healthMenu":   // 記一杯水's cups and 開始 / 停止番茄鐘 follow the page
                {
                    object p;
                    Dictionary<string, object> pomodoro = d.TryGetValue("pomodoro", out p) ? p as Dictionary<string, object> : null;
                    tray.SetHealth(Bridge.Str(d, "cups"), Bridge.Str(pomodoro, "phase"), Bridge.Num(pomodoro, "endsMs", 0));
                    break;
                }
            case "setTopmost":   // after every layout change, and from the menu's 永遠在最上層 or the title bar's pin (1.1.2)
                {
                    bool? on = Bridge.Bool(d, "on");
                    if (on == null) break;
                    if (layout != null) topmost[TopmostLayout()] = on.Value;   // the page saves it in settings.json
                    ApplyTopmost();
                    UpdateTray();   // the menu's check follows
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
            case "setZoom":
                {
                    object v;
                    if (!d.TryGetValue("percent", out v)) break;
                    zoomPercent = PageZoom.Parse(v);
                    placer.ZoomPercent = zoomPercent;
                    ApplyZoom();
                    break;
                }
            case "checkUpdate": CheckUpdate(); break;
            case "openUpdate": OpenUpdate(); break;
            case "installUpdate": InstallUpdate(); break;
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
        LayoutMove move = WindowPlacer.MoveFor(name, WindowPlacer.InPlaceAsked(d));
        bool changed = name != layout;
        bool shownBefore = layout != null || rescued;   // a layout was placed before this one (PanelFrom)
        layout = name;
        if (name != WindowPlacer.PanelLayout) fromLayout = name;
        if (changed) panelInPlace = move == LayoutMove.InPlace;   // a panel stays in place or beside until it closes
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
        double dpr = Dpr(d), scaleBefore = window.CssScale;
        if (SetWindowZoom(ZoomFor(css, before))) dpr = 0;   // sized at the new zoom; the page reports its DPR after
        if (move == LayoutMove.InPlace) window.KeepSize(css.Width, css.Height, dpr);   // the same window, untouched
        else if (!changed) window.SetContentSize(css.Width, css.Height, dpr);
        else
        {
            // Resized and moved in one step (no frame of the new size at the old spot), then placed again at the size a
            // landing on another DPI gave it.
            window.SetContentSizeAt(css.Width, css.Height, dpr, delegate(Size size) { return Target(move, name, size, before, shownBefore).Location; });
            Rectangle again = Target(move, name, window.Size, before, shownBefore);
            if (again != window.Bounds) window.Bounds = again;
            if (move == LayoutMove.Dock) placer.Remember(name, window.Location);   // the next start in U10 shows there
            if (move != LayoutMove.Beside) placer.RememberSize(name, css);   // the next start's PrePlace and the safety net
        }
        if (changed)
        {
            growFrom = null;
            growTo = null;
            presentation.Poll();   // another monitor: is a full-screen window in front there?
            UpdateStepBack();
            ApplyTopmost();
        }
        else if (!window.Moving)   // a new size mid-drag (another DPI) is left to the drop (OnMoveEnded)
        {
            if (window.Size != before.Size || name == "U10") AfterZoomOrResize(before, scaleBefore);
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

    // Where a layout change puts a window of size (physical px), given the window's rect before it:
    // - Beside: a panel beside the window it came from, on that monitor (1.1.1); at a start that opens with a panel, the
    //   hidden window PrePlace put where the start layout shows. PANEL's own saved spot is not used.
    // - Dock: U10 at its dock on the monitor the window is on.
    // - Anchor (1.1.2): every other layout. Without an anchor yet, this layout's own 1.1.1 spot becomes it, at the size it
    //   was saved at (the upgrade), else the window's top-left once a layout has shown.
    Rectangle Target(LayoutMove move, string name, Size size, Rectangle before, bool shownBefore)
    {
        Rectangle[] areas = WindowPlacer.WorkAreas();
        if (move == LayoutMove.Beside)
            return WindowPlacer.PanelBounds(WindowPlacer.PanelFrom(shownBefore, placer.StartSpotKnown, before), size, areas, Screen.PrimaryScreen.WorkingArea);
        if (move == LayoutMove.Dock) return CapsuleDock.Rect(capsuleDock, CapsuleDock.AreaFor(before, areas), size, CapsuleMargin());
        Size? savedCss = placer.SavedSize(name);
        return placer.AnchorRect(name, size, savedCss.HasValue ? window.ToPhysical(savedCss.Value) : (Size?)null,
            shownBefore ? before.Location : (Point?)null);
    }

    // The same layout changed size (a prompt bubble beside U7 / M3): a window that was inside stays fully inside through
    // every grow and partial shrink, and goes back to where it was once it fits there, unless the user moved it
    // meanwhile (WindowPlacer.ResizeInside). No spot is saved.
    void FitAfterResize(Rectangle before)
    {
        Point at = WindowPlacer.ResizeInside(before, window.Size, WindowPlacer.WorkAreas(), ref growFrom, ref growTo);
        if (at != window.Location) window.Location = at;
    }

    // The window resized within its layout (before: its rect then, at scaleBefore physical px per CSS px): U10 back to its
    // dock; U7 seated on the taskbar edge kept seated when the zoom changed (ScreenFit.SettleDesk); any other window kept
    // inside its work area (FitAfterResize).
    void AfterZoomOrResize(Rectangle before, double scaleBefore)
    {
        if (layout == "U10") { DockCapsule(before); return; }
        Rectangle area = Screen.FromRectangle(before).WorkingArea;
        if (layout == "U7" && Math.Abs(window.CssScale - scaleBefore) > 1e-9 && ScreenFit.Seated(before, DeskMargin(scaleBefore), area))
        {
            // seated on the taskbar edge: the desk stays on it (its margin below the work area, as a drop leaves it)
            Rectangle at = ScreenFit.SettleDesk(before, DeskMargin(scaleBefore), window.Size, DeskMargin(window.CssScale), area);
            if (at.Location != window.Location) window.Location = at.Location;
            growFrom = null;
            growTo = null;
            return;
        }
        FitAfterResize(before);
    }

    // The zoom for a page of css size in the window at rect (on that monitor): PageZoom.Fit of the chosen zoom.
    double ZoomFor(Size css, Rectangle at)
    {
        return PageZoom.Fit(zoomPercent, css, window.BaseScale, Screen.FromRectangle(at).WorkingArea);
    }

    // The chosen zoom changed (setZoom), or the window landed on another monitor: the window takes the zoom it gets there
    // and is resized from it at once (the page re-reports its DPR and layout after).
    // True when the zoom changed.
    bool ApplyZoom()
    {
        if (layout == null || layoutCss.Width < 1)
        {
            SetWindowZoom(PageZoom.Factor(zoomPercent));   // nothing shown yet: the first setLayout fits it
            return false;
        }
        Rectangle before = window.Bounds;
        double scaleBefore = window.CssScale;
        if (!SetWindowZoom(ZoomFor(layoutCss, before))) return false;
        window.SetContentSize(layoutCss.Width, layoutCss.Height, 0);
        if (!window.Moving) AfterZoomOrResize(before, scaleBefore);
        return true;
    }

    // A new DPI or new display settings (review M-4): the zoom fitted again where the window is now, unless a drag is on
    // (its drop does it) or the app is closing.
    void RefitZoom()
    {
        if (quitting || window.IsDisposed || window.Moving) return;
        try { ApplyZoom(); }
        catch (Exception ex) { ErrorLog.Write("refit zoom", ex); }
    }

    // Sets the WebView2 zoom and tells the page the one it got (PageZoom.Fit may give less than the setting): the page
    // sizes its tall panels by it (review M-6). True when it changed.
    bool SetWindowZoom(double z)
    {
        bool changed = window.SetZoom(z);
        if (Math.Abs(window.Zoom - sentZoom) > 1e-9)
        {
            sentZoom = window.Zoom;
            Send("zoomApplied", new { factor = sentZoom });
        }
        return changed;
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

    // U7's desk margin in physical px at scale.
    static int DeskMargin(double scale)
    {
        return (int)Math.Round(U7DeskMarginCss * scale, MidpointRounding.AwayFromZero);
    }

    void OnMoveEnded()
    {
        // on another monitor the window may get another zoom (PageZoom.Fit); its spot is saved again after that refit
        // (review M-5), so the saved anchor is the window as it ends up
        try { EndMove(); if (ApplyZoom()) SaveSpot(); }
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
            int margin = DeskMargin(window.CssScale);
            Rectangle fit = ScreenFit.KeepBottomIn(window.Bounds, margin, area);
            if (fit.Location != window.Location) window.Location = fit.Location;
        }
        SaveSpot();
        Send("dragEnd", null);
    }

    // A dropped window's spot (not U10's: its dock is saved by SnapCapsule / DockCapsule).
    void SaveSpot()
    {
        if (layout == "U10") return;
        if (WindowPlacer.DragMovesAnchor(layout, panelInPlace)) placer.SetAnchor(window.Bounds);   // 1.1.2: not U10, not a panel beside
        if (layout != WindowPlacer.PanelLayout)
        {
            // The layout's own 1.1.1 entry, no longer read for placement: kept up to date for a downgrade.
            placer.Remember(layout, window.Location);
            placer.RememberSize(layout, layoutCss);
        }
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
            else window.Bounds = placer.AnchorRect(startLayout, window.Size, window.Size, null);
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
    // safety net shows); for a panel, the layout it came from's.
    bool LayoutTopmost()
    {
        bool on;
        return topmost.TryGetValue(TopmostLayout(), out on) && on;
    }

    string TopmostLayout()
    {
        return ShowRescue.TopmostLayout(layout ?? startLayout, fromLayout ?? startLayout);
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
        string toPage = ShowRescue.PageAction(action, layout);   // 7 迷你浮窗 is the page's mini, and nothing in M3 (review M-1)
        if (ShowRescue.MenuShows(action))
        {
            // The user wants to see the result: shown and raised now, with the keyboard if the current layout takes
            // it and stays; the layout the page switches to for it (a panel, another layout) takes the keyboard when
            // its setLayout arrives, if it is an activating one.
            ShowAndRaise(ShowRescue.MenuActivatesNow(action));
            activateUntil = DateTime.UtcNow.AddMilliseconds(MenuActivateMs);
            if (ShowRescue.UserPanel(action)) panelAskedUntil = activateUntil;   // in front of full screen too (review §4a)
        }
        if (toPage != null) Send("menu", new { action = toPage });
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
    // example in the WebView2 child or the user's app) gets Esc through MenuEscape while it is open. Every menu, from the
    // page or the tray, in every layout, closes on a click on our own window (MenuClickAway, 1.1.2 item 2).
    void OnMenuOpened()
    {
        if (quitting) return;
        menuClickAway.Start();
        if (MenuEscape.Needed(window.NoActivate, KeyboardThread(), uiThread)) menuEscape.Start();
    }

    // The cursor is over the pet window where the user sees it: the window at the cursor (WindowFromPoint skips it where
    // it clicks through) is ours or one of its children, the WebView2 page's windows included (another process's, so
    // GetAncestor). Over the menu, whose popups are top-level windows of their own, or another program's window: false.
    bool CursorOverWindow()
    {
        if (!ShownToUser()) return false;
        Native.POINT p;
        if (!Native.GetCursorPos(out p)) return false;
        IntPtr at = Native.WindowFromPoint(p);
        return at != IntPtr.Zero && Native.GetAncestor(at, Native.GA_ROOT) == window.Handle;
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

    // 檢查更新: the one request, off the UI thread (UpdateCheck.Within gives up after WaitMs); the answer goes to the page.
    async void CheckUpdate()
    {
        if (installing) return;   // the page does not ask while 一鍵更新 runs
        if (updateBusy) { updateAgain = true; return; }   // answered when the request out now ends
        updateBusy = true;
        UpdateResult r;
        try
        {
            // busy until the request itself has ended, not only until the page got its answer (review M-1): a request
            // that outlives the wait is never joined by a second one
            Task<UpdateResult> work = UpdateCheck.Begin(UpdateCheck.Fetch, Version);
            SynchronizationContext at = ui;
            Task ended = work.ContinueWith(delegate   // (not awaited: CheckUpdate answers at the wait, this at the end)
            {
                at.Post(delegate
                {
                    updateBusy = false;
                    if (!updateAgain) return;
                    updateAgain = false;   // pressed again meanwhile (the page had its unknown): this request's answer
                    if (!quitting) AnswerUpdate(work.Result);
                }, null);
            }, TaskScheduler.Default);
            r = await UpdateCheck.Within(work, UpdateCheck.WaitMs);
        }
        catch (Exception ex) { ErrorLog.Write("update check", ex); r = UpdateCheck.Unknown(); updateBusy = false; }
        if (!quitting) AnswerUpdate(r);
    }

    void AnswerUpdate(UpdateResult r)
    {
        updateUrl = UpdateCheck.UrlToOpen(r.Url);
        updateAsset = r.Kind == "newer" && Payload.IsRelease ? r.Asset : null;   // a dev build never updates itself
        Send("updateResult", new { kind = r.Kind, version = r.Version, install = updateAsset != null });
    }

    // 一鍵更新: the last newer result's exe, downloaded and checked off the UI thread, then put in place of this exe.
    async void InstallUpdate()
    {
        UpdateAsset a = updateAsset;
        if (installing || quitting || a == null || !Payload.IsRelease) return;
        installing = true;
        SendUpdateState("downloading", 0);
        string exe = Application.ExecutablePath;
        SynchronizationContext at = ui;
        string file = null;
        try
        {
            string dir = Path.Combine(AppPaths.LocalDir, UpdateInstall.Folder);
            int shown = 0;   // the last percent sent (worker thread only)
            file = await Task.Run(delegate
            {
                return UpdateInstall.Download(a, dir, UpdateInstall.Get, delegate(long got, long size)
                {
                    int p = (int)(got * 100 / size);
                    if (p == shown) return;
                    shown = p;
                    at.Post(delegate { if (installing && !quitting && restartExe == null) SendUpdateState("downloading", p); }, null);
                }, delegate(string why) { ErrorLog.Write(why); });
            });
        }
        catch (Exception ex) { ErrorLog.Write("update download", ex); file = null; }
        if (quitting) { DeleteQuietly(file); return; }
        if (file == null || !UpdateInstall.Swap(exe, file, File.Move, delegate(string why) { ErrorLog.Write(why); }))
        {
            DeleteQuietly(file);
            installing = false;
            SendUpdateState("failed", 0);
            return;
        }
        restartExe = exe;
        SendUpdateState("restarting", 100);
        BeginQuit();   // the page saves as on any quit; Quit starts the new exe
    }

    void SendUpdateState(string phase, int percent)
    {
        Send("updateState", new { phase = phase, percent = percent });
    }

    static void DeleteQuietly(string path)
    {
        try { if (path != null && File.Exists(path)) File.Delete(path); }
        catch (Exception) { }
    }

    // After Shutdown (files saved, the instance mutex released): the swapped exe, told to wait for this process. When it
    // cannot start, the old exe goes back and that one is started instead.
    void StartUpdated()
    {
        string exe = restartExe;
        if (exe == null) return;
        int pid;
        using (System.Diagnostics.Process me = System.Diagnostics.Process.GetCurrentProcess()) pid = me.Id;
        if (StartExe(exe, pid)) return;
        if (UpdateInstall.Restore(exe, File.Move, delegate(string why) { ErrorLog.Write(why); })) StartExe(exe, pid);
    }

    static bool StartExe(string exe, int pid)
    {
        try
        {
            System.Diagnostics.ProcessStartInfo si = new System.Diagnostics.ProcessStartInfo(exe, UpdateInstall.RestartArgs(pid));
            si.UseShellExecute = false;
            si.WorkingDirectory = Path.GetDirectoryName(exe);
            using (System.Diagnostics.Process.Start(si)) { }
            return true;
        }
        catch (Exception ex)
        {
            ErrorLog.Write("starting the updated exe", ex);
            return false;
        }
    }

    // The last result's page in the default browser: only ever the two shapes UpdateCheck.UrlToOpen lets through.
    void OpenUpdate()
    {
        string url = UpdateCheck.UrlToOpen(updateUrl);
        try { using (System.Diagnostics.Process.Start(url)) { } }
        catch (Exception ex) { ErrorLog.Write("open " + url, ex); }
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
        StartUpdated();   // 一鍵更新: the new exe (it waits for this process to end)
        // Deferred: Quit runs inside WebView2 and menu event handlers, which must return before their objects go.
        ui.Post(delegate
        {
            try
            {
                menuEscape.Dispose();   // first: the poll timers go even if a later step throws
                menuClickAway.Dispose();
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
        if (displayChanged != null) Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= displayChanged;   // a static event: it would keep the app alive
        firstShowTimer.Stop();
        firstShowTimer.Dispose();
        menuEscape.Stop();   // quitting from the open menu: Esc must not stay registered
        menuClickAway.Stop();
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
