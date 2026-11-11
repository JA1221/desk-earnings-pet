using System;
using System.IO;

public static class AppPaths
{
    const string AppFolder = "錢進中";

    // %AppData%\錢進中 (settings.json, history.json); created on first access.
    public static string DataDir
    {
        get { return Ensure(Environment.SpecialFolder.ApplicationData); }
    }

    // %LocalAppData%\錢進中 (extracted runtime files, WebView2 user data); created on first access.
    public static string LocalDir
    {
        get { return Ensure(Environment.SpecialFolder.LocalApplicationData); }
    }

    static string Ensure(Environment.SpecialFolder root)
    {
        string dir = Path.Combine(Environment.GetFolderPath(root), AppFolder);
        Directory.CreateDirectory(dir);
        return dir;
    }
}
