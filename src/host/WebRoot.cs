using System;
using System.IO;
using System.Reflection;

public static class WebRoot
{
    // The folder served as https://app.qjz/: the release build's unpacked pages (Payload), else (dev build)
    // %QJZ_WEB_ROOT% if set, else <repo>\src\web found above the exe, else null.
    public static string Resolve()
    {
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        return Resolve(Environment.GetEnvironmentVariable("QJZ_WEB_ROOT"), Payload.WebDir, exeDir);
    }

    // packed: Payload.WebDir. A release exe always serves its own pages, even when it sits in the repo's build\,
    // and ignores QJZ_WEB_ROOT.
    public static string Resolve(string env, string packed, string exeDir)
    {
        if (!string.IsNullOrEmpty(packed)) return packed;
        if (!string.IsNullOrEmpty(env)) return env;
        string dir = exeDir;
        for (int i = 0; i < 2; i++)
        {
            dir = Path.GetDirectoryName(dir);
            if (dir == null) break;
            string candidate = Path.Combine(dir, Path.Combine("src", "web"));
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }

    // The file under root that a page URL path ("/index.html", "dev.html?layout=U7") is served from, or null when
    // the path names no file inside root.
    public static string PageFile(string root, string urlPath)
    {
        if (string.IsNullOrEmpty(root) || string.IsNullOrEmpty(urlPath)) return null;
        string p = urlPath;
        int cut = p.IndexOfAny(new[] { '?', '#' });
        if (cut >= 0) p = p.Substring(0, cut);
        try { p = Uri.UnescapeDataString(p); }
        catch (Exception) { return null; }
        if (p.StartsWith("/")) p = p.Substring(1);
        return Payload.EntryPath(root, p);
    }
}
