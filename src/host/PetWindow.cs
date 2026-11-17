using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Borderless, taskbar-less window whose only content is a WebView2 page. Wherever the page is
// transparent the desktop shows through (true per-pixel alpha), and outside the page's hit rects
// clicks fall through to whatever is behind. Why it is built this way: docs/spikes/transparency.md.
//
// Rendering: DWM blur-behind with an empty region makes DWM honour the alpha of the window surface;
// the GDI background is black (alpha 0) and the WebView2 page (transparent default background) is
// composed on top with its own alpha.
// Click-through: the window is layered with constant alpha 255 (renders the same, but makes
// WS_EX_TRANSPARENT count for hit-testing); a ~30 Hz cursor poll sets WS_EX_TRANSPARENT whenever
// the cursor is outside every hit rect, so the whole window, WebView2 included, is skipped.
// CSS -> physical px uses the page's devicePixelRatio (reported with SetContentSize / SetHitRects),
// which can differ from DPI / 96 (page zoom, Windows Text size). 1.1.5 縮放比例 is the WebView2 ZoomFactor (Zoom), so
// the page's DPR includes it and every conversion follows; the page's own zoom keys and Ctrl+wheel stay off (the page
// handles them itself and asks the host, AppHost setZoom).
// Focus: showing never activates the window; with NoActivate set (floating layouts) clicks do not either.
// If either transparency call fails (Transparency), the window still works with an opaque #FFF8EC background
// (ForceOpaque; the page is told in init); click-through keeps working as long as the window could be layered.
public class PetWindow : Form
{
    private readonly WebView2 web = new WebView2();
    private readonly Timer hitTimer = new Timer();
    private readonly string startUrl;
    private RectangleF[] hitRects = new RectangleF[0];   // CSS px; none = everything clicks through
    private int cssWidth;
    private int cssHeight;
    private double scale;      // physical px per CSS px; 0 until known, then the page's DPR
    private double zoom = 1;   // the WebView2 ZoomFactor (1.1.5 縮放比例): part of the page's DPR
    private double staleDpr;   // the DPR before the last zoom change: a report of it is from before the change, ignored
    private int windowDpi;     // tracked through WM_DPICHANGED
    private bool pollSuspended;
    private bool webStarted;
    private bool failed;
    private bool noActivate;
    private bool topMost;
    private bool everShown;
    private bool notLayered;          // SetLayeredWindowAttributes failed: a layered window would stay invisible
    private bool transparencyLogged;  // the transparency failure goes to error.log once

    public event EventHandler WebReady;

    // The cursor moved onto (true) or off (false) every hit rect, as the hit poll saw it (1.1.1): only on a crossing
    // (PointerEdge). Once off them the window clicks through and the page gets no more mouse events, so this is how
    // it learns the pointer has gone even when WebView2 sends it no mouseout.
    public event Action<bool> PointerChanged;
    private readonly PointerEdge pointer = new PointerEdge();

    // WebView2 setup failed; the window cannot be shown usefully. Raised at most once. Without a subscriber the
    // window shows the message itself and closes. (A transparency failure is not one: see ForceOpaque.)
    public event Action<string> InitFailed;

    // Windows is ending the session (WM_QUERYENDSESSION, or WM_ENDSESSION with wParam TRUE). Raised synchronously,
    // before WinForms turns it into FormClosing: the handler can still write to the disk.
    public event EventHandler SessionEnding;

    // The transparency setup failed (Transparency): the window paints an opaque #FFF8EC background instead of the
    // desktop. Known once the handle exists.
    public bool ForceOpaque { get; private set; }

    // A move or resize loop ended (WM_EXITSIZEMOVE), e.g. after BeginDrag.
    public event EventHandler MoveEnded;

    // A move or resize loop runs (WM_ENTERSIZEMOVE until WM_EXITSIZEMOVE): the user is dragging the window.
    public bool Moving { get; private set; }

    // WM_HOTKEY arrived; the argument is the hotkey id.
    public event Action<int> HotKeyPressed;

    // The user asked to close the window (Alt+F4: WM_SYSCOMMAND SC_CLOSE). The window does not close by itself;
    // the owner decides (the app hides it). Any FormClosing therefore comes from the program or from Windows.
    public event EventHandler CloseRequested;

    public PetWindow(string startUrl)
    {
        this.startUrl = startUrl;
        Text = "錢進中";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.None;
        BackColor = Color.Black;   // GDI writes alpha 0, so black = fully transparent under blur-behind

        web.DefaultBackgroundColor = Color.Transparent;
        web.Dock = DockStyle.Fill;
        Controls.Add(web);

        hitTimer.Interval = 33;
        hitTimer.Tick += delegate { UpdateClickThrough(); };
        VisibleChanged += delegate { hitTimer.Enabled = Visible && !pollSuspended; };
    }

    // Null until WebReady.
    public CoreWebView2 Web { get { return web.CoreWebView2; } }

    // Creates the window without showing it and starts loading the page (WebView2 runs while hidden), so the
    // owner can size and place it before the first Show().
    public void CreateHidden()
    {
        if (!IsHandleCreated) CreateHandle();
    }

    // Set without activating the window (Form.TopMost would activate it and take focus from the user's app).
    public bool TopMostEnabled
    {
        get { return topMost; }
        set
        {
            topMost = value;
            if (IsHandleCreated)
                Native.SetWindowPos(Handle, value ? Native.HWND_TOPMOST : Native.HWND_NOTOPMOST, 0, 0, 0, 0,
                    Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
        }
    }

    // Brings the window to the top of its band (topmost or not) without activating it. SetWindowPos(HWND_TOP) alone
    // does not lift it above another program's windows while this process is in the background (measured: it stays
    // under them); passing through the topmost band does, and a window that is not topmost leaves that band at once
    // (HWND_NOTOPMOST puts it above every other non-topmost window, the foreground one included).
    public void RaiseWithoutActivation()
    {
        if (!IsHandleCreated) return;
        const uint flags = Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE;
        Native.SetWindowPos(Handle, Native.HWND_TOPMOST, 0, 0, 0, 0, flags);
        if (!topMost) Native.SetWindowPos(Handle, Native.HWND_NOTOPMOST, 0, 0, 0, 0, flags);
    }

    // True: clicking the window does not activate it, so the user's app keeps keyboard focus. WS_EX_NOACTIVATE
    // on this root window is what counts for clicks on the page: the WebView2 child windows answer
    // WM_MOUSEACTIVATE themselves (MA_ACTIVATE); this window answers MA_NOACTIVATE for clicks that reach it.
    // False: normal activation, needed wherever the page takes keyboard input.
    public bool NoActivate
    {
        get { return noActivate; }
        set
        {
            noActivate = value;
            if (!IsHandleCreated) return;
            int ex = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
            int want = value ? ex | Native.WS_EX_NOACTIVATE : ex & ~Native.WS_EX_NOACTIVATE;
            if (want != ex) Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, want);
        }
    }

    protected override bool ShowWithoutActivation
    {
        get { return true; }
    }

    // The WebView2 control is hidden and shown together with the window:
    // - WinForms tells child controls when their form is shown but not when it is hidden, so WebView2 would keep
    //   rendering a hidden window (measured: ~13 % of a core instead of ~0.4 %).
    // - First show: the window was created hidden (CreateHidden) at its default size, and that initial area
    //   showed as a solid white box until the WebView2 control itself was hidden and shown once, so it is.
    // (Before the first show nothing is changed: the page loads while hidden and sends its first setLayout.)
    protected override void SetVisibleCore(bool value)
    {
        if (!value && everShown) web.Visible = false;
        base.SetVisibleCore(value);
        if (value)
        {
            if (!everShown) web.Visible = false;
            everShown = true;
            web.Visible = true;
        }
    }

    // Window size = page CSS size x page DPR. dpr <= 0 means "not reported": the last known scale is kept
    // (window DPI / 96 until the page has reported one).
    public void SetContentSize(int cssWidth, int cssHeight, double dpr)
    {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        TakeDpr(dpr);
        ApplySize();
    }

    // SetContentSize, and in the same step (one SetWindowPos) the window goes where place puts a window of the new size
    // (physical px), so no frame shows the new size at the old spot (1.1.2: a layout switch that is pushed in, or leaves
    // U10). A landing on a monitor with another DPI is resized by WM_DPICHANGED from the new CSS size.
    public void SetContentSizeAt(int cssWidth, int cssHeight, double dpr, Func<Size, Point> place)
    {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        TakeDpr(dpr);
        Size size = PetGeometry.WindowSize(cssWidth, cssHeight, Scale());
        Bounds = new Rectangle(place(size), size);
    }

    // The page lays itself out at cssWidth x cssHeight in the window as it is (an in-place panel, 1.1.2): remembered
    // like SetContentSize (a DPI change resizes from it), but the window keeps its size exactly, even where that CSS size
    // would round to another one. Only a new DPR (the zoom changed) resizes it, as SetHitRects would.
    public void KeepSize(int cssWidth, int cssHeight, double dpr)
    {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        if (TakeDpr(dpr)) ApplySize();
    }

    // The WebView2 ZoomFactor (1.1.5 縮放比例; set before the page loads, it applies from the first frame).
    public double Zoom { get { return zoom; } }

    // Physical px per CSS px at zoom 1 on this monitor: the page's DPR without the zoom.
    public double BaseScale { get { return Scale() / zoom; } }

    // Sets the zoom; false when it is the one already set. The scale becomes the one the page will report (as after a DPI
    // change) and a report of the old one, sent before the change reached the page, is ignored. The window is not resized
    // here: the caller sizes it (SetContentSize with dpr 0).
    public bool SetZoom(double z)
    {
        if (!(z > 0) || Math.Abs(z - zoom) < 1e-9) return false;
        if (scale > 0)
        {
            staleDpr = scale;
            scale = scale * z / zoom;
        }
        zoom = z;
        web.ZoomFactor = z;
        return true;
    }

    // Areas (CSS px, page coordinates) that receive the mouse; everywhere else clicks fall through.
    // A newly reported dpr also re-sizes the window.
    public void SetHitRects(RectangleF[] cssRects, double dpr)
    {
        hitRects = cssRects ?? new RectangleF[0];
        if (TakeDpr(dpr)) ApplySize();
        UpdateClickThrough();
    }

    // Stops (true) or restarts (false) the 30 Hz hit poll, e.g. while the session is locked. The last
    // click-through state stays in effect while stopped.
    public void SuspendHitPolling(bool suspend)
    {
        pollSuspended = suspend;
        hitTimer.Enabled = Visible && !suspend;
    }

    // Native window move; call while the primary button is held (e.g. on a page mousedown message).
    // grab: page CSS px that should hang under the cursor (U7's scruff tip); the window first jumps so it does, and
    // the move loop then keeps that offset for the whole drag. Null: the window moves from wherever it was pressed.
    public void BeginDrag(PointF? grab)
    {
        // Deferred so a WebView2 event handler that calls this returns before the modal move loop starts.
        BeginInvoke((MethodInvoker)delegate
        {
            int button = Native.GetSystemMetrics(Native.SM_SWAPBUTTON) != 0 ? Native.VK_RBUTTON : Native.VK_LBUTTON;
            if ((Native.GetAsyncKeyState(button) & 0x8000) == 0) return;   // already released: no sticky drag
            Native.POINT p;
            Native.GetCursorPos(out p);
            if (grab.HasValue)
            {
                Point? at = PetGeometry.GrabOrigin(p.X, p.Y, grab.Value, cssWidth, cssHeight, Scale());
                if (at.HasValue)
                    Native.SetWindowPos(Handle, IntPtr.Zero, at.Value.X, at.Value.Y, 0, 0,
                        Native.SWP_NOSIZE | Native.SWP_NOZORDER | Native.SWP_NOACTIVATE);
            }
            Native.ReleaseCapture();
            Native.SendMessage(Handle, Native.WM_NCLBUTTONDOWN, (IntPtr)Native.HTCAPTION,
                (IntPtr)((p.Y << 16) | (p.X & 0xFFFF)));
        });
    }

    protected override CreateParams CreateParams
    {
        get
        {
            CreateParams cp = base.CreateParams;
            cp.ExStyle |= Native.WS_EX_TRANSPARENT;
            if (!notLayered) cp.ExStyle |= Native.WS_EX_LAYERED;
            if (noActivate) cp.ExStyle |= Native.WS_EX_NOACTIVATE;
            if (topMost) cp.ExStyle |= Native.WS_EX_TOPMOST;
            return cp;
        }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        windowDpi = (int)Native.GetDpiForWindow(Handle);
        SetUpTransparency();
        if (!webStarted)
        {
            webStarted = true;
            BeginInvoke((MethodInvoker)InitWeb);
        }
    }

    // Both calls are always made: the layered style (click-through) does not depend on blur-behind. A failure is
    // logged once and the window goes on opaque. QJZ_FAKE_DWM_FAILURE=1 (dev builds only) skips the blur-behind call
    // and reports it as failed, to try the opaque path on a machine where DWM works.
    private void SetUpTransparency()
    {
        int hr;
        if (!Payload.IsRelease && Environment.GetEnvironmentVariable("QJZ_FAKE_DWM_FAILURE") == "1") hr = unchecked((int)0x80004005);
        else
        {
            Native.DWM_BLURBEHIND bb = new Native.DWM_BLURBEHIND();
            bb.dwFlags = Native.DWM_BB_ENABLE | Native.DWM_BB_BLURREGION;
            bb.fEnable = true;
            bb.hRgnBlur = Native.CreateRectRgn(0, 0, -1, -1);   // empty region: alpha only, no blur
            hr = Native.DwmEnableBlurBehindWindow(Handle, ref bb);
            Native.DeleteObject(bb.hRgnBlur);
        }
        bool layered = notLayered || Native.SetLayeredWindowAttributes(Handle, 0, 255, Native.LWA_ALPHA);
        int layeredError = layered ? 0 : Marshal.GetLastWin32Error();
        string failure = Transparency.Failure(hr, layered, layeredError);
        if (failure == null) return;
        if (!transparencyLogged)
        {
            transparencyLogged = true;
            ErrorLog.Write("transparent window setup failed, going on with an opaque background: " + failure);
        }
        ForceOpaque = true;
        Color paper = Color.FromArgb(Transparency.PaperArgb);
        BackColor = paper;                    // GDI black would show as black without blur-behind
        web.DefaultBackgroundColor = paper;   // until the page paints its own (opaque) background
        if (!layered)
        {
            // A layered window without SetLayeredWindowAttributes is never drawn: drop the style so the window shows.
            // Clicks then reach the whole window (no click-through) but the app stays usable.
            notLayered = true;
            int ex = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
            Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, ex & ~Native.WS_EX_LAYERED);
        }
    }

    // Handled here without calling base: Form.DeviceDpi stays at its creation value and Form.DpiChanged
    // never fires for this window. Use the page's reported DPR instead of either.
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_DPICHANGED)
        {
            int newDpi = (int)(m.WParam.ToInt64() & 0xFFFF);
            if (scale > 0) scale = PetGeometry.ScaleAfterDpiChange(scale, windowDpi, newDpi);   // provisional until the page re-reports
            staleDpr = 0;
            windowDpi = newDpi;
            Native.RECT r = (Native.RECT)Marshal.PtrToStructure(m.LParam, typeof(Native.RECT));
            Size size = cssWidth > 0 ? PetGeometry.WindowSize(cssWidth, cssHeight, Scale())
                                     : new Size(r.Right - r.Left, r.Bottom - r.Top);
            Native.SetWindowPos(Handle, IntPtr.Zero, r.Left, r.Top, size.Width, size.Height, Native.SWP_NOZORDER | Native.SWP_NOACTIVATE);
            m.Result = IntPtr.Zero;
            return;
        }
        if (m.Msg == Native.WM_MOUSEACTIVATE && noActivate)
        {
            m.Result = (IntPtr)Native.MA_NOACTIVATE;   // the click still reaches the page
            return;
        }
        if (m.Msg == Native.WM_SYSCOMMAND && (m.WParam.ToInt64() & 0xFFF0) == Native.SC_CLOSE)
        {
            // Not passed to base: WinForms would turn it into a WM_CLOSE with CloseReason UserClosing, and keep that
            // reason after a cancelled close, so a later WM_CLOSE from outside would look like Alt+F4 too.
            if (CloseRequested != null) CloseRequested(this, EventArgs.Empty);
            m.Result = IntPtr.Zero;
            return;
        }
        if (m.Msg == Native.WM_HOTKEY)
        {
            Action<int> hot = HotKeyPressed;
            if (hot != null) hot((int)m.WParam.ToInt64());
            m.Result = IntPtr.Zero;
            return;
        }
        if ((m.Msg == Native.WM_QUERYENDSESSION || (m.Msg == Native.WM_ENDSESSION && m.WParam != IntPtr.Zero)) && SessionEnding != null)
        {
            try { SessionEnding(this, EventArgs.Empty); }
            catch (Exception ex) { ErrorLog.Write("session end", ex); }   // Windows must still get its answer below
        }
        if (m.Msg == Native.WM_ENTERSIZEMOVE) Moving = true;
        base.WndProc(ref m);
        if (m.Msg == Native.WM_EXITSIZEMOVE)
        {
            Moving = false;
            if (MoveEnded != null) MoveEnded(this, EventArgs.Empty);
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) hitTimer.Dispose();
        base.Dispose(disposing);
    }

    // Physical px per CSS px of the page (its devicePixelRatio once reported).
    public double CssScale { get { return Scale(); } }

    // The window size a page of css size would have now (the same rounding as SetContentSize).
    public Size ToPhysical(Size css)
    {
        return PetGeometry.WindowSize(css.Width, css.Height, Scale());
    }

    private double Scale()
    {
        return scale > 0 ? scale : PetGeometry.DpiScale(windowDpi > 0 ? windowDpi : DeviceDpi) * zoom;
    }

    // A DPR the page reported (0 or less: none): taken unless it is the one from before the last zoom change. True when
    // the scale changed.
    private bool TakeDpr(double dpr)
    {
        if (!(dpr > 0)) return false;
        if (staleDpr > 0 && Math.Abs(dpr - staleDpr) < 1e-6) return false;
        staleDpr = 0;
        if (dpr == scale) return false;
        scale = dpr;
        return true;
    }

    private void ApplySize()
    {
        if (cssWidth > 0) Size = PetGeometry.WindowSize(cssWidth, cssHeight, Scale());
    }

    private void UpdateClickThrough()
    {
        if (!IsHandleCreated) return;
        bool on = CursorOnHitRect(), through = !on;
        bool? crossed = pointer.Step(on);
        if (crossed.HasValue && PointerChanged != null) PointerChanged(crossed.Value);
        int ex = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
        int want = through ? ex | Native.WS_EX_TRANSPARENT : ex & ~Native.WS_EX_TRANSPARENT;
        if (want != ex) Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, want);
    }

    private bool CursorOnHitRect()
    {
        Native.POINT p;
        Native.RECT win;
        if (!Native.GetCursorPos(out p) || !Native.GetWindowRect(Handle, out win)) return false;
        return PetGeometry.HitTest(hitRects, p.X, p.Y, win.Left, win.Top, Scale());
    }

    private void Fail(string message)
    {
        if (failed) return;   // e.g. a DWM failure followed by the WebView2 one: report only the first
        failed = true;
        Action<string> handler = InitFailed;
        if (handler != null) { handler(message); return; }
        MessageBox.Show(message, "錢進中");
        Close();
    }

    private async void InitWeb()
    {
        try
        {
            // The page must exist before WebView2 starts: a missing one (a dev page in a release build, or files
            // gone from the folder) is a short message and error.log, not a browser error page.
            string root = WebRoot.Resolve();
            if (root == null) { Fail("找不到網頁資源。"); return; }
            string page = WebRoot.PageFile(root, new Uri(startUrl).AbsolutePath);
            if (page == null || !File.Exists(page))
            {
                ErrorLog.Write("page not found: " + (page ?? startUrl));
                Fail("找不到頁面 " + new Uri(startUrl).AbsolutePath.TrimStart('/') + "。");
                return;
            }

            await web.EnsureCoreWebView2Async(await WebViewEnv.GetAsync());
            CoreWebView2Settings s = web.CoreWebView2.Settings;
            s.IsZoomControlEnabled = false;   // the page handles Ctrl+wheel / Ctrl+± itself (1.1.5): its zoom goes through the setting
            web.ZoomFactor = zoom;
            s.IsPinchZoomEnabled = false;
            s.AreDefaultContextMenusEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false;
            s.IsStatusBarEnabled = false;
            s.AreDevToolsEnabled = !Payload.IsRelease && Environment.GetEnvironmentVariable("QJZ_DEVTOOLS") == "1";   // dev builds only
            try { s.IsReputationCheckingRequired = false; }   // no SmartScreen lookups for the app's own local pages
            catch (Exception ex) { ErrorLog.Write("IsReputationCheckingRequired (older WebView2 runtime?)", ex); }
            web.AllowExternalDrop = false;    // a file dropped on a hit rect would navigate the page away

            web.CoreWebView2.SetVirtualHostNameToFolderMapping("app.qjz", root, CoreWebView2HostResourceAccessKind.Allow);
            if (WebReady != null) WebReady(this, EventArgs.Empty);
            web.CoreWebView2.Navigate(startUrl);
        }
        catch (Exception ex)
        {
            Fail("WebView2 初始化失敗：" + ex.Message);
        }
    }
}
