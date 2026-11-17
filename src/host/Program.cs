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
    public const string ForeignWebView2 = "錢進中.exe 旁邊有其他版本的 WebView2 元件，請把 錢進中.exe 放到單獨的資料夾再開啟。";

    // A QJZ_PROFILE that is set but invalid (AppPaths.ProfileRejected): the run must not become the user's own app.
    public const int ProfileRejectedExit = 3;

    [STAThread]
    public static int Main(string[] args)
    {
        // First of all: nothing written (ErrorLog would write to the user's own folder), no window, no signal to the
        // user's running app through the single-instance event.
        if (AppPaths.ProfileRejected(AppPaths.RawProfile)) return ProfileRejectedExit;
        RestrictDllSearch();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        // A bug in one UI event handler is logged and the app keeps running; anything else is fatal.
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { ErrorLog.Write("unhandled exception on the UI thread", e.Exception); };
        AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { Fatal(e.ExceptionObject as Exception); };

        if (ForeignWebView2Beside()) return 0;
        // 1.1.6 一鍵更新: started by the exe this one replaced, with --after-update <pid>: that process is still saving and
        // quitting, and holds the instance mutex until it ends; wait for it (UpdateInstall.WaitForOldMs at most).
        int oldPid = UpdateInstall.WaitPid(args);
        if (oldPid > 0) UpdateInstall.WaitForExit(oldPid, UpdateInstall.WaitForOldMs);
        bool started = SingleInstance.TryStart();
        // after an update the old process is quitting, not staying: a slow exit must not leave no app at all, so keep
        // trying a while longer (30 s) instead of handing over to an instance that is about to end
        for (int i = 0; !started && oldPid > 0 && i < 60; i++) { Thread.Sleep(500); started = SingleInstance.TryStart(); }
        if (!started) return 0;   // the running instance shows itself
        UpdateInstall.CleanOld(Application.ExecutablePath);   // the exe an update replaced (best effort, every start)
        if (!Unpack()) return 1;
        return Start(args);
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

    // A release exe: is there a Microsoft.Web.WebView2.Core.dll or .WinForms.dll beside it that is not byte-identical
    // to its own embedded copy (another program's, left in Downloads, say)? The runtime looks in the exe's folder
    // first, before the AssemblyResolve handler (Payload) can hand out the unpacked copy, so such a file would be
    // loaded instead, or crash the start when it is another version. Then the user is told to move the exe, one line
    // goes to error.log, and the app ends (true). Identical copies are fine. Runs before any WebView2 type is touched.
    // (A second AppDomain based in the unpacked folder would avoid the question, but AppDomain.ExecuteAssembly refuses
    // an exe that carries the Mark of the Web, which every downloaded or mailed copy does.)
    static bool ForeignWebView2Beside()
    {
        List<string> foreign;
        string exeDir;
        try
        {
            exeDir = Path.GetDirectoryName(typeof(Program).Assembly.Location);
            foreign = Payload.ForeignCopies(exeDir, Payload.Embedded);
        }
        catch (Exception ex)
        {
            // fail closed (§5.10): a check that could not finish must not let an unknown DLL load. A dev build embeds
            // nothing, so it never throws from here and is never refused.
            ErrorLog.Write("checking the DLLs beside the exe", ex);
            MessageBox.Show(ForeignWebView2, "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return true;
        }
        if (foreign.Count == 0) return false;
        ErrorLog.Write("refused to start: " + string.Join(", ", foreign.ToArray()) + " in " + exeDir + " differ from the app's own copies");
        MessageBox.Show(ForeignWebView2, "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return true;
    }

    // Release build: the files embedded in the exe go to %LocalAppData%\錢進中\app\ (one process at a time, after
    // the single-instance check) before anything needs the WebView2 assemblies. Dev build: nothing to do.
    static bool Unpack()
    {
        try
        {
            Payload.Ensure();
            return true;
        }
        catch (Exception ex)
        {
            ErrorLog.Write("unpacking the app files failed", ex);
            MessageBox.Show(UnpackFailed + ErrorLog.FilePath, "錢進中", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
    }

    // Apart from Main (and never inlined into it), so nothing WebView2-related is compiled or loaded before
    // Payload.Ensure has run: a release build resolves those assemblies from the unpacked folder (or from identical
    // copies beside the exe; ForeignWebView2Beside has refused any other).
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
            host = new AppHost(page ?? "index.html", page != null, UpdateInstall.WaitPid(args) > 0);
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
