using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Windows.Forms;

// The app's one menu, in A1 colours: the tray icon shows it on right click, and the host shows it for the
// page's contextMenu message. Every item raises ItemClicked with its action id (layout:U1|U3|U5B|U7, mini,
// feed, start, adjust, end, topmost, settings, history, toggleVisible, quit); the host decides what each does.
// The tray icon (tooltip 錢進中) is a coin drawn at runtime; double-clicking it raises IconDoubleClick.
public class TrayMenu : IDisposable
{
    static readonly Color Paper = Color.FromArgb(0xFF, 0xF8, 0xEC);   // #FFF8EC
    static readonly Color Line = Color.FromArgb(0x3D, 0x2C, 0x24);    // #3D2C24
    static readonly Color Gold = Color.FromArgb(0xFF, 0xC8, 0x57);    // #FFC857
    static readonly Color Orange = Color.FromArgb(0xFF, 0x8A, 0x3D);  // #FF8A3D
    static readonly Color Amber = Color.FromArgb(0xFF, 0xB6, 0x27);   // #FFB627
    const string FontName = "Microsoft JhengHei UI";
    const float FontPoints = 10f;

    readonly ContextMenuStrip menu = new ContextMenuStrip();
    readonly ToolStripMenuItem layouts;
    NotifyIcon notifyIcon;
    Icon trayIcon;
    Font font;
    float fontScale;
    bool showingAt;

    public event Action<string> ItemClicked;
    public event EventHandler IconDoubleClick;

    public TrayMenu()
    {
        ToolStripProfessionalRenderer renderer = new A1Renderer();
        menu.Renderer = renderer;
        menu.ShowImageMargin = true;   // room for the check marks
        layouts = new ToolStripMenuItem("切換版型");
        layouts.Name = "layouts";
        layouts.DropDown.Renderer = renderer;
        Add(layouts.DropDownItems, "U1 經典直式", "layout:U1");
        Add(layouts.DropDownItems, "U3 遊戲畫面", "layout:U3");
        Add(layouts.DropDownItems, "U5-B 橫向極簡", "layout:U5B");
        Add(layouts.DropDownItems, "U7 桌面寵物", "layout:U7");
        menu.Items.Add(layouts);
        Add(menu.Items, "縮成迷你", "mini");
        menu.Items.Add(new ToolStripSeparator());
        Add(menu.Items, "餵食", "feed");
        menu.Items.Add(new ToolStripSeparator());
        Add(menu.Items, "開始上班", "start");
        Add(menu.Items, "調整起算時間", "adjust");
        Add(menu.Items, "下班", "end");
        menu.Items.Add(new ToolStripSeparator());
        Add(menu.Items, "永遠在最上層", "topmost");
        menu.Items.Add(new ToolStripSeparator());
        Add(menu.Items, "設定", "settings");
        Add(menu.Items, "紀錄", "history");
        menu.Items.Add(new ToolStripSeparator());
        Add(menu.Items, "隱藏", "toggleVisible");
        Add(menu.Items, "結束", "quit");
        SetFontScale(1f);
        menu.Opening += OnOpening;
    }

    public ContextMenuStrip Menu { get { return menu; } }

    // Shows the tray icon (call once, on the UI thread).
    public void ShowIcon()
    {
        if (notifyIcon != null) return;
        trayIcon = CoinIcon(SystemInformation.SmallIconSize.Width);
        notifyIcon = new NotifyIcon();
        notifyIcon.Icon = trayIcon;
        notifyIcon.Text = "錢進中";
        notifyIcon.ContextMenuStrip = menu;
        notifyIcon.MouseDoubleClick += delegate(object s, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left && IconDoubleClick != null) IconDoubleClick(this, EventArgs.Empty);
        };
        notifyIcon.Visible = true;
    }

    // Esc: closes the open submenu if there is one, else the menu (the menu's own Esc does the same).
    public void CloseInnermost()
    {
        if (layouts.DropDown.Visible) layouts.DropDown.Close(ToolStripDropDownCloseReason.Keyboard);
        else menu.Close(ToolStripDropDownCloseReason.Keyboard);
    }

    // Removes the tray icon at once (fatal error path; safe to call from any thread, never throws).
    public void HideIcon()
    {
        try
        {
            NotifyIcon icon = notifyIcon;
            if (icon != null) icon.Visible = false;
        }
        catch (Exception) { }
    }

    public void ShowAt(Point screen)
    {
        SetFontScale(DpiScaleAt(screen));
        showingAt = true;
        try { menu.Show(screen); }
        finally { showingAt = false; }
    }

    // Check marks and the show/hide label: layout = current layout (only main layouts get a check),
    // topmost = window is topmost, visible = window is shown (item reads 隱藏) or hidden (顯示).
    public void SetState(string layout, bool topmost, bool visible)
    {
        foreach (ToolStripItem i in layouts.DropDownItems)
        {
            ToolStripMenuItem m = i as ToolStripMenuItem;
            if (m != null) m.Checked = layout != null && m.Name == "layout:" + layout;
        }
        Item("topmost").Checked = topmost;
        Item("toggleVisible").Text = visible ? "隱藏" : "顯示";
    }

    public void Dispose()
    {
        if (notifyIcon != null)
        {
            notifyIcon.Visible = false;
            notifyIcon.Dispose();
            notifyIcon = null;
        }
        if (trayIcon != null) { trayIcon.Dispose(); trayIcon = null; }
        menu.Dispose();
        if (font != null) { font.Dispose(); font = null; }
    }

    // A #FFC857 coin with a #3D2C24 outline and a "$", drawn at size x size px (16 for the tray at 100 %, 32 large).
    public static Icon CoinIcon(int size)
    {
        using (Bitmap b = CoinBitmap(size))
        {
            IntPtr h = b.GetHicon();
            try
            {
                using (Icon shared = Icon.FromHandle(h)) return (Icon)shared.Clone();   // the clone owns its handle
            }
            finally { Native.DestroyIcon(h); }
        }
    }

    // The coin as a 32-bit ARGB bitmap (also the exe icon: tools\make-icon.ps1 -> assets\app.ico).
    public static Bitmap CoinBitmap(int size)
    {
        Bitmap b = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        try
        {
            using (Graphics g = Graphics.FromImage(b))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                float pen = Math.Max(1.25f, size / 11f);
                RectangleF coin = new RectangleF(pen / 2f, pen / 2f, size - pen, size - pen);
                using (SolidBrush fill = new SolidBrush(Gold)) g.FillEllipse(fill, coin);
                using (Pen outline = new Pen(Line, pen)) g.DrawEllipse(outline, coin);
                using (GraphicsPath dollar = new GraphicsPath())
                using (FontFamily family = new FontFamily(GenericFontFamilies.SansSerif))
                {
                    float em = size * 0.72f;
                    dollar.AddString("$", family, (int)FontStyle.Bold, em, new PointF(0, 0), StringFormat.GenericTypographic);
                    RectangleF r = dollar.GetBounds();
                    using (Matrix m = new Matrix())
                    {
                        m.Translate(size / 2f - (r.X + r.Width / 2f), size / 2f - (r.Y + r.Height / 2f));
                        dollar.Transform(m);
                    }
                    using (SolidBrush ink = new SolidBrush(Line)) g.FillPath(ink, dollar);
                }
            }
            return b;
        }
        catch
        {
            b.Dispose();
            throw;
        }
    }

    void Add(ToolStripItemCollection items, string text, string action)
    {
        ToolStripMenuItem item = new ToolStripMenuItem(text);
        item.Name = action;
        item.Click += delegate
        {
            Action<string> h = ItemClicked;
            if (h != null) h(action);
        };
        items.Add(item);
    }

    ToolStripMenuItem Item(string action)
    {
        return (ToolStripMenuItem)menu.Items.Find(action, true)[0];
    }

    // The process is per-monitor DPI aware, so WinForms sizes the menu for the system DPI only: scale the font
    // for the monitor the menu opens on (the cursor's, when the tray icon opens it).
    void OnOpening(object sender, CancelEventArgs e)
    {
        if (!showingAt) SetFontScale(DpiScaleAt(Cursor.Position));
    }

    void SetFontScale(float scale)
    {
        if (scale == fontScale) return;
        fontScale = scale;
        Font old = font;
        font = new Font(FontName, FontPoints * scale);
        menu.Font = font;
        layouts.DropDown.Font = font;
        if (old != null) old.Dispose();
    }

    static float DpiScaleAt(Point p)
    {
        try
        {
            Native.POINT pt;
            pt.X = p.X;
            pt.Y = p.Y;
            uint dx, dy;
            IntPtr mon = Native.MonitorFromPoint(pt, Native.MONITOR_DEFAULTTONEAREST);
            if (Native.GetDpiForMonitor(mon, Native.MDT_EFFECTIVE_DPI, out dx, out dy) != 0 || dy == 0) return 1f;
            float system;
            using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) system = g.DpiY;
            return system > 0 ? dy / system : 1f;
        }
        catch (Exception)
        {
            return 1f;
        }
    }

    class A1Renderer : ToolStripProfessionalRenderer
    {
        public A1Renderer() : base(new A1Colors())
        {
            RoundedEdges = false;
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = e.Item.Enabled ? Line : Color.FromArgb(0x9A, 0x8A, 0x80);
            base.OnRenderItemText(e);
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            e.ArrowColor = Line;
            base.OnRenderArrow(e);
        }
    }

    class A1Colors : ProfessionalColorTable
    {
        public A1Colors() { UseSystemColors = false; }
        public override Color ToolStripDropDownBackground { get { return Paper; } }
        public override Color ImageMarginGradientBegin { get { return Paper; } }
        public override Color ImageMarginGradientMiddle { get { return Paper; } }
        public override Color ImageMarginGradientEnd { get { return Paper; } }
        public override Color MenuBorder { get { return Line; } }
        public override Color MenuItemBorder { get { return Line; } }
        public override Color MenuItemSelected { get { return Gold; } }
        public override Color MenuItemSelectedGradientBegin { get { return Gold; } }
        public override Color MenuItemSelectedGradientEnd { get { return Gold; } }
        public override Color MenuItemPressedGradientBegin { get { return Amber; } }
        public override Color MenuItemPressedGradientMiddle { get { return Amber; } }
        public override Color MenuItemPressedGradientEnd { get { return Amber; } }
        public override Color CheckBackground { get { return Amber; } }
        public override Color CheckSelectedBackground { get { return Orange; } }
        public override Color CheckPressedBackground { get { return Orange; } }
        public override Color ButtonSelectedBorder { get { return Line; } }
        public override Color SeparatorDark { get { return Color.FromArgb(0xE2, 0xCF, 0xB4); } }
        public override Color SeparatorLight { get { return Paper; } }
    }
}
