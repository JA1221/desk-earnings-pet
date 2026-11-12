using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (Array.IndexOf(args, "--spike") >= 0) Application.Run(SpikeWindow());
        else Application.Run(new MainForm());
    }

    // Dev-only (Task 2): spike.html in a PetWindow; replaced by AppHost in Task 7.
    private static PetWindow SpikeWindow()
    {
        PetWindow w = new PetWindow("https://app.qjz/spike.html");
        w.InitFailed += delegate(string message)
        {
            MessageBox.Show(message, "錢進中");
            w.Close();
        };
        w.WebReady += delegate
        {
            Bridge bridge = new Bridge(w.Web);
            bridge.Received += delegate(string type, Dictionary<string, object> d)
            {
                if (type == "dragStart") w.BeginDrag();
                else if (type == "setTopmost") w.TopMostEnabled = true.Equals(Field(d, "on"));
                else if (type == "setLayout") w.SetContentSize((int)Num(Field(d, "width")), (int)Num(Field(d, "height")), Num(Field(d, "dpr")));
                else if (type == "hitRects") w.SetHitRects(Rects(Field(d, "rects")), Num(Field(d, "dpr")));
            };
        };
        return w;
    }

    private static object Field(Dictionary<string, object> d, string key)
    {
        object v;
        return d.TryGetValue(key, out v) ? v : null;
    }

    private static float Num(object v)
    {
        try { return v == null ? 0f : Convert.ToSingle(v, CultureInfo.InvariantCulture); }
        catch (Exception) { return 0f; }
    }

    private static RectangleF[] Rects(object v)
    {
        List<RectangleF> list = new List<RectangleF>();
        IEnumerable items = v as IEnumerable;
        if (items != null)
            foreach (object item in items)
            {
                IList r = item as IList;
                if (r != null && r.Count == 4) list.Add(new RectangleF(Num(r[0]), Num(r[1]), Num(r[2]), Num(r[3])));
            }
        return list.ToArray();
    }
}

public class MainForm : Form
{
    private readonly WebView2 web = new WebView2();

    public MainForm()
    {
        Text = "錢進中";
        ClientSize = new Size(400, 300);
        StartPosition = FormStartPosition.CenterScreen;
        web.Dock = DockStyle.Fill;
        Controls.Add(web);
        Load += delegate { Init(); };
    }

    private async void Init()
    {
        try
        {
            await web.EnsureCoreWebView2Async(await WebViewEnv.GetAsync());
            string root = WebRoot.Resolve();
            if (root == null) { MessageBox.Show("找不到網頁資源 (src/web)。", "錢進中"); return; }
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("app.qjz", root, CoreWebView2HostResourceAccessKind.Allow);
            web.CoreWebView2.Navigate("https://app.qjz/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.ToString(), "錢進中");
        }
    }
}
