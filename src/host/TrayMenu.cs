using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.Windows.Forms;

// The app's one menu, in A1 colours: the tray icon shows it on right click, and the host shows it for the
// page's contextMenu message. Every item raises ItemClicked with its action id (layout:U1|U3|U5B|U7|U10|U12|U13,
// mini, drink, undrink, stoodUp, pomodoro, feed, start, adjust, end, topmost, capsule:top|bottomLeft|bottomCenter|
// bottomRight, settings, history, toggleVisible, quit); the host decides what each does.
// 1.1.3 groups (a separator between them):
//   健康: 記一杯水 3/8, 少記一杯, 我剛起來動過了, 開始番茄鐘  |  上班: 開始上班 / 下班 / 繼續上班, 調整起算時間, 餵食 ×N  |
//   畫面: 版型 ▶, 隱藏金額, 隱藏視窗 / 顯示視窗  |  其他: 紀錄, 設定, 結束
//   版型 ▶: 1 經典直式 (U1), 2 遊戲畫面 (U3), 3 健康儀表板 (U12), 4 番茄鐘優先 (U13)  |  5 橫向極簡 (U5B), 6 頂端小膠囊 (U10),
//   7 迷你浮窗 (layout:M3, which the host sends the page as mini)  |  8 桌面寵物 (U7)  |  縮成迷你  |  永遠在最上層 (for the
//   current layout), 膠囊位置 ▶ (U10 only)
//   膠囊位置 ▶: 上方正中間, 左下, 中下, 右下 (the current dock checked)
// 隱藏金額 (1.1.3, mask) sends menu {action:'mask'}: the page toggles the amount mask, like a click on the amount. It is
// checked while the page's menuState says masked:true (SetMasked). It never shows or activates the window.
// The work item follows the status the page reports (SetWork): 開始上班 (start) before work, 下班 (end) while the
// day runs, 繼續上班 (start: the page continues an ended day) after 下班. 餵食 shows the snack count (SetSnacks).
// 記一杯水 shows the cups and 開始番茄鐘 reads 停止番茄鐘（還剩 N 分） while a focus or a break runs (SetHealth; the
// label is worked out again each time the menu opens); either way it sends pomodoro and the page toggles.
// 少記一杯 (1.1.1, undrink: the page takes one cup off today, never below 0) shows only while today's cups are above 0
// (SetHealth's cups, CupsToday). 我剛起來動過了 (1.1.2, stoodUp: the page counts a stand-up, restarts the sit timer and
// the pet says 「收到！」) shows only while the 起來動 reminder is on (SetHealth's sitOn); it comes right after 少記一杯, so
// right after 記一杯水 while 少記一杯 is hidden.
// 縮成迷你 is checked in M3; clicking it there goes back to the main layout (the page toggles).
// The tray icon (tooltip 錢進中) is a coin drawn at runtime; double-clicking it raises IconDoubleClick.
public class TrayMenu : IDisposable
{
    static readonly Color Paper = Color.FromArgb(0xFF, 0xF8, 0xEC);   // #FFF8EC
    static readonly Color Line = Color.FromArgb(0x3D, 0x2C, 0x24);    // #3D2C24
    static readonly Color Gold = Color.FromArgb(0xFF, 0xC8, 0x57);    // #FFC857
    static readonly Color Orange = Color.FromArgb(0xFF, 0x8A, 0x3D);  // #FF8A3D
    static readonly Color Amber = Color.FromArgb(0xFF, 0xB6, 0x27);   // #FFB627
    static readonly Color Sub = Color.FromArgb(0x9A, 0x6E, 0x52);     // #9A6E52, the snack count
    const string FontName = "Microsoft JhengHei UI";
    const float FontPoints = 10f;

    readonly ContextMenuStrip menu = new ContextMenuStrip();
    readonly ToolStripMenuItem layouts;
    readonly ToolStripMenuItem capsule;
    readonly ToolStripMenuItem work;
    readonly ToolStripMenuItem feed;
    readonly ToolStripMenuItem drink;
    readonly ToolStripMenuItem undrink;
    readonly ToolStripMenuItem stoodUp;
    readonly ToolStripMenuItem pomodoro;
    string workAction = "start";   // what the work item sends now
    string pomodoroPhase;          // healthMenu pomodoro.phase; null until the page reports
    double pomodoroEndsMs;         // healthMenu pomodoro.endsMs (focus / break)
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
        // 健康
        drink = Add(menu.Items, "記一杯水", "drink");
        undrink = Add(menu.Items, "少記一杯", "undrink");
        undrink.Available = false;   // only while today has a cup (SetHealth)
        stoodUp = Add(menu.Items, "我剛起來動過了", "stoodUp");
        stoodUp.Available = false;   // only while the 起來動 reminder is on (SetHealth)
        pomodoro = Add(menu.Items, "開始番茄鐘", "pomodoro");
        menu.Items.Add(new ToolStripSeparator());
        // 上班
        work = new ToolStripMenuItem("開始上班");
        work.Name = "work";
        work.Click += delegate
        {
            Action<string> h = ItemClicked;
            if (h != null) h(workAction);
        };
        menu.Items.Add(work);
        Add(menu.Items, "調整起算時間", "adjust");
        feed = Add(menu.Items, "餵食", "feed");
        menu.Items.Add(new ToolStripSeparator());
        // 畫面
        layouts = new ToolStripMenuItem("版型");
        layouts.Name = "layouts";
        layouts.DropDown.Renderer = renderer;
        Add(layouts.DropDownItems, "1 經典直式", "layout:U1");
        Add(layouts.DropDownItems, "2 遊戲畫面", "layout:U3");
        Add(layouts.DropDownItems, "3 健康儀表板", "layout:U12");
        Add(layouts.DropDownItems, "4 番茄鐘優先", "layout:U13");
        layouts.DropDownItems.Add(new ToolStripSeparator());
        Add(layouts.DropDownItems, "5 橫向極簡", "layout:U5B");
        Add(layouts.DropDownItems, "6 頂端小膠囊", "layout:U10");
        Add(layouts.DropDownItems, "7 迷你浮窗", "layout:M3");
        layouts.DropDownItems.Add(new ToolStripSeparator());
        Add(layouts.DropDownItems, "8 桌面寵物", "layout:U7");
        layouts.DropDownItems.Add(new ToolStripSeparator());
        Add(layouts.DropDownItems, "縮成迷你", "mini");
        layouts.DropDownItems.Add(new ToolStripSeparator());
        Add(layouts.DropDownItems, "永遠在最上層", "topmost");
        capsule = new ToolStripMenuItem("膠囊位置");
        capsule.Name = "capsule";
        capsule.DropDown.Renderer = renderer;
        Add(capsule.DropDownItems, "上方正中間", "capsule:top");
        Add(capsule.DropDownItems, "左下", "capsule:bottomLeft");
        Add(capsule.DropDownItems, "中下", "capsule:bottomCenter");
        Add(capsule.DropDownItems, "右下", "capsule:bottomRight");
        capsule.Available = false;   // U10 only (SetState)
        layouts.DropDownItems.Add(capsule);
        menu.Items.Add(layouts);
        Add(menu.Items, "隱藏金額", "mask");
        Add(menu.Items, "隱藏視窗", "toggleVisible");
        menu.Items.Add(new ToolStripSeparator());
        // 其他
        Add(menu.Items, "紀錄", "history");
        Add(menu.Items, "設定", "settings");
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

    // Esc: closes the innermost open submenu if there is one (膠囊位置, then 版型), else the menu (the menu's own Esc
    // does the same).
    public void CloseInnermost()
    {
        if (capsule.DropDown.Visible) capsule.DropDown.Close(ToolStripDropDownCloseReason.Keyboard);
        else if (layouts.DropDown.Visible) layouts.DropDown.Close(ToolStripDropDownCloseReason.Keyboard);
        else menu.Close(ToolStripDropDownCloseReason.Keyboard);
    }

    // A click away from the menu (1.1.2, MenuClickAway): every open level closes, as for a click elsewhere.
    public void CloseAll()
    {
        if (menu.Visible) menu.Close(ToolStripDropDownCloseReason.AppClicked);   // its open submenus close with it
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

    // Check marks and the show/hide label: layout = current layout (a main layout's item, or 縮成迷你 for M3),
    // topmost = window is topmost, visible = window is shown (item reads 隱藏) or hidden (顯示), dock = U10's dock
    // (膠囊位置 shows in U10 only, with that dock checked).
    public void SetState(string layout, bool topmost, bool visible, string dock = null)
    {
        foreach (ToolStripItem i in layouts.DropDownItems)
        {
            ToolStripMenuItem m = i as ToolStripMenuItem;
            if (m != null && m.Name.StartsWith("layout:")) m.Checked = layout != null && m.Name == "layout:" + layout;
        }
        Item("mini").Checked = layout == "M3";
        Item("layout:M3").Checked = layout == "M3";
        Item("topmost").Checked = topmost;
        Item("toggleVisible").Text = visible ? "隱藏視窗" : "顯示視窗";
        capsule.Available = layout == "U10";
        foreach (ToolStripItem i in capsule.DropDownItems)
        {
            ToolStripMenuItem m = i as ToolStripMenuItem;
            if (m != null) m.Checked = dock != null && m.Name == "capsule:" + dock;
        }
    }

    // The page's healthMenu: cups = today's cups as the page shows them ("3/8"), or null when it hides them (spec 4.9
    // #8: the 喝水 reminder is off and today has no cup); phase and endsMs = the pomodoro (idle / focus / break /
    // breakOver, and when a focus or break ends, epoch ms); sitOn (1.1.2) = the 起來動 reminder is on. 少記一杯 shows while
    // today has a cup, 我剛起來動過了 while sitOn.
    public void SetHealth(string cups, string phase, double endsMs, bool sitOn = false)
    {
        string text = string.IsNullOrEmpty(cups) ? null : cups;
        if (drink.ShortcutKeyDisplayString != text) drink.ShortcutKeyDisplayString = text;
        bool any = CupsToday(cups) > 0;
        if (undrink.Available != any) undrink.Available = any;
        if (stoodUp.Available != sitOn) stoodUp.Available = sitOn;
        pomodoroPhase = phase;
        pomodoroEndsMs = endsMs;
        UpdatePomodoroLabel();
    }

    // Today's cups from healthMenu's cups ("3/8": the whole number before the slash); 0 for null or anything else.
    public static int CupsToday(string cups)
    {
        if (string.IsNullOrEmpty(cups)) return 0;
        int slash = cups.IndexOf('/');
        int n;
        return int.TryParse(slash >= 0 ? cups.Substring(0, slash) : cups, NumberStyles.None, CultureInfo.InvariantCulture, out n) ? n : 0;
    }

    // 停止番茄鐘（還剩 N 分） while a focus or a break runs (N whole minutes rounded up, at least 1), else 開始番茄鐘.
    public static string PomodoroLabel(string phase, double endsMs, double nowMs)
    {
        if (phase != "focus" && phase != "break") return "開始番茄鐘";
        double minutes = Math.Ceiling((endsMs - nowMs) / 60000);
        if (!(minutes >= 1)) minutes = 1;
        return "停止番茄鐘（還剩 " + minutes.ToString("0", CultureInfo.InvariantCulture) + " 分）";
    }

    // The page's work status (menuState work): "working" -> 下班 (end), "ended" -> 繼續上班 (start), anything else
    // (before work, a day off, not reported yet) -> 開始上班 (start).
    public void SetWork(string status)
    {
        string text = "開始上班";
        workAction = "start";
        if (status == "working") { text = "下班"; workAction = "end"; }
        else if (status == "ended") text = "繼續上班";
        if (work.Text != text) work.Text = text;
    }

    // The page's menuState masked (1.1.3): 隱藏金額 is checked while the amounts are hidden.
    public void SetMasked(bool masked)
    {
        ToolStripMenuItem m = Item("mask");
        if (m.Checked != masked) m.Checked = masked;
    }

    // The snacks there are to feed (menuState snacks), shown right of 餵食 as ×N; below 0: unknown, no count. 餵食 stays
    // clickable at 0: the pet then says how much more until the next snack.
    public void SetSnacks(int count)
    {
        string text = count >= 0 ? "×" + count : null;
        if (feed.ShortcutKeyDisplayString != text) feed.ShortcutKeyDisplayString = text;
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

    ToolStripMenuItem Add(ToolStripItemCollection items, string text, string action)
    {
        ToolStripMenuItem item = new ToolStripMenuItem(text);
        item.Name = action;
        item.Click += delegate
        {
            Action<string> h = ItemClicked;
            if (h != null) h(action);
        };
        items.Add(item);
        return item;
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
        UpdatePomodoroLabel();   // the minutes left as of now
    }

    void UpdatePomodoroLabel()
    {
        string text = PomodoroLabel(pomodoroPhase, pomodoroEndsMs, NowMs());
        if (pomodoro.Text != text) pomodoro.Text = text;
    }

    static double NowMs()
    {
        return (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }

    void SetFontScale(float scale)
    {
        if (scale == fontScale) return;
        fontScale = scale;
        Font old = font;
        font = new Font(FontName, FontPoints * scale);
        menu.Font = font;
        layouts.DropDown.Font = font;
        capsule.DropDown.Font = font;
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
            ToolStripMenuItem m = e.Item as ToolStripMenuItem;
            bool count = m != null && !string.IsNullOrEmpty(m.ShortcutKeyDisplayString) && e.Text == m.ShortcutKeyDisplayString && e.Text != m.Text;
            e.TextColor = !e.Item.Enabled ? Color.FromArgb(0x9A, 0x8A, 0x80) : count ? Sub : Line;
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
