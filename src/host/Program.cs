using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

public static class Program
{
    [STAThread]
    public static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm());
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
