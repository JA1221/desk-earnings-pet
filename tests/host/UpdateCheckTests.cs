using System;
using System.Net;
using System.Threading;

// 1.1.5 item 4: 檢查更新, one GET for the latest release, only when the user presses the button.
public static class UpdateCheckTests
{
    const string Releases = "https://github.com/JA1221/desk-earnings-pet/releases";

    static string Release(string tag, string url)
    {
        return "{\"tag_name\":\"" + tag + "\",\"html_url\":\"" + url + "\",\"name\":\"x\",\"assets\":[]}";
    }

    public static void Test_VersionParsing()
    {
        Assert.Eq("1.2.3", string.Join(".", UpdateCheck.ParseVersion("v1.2.3")), "v prefix");
        Assert.Eq("1.10.0", string.Join(".", UpdateCheck.ParseVersion("1.10.0")), "no prefix");
        Assert.Eq("2.0.1", string.Join(".", UpdateCheck.ParseVersion(" V2.0.1 ")), "spaces, capital V");
        foreach (string bad in new[] { null, "", "v1.2", "v1.2.3.4", "v1.2.3-beta", "latest", "v1.2.x", "v99999999999.0.0", "v1.2.3\n", "v1.2.3\r\n", "\nv1.2.3" })
            Assert.True(UpdateCheck.ParseVersion(bad) == null, "not a version: " + bad);
    }

    public static void Test_CompareVersions()
    {
        Assert.True(UpdateCheck.Newer("v1.1.6", "1.1.5"), "patch");
        Assert.True(UpdateCheck.Newer("v1.2.0", "1.1.5"), "minor");
        Assert.True(UpdateCheck.Newer("v1.10.0", "1.9.9"), "numeric, not text");
        Assert.True(UpdateCheck.Newer("v2.0.0", "1.99.99"), "major");
        Assert.True(!UpdateCheck.Newer("v1.1.5", "1.1.5"), "same");
        Assert.True(!UpdateCheck.Newer("v1.1.4", "1.1.5"), "older");
    }

    public static void Test_ResultFromTheReleaseJson()
    {
        string page = Releases + "/tag/v1.2.0";
        UpdateResult r = UpdateCheck.Result(Release("v1.2.0", page), "1.1.5");
        Assert.Eq("newer", r.Kind, "newer kind");
        Assert.Eq("1.2.0", r.Version, "newer version, without the v");
        Assert.Eq(page, r.Url, "the release's page");

        r = UpdateCheck.Result(Release("v1.1.5", Releases + "/tag/v1.1.5"), "1.1.5");
        Assert.Eq("latest", r.Kind, "same version");
        Assert.Eq("1.1.5", r.Version, "the app's version");

        r = UpdateCheck.Result(Release("v1.1.4", Releases + "/tag/v1.1.4"), "1.1.5");
        Assert.Eq("latest", r.Kind, "an older release (a newer build here)");
        Assert.Eq("1.1.5", r.Version, "the app's version");
    }

    public static void Test_AnythingElseIsUnknown()
    {
        foreach (string json in new[] { null, "", "not json", "[]", "{}", "{\"message\":\"Not Found\"}", "{\"tag_name\":7}",
            "{\"tag_name\":\"nightly\"}", Release("v1.2", Releases) })
        {
            UpdateResult r = UpdateCheck.Result(json, "1.1.5");
            Assert.Eq("unknown", r.Kind, "unknown: " + json);
            Assert.Eq(Releases, r.Url, "the Releases page: " + json);
        }
        Assert.Eq("unknown", UpdateCheck.Result(Release("v1.2.0", Releases), "dev").Kind, "the app's version is not one");
    }

    // Review I-1: the answer's html_url is never used; the newer release's page is built from its parsed version, so a
    // hostile html_url (a path that climbs out with .., a trailing newline, another site) changes nothing.
    public static void Test_TheReleasePageIsBuiltFromTheVersion()
    {
        string[] hostile = { Releases + "/../../attacker/x", Releases + "/tag/v1.2.0/../../../../attacker/x", Releases + "/tag/v1.2.0\n",
            Releases + "\n", "http://github.com/JA1221/desk-earnings-pet/releases/tag/v1.2.0", "https://evil.example/JA1221/desk-earnings-pet/releases/",
            "https://github.com/JA1221/desk-earnings-pet-x/releases/tag/v1", "https://github.com/someone/else/releases/tag/v1.2.0",
            Releases + "/tag/v1.2.0\" & calc", "javascript:alert(1)", "", Releases + "/tag/v1.2.0" };
        foreach (string page in hostile)
        {
            UpdateResult r = UpdateCheck.Result(Release("v1.2.0", page.Replace("\\", "\\\\").Replace("\n", "\\n").Replace("\"", "\\\"")), "1.1.5");
            Assert.Eq("newer", r.Kind, "still newer: " + page);
            Assert.Eq(Releases + "/tag/v1.2.0", r.Url, "the page from the version: " + page);
        }
        Assert.Eq(Releases, UpdateCheck.Result(Release("v1.1.5", Releases + "/../../attacker/x"), "1.1.5").Url, "latest: the Releases page");
    }

    // Only two shapes ever reach Process.Start (AppHost.OpenUpdate hands it UrlToOpen's answer): the Releases page and
    // .../releases/tag/vX.Y.Z, exactly.
    public static void Test_OnlyTwoUrlShapesOpen()
    {
        Assert.True(UpdateCheck.SafeUrl(Releases), "the Releases page");
        Assert.True(UpdateCheck.SafeUrl(Releases + "/tag/v1.2.0"), "a release's page");
        Assert.Eq(Releases + "/tag/v10.0.3", UpdateCheck.UrlToOpen(Releases + "/tag/v10.0.3"), "kept");
        foreach (string bad in new[] { null, "", Releases + "/", Releases + "/../../attacker/x", Releases + "/tag/v1.2.0/../../x", Releases + "/tag/v1.2.0\n",
            Releases + "\n", Releases + "/tag/v1.2", Releases + "/tag/1.2.0", Releases + "/tag/v1.2.0-beta", Releases + "/tag/v1.2.0?x=1",
            Releases + "/tag/v1.2.0#x", Releases + "/download/v1.2.0/x.exe", "HTTPS://github.com/JA1221/desk-earnings-pet/releases",
            "https://github.com/JA1221/desk-earnings-pet/releases/tag/v1.2.0\" & calc", "file:///C:/Windows/System32/calc.exe" })
        {
            Assert.True(!UpdateCheck.SafeUrl(bad), "not one of the two: " + bad);
            Assert.Eq(Releases, UpdateCheck.UrlToOpen(bad), "the Releases page instead: " + bad);
        }
        Assert.Eq(Releases + "/tag/v1.2.0", UpdateCheck.TagUrl(new[] { 1, 2, 0 }), "TagUrl");
    }

    public static void Test_CheckUsesTheInjectedRequest()
    {
        int calls = 0;
        UpdateResult r = UpdateCheck.Check(delegate { calls++; return Release("v9.0.0", Releases + "/tag/v9.0.0"); }, "1.1.5");
        Assert.Eq(1, calls, "one request");
        Assert.Eq("newer", r.Kind, "newer");
        r = UpdateCheck.Check(delegate { return null; }, "1.1.5");
        Assert.Eq("unknown", r.Kind, "no answer (404, rate limit, no network)");
        r = UpdateCheck.Check(delegate { throw new WebException("timeout", WebExceptionStatus.Timeout); }, "1.1.5");
        Assert.Eq("unknown", r.Kind, "a request that throws");
        r = UpdateCheck.Check(delegate { throw new InvalidOperationException(); }, "1.1.5");
        Assert.Eq("unknown", r.Kind, "anything that throws");
    }

    // A request that hangs past the wait still answers, as unknown.
    public static void Test_RunGivesUpAfterTheWait()
    {
        ManualResetEvent release = new ManualResetEvent(false);
        DateTime t0 = DateTime.UtcNow;
        UpdateResult r = UpdateCheck.RunAsync(delegate { release.WaitOne(5000); return Release("v9.0.0", Releases); }, "1.1.5", 200).Result;
        release.Set();
        Assert.Eq("unknown", r.Kind, "timed out");
        Assert.True((DateTime.UtcNow - t0).TotalMilliseconds < 3000, "did not wait for the request");
        r = UpdateCheck.RunAsync(delegate { return Release("v1.1.5", Releases); }, "1.1.5", 2000).Result;
        Assert.Eq("latest", r.Kind, "in time");
    }

    // Review M-1: the host keeps 檢查更新 busy until the request itself ends: Begin's task is that request, and it is still
    // running after Within has answered unknown.
    public static void Test_TheWorkOutlivesTheWait()
    {
        ManualResetEvent release = new ManualResetEvent(false);
        System.Threading.Tasks.Task<UpdateResult> work = UpdateCheck.Begin(delegate { release.WaitOne(5000); return Release("v9.0.0", Releases); }, "1.1.5");
        UpdateResult r = UpdateCheck.Within(work, 100).Result;
        Assert.Eq("unknown", r.Kind, "the page hears unknown");
        Assert.True(!work.IsCompleted, "the request is still out: still busy");
        release.Set();
        Assert.True(work.Wait(3000) && work.Result.Kind == "newer", "then it ends");
    }

    // The one request: GET of the latest release, a generic User-Agent, no cookies or credentials, a short timeout.
    public static void Test_TheRequestCarriesNothingButItself()
    {
        Assert.Eq("https://api.github.com/repos/JA1221/desk-earnings-pet/releases/latest", UpdateCheck.ApiUrl, "the URL");
        HttpWebRequest q = UpdateCheck.NewRequest();
        Assert.Eq("GET", q.Method, "GET");
        Assert.Eq(UpdateCheck.ApiUrl, q.RequestUri.AbsoluteUri, "the URL");
        Assert.Eq("desk-earnings-pet", q.UserAgent, "a generic User-Agent");
        Assert.True(q.CookieContainer == null, "no cookies");
        Assert.True(q.Credentials == null && !q.UseDefaultCredentials, "no credentials");
        Assert.True(q.Timeout > 0 && q.Timeout <= 10000 && q.ReadWriteTimeout <= 10000, "a short timeout");
        Assert.Eq("application/vnd.github+json", q.Accept, "Accept");
        Assert.True(!q.AllowAutoRedirect, "no redirect is followed: a 3xx is unknown (review M-2)");
        int extra = 0;
        foreach (string h in q.Headers.AllKeys) if (h != "User-Agent" && h != "Accept") extra++;
        Assert.Eq(0, extra, "no other headers: " + string.Join(",", q.Headers.AllKeys));
        UpdateCheck.EnsureTls12();
        Assert.True((ServicePointManager.SecurityProtocol & SecurityProtocolType.Tls12) != 0, "TLS 1.2 on");
    }
}
