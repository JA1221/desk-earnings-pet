using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Borderless, taskbar-less window whose only content is a WebView2 page. Wherever the page is
// transparent the desktop shows through, and outside the page's hit rects clicks fall through
// to whatever is behind. See docs/spikes/transparency.md for why it is built this way.
public class PetWindow : Form
{
    // Colour key: one step off the A1 outline colour #3D2C24 (61,44,36), so real outline pixels stay
    // opaque while anti-aliased edges that blend toward the key read as outline instead of a fringe.
    private static readonly Color KeyColor = Color.FromArgb(61, 44, 37);

    private readonly WebView2 web = new WebView2();
    private readonly Timer hitTimer = new Timer();
    private readonly string startUrl;
    private RectangleF[] hitRects;   // CSS px; null until the page reports them (whole window hittable)
    private int cssWidth;
    private int cssHeight;

    public event EventHandler WebReady;

    public PetWindow(string startUrl)
    {
        this.startUrl = startUrl;
        Text = "錢進中";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.None;
        BackColor = KeyColor;
        TransparencyKey = KeyColor;

        web.DefaultBackgroundColor = Color.Transparent;
        web.Dock = DockStyle.Fill;
        Controls.Add(web);

        hitTimer.Interval = 33;   // ~30 Hz cursor poll
        hitTimer.Tick += delegate { UpdateClickThrough(); };
        VisibleChanged += delegate { hitTimer.Enabled = Visible; };
        Load += delegate { InitWeb(); };
    }

    public CoreWebView2 Web { get { return web.CoreWebView2; } }

    public bool TopMostEnabled
    {
        get { return TopMost; }
        set { TopMost = value; }
    }

    // Window size = page CSS size x the window's current DPI scale.
    public void SetContentSize(int cssWidth, int cssHeight)
    {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        double s = DpiScale();
        Size = new Size((int)Math.Round(cssWidth * s), (int)Math.Round(cssHeight * s));
    }

    // Areas (CSS px, page coordinates) that receive the mouse; everywhere else clicks fall through.
    public void SetHitRects(RectangleF[] cssRects)
    {
        hitRects = cssRects ?? new RectangleF[0];
        UpdateClickThrough();
    }

    // Native window move; call while the primary button is held (e.g. from a page mousedown message).
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

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_DPICHANGED)
        {
            // Keep the suggested position, but size from the page's CSS size at the new DPI.
            Native.RECT r = (Native.RECT)Marshal.PtrToStructure(m.LParam, typeof(Native.RECT));
            double s = (m.WParam.ToInt64() & 0xFFFF) / 96.0;
            int w = cssWidth > 0 ? (int)Math.Round(cssWidth * s) : r.Right - r.Left;
            int h = cssHeight > 0 ? (int)Math.Round(cssHeight * s) : r.Bottom - r.Top;
            Native.SetWindowPos(Handle, IntPtr.Zero, r.Left, r.Top, w, h, Native.SWP_NOZORDER | Native.SWP_NOACTIVATE);
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

    private double DpiScale()
    {
        uint dpi = IsHandleCreated ? Native.GetDpiForWindow(Handle) : 0;
        return (dpi == 0 ? DeviceDpi : (int)dpi) / 96.0;
    }

    // WS_EX_TRANSPARENT on a layered window makes the whole window, WebView2 child included,
    // invisible to hit-testing; it is set whenever the cursor is outside every hit rect.
    private void UpdateClickThrough()
    {
        if (!IsHandleCreated) return;
        bool through = hitRects != null && !CursorOnHitRect();
        int ex = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
        int want = through ? ex | Native.WS_EX_TRANSPARENT : ex & ~Native.WS_EX_TRANSPARENT;
        if (want != ex) Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, want);
    }

    private bool CursorOnHitRect()
    {
        Native.POINT p;
        Native.RECT win;
        if (!Native.GetCursorPos(out p) || !Native.GetWindowRect(Handle, out win)) return false;
        double s = DpiScale();
        float x = (float)((p.X - win.Left) / s);
        float y = (float)((p.Y - win.Top) / s);
        foreach (RectangleF r in hitRects)
            if (r.Contains(x, y)) return true;
        return false;
    }

    private async void InitWeb()
    {
        try
        {
            string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
            string arch = Environment.Is64BitProcess ? "x64" : "x86";
            string loader = Path.Combine(exeDir, Path.Combine("vendor", Path.Combine("webview2", arch)));
            if (!Directory.Exists(loader))
            {
                // dev layout: build\ exe next to repo's vendor\
                string repoVendor = Path.Combine(Path.GetDirectoryName(exeDir) ?? exeDir, Path.Combine("vendor", Path.Combine("webview2", arch)));
                if (Directory.Exists(repoVendor)) loader = repoVendor;
            }
            if (Directory.Exists(loader)) CoreWebView2Environment.SetLoaderDllFolderPath(loader);

            string userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Path.Combine("錢進中", "WebView2"));
            Directory.CreateDirectory(userData);
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userData);
            await web.EnsureCoreWebView2Async(env);

            string root = WebRoot.Resolve();
            if (root == null) { MessageBox.Show("找不到網頁資源 (src/web)。", "錢進中"); return; }
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("app.qjz", root, CoreWebView2HostResourceAccessKind.Allow);
            if (WebReady != null) WebReady(this, EventArgs.Empty);
            web.CoreWebView2.Navigate(startUrl);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.ToString(), "錢進中");
        }
    }
}
