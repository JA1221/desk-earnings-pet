using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

// 1.1.6 一鍵更新 (設定 → 其他 → 關於 → 「更新」): after 檢查更新 found a newer release, a press of 更新 downloads its exe,
// checks it and puts it in place of the running exe. Nothing goes online before that press, and only these requests do.
//   The source is fixed (Asset): the latest-release answer must name exactly one .exe asset, at exactly
//   https://github.com/JA1221/desk-earnings-pet/releases/download/vX.Y.Z/<name> (<name>: ^[A-Za-z0-9._-]+\.exe$), with a
//   size (at most MaxSize) and a digest sha256:<64 hex>. Anything else (a missing digest included): no 更新, the link only.
//   The download (Download): redirects are followed by hand, at most MaxRedirects, HTTPS on the default port only, to
//   github.com / release-assets.githubusercontent.com / objects.githubusercontent.com only (AllowedUri); TLS 1.2, timeouts,
//   no cookies or credentials. The body streams to %LocalAppData%\錢進中\update\<name>.part and stops past size; then its
//   length must be size, its SHA-256 the digest and its first bytes MZ. Any failure deletes the file (null: 更新失敗).
//   The swap (Swap, release build only): the running exe is renamed to <exe>.old (Windows allows that), the checked file
//   moved to the exe's path (a failure renames .old back). The host then quits as usual (the page saves) and starts the
//   new exe with WaitArg <pid>: it waits for this process to end (WaitForOldMs at most) before its single-instance
//   check (Program.Main), and every start deletes <exe>.old (CleanOld, best effort). %AppData% is never touched.
// The request (Get) is injectable: Download takes it, so tests never go online.
public sealed class UpdateAsset
{
    public string Name { get; private set; }     // the asset's file name (NameRx)
    public string Url { get; private set; }      // its browser_download_url, exactly DownloadUrl(version, name)
    public long Size { get; private set; }       // bytes, 1..MaxSize
    public string Sha256 { get; private set; }   // 64 lowercase hex digits

    public UpdateAsset(string name, string url, long size, string sha256)
    {
        Name = name;
        Url = url;
        Size = size;
        Sha256 = sha256;
    }
}

// One answer to one GET: its status, its Location (a 3xx) and its body (a 200). Disposing it closes the response.
public sealed class UpdateHop : IDisposable
{
    public int Status { get; private set; }
    public string Location { get; private set; }
    public Stream Body { get; private set; }
    readonly IDisposable owner;

    public UpdateHop(int status, string location, Stream body, IDisposable owner)
    {
        Status = status;
        Location = location;
        Body = body;
        this.owner = owner;
    }

    public void Dispose()
    {
        if (Body != null) Body.Dispose();
        if (owner != null) owner.Dispose();
    }
}

public static class UpdateInstall
{
    public const long MaxSize = 64L << 20;   // 64 MB (the release exe is a few MB)
    public const int MaxRedirects = 3;
    public const int TimeoutMs = 15000;      // connect + response
    public const int ReadTimeoutMs = 30000;  // each read: a stalled download fails, a slow one goes on
    public const string Folder = "update";   // under %LocalAppData%\錢進中
    public const string OldSuffix = ".old";
    public const string WaitArg = "--after-update";
    public const int WaitForOldMs = 10000;
    const string DownloadBase = UpdateCheck.ReleasesUrl + "/download/v";
    static readonly Regex NameRx = new Regex(@"^[A-Za-z0-9._-]+\.exe\z");
    static readonly Regex DigestRx = new Regex(@"^sha256:([0-9a-fA-F]{64})\z");
    static readonly string[] Hosts = { "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com" };

    // https://github.com/JA1221/desk-earnings-pet/releases/download/vX.Y.Z/<name>
    public static string DownloadUrl(int[] version, string name)
    {
        return DownloadBase + string.Join(".", version) + "/" + name;
    }

    // ---- the source ----

    // The update asset of a release answer (release: its JSON object; version: its parsed tag), or null when the answer
    // does not name exactly one .exe at the fixed URL with a size and a SHA-256 digest.
    public static UpdateAsset Asset(Dictionary<string, object> release, int[] version)
    {
        if (release == null || version == null) return null;
        object[] assets;
        object raw;
        if (!release.TryGetValue("assets", out raw) || (assets = raw as object[]) == null) return null;
        Dictionary<string, object> exe = null;
        foreach (object o in assets)
        {
            Dictionary<string, object> a = o as Dictionary<string, object>;
            string n = a == null ? null : Bridge.Str(a, "name");
            if (n == null || !n.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) continue;
            if (exe != null) return null;   // two .exe assets: which one is meant is not clear
            exe = a;
        }
        if (exe == null) return null;
        string name = Bridge.Str(exe, "name");
        if (!NameRx.IsMatch(name)) return null;
        string url = Bridge.Str(exe, "browser_download_url");
        if (url != DownloadUrl(version, name)) return null;
        long size = Size(exe.ContainsKey("size") ? exe["size"] : null);
        if (size <= 0 || size > MaxSize) return null;
        string digest = Bridge.Str(exe, "digest");
        Match m = digest == null ? Match.Empty : DigestRx.Match(digest);
        if (!m.Success) return null;   // no digest: no update (the link only)
        return new UpdateAsset(name, url, size, m.Groups[1].Value.ToLowerInvariant());
    }

    // A JSON number that is a whole count of bytes; else -1.
    static long Size(object v)
    {
        if (v is int) return (int)v;
        if (v is long) return (long)v;
        if (v is decimal)
        {
            decimal d = (decimal)v;
            return d == decimal.Truncate(d) && d > 0 && d <= MaxSize ? (long)d : -1;
        }
        return -1;
    }

    // ---- the download ----

    // An absolute https URL on the default port, without user info, on one of the three hosts.
    public static bool AllowedUri(Uri u)
    {
        if (u == null || !u.IsAbsoluteUri || u.Scheme != Uri.UriSchemeHttps || !u.IsDefaultPort || u.UserInfo.Length != 0) return false;
        foreach (string h in Hosts)
            if (string.Equals(u.Host, h, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    public static bool AllowedUrl(string url)
    {
        Uri u;
        return url != null && Uri.TryCreate(url, UriKind.Absolute, out u) && AllowedUri(u);
    }

    static bool IsRedirect(int status)
    {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    // Downloads a (get: one GET of a URL, never following redirects) into dir\<name>.part and checks it. Returns that
    // file, or null after deleting it (why: log). progress(bytes so far, size) is called on the calling thread.
    public static string Download(UpdateAsset a, string dir, Func<string, UpdateHop> get, Action<long, long> progress, Action<string> log)
    {
        if (log == null) log = delegate { };
        if (a == null || !NameRx.IsMatch(a.Name ?? "") || a.Size <= 0 || a.Size > MaxSize || !AllowedUrl(a.Url)) { log("update: not a valid asset"); return null; }
        string part = null;
        try
        {
            Directory.CreateDirectory(dir);
            part = Path.Combine(dir, a.Name + ".part");
            string url = a.Url;
            for (int hop = 0; ; hop++)
            {
                using (UpdateHop h = get(url))
                {
                    if (h == null) { log("update: no answer from " + url); return Fail(part); }
                    if (IsRedirect(h.Status))
                    {
                        Uri next;
                        if (hop >= MaxRedirects) { log("update: too many redirects"); return Fail(part); }
                        if (h.Location == null || !Uri.TryCreate(new Uri(url), h.Location, out next) || !AllowedUri(next))
                        {
                            log("update: a redirect to a place not allowed");
                            return Fail(part);
                        }
                        url = next.AbsoluteUri;
                        continue;
                    }
                    if (h.Status != 200 || h.Body == null) { log("update: HTTP " + h.Status); return Fail(part); }
                    string why = Save(h.Body, part, a, progress);
                    if (why != null) { log("update: " + why); return Fail(part); }
                    return part;
                }
            }
        }
        catch (Exception ex)
        {
            log("update: " + ex.GetType().Name + ": " + ex.Message);
            return Fail(part);
        }
    }

    static string Fail(string part)
    {
        if (part != null) DeleteQuietly(part);
        return null;
    }

    // Streams body to path (at most a.Size bytes are written) and checks it; null when it is the asset, else why not.
    static string Save(Stream body, string path, UpdateAsset a, Action<long, long> progress)
    {
        long got = 0;
        byte[] head = new byte[2];
        using (SHA256 sha = SHA256.Create())
        {
            using (FileStream f = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                byte[] buf = new byte[81920];
                int n;
                while ((n = body.Read(buf, 0, buf.Length)) > 0)
                {
                    if (got + n > a.Size) return "longer than its size";
                    for (int i = 0; i < n && got + i < 2; i++) head[got + i] = buf[i];
                    f.Write(buf, 0, n);
                    sha.TransformBlock(buf, 0, n, null, 0);
                    got += n;
                    if (progress != null) progress(got, a.Size);
                }
            }
            sha.TransformFinalBlock(new byte[0], 0, 0);
            if (got != a.Size) return "length " + got + " is not its size " + a.Size;
            if (Hex(sha.Hash) != a.Sha256) return "SHA-256 differs from its digest";
        }
        if (head[0] != (byte)'M' || head[1] != (byte)'Z') return "not an exe (no MZ)";
        return null;
    }

    static string Hex(byte[] b)
    {
        char[] c = new char[b.Length * 2];
        for (int i = 0; i < b.Length; i++)
        {
            c[2 * i] = "0123456789abcdef"[b[i] >> 4];
            c[2 * i + 1] = "0123456789abcdef"[b[i] & 15];
        }
        return new string(c);
    }

    // The real request for one URL (allowed by AllowedUrl): GET, a generic User-Agent, nothing else of the user's, no
    // redirect followed, TLS 1.2. An HTTP error comes back as its status; no answer at all throws (Download: 更新失敗).
    public static UpdateHop Get(string url)
    {
        if (!AllowedUrl(url)) return null;
        UpdateCheck.EnsureTls12();
        HttpWebRequest q = NewRequest(url);
        HttpWebResponse r;
        try { r = (HttpWebResponse)q.GetResponse(); }
        catch (WebException ex)
        {
            r = ex.Response as HttpWebResponse;
            if (r == null) throw;
        }
        int status = (int)r.StatusCode;
        return new UpdateHop(status, r.Headers[HttpResponseHeader.Location], status == 200 ? r.GetResponseStream() : null, r);
    }

    // The request, not sent.
    public static HttpWebRequest NewRequest(string url)
    {
        HttpWebRequest q = (HttpWebRequest)WebRequest.Create(url);
        q.Method = "GET";
        q.UserAgent = UpdateCheck.UserAgent;
        q.Accept = "application/octet-stream";
        q.Timeout = TimeoutMs;
        q.ReadWriteTimeout = ReadTimeoutMs;
        q.CookieContainer = null;
        q.Credentials = null;
        q.UseDefaultCredentials = false;
        q.PreAuthenticate = false;
        q.AllowAutoRedirect = false;   // each hop is checked by Download (AllowedUri)
        return q;
    }

    // ---- the swap ----

    // Puts the checked file newFile in place of the running exe: exe -> exe.old, newFile -> exe; when the second move
    // fails, exe.old goes back. move is File.Move (injectable for tests). True when the new exe is in place.
    public static bool Swap(string exe, string newFile, Action<string, string> move, Action<string> log)
    {
        if (log == null) log = delegate { };
        string old = exe + OldSuffix;
        try
        {
            if (File.Exists(old)) File.Delete(old);   // a .old an earlier start could not delete
            move(exe, old);
        }
        catch (Exception ex)
        {
            log("update: renaming the exe: " + ex.Message);
            return false;
        }
        try
        {
            move(newFile, exe);
            return true;
        }
        catch (Exception ex)
        {
            log("update: moving the new exe in: " + ex.Message);
            Restore(exe, move, log);
            return false;
        }
    }

    // exe.old back to exe (after a failed swap, or when the new exe does not start): whatever is at exe goes.
    public static bool Restore(string exe, Action<string, string> move, Action<string> log)
    {
        if (log == null) log = delegate { };
        string old = exe + OldSuffix;
        try
        {
            if (!File.Exists(old)) return false;
            if (File.Exists(exe)) File.Delete(exe);
            move(old, exe);
            return true;
        }
        catch (Exception ex)
        {
            log("update: putting the old exe back: " + ex.Message);
            return false;
        }
    }

    // Every start: exe.old goes, if it is there and can go. True when none is left.
    public static bool CleanOld(string exe)
    {
        try
        {
            string old = exe + OldSuffix;
            if (File.Exists(old)) File.Delete(old);
            return !File.Exists(old);
        }
        catch (Exception) { return false; }
    }

    static void DeleteQuietly(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (Exception) { }
    }

    // ---- the restart ----

    // The arguments the new exe is started with: WaitArg and this process's id.
    public static string RestartArgs(int pid)
    {
        return WaitArg + " " + pid.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    // The pid after WaitArg in args, or 0 when there is none (or it is not a positive number).
    public static int WaitPid(string[] args)
    {
        if (args == null) return 0;
        for (int i = 0; i + 1 < args.Length; i++)
        {
            int pid;
            if (args[i] == WaitArg && int.TryParse(args[i + 1], System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture, out pid) && pid > 0) return pid;
        }
        return 0;
    }

    // Waits until process pid (not this one) has ended, at most ms. True when it has (or was not running).
    public static bool WaitForExit(int pid, int ms)
    {
        if (pid <= 0) return true;
        try
        {
            using (Process me = Process.GetCurrentProcess())
                if (me.Id == pid) return true;
            using (Process p = Process.GetProcessById(pid))
                return p.WaitForExit(ms);
        }
        catch (ArgumentException) { return true; }   // not running
        catch (Exception) { return false; }
    }
}
