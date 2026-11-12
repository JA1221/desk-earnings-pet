using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Windows.Forms;

public static class Program
{
    static AppHost host;   // for the fatal path: its tray icon must not outlive the process
    const string UnpackFailed = "錢進中無法準備執行所需的檔案（可能是磁碟空間不足，或被防毒軟體擋住），需要關閉。\n\n詳細資訊已記錄在：\n";

    [STAThread]
    public static int Main(string[] args)
    {
        if (AppDomain.CurrentDomain.IsDefaultAppDomain())
        {
            RestrictDllSearch();
            string appBase = ReleaseAppBase();
            if (appBase != null) return RunIsolated(appBase, args);
        }
        return Run(args);
    }

    // DLLs named without a path load from the exe's folder, System32 and folders added with AddDllDirectory only:
    // never from the current directory or PATH. The app's own P/Invokes use System32 only (AssemblyInfo.cs), and
    // WebView2Loader.dll is loaded from the payload folder by its full path (WebViewEnv: SetLoaderDllFolderPath).
    static void RestrictDllSearch()
    {
        try
        {
            if (!Native.SetDefaultDllDirectories(Native.LOAD_LIBRARY_SEARCH_DEFAULT_DIRS))
                ErrorLog.Write("SetDefaultDllDirectories failed (error " + System.Runtime.InteropServices.Marshal.GetLastWin32Error() + ")");
        }
        catch (Exception ex) { ErrorLog.Write("SetDefaultDllDirectories", ex); }   // a Windows without it (before KB2533623)
    }

    // Release build: the unpacked folder (Payload.ExpectedDir, which may not exist yet); dev build: null.
    static string ReleaseAppBase()
    {
        try { return Payload.ExpectedDir(); }
        catch (Exception ex)
        {
            ErrorLog.Write("finding the app folder", ex);
            return null;
        }
    }

    // A release exe runs the app in a second AppDomain whose ApplicationBase is its unpacked folder
    // (%LocalAppData%\錢進中\app\<id>), not the exe's folder. The runtime looks for the WebView2 assemblies in the
    // ApplicationBase first, before any AssemblyResolve handler can answer, so a Microsoft.Web.WebView2.Core.dll or
    // .WinForms.dll that another program left beside the exe (in Downloads, say) would otherwise be loaded instead of
    // the app's own copy, or crash it when it is a different version. This domain loads nothing but the exe and
    // mscorlib; the app domain runs Main again (Run) on this same STA thread. A foreign copy is logged.
    static int RunIsolated(string appBase, string[] args)
    {
        string exe = typeof(Program).Assembly.Location;
        LogForeignCopies(Path.GetDirectoryName(exe), appBase);
        AppDomain app;
        try
        {
            AppDomainSetup setup = new AppDomainSetup();
            setup.ApplicationBase = appBase;
            setup.ApplicationName = "錢進中";
            setup.DisallowCodeDownload = true;
            app = AppDomain.CreateDomain("錢進中", null, setup);
        }
        catch (Exception ex)
        {
            ErrorLog.Write("could not create the app domain; running in the default one", ex);
            return Run(args);
        }
        try { return app.ExecuteAssembly(exe, args); }
        catch (Exception ex)
        {
            ErrorLog.Write("fatal error in the app domain", ex);
            return 1;
        }
    }

    static void LogForeignCopies(string exeDir, string appBase)
    {
        try
        {
            List<string> foreign = Payload.ForeignCopies(exeDir, Payload.Embedded);
            foreach (string name in foreign)
                ErrorLog.Write("ignored " + Path.Combine(exeDir, name) + ": not the app's own copy; the app uses " + Path.Combine(appBase, name));
        }
        catch (Exception ex) { ErrorLog.Write("checking the DLLs beside the exe", ex); }
    }

    // The app itself: in the app domain (release) or the default domain (dev build).
    static int Run(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        // A bug in one UI event handler is logged and the app keeps running; anything else is fatal.
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { ErrorLog.Write("unhandled exception on the UI thread", e.Exception); };
        AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { Fatal(e.ExceptionObject as Exception); };

        if (!SingleInstance.TryStart()) return 0;   // the running instance shows itself
        if (!Unpack()) return 1;
        return Start(args);
    }

    // Release build: the files embedded in the exe go to %LocalAppData%\錢進中\app\ (one process at a time, after
    // the single-instance check) before anything needs the WebView2 assemblies. Dev build: nothing to do.
    static bool Unpack()
    {
        try
        {
            string dir = Payload.Ensure();
            if (dir != null && !SameFolder(dir, AppDomain.CurrentDomain.BaseDirectory))
                ErrorLog.Write("the app runs outside its unpacked folder: " + AppDomain.CurrentDomain.BaseDirectory + " (expected " + dir + ")");
            return true;
        }
        catch (Exception ex)
        {
            ErrorLog.Write("unpacking the app files failed", ex);
            MessageBox.Show(UnpackFailed + ErrorLog.FilePath, "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
    }

    static bool SameFolder(string a, string b)
    {
        return string.Equals(Path.GetFullPath(a).TrimEnd('\\'), Path.GetFullPath(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
    }

    // Apart from Main (and never inlined into it), so nothing WebView2-related is compiled or loaded before
    // Payload.Ensure has run: a release build resolves those assemblies only from the unpacked folder.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static int Start(string[] args)
    {
        if (!WebView2Check.IsAvailable())
        {
            // 是 opens the download page in the default browser; 否 just closes.
            if (MessageBox.Show(WebView2Check.MissingMessage, "錢進中", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                WebView2Check.OpenDownloadPage();
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
