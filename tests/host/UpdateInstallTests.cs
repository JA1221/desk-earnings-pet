using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

// 1.1.6 item 1: 一鍵更新. The source (only the release's one exe at the fixed URL, with a size and a digest), the download
// (redirect hosts, size, SHA-256, MZ; any failure leaves no file), the swap and its rollback, the .old cleanup and the
// restart argument. Every request is injected: nothing here goes online.
public static class UpdateInstallTests
{
    const string Dl = "https://github.com/JA1221/desk-earnings-pet/releases/download/";
    const string Assets = "https://release-assets.githubusercontent.com/github-production-release-asset/1/abc?sp=r&sig=x";

    static string TempDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-ui-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    static string Sha(byte[] b)
    {
        using (SHA256 s = SHA256.Create())
            return BitConverter.ToString(s.ComputeHash(b)).Replace("-", "").ToLowerInvariant();
    }

    static byte[] Exe(int n)
    {
        byte[] b = new byte[n];
        new Random(n).NextBytes(b);
        b[0] = (byte)'M';
        b[1] = (byte)'Z';
        return b;
    }

    // A release answer: tag, and its assets as JSON objects (already written).
    static string Release(string tag, params string[] assets)
    {
        return "{\"tag_name\":\"" + tag + "\",\"html_url\":\"x\",\"assets\":[" + string.Join(",", assets) + "]}";
    }

    static string AssetJson(string name, string url, string size, string digest)
    {
        string s = "{\"name\":\"" + name + "\",\"browser_download_url\":\"" + url + "\",\"content_type\":\"application/x-msdownload\"";
        if (size != null) s += ",\"size\":" + size;
        if (digest != null) s += ",\"digest\":\"" + digest + "\"";
        return s + "}";
    }

    static string Good(string tag, string name, long size, string sha)
    {
        return AssetJson(name, Dl + tag + "/" + name, size.ToString(), "sha256:" + sha);
    }

    static UpdateAsset AssetOf(string json)
    {
        Dictionary<string, object> d = (Dictionary<string, object>)new JavaScriptSerializer().DeserializeObject(json);
        return UpdateInstall.Asset(d, UpdateCheck.ParseVersion(Bridge.Str(d, "tag_name")));
    }

    static UpdateAsset AssetFor(byte[] body)
    {
        return new UpdateAsset("desk-earnings-pet-1.2.0.exe", Dl + "v1.2.0/desk-earnings-pet-1.2.0.exe", body.Length, Sha(body));
    }

    // ---- the source ----

    public static void Test_TheAssetOfARelease()
    {
        string sha = new string('a', 64);
        UpdateAsset a = AssetOf(Release("v1.2.0", Good("v1.2.0", "desk-earnings-pet-1.2.0.exe", 5000000, sha),
            AssetJson("notes.txt", Dl + "v1.2.0/notes.txt", "10", null)));
        Assert.True(a != null, "one exe with a size and a digest");
        Assert.Eq("desk-earnings-pet-1.2.0.exe", a.Name, "name");
        Assert.Eq(Dl + "v1.2.0/desk-earnings-pet-1.2.0.exe", a.Url, "url");
        Assert.Eq(5000000L, a.Size, "size");
        Assert.Eq(sha, a.Sha256, "sha");
        a = AssetOf(Release("v1.2.0", Good("v1.2.0", "x.exe", 1, new string('C', 64))));
        Assert.Eq(new string('c', 64), a.Sha256, "the digest in lowercase");
        Assert.True(AssetOf(Release("v1.2.0", Good("v1.2.0", "x.exe", UpdateInstall.MaxSize, sha))) != null, "64 MB is allowed");
    }

    public static void Test_AnythingElseIsTheLinkOnly()
    {
        string sha = "sha256:" + new string('a', 64);
        string ok = Good("v1.2.0", "a.exe", 100, new string('a', 64));
        string[] bad = {
            Release("v1.2.0"),                                                                   // no asset
            Release("v1.2.0", ok, Good("v1.2.0", "b.exe", 100, new string('a', 64))),           // two exes
            Release("v1.2.0", ok, AssetJson("B.EXE", Dl + "v1.2.0/B.EXE", "100", sha)),         // two, one in capitals
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100", null)),            // no digest
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100", "sha1:" + new string('a', 40))),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100", "sha256:" + new string('a', 63))),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100", "sha256:" + new string('g', 64))),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100", sha + "\\n")),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", null, sha)),              // no size
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "0", sha)),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "-5", sha)),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "\"100\"", sha)),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", "100.5", sha)),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/a.exe", (UpdateInstall.MaxSize + 1).ToString(), sha)),   // over 64 MB
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.1/a.exe", "100", sha)),             // another version's
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/b.exe", "100", sha)),             // another file
            Release("v1.2.0", AssetJson("a.exe", "http://github.com/JA1221/desk-earnings-pet/releases/download/v1.2.0/a.exe", "100", sha)),
            Release("v1.2.0", AssetJson("a.exe", "https://evil.example/JA1221/desk-earnings-pet/releases/download/v1.2.0/a.exe", "100", sha)),
            Release("v1.2.0", AssetJson("a.exe", "https://github.com/someone/else/releases/download/v1.2.0/a.exe", "100", sha)),
            Release("v1.2.0", AssetJson("a.exe", Dl + "v1.2.0/../../x/a.exe", "100", sha)),
            Release("v1.2.0", AssetJson("a b.exe", Dl + "v1.2.0/a b.exe", "100", sha)),         // a name outside [A-Za-z0-9._-]
            Release("v1.2.0", AssetJson("a%2F..exe", Dl + "v1.2.0/a%2F..exe", "100", sha)),
            Release("v1.2.0", AssetJson("錢進中.exe", Dl + "v1.2.0/錢進中.exe", "100", sha)),
            Release("v1.2.0", AssetJson("a.exe.zip", Dl + "v1.2.0/a.exe.zip", "100", sha)),     // no exe at all
            "{\"tag_name\":\"v1.2.0\",\"assets\":{}}",
            "{\"tag_name\":\"v1.2.0\"}"
        };
        foreach (string json in bad)
            Assert.True(AssetOf(json) == null, "no 更新: " + json);
        Assert.True(UpdateInstall.Asset(null, new[] { 1, 2, 0 }) == null && UpdateInstall.Asset(new Dictionary<string, object>(), null) == null, "nothing");
    }

    // 檢查更新 carries the asset for a newer release only; an older or the same release has none (the version compare).
    public static void Test_OnlyANewerReleaseCanBeInstalled()
    {
        string sha = new string('a', 64);
        UpdateResult r = UpdateCheck.Result(Release("v1.1.7", Good("v1.1.7", "a.exe", 100, sha)), "1.1.6");
        Assert.Eq("newer", r.Kind, "newer");
        Assert.True(r.Asset != null && r.Asset.Url == Dl + "v1.1.7/a.exe", "with its exe");
        r = UpdateCheck.Result(Release("v1.10.0", Good("v1.10.0", "a.exe", 100, sha)), "1.9.9");
        Assert.True(r.Kind == "newer" && r.Asset != null, "numeric compare");
        foreach (string tag in new[] { "v1.1.6", "v1.1.5", "v1.0.99", "v0.9.0" })
        {
            r = UpdateCheck.Result(Release(tag, Good(tag, "a.exe", 100, sha)), "1.1.6");
            Assert.Eq("latest", r.Kind, tag);
            Assert.True(r.Asset == null, "nothing to install: " + tag);
        }
        r = UpdateCheck.Result(Release("v1.1.7", AssetJson("a.exe", Dl + "v1.1.7/a.exe", "100", null)), "1.1.6");
        Assert.True(r.Kind == "newer" && r.Asset == null && r.Url == UpdateCheck.ReleasesUrl + "/tag/v1.1.7", "no digest: the link only");
    }

    // ---- the download ----

    public static void Test_RedirectHostsAreAllowListed()
    {
        foreach (string ok in new[] { Dl + "v1.2.0/a.exe", Assets, "https://objects.githubusercontent.com/x/y?z=1", "https://GitHub.com/x" })
            Assert.True(UpdateInstall.AllowedUrl(ok), "allowed: " + ok);
        foreach (string bad in new[] { null, "", "/relative", "http://github.com/x", "https://github.com:8443/x", "https://user:pw@github.com/x",
            "https://evil.example/x", "https://github.com.evil.example/x", "https://evilgithub.com/x", "https://api.github.com/x",
            "https://raw.githubusercontent.com/x", "https://githubusercontent.com/x", "ftp://github.com/x", "file:///C:/x.exe", "https://127.0.0.1/x" })
            Assert.True(!UpdateInstall.AllowedUrl(bad), "refused: " + bad);
    }

    // A fake source: url -> (status, location, body).
    sealed class Fake
    {
        public readonly List<string> Asked = new List<string>();
        readonly Dictionary<string, object[]> map = new Dictionary<string, object[]>();
        public Fake Add(string url, int status, string location, byte[] body) { map[url] = new object[] { status, location, body }; return this; }
        public UpdateHop Get(string url)
        {
            Asked.Add(url);
            object[] a;
            if (!map.TryGetValue(url, out a)) return new UpdateHop(404, null, null, null);
            byte[] body = (byte[])a[2];
            return new UpdateHop((int)a[0], (string)a[1], body == null ? null : new MemoryStream(body), null);
        }
    }

    static string Run(UpdateAsset a, Fake f, string dir, List<long> progress)
    {
        return UpdateInstall.Download(a, dir, f.Get, delegate(long got, long size) { if (progress != null) progress.Add(got); }, null);
    }

    public static void Test_DownloadFollowsAllowedRedirectsAndChecksTheFile()
    {
        string dir = TempDir();
        try
        {
            byte[] body = Exe(200000);
            UpdateAsset a = AssetFor(body);
            Fake f = new Fake().Add(a.Url, 302, Assets, null).Add(Assets, 200, null, body);
            List<long> p = new List<long>();
            string file = Run(a, f, dir, p);
            Assert.Eq(Path.Combine(dir, a.Name + ".part"), file, "the .part file");
            Assert.True(File.Exists(file) && Sha(File.ReadAllBytes(file)) == a.Sha256, "the checked body");
            Assert.Eq(2, f.Asked.Count, "the URL, then the redirect");
            Assert.True(p.Count > 0 && p[p.Count - 1] == body.Length, "progress up to the size");
            for (int i = 1; i < p.Count; i++) Assert.True(p[i] > p[i - 1], "growing");

            // a relative Location resolves against github.com; three redirects are fine
            f = new Fake().Add(a.Url, 302, "/x/1", null).Add("https://github.com/x/1", 301, "https://objects.githubusercontent.com/2", null)
                .Add("https://objects.githubusercontent.com/2", 307, Assets, null).Add(Assets, 200, null, body);
            Assert.True(Run(a, f, dir, null) != null, "three hops");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_DownloadRefusesRedirectsElsewhere()
    {
        string dir = TempDir();
        try
        {
            byte[] body = Exe(1000);
            UpdateAsset a = AssetFor(body);
            foreach (string to in new[] { "https://evil.example/a.exe", "http://release-assets.githubusercontent.com/a.exe",
                "https://release-assets.githubusercontent.com:444/a.exe", "https://release-assets.githubusercontent.com.evil.example/a.exe", "file:///C:/a.exe" })
            {
                Fake f = new Fake().Add(a.Url, 302, to, null).Add(to, 200, null, body);
                Assert.True(Run(a, f, dir, null) == null, "refused: " + to);
                Assert.Eq(1, f.Asked.Count, "never asked: " + to);
            }
            Fake g = new Fake().Add(a.Url, 302, null, null);
            Assert.True(Run(a, g, dir, null) == null, "a redirect without a Location");
            // four redirects: one too many
            Fake h = new Fake().Add(a.Url, 302, "https://github.com/1", null).Add("https://github.com/1", 302, "https://github.com/2", null)
                .Add("https://github.com/2", 302, "https://github.com/3", null).Add("https://github.com/3", 302, Assets, null).Add(Assets, 200, null, body);
            Assert.True(Run(a, h, dir, null) == null, "four hops");
            Assert.Eq(4, h.Asked.Count, "stopped before the fifth request");
            // the asset's own URL must be allowed too
            UpdateAsset off = new UpdateAsset(a.Name, "https://evil.example/a.exe", a.Size, a.Sha256);
            Fake e = new Fake().Add(off.Url, 200, null, body);
            Assert.True(Run(off, e, dir, null) == null && e.Asked.Count == 0, "a URL not allowed is never asked");
            Assert.Eq(0, Directory.GetFiles(dir).Length, "no file left");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_AFailedCheckLeavesNoFile()
    {
        string dir = TempDir();
        try
        {
            byte[] body = Exe(5000);
            UpdateAsset a = AssetFor(body);
            byte[] other = (byte[])body.Clone();
            other[4000] ^= 1;
            byte[] noMz = (byte[])body.Clone();
            noMz[0] = (byte)'P';
            byte[] longer = new byte[body.Length + 1];
            body.CopyTo(longer, 0);
            byte[] shorter = new byte[body.Length - 1];
            Array.Copy(body, shorter, shorter.Length);
            object[][] cases = {
                new object[] { "digest mismatch", a, other },
                new object[] { "longer than its size", a, longer },
                new object[] { "shorter than its size", a, shorter },
                new object[] { "empty", a, new byte[0] },
                new object[] { "not MZ, with a matching digest", new UpdateAsset(a.Name, a.Url, noMz.Length, Sha(noMz)), noMz },
                new object[] { "MZ-less one byte", new UpdateAsset(a.Name, a.Url, 1, Sha(new byte[] { 77 })), new byte[] { 77 } }
            };
            foreach (object[] c in cases)
            {
                UpdateAsset x = (UpdateAsset)c[1];
                Fake f = new Fake().Add(x.Url, 200, null, (byte[])c[2]);
                List<string> log = new List<string>();
                Assert.True(UpdateInstall.Download(x, dir, f.Get, null, delegate(string s) { log.Add(s); }) == null, (string)c[0]);
                Assert.Eq(0, Directory.GetFiles(dir).Length, "deleted: " + c[0]);
                Assert.True(log.Count == 1, "logged: " + c[0]);
            }
            // longer: it stops reading past the size
            CountingStream cs = new CountingStream(new byte[a.Size * 4]);
            UpdateInstall.Download(a, dir, delegate(string u) { return new UpdateHop(200, null, cs, null); }, null, null);
            Assert.True(cs.Read_ <= a.Size + 81920, "stopped past the size: read " + cs.Read_);
            // HTTP errors, no answer, a throw
            foreach (int st in new[] { 403, 404, 500, 304 })
                Assert.True(Run(a, new Fake().Add(a.Url, st, null, body), dir, null) == null, "HTTP " + st);
            Assert.True(UpdateInstall.Download(a, dir, delegate(string u) { return null; }, null, null) == null, "no answer");
            Assert.True(UpdateInstall.Download(a, dir, delegate(string u) { throw new WebException("timeout", WebExceptionStatus.Timeout); }, null, null) == null, "a timeout");
            Assert.True(UpdateInstall.Download(a, dir, delegate(string u) { return new UpdateHop(200, null, new FailingStream(), null); }, null, null) == null, "a read that fails");
            Assert.Eq(0, Directory.GetFiles(dir).Length, "no file left");
        }
        finally { Directory.Delete(dir, true); }
    }

    sealed class CountingStream : MemoryStream
    {
        public long Read_;
        public CountingStream(byte[] b) : base(b) { }
        public override int Read(byte[] buffer, int offset, int count) { int n = base.Read(buffer, offset, count); Read_ += n; return n; }
    }

    sealed class FailingStream : MemoryStream
    {
        int calls;
        public FailingStream() : base(new byte[] { 77, 90, 0, 0 }) { }
        public override int Read(byte[] buffer, int offset, int count) { if (calls++ > 0) throw new IOException("reset"); return base.Read(buffer, offset, 2); }
    }

    // The real request: GET, a generic User-Agent, no cookies or credentials, timeouts, no redirect followed.
    public static void Test_TheDownloadRequestCarriesNothingButItself()
    {
        HttpWebRequest q = UpdateInstall.NewRequest(Dl + "v1.2.0/a.exe");
        Assert.Eq("GET", q.Method, "GET");
        Assert.Eq("desk-earnings-pet", q.UserAgent, "a generic User-Agent");
        Assert.True(q.CookieContainer == null && q.Credentials == null && !q.UseDefaultCredentials, "no cookies or credentials");
        Assert.True(!q.AllowAutoRedirect, "each redirect is checked by Download");
        Assert.True(q.Timeout > 0 && q.Timeout <= 30000 && q.ReadWriteTimeout > 0 && q.ReadWriteTimeout <= 60000, "timeouts");
        int extra = 0;
        foreach (string h in q.Headers.AllKeys) if (h != "User-Agent" && h != "Accept") extra++;
        Assert.Eq(0, extra, "no other headers");
        Assert.True(UpdateInstall.Get("https://evil.example/a.exe") == null, "Get never asks a URL that is not allowed");
    }

    // ---- the swap ----

    public static void Test_SwapPutsTheNewExeInPlace()
    {
        string dir = TempDir();
        try
        {
            string exe = Path.Combine(dir, "錢進中.exe"), nw = Path.Combine(dir, "new.part");
            File.WriteAllText(exe, "old");
            File.WriteAllText(nw, "new");
            File.WriteAllText(exe + ".old", "older");   // an earlier .old that was not cleaned
            Assert.True(UpdateInstall.Swap(exe, nw, File.Move, null), "swapped");
            Assert.Eq("new", File.ReadAllText(exe), "the new exe at the old name");
            Assert.Eq("old", File.ReadAllText(exe + ".old"), "the running one is .old");
            Assert.True(!File.Exists(nw), "moved, not copied");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_SwapRollsBack()
    {
        string dir = TempDir();
        try
        {
            string exe = Path.Combine(dir, "a.exe"), nw = Path.Combine(dir, "new.part");
            File.WriteAllText(exe, "old");
            File.WriteAllText(nw, "new");
            List<string> log = new List<string>();
            Action<string, string> failSecond = delegate(string from, string to)
            {
                if (from == nw) throw new IOException("disk full");
                File.Move(from, to);
            };
            Assert.True(!UpdateInstall.Swap(exe, nw, failSecond, delegate(string s) { log.Add(s); }), "failed");
            Assert.Eq("old", File.ReadAllText(exe), "the old exe is back");
            Assert.True(!File.Exists(exe + ".old"), "no .old left");
            Assert.Eq(1, log.Count, "logged");

            // the rename itself fails: nothing moved
            Action<string, string> failFirst = delegate(string from, string to) { throw new UnauthorizedAccessException("no"); };
            Assert.True(!UpdateInstall.Swap(exe, nw, failFirst, null), "failed");
            Assert.Eq("old", File.ReadAllText(exe), "untouched");
            Assert.True(File.Exists(nw), "the new file is the caller's to delete");

            // the new exe does not start: Restore puts the old one back
            Assert.True(UpdateInstall.Swap(exe, nw, File.Move, null), "swapped");
            Assert.True(UpdateInstall.Restore(exe, File.Move, null), "restored");
            Assert.Eq("old", File.ReadAllText(exe), "the old exe again");
            Assert.True(!File.Exists(exe + ".old"), "no .old");
            Assert.True(!UpdateInstall.Restore(exe, File.Move, null), "nothing to restore");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_CleanOldOnStart()
    {
        string dir = TempDir();
        try
        {
            string exe = Path.Combine(dir, "a.exe");
            File.WriteAllText(exe, "x");
            Assert.True(UpdateInstall.CleanOld(exe), "none: fine");
            File.WriteAllText(exe + ".old", "y");
            Assert.True(UpdateInstall.CleanOld(exe), "deleted");
            Assert.True(!File.Exists(exe + ".old") && File.Exists(exe), "only the .old");
            File.WriteAllText(exe + ".old", "y");
            using (new FileStream(exe + ".old", FileMode.Open, FileAccess.Read, FileShare.None))
                Assert.True(!UpdateInstall.CleanOld(exe), "in use: false, no throw");
            Assert.True(UpdateInstall.CleanOld(exe), "next time");
            UpdateInstall.CleanOld(dir + "\\a<b>|.exe");   // a path Windows refuses: no throw
        }
        finally { Directory.Delete(dir, true); }
    }

    // ---- the restart ----

    public static void Test_TheRestartArgument()
    {
        Assert.Eq("--after-update 1234", UpdateInstall.RestartArgs(1234), "the argument");
        Assert.Eq(1234, UpdateInstall.WaitPid(new[] { "--after-update", "1234" }), "read back");
        Assert.Eq(77, UpdateInstall.WaitPid(new[] { "--page", "x.html", "--after-update", "77" }), "among others");
        foreach (string[] bad in new[] { null, new string[0], new[] { "--after-update" }, new[] { "--after-update", "-1" }, new[] { "--after-update", "0" },
            new[] { "--after-update", "x" }, new[] { "--after-update", " 12" }, new[] { "--after-update", "99999999999" }, new[] { "--other", "12" } })
            Assert.Eq(0, UpdateInstall.WaitPid(bad), "none: " + (bad == null ? "null" : string.Join(" ", bad)));
        DateTime t0 = DateTime.UtcNow;
        Assert.True(UpdateInstall.WaitForExit(System.Diagnostics.Process.GetCurrentProcess().Id, 5000), "not this process");
        Assert.True(UpdateInstall.WaitForExit(int.MaxValue - 7, 5000), "a pid not running");
        Assert.True((DateTime.UtcNow - t0).TotalMilliseconds < 2000, "no wait for either");
    }
}
