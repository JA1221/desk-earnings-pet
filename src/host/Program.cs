using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
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
        w.WebReady += delegate
        {
            w.Web.WebMessageReceived += delegate(object s, CoreWebView2WebMessageReceivedEventArgs e)
            {
                string msg = e.TryGetWebMessageAsString() ?? "";
                if (msg == "drag") w.BeginDrag();
                else if (msg == "topmost")
                {
                    w.TopMostEnabled = !w.TopMostEnabled;
                    w.Web.PostWebMessageAsString(w.TopMostEnabled ? "topmost 1" : "topmost 0");
                }
                else if (msg.StartsWith("size ")) { float[] v = Numbers(msg.Substring(5)); w.SetContentSize((int)v[0], (int)v[1]); }
                else if (msg.StartsWith("hits "))
                {
                    List<RectangleF> rects = new List<RectangleF>();
                    foreach (string part in msg.Substring(5).Split('|'))
                    {
                        float[] v = Numbers(part);
                        rects.Add(new RectangleF(v[0], v[1], v[2], v[3]));
                    }
                    w.SetHitRects(rects.ToArray());
                }
            };
        };
        return w;
    }

    private static float[] Numbers(string s)
    {
        string[] parts = s.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        float[] v = new float[parts.Length];
        for (int i = 0; i < parts.Length; i++) v[i] = float.Parse(parts[i], CultureInfo.InvariantCulture);
        return v;
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
            string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
            string loader = Path.Combine(exeDir, Path.Combine("vendor", Path.Combine("webview2", Environment.Is64BitProcess ? "x64" : "x86")));
            if (!Directory.Exists(loader))
            {
                // dev layout: build\ exe next to repo's vendor\
                string repoVendor = Path.Combine(Path.GetDirectoryName(exeDir) ?? exeDir, Path.Combine("vendor", Path.Combine("webview2", Environment.Is64BitProcess ? "x64" : "x86")));
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
            web.CoreWebView2.Navigate("https://app.qjz/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.ToString(), "錢進中");
        }
    }
}
