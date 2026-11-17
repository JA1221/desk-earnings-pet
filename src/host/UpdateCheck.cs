using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// 1.1.5 檢查更新 (設定 → 其他 → 關於): the app's one network request, made only when the user presses the button. One
// GET of the repo's latest release from the GitHub API, with a generic User-Agent and nothing else of the user's: no
// cookies, no credentials, no identifiers, TLS 1.2 set explicitly, a short timeout. Its tag_name (vX.Y.Z) against
// AppHost.Version gives one of three results (UpdateResult.Kind):
//   latest   the app is as new as the latest release, or newer: 「已是最新版（<app version>）」
//   newer    a newer release: 「有新版 X.Y.Z」, and its page can be opened (html_url)
//   unknown  anything else (no network, a timeout, 404 while the repo is private, rate limiting, an answer that does not
//            parse): 「查不到更新資訊」, and the Releases page can be opened.
// Only the repo's own release pages are ever opened (SafeUrl). The request is injectable (Check / RunAsync take it), so
// tests never go online.
public sealed class UpdateResult
{
    public string Kind { get; private set; }
    public string Version { get; private set; }   // latest: the app's; newer: the release's; unknown: null
    public string Url { get; private set; }       // the page 前往下載 opens: the release's, else the Releases page

    public UpdateResult(string kind, string version, string url)
    {
        Kind = kind;
        Version = version;
        Url = url;
    }
}

public static class UpdateCheck
{
    public const string ApiUrl = "https://api.github.com/repos/JA1221/desk-earnings-pet/releases/latest";
    public const string ReleasesUrl = "https://github.com/JA1221/desk-earnings-pet/releases";
    public const string UserAgent = "desk-earnings-pet";
    public const int TimeoutMs = 8000;      // the request's own timeouts (connect + response, and each read)
    public const int WaitMs = 10000;        // the longest the user waits for an answer, whatever the request does
    const int MaxBytes = 1 << 20;           // a release's JSON is a few KB; more is not read
    static readonly Regex VersionRx = new Regex(@"^\s*[vV]?(\d{1,9})\.(\d{1,9})\.(\d{1,9})\s*$");
    static readonly Regex SafeRx = new Regex(@"^https://github\.com/JA1221/desk-earnings-pet/releases(/[A-Za-z0-9._/-]*)?$");

    public static UpdateResult Unknown()
    {
        return new UpdateResult("unknown", null, ReleasesUrl);
    }

    // "v1.2.3" / "1.2.3" -> {1, 2, 3}; anything else (a pre-release suffix included) -> null.
    public static int[] ParseVersion(string s)
    {
        if (s == null) return null;
        Match m = VersionRx.Match(s);
        if (!m.Success) return null;
        int[] v = new int[3];
        for (int i = 0; i < 3; i++)
            if (!int.TryParse(m.Groups[i + 1].Value, out v[i])) return null;
        return v;
    }

    // tag is a newer version than current (both parse).
    public static bool Newer(string tag, string current)
    {
        int[] a = ParseVersion(tag), b = ParseVersion(current);
        if (a == null || b == null) return false;
        for (int i = 0; i < 3; i++)
            if (a[i] != b[i]) return a[i] > b[i];
        return false;
    }

    // Only the repo's own release pages: https, github.com, this repo's /releases, plain path characters.
    public static bool SafeUrl(string url)
    {
        return url != null && SafeRx.IsMatch(url);
    }

    // The result for the API's answer json (null: none) and the app's version current.
    public static UpdateResult Result(string json, string current)
    {
        int[] cur = ParseVersion(current);
        if (cur == null || string.IsNullOrEmpty(json)) return Unknown();
        Dictionary<string, object> d;
        try { d = new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string, object>; }
        catch (Exception) { return Unknown(); }
        if (d == null) return Unknown();
        string tag = Bridge.Str(d, "tag_name"), page = Bridge.Str(d, "html_url");
        int[] rel = ParseVersion(tag);
        if (rel == null) return Unknown();
        string url = SafeUrl(page) ? page : ReleasesUrl;
        if (Newer(tag, current)) return new UpdateResult("newer", string.Join(".", rel), url);
        return new UpdateResult("latest", string.Join(".", cur), url);
    }

    // One request (fetch: the API's answer, null for none) and its result; a fetch that throws is unknown.
    public static UpdateResult Check(Func<string> fetch, string current)
    {
        string json;
        try { json = fetch(); }
        catch (Exception) { return Unknown(); }
        return Result(json, current);
    }

    // Check on a worker thread; unknown when it has not answered within waitMs (the request is left to time out).
    public static async Task<UpdateResult> RunAsync(Func<string> fetch, string current, int waitMs)
    {
        Task<UpdateResult> t = Task.Run(delegate { return Check(fetch, current); });
        if (await Task.WhenAny(t, Task.Delay(waitMs)).ConfigureAwait(false) != t) return Unknown();
        return t.Result;
    }

    public static void EnsureTls12()
    {
        ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
    }

    // The request, not sent.
    public static HttpWebRequest NewRequest()
    {
        HttpWebRequest q = (HttpWebRequest)WebRequest.Create(ApiUrl);
        q.Method = "GET";
        q.UserAgent = UserAgent;
        q.Accept = "application/vnd.github+json";
        q.Timeout = TimeoutMs;
        q.ReadWriteTimeout = TimeoutMs;
        q.CookieContainer = null;
        q.Credentials = null;
        q.UseDefaultCredentials = false;
        q.PreAuthenticate = false;
        q.MaximumAutomaticRedirections = 3;
        return q;
    }

    // The real request: the API's answer for a 200, else null (404 while the repo is private, 403 rate limiting, no
    // network, a timeout).
    public static string Fetch()
    {
        EnsureTls12();
        HttpWebRequest q = NewRequest();
        try
        {
            using (HttpWebResponse r = (HttpWebResponse)q.GetResponse())
            {
                if (r.StatusCode != HttpStatusCode.OK) return null;
                using (Stream s = r.GetResponseStream())
                using (MemoryStream m = new MemoryStream())
                {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = s.Read(buf, 0, buf.Length)) > 0)
                    {
                        if (m.Length + n > MaxBytes) return null;
                        m.Write(buf, 0, n);
                    }
                    return Encoding.UTF8.GetString(m.ToArray());
                }
            }
        }
        catch (WebException) { return null; }
        catch (IOException) { return null; }
    }
}
