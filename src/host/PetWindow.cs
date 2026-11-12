using System;
using System.Drawing;
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
// which can differ from DPI / 96 (page zoom, Windows Text size).
public class PetWindow : Form
{
    private readonly WebView2 web = new WebView2();
    private readonly Timer hitTimer = new Timer();
    private readonly string startUrl;
    private RectangleF[] hitRects = new RectangleF[0];   // CSS px; none = everything clicks through
    private int cssWidth;
    private int cssHeight;
    private double scale;      // physical px per CSS px; 0 until known, then the page's DPR
    private int windowDpi;     // tracked through WM_DPICHANGED
    private bool pollSuspended;

    public event EventHandler WebReady;

    // Transparency or WebView2 setup failed; the window cannot be shown usefully. Without a subscriber the
    // window shows the message itself and closes.
    public event Action<string> InitFailed;

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
        Load += delegate { InitWeb(); };
    }

    // Null until WebReady.
    public CoreWebView2 Web { get { return web.CoreWebView2; } }

    public bool TopMostEnabled
    {
        get { return TopMost; }
        set { TopMost = value; }
    }

    // Window size = page CSS size x page DPR. dpr <= 0 means "not reported": the last known scale is kept
    // (window DPI / 96 until the page has reported one).
    public void SetContentSize(int cssWidth, int cssHeight, double dpr)
    {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        if (dpr > 0) scale = dpr;
        ApplySize();
    }

    // Areas (CSS px, page coordinates) that receive the mouse; everywhere else clicks fall through.
    // A newly reported dpr also re-sizes the window.
    public void SetHitRects(RectangleF[] cssRects, double dpr)
    {
        hitRects = cssRects ?? new RectangleF[0];
        if (dpr > 0 && dpr != scale)
        {
            scale = dpr;
            ApplySize();
        }
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
    public void BeginDrag()
    {
        // Deferred so a WebView2 event handler that calls this returns before the modal move loop starts.
        BeginInvoke((MethodInvoker)delegate
        {
            int button = Native.GetSystemMetrics(Native.SM_SWAPBUTTON) != 0 ? Native.VK_RBUTTON : Native.VK_LBUTTON;
            if ((Native.GetAsyncKeyState(button) & 0x8000) == 0) return;   // already released: no sticky drag
            Native.POINT p;
            Native.GetCursorPos(out p);
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
            cp.ExStyle |= Native.WS_EX_LAYERED | Native.WS_EX_TRANSPARENT;
            return cp;
        }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        windowDpi = (int)Native.GetDpiForWindow(Handle);
        Native.DWM_BLURBEHIND bb = new Native.DWM_BLURBEHIND();
        bb.dwFlags = Native.DWM_BB_ENABLE | Native.DWM_BB_BLURREGION;
        bb.fEnable = true;
        bb.hRgnBlur = Native.CreateRectRgn(0, 0, -1, -1);   // empty region: alpha only, no blur
        int hr = Native.DwmEnableBlurBehindWindow(Handle, ref bb);
        Native.DeleteObject(bb.hRgnBlur);
        string error = null;
        if (hr < 0) error = "DwmEnableBlurBehindWindow 0x" + hr.ToString("X8");
        else if (!Native.SetLayeredWindowAttributes(Handle, 0, 255, Native.LWA_ALPHA))
            error = "SetLayeredWindowAttributes " + Marshal.GetLastWin32Error();
        if (error != null)
            BeginInvoke((MethodInvoker)delegate { Fail("透明視窗初始化失敗：" + error); });
    }

    // Handled here without calling base: Form.DeviceDpi stays at its creation value and Form.DpiChanged
    // never fires for this window. Use the page's reported DPR instead of either.
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_DPICHANGED)
        {
            int newDpi = (int)(m.WParam.ToInt64() & 0xFFFF);
            if (scale > 0) scale = PetGeometry.ScaleAfterDpiChange(scale, windowDpi, newDpi);   // provisional until the page re-reports
            windowDpi = newDpi;
            Native.RECT r = (Native.RECT)Marshal.PtrToStructure(m.LParam, typeof(Native.RECT));
            Size size = cssWidth > 0 ? PetGeometry.WindowSize(cssWidth, cssHeight, Scale())
                                     : new Size(r.Right - r.Left, r.Bottom - r.Top);
            Native.SetWindowPos(Handle, IntPtr.Zero, r.Left, r.Top, size.Width, size.Height, Native.SWP_NOZORDER | Native.SWP_NOACTIVATE);
            m.Result = IntPtr.Zero;
            return;
        }
        base.WndProc(ref m);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) hitTimer.Dispose();
        base.Dispose(disposing);
    }

    private double Scale()
    {
        return scale > 0 ? scale : PetGeometry.DpiScale(windowDpi > 0 ? windowDpi : DeviceDpi);
    }

    private void ApplySize()
    {
        if (cssWidth > 0) Size = PetGeometry.WindowSize(cssWidth, cssHeight, Scale());
    }

    private void UpdateClickThrough()
    {
        if (!IsHandleCreated) return;
        bool through = !CursorOnHitRect();
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
        Action<string> handler = InitFailed;
        if (handler != null) { handler(message); return; }
        MessageBox.Show(message, "錢進中");
        Close();
    }

    private async void InitWeb()
    {
        try
        {
            await web.EnsureCoreWebView2Async(await WebViewEnv.GetAsync());
            CoreWebView2Settings s = web.CoreWebView2.Settings;
            s.IsZoomControlEnabled = false;   // page zoom would desync DPR from the reported layout
            s.IsPinchZoomEnabled = false;
            s.AreDefaultContextMenusEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false;
            s.IsStatusBarEnabled = false;
            s.AreDevToolsEnabled = Environment.GetEnvironmentVariable("QJZ_DEVTOOLS") == "1";
            web.AllowExternalDrop = false;    // a file dropped on a hit rect would navigate the page away

            string root = WebRoot.Resolve();
            if (root == null) { Fail("找不到網頁資源 (src/web)。"); return; }
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
