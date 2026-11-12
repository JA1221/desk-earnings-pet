using System;
using System.IO;
using System.Text;

// %LocalAppData%\錢進中\error.log: what went wrong, with details, for support. Never throws. Rotated to
// error.old.log past 256 KB. With QJZ_TRACE=1 (dev only) the host also traces its page messages to trace.log.
public static class ErrorLog
{
    const long MaxBytes = 256 * 1024;
    static readonly object Gate = new object();
    static readonly Encoding Utf8NoBom = new UTF8Encoding(false);
    // QJZ_TRACE=1: callers check this before building a trace line.
    public static readonly bool Tracing = Environment.GetEnvironmentVariable("QJZ_TRACE") == "1";

    public static string FilePath
    {
        get { return Path.Combine(AppPaths.LocalDir, "error.log"); }
    }

    public static void Write(string what, Exception ex)
    {
        Append("error.log", ex == null ? what : what + ": " + ex);
    }

    public static void Write(string what)
    {
        Append("error.log", what);
    }

    public static void Trace(string line)
    {
        if (Tracing) Append("trace.log", line);
    }

    static void Append(string name, string text)
    {
        try
        {
            lock (Gate)
            {
                string path = Path.Combine(AppPaths.LocalDir, name);
                FileInfo fi = new FileInfo(path);
                if (fi.Exists && fi.Length > MaxBytes)
                {
                    string old = Path.ChangeExtension(path, ".old.log");
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(path, old);
                }
                File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + text + Environment.NewLine, Utf8NoBom);
            }
        }
        catch (Exception)
        {
            // logging must never take the app down
        }
    }
}
