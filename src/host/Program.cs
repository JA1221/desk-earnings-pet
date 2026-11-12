using System;
using System.Threading;
using System.Windows.Forms;

public static class Program
{
    static AppHost host;   // for the fatal path: its tray icon must not outlive the process
    const string MissingWebView2 = "這台電腦缺少 Microsoft Edge WebView2 執行階段，錢進中需要它才能顯示畫面。請到 https://go.microsoft.com/fwlink/p/?LinkId=2124703 下載安裝後再開啟。";

    [STAThread]
    public static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        // A bug in one UI event handler is logged and the app keeps running; anything else is fatal.
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { ErrorLog.Write("unhandled exception on the UI thread", e.Exception); };
        AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { Fatal(e.ExceptionObject as Exception); };

        if (!SingleInstance.TryStart()) return 0;   // the running instance shows itself
        if (!WebView2Check.IsAvailable())
        {
            MessageBox.Show(MissingWebView2, "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }
        string page = DevPage(args);
        try
        {
            host = new AppHost(page ?? "index.html", page != null);
            host.Run();
            return 0;
        }
        catch (Exception ex)
        {
            Fatal(ex);
            return 1;
        }
    }

    // A short message for the user; the details go to error.log; the tray icon goes away first.
    static void Fatal(Exception ex)
    {
        ErrorLog.Write("fatal error", ex);
        AppHost h = host;
        if (h != null) h.RemoveTrayIcon();
        try
        {
            MessageBox.Show("錢進中發生錯誤，需要關閉。\n\n詳細資訊已記錄在：\n" + ErrorLog.FilePath,
                "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        catch (Exception) { }
    }

    // Dev only: --page <file> loads that page from the web root instead of index.html (a relative path inside
    // the root, optionally with a ?query); --spike is --page spike.html (tools\visual-check uses it).
    static string DevPage(string[] args)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--spike") return "spike.html";
            if (args[i] == "--page" && i + 1 < args.Length && SafePage(args[i + 1])) return args[i + 1].Replace('\\', '/');
        }
        return null;
    }

    static bool SafePage(string p)
    {
        if (string.IsNullOrEmpty(p) || p.Length > 200 || p.Contains("..") || p.StartsWith("/") || p.StartsWith("\\")) return false;
        foreach (char c in p)
            if (!(char.IsLetterOrDigit(c) && c < 128) && "._-/\\?=&%".IndexOf(c) < 0) return false;
        return true;
    }
}
