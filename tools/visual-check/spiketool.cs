using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

// Visual-check helper for PetWindow (see README.md). Per-monitor-v2 aware: every coordinate is physical px.
// Moves the real mouse cursor for click/drag/hover (and puts it back afterwards).
public static class Tool
{
    [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr c);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr h);
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool GetLayeredWindowAttributes(IntPtr h, out uint key, out byte alpha, out uint flags);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr d, int x, int y, int w, int h, IntPtr s, int sx, int sy, uint op);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }

    const string Usage = @"spiketool <command> ...   (physical px, hwnd as decimal)
  backdrop x y w h log [topmost|normal]   borderless window with a busy pattern; logs mouse downs to log
  capture x y w h out.png                 screen capture (BitBlt + CAPTUREBLT)
  click x y | hittest x y                 real click (reports window under cursor + foreground) | WindowFromPoint only
  drag x1 y1 x2 y2 [steps]                press, move in steps, release
  hover x y hwnd ms                       move cursor, wait, describe hwnd and the window under the cursor
  hovercap x y hwnd ms cx cy cw ch out    hover, then capture while the cursor is still there
  find title | info hwnd | children hwnd  describe windows
  move hwnd x y | settop hwnd | untop hwnd | above hwndA hwndB | printwindow hwnd out.png [flags]";

    [STAThread]
    public static int Main(string[] a)
    {
        try { return Run(a); }
        catch (Exception ex)
        {
            Console.WriteLine("ERR " + ex.GetType().FullName + " hr=0x" + Marshal.GetHRForException(ex).ToString("X8"));
            return 2;
        }
    }

    static int Run(string[] a)
    {
        SetProcessDpiAwarenessContext(new IntPtr(-4));
        string cmd = a.Length > 0 ? a[0] : "";
        switch (cmd)
        {
            case "backdrop": Backdrop(I(a[1]), I(a[2]), I(a[3]), I(a[4]), a[5], a.Length > 6 ? a[6] : "topmost"); return 0;
            case "capture": Capture(I(a[1]), I(a[2]), I(a[3]), I(a[4]), a[5]); return 0;
            case "click": Click(I(a[1]), I(a[2])); return 0;
            case "hittest": Console.WriteLine(Describe(HitAt(I(a[1]), I(a[2])))); return 0;
            case "drag": Drag(I(a[1]), I(a[2]), I(a[3]), I(a[4]), a.Length > 5 ? I(a[5]) : 30); return 0;
            case "hover": Hover(I(a[1]), I(a[2]), H(a[3]), I(a[4]), null); return 0;
            case "hovercap": Hover(I(a[1]), I(a[2]), H(a[3]), I(a[4]), a); return 0;
            case "find": Find(a[1]); return 0;
            case "info": Console.WriteLine(Describe(H(a[1]))); return 0;
            case "children": Children(H(a[1])); return 0;
            case "move": SetWindowPos(H(a[1]), IntPtr.Zero, I(a[2]), I(a[3]), 0, 0, 0x0001 | 0x0004 | 0x0010); return 0;
            case "settop": SetWindowPos(H(a[1]), new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010); return 0;
            case "untop": SetWindowPos(H(a[1]), new IntPtr(-2), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010); return 0;
            case "above": Above(H(a[1]), H(a[2])); return 0;
            case "printwindow": PrintWin(H(a[1]), a[2], a.Length > 3 ? uint.Parse(a[3]) : 2); return 0;
        }
        Console.WriteLine(Usage);
        return 1;
    }
    static int I(string s) { return int.Parse(s); }
    static IntPtr H(string s) { return new IntPtr(long.Parse(s)); }

    static void Backdrop(int x, int y, int w, int h, string log, string mode)
    {
        Application.EnableVisualStyles();
        Form f = new Form();
        f.Text = "SPIKE-BACKDROP";
        f.FormBorderStyle = FormBorderStyle.None;
        f.StartPosition = FormStartPosition.Manual;
        f.AutoScaleMode = AutoScaleMode.None;
        f.Bounds = new Rectangle(x, y, w, h);
        f.TopMost = mode == "topmost";
        f.ShowInTaskbar = false;
        Bitmap bmp = BusyPattern(w, h);
        f.Paint += delegate(object s, PaintEventArgs e) { e.Graphics.DrawImageUnscaled(bmp, 0, 0); };
        f.MouseDown += delegate(object s, MouseEventArgs e)
        {
            Point p = f.PointToScreen(e.Location);
            File.AppendAllText(log, "down " + p.X + " " + p.Y + " " + DateTime.Now.ToString("HH:mm:ss.fff") + "\r\n");
        };
        f.Shown += delegate { f.Bounds = new Rectangle(x, y, w, h); };
        Application.Run(f);
    }

    // Deterministic "busy wallpaper": colour waves + per-pixel noise, white diagonals, rings and blocks.
    static Bitmap BusyPattern(int w, int h)
    {
        Random rnd = new Random(7);
        Bitmap b = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        BitmapData d = b.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        byte[] px = new byte[d.Stride * h];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int n = rnd.Next(-35, 36), i = y * d.Stride + x * 4;
                px[i + 2] = Clamp((Math.Sin(x / 37.0) + 1) * 90 + 60.0 * y / h + n);
                px[i + 1] = Clamp((Math.Sin((x + y) / 23.0) + 1) * 80 + 80.0 * x / w + n);
                px[i + 0] = Clamp((Math.Cos(y / 19.0) + 1) * 90 + 40 - n);
                px[i + 3] = 255;
            }
        Marshal.Copy(px, 0, d.Scan0, px.Length);
        b.UnlockBits(d);
        using (Graphics g = Graphics.FromImage(b))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            for (int i = 0; i < 70; i++)
            {
                int cx = rnd.Next(w), cy = rnd.Next(h), r = rnd.Next(10, 70);
                using (Pen p = new Pen(Color.FromArgb(rnd.Next(256), rnd.Next(256), rnd.Next(256)), rnd.Next(2, 9)))
                    g.DrawEllipse(p, cx - r, cy - r, 2 * r, 2 * r);
            }
            using (Pen white = new Pen(Color.White, 2))
                for (int x = 0; x < w; x += 60) g.DrawLine(white, x, 0, x + 300, h);
            for (int i = 0; i < 40; i++)
                using (SolidBrush br = new SolidBrush(Color.FromArgb(rnd.Next(256), rnd.Next(256), rnd.Next(256))))
                    g.FillRectangle(br, rnd.Next(w), rnd.Next(h), rnd.Next(20, 120), rnd.Next(8, 24));
        }
        return b;
    }
    static byte Clamp(double v) { return (byte)Math.Max(0, Math.Min(255, v)); }

    static void Capture(int x, int y, int w, int h, string path)
    {
        using (Bitmap b = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(b))
            {
                IntPtr src = GetDC(IntPtr.Zero);
                IntPtr dst = g.GetHdc();
                BitBlt(dst, 0, 0, w, h, src, x, y, 0x00CC0020 | 0x40000000);   // SRCCOPY | CAPTUREBLT
                g.ReleaseHdc(dst);
                ReleaseDC(IntPtr.Zero, src);
            }
            b.Save(path, ImageFormat.Png);
        }
        Console.WriteLine("captured " + path);
    }

    static void PrintWin(IntPtr h, string path, uint flags)
    {
        RECT r; GetWindowRect(h, out r);
        using (Bitmap b = new Bitmap(r.R - r.L, r.B - r.T, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(b)) { IntPtr dc = g.GetHdc(); PrintWindow(h, dc, flags); g.ReleaseHdc(dc); }
            b.Save(path, ImageFormat.Png);
        }
    }

    static IntPtr HitAt(int x, int y) { POINT p; p.X = x; p.Y = y; return WindowFromPoint(p); }

    static string Describe(IntPtr h)
    {
        if (h == IntPtr.Zero) return "null";
        IntPtr root = GetAncestor(h, 2);
        uint pid; GetWindowThreadProcessId(h, out pid);
        string pname = "?";
        try { pname = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
        StringBuilder cls = new StringBuilder(256); GetClassName(h, cls, 256);
        StringBuilder rt = new StringBuilder(256); GetWindowText(root, rt, 256);
        RECT r; GetWindowRect(root, out r);
        int ex = GetWindowLong(root, -20);
        uint key; byte alpha; uint fl; bool lay = GetLayeredWindowAttributes(root, out key, out alpha, out fl);
        return string.Format("hwnd={0} class={1} pid={2} proc={3} root={4} rootTitle='{5}' rootRect={6},{7},{8},{9} exstyle=0x{10:X8} topmost={11} transparent={12} layered={13} dpi={14} lwa={15}",
            h, cls, pid, pname, root, rt, r.L, r.T, r.R - r.L, r.B - r.T, ex, (ex & 8) != 0, (ex & 0x20) != 0, (ex & 0x80000) != 0, GetDpiForWindow(root),
            lay ? string.Format("key=0x{0:X6} alpha={1} flags={2}", key, alpha, fl) : "none");
    }

    static void Click(int x, int y)
    {
        POINT old; GetCursorPos(out old);
        SetCursorPos(x, y);
        Thread.Sleep(120);   // let the 30 Hz hit poll see the cursor
        Console.WriteLine("under:  " + Describe(HitAt(x, y)));
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(40);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(400);
        Console.WriteLine("foreground: " + Describe(GetForegroundWindow()));
        SetCursorPos(old.X, old.Y);
    }

    static void Drag(int x1, int y1, int x2, int y2, int steps)
    {
        POINT old; GetCursorPos(out old);
        SetCursorPos(x1, y1);
        Thread.Sleep(150);
        Console.WriteLine("under:  " + Describe(HitAt(x1, y1)));
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(250);
        for (int i = 1; i <= steps; i++)
        {
            SetCursorPos(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps);
            Thread.Sleep(25);
        }
        Thread.Sleep(200);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(300);
        SetCursorPos(old.X, old.Y);
    }

    // hover / hovercap (a = full args when capturing: a[5..8] = rect, a[9] = file)
    static void Hover(int x, int y, IntPtr hwnd, int ms, string[] a)
    {
        POINT old; GetCursorPos(out old);
        SetCursorPos(x, y);
        Thread.Sleep(ms);
        Console.WriteLine(Describe(hwnd));
        Console.WriteLine("under: " + Describe(HitAt(x, y)));
        if (a != null) Capture(I(a[5]), I(a[6]), I(a[7]), I(a[8]), a[9]);
        SetCursorPos(old.X, old.Y);
    }

    static void Find(string title)
    {
        EnumWindows(delegate(IntPtr h, IntPtr l)
        {
            StringBuilder t = new StringBuilder(256); GetWindowText(h, t, 256);
            if (t.ToString() == title && IsWindowVisible(h)) Console.WriteLine(h + " " + Describe(h));
            return true;
        }, IntPtr.Zero);
    }

    static void Children(IntPtr parent)
    {
        EnumChildWindows(parent, delegate(IntPtr h, IntPtr l)
        {
            StringBuilder c = new StringBuilder(256); GetClassName(h, c, 256);
            uint pid; GetWindowThreadProcessId(h, out pid);
            RECT r; GetWindowRect(h, out r);
            Console.WriteLine(h + " class=" + c + " pid=" + pid + " rect=" + r.L + "," + r.T + "," + (r.R - r.L) + "," + (r.B - r.T) + " ex=0x" + GetWindowLong(h, -20).ToString("X8") + " style=0x" + GetWindowLong(h, -16).ToString("X8"));
            return true;
        }, IntPtr.Zero);
    }

    // Is window a above window b in the z-order?
    static void Above(IntPtr a, IntPtr b)
    {
        for (IntPtr h = GetTopWindow(IntPtr.Zero); h != IntPtr.Zero; h = GetWindow(h, 2))
        {
            if (h == a) { Console.WriteLine("above=True"); return; }
            if (h == b) { Console.WriteLine("above=False"); return; }
        }
        Console.WriteLine("above=?");
    }
}
