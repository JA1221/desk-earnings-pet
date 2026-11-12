using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;

// JSON message bridge between the host and the page; every message is an object with a string "type".
// Host -> page: Send queues until Open (the page's init), and again after Hold (the page navigates), so the page
// never misses a message sent before it could listen; at most MaxQueued wait, the oldest are dropped.
// Page -> host: every Received handler runs on its own; one that throws is reported and the others still run.
public class Bridge
{
    public const int MaxQueued = 200;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    readonly Action<string> post;
    readonly Action<string, Exception> onError;
    readonly List<string> queue = new List<string>();
    bool open;

    public event Action<string, Dictionary<string, object>> Received;

    public Bridge(CoreWebView2 web) : this(web.PostWebMessageAsJson, ErrorLog.Write)
    {
        Attach(web);
    }

    // post: delivers one JSON message to the page. onError: reports a handler that threw (may be null).
    public Bridge(Action<string> post, Action<string, Exception> onError)
    {
        this.post = post;
        this.onError = onError;
    }

    // Messages are delivered (true) or queued (false).
    public bool IsOpen { get { return open; } }

    // Receives the page's messages from web.
    public void Attach(CoreWebView2 web)
    {
        web.WebMessageReceived += OnMessage;
    }

    public void Send(string type, object payload)
    {
        string json = BuildMessage(type, payload);
        if (open) { post(json); return; }
        queue.Add(json);
        if (queue.Count > MaxQueued) queue.RemoveAt(0);
    }

    // Delivers this first message (the page's init), then everything queued, in order; later sends go straight out.
    public void Open(string type, object payload)
    {
        post(BuildMessage(type, payload));
        open = true;
        string[] waiting = queue.ToArray();
        queue.Clear();
        foreach (string json in waiting) post(json);
    }

    // Queue again until the next Open (the page is navigating).
    public void Hold()
    {
        open = false;
    }

    // Parses one message from the page and hands it to every Received handler, each isolated.
    public void Dispatch(string json)
    {
        Dictionary<string, object> d = Parse(json);
        Action<string, Dictionary<string, object>> handlers = Received;
        if (d == null || handlers == null) return;
        string type = (string)d["type"];
        foreach (Delegate h in handlers.GetInvocationList())
        {
            try { ((Action<string, Dictionary<string, object>>)h)(type, d); }
            catch (Exception ex)
            {
                if (onError == null) continue;
                try { onError("page message '" + type + "' handler failed", ex); }
                catch (Exception) { }
            }
        }
    }

    public static string BuildMessage(string type, object payload)
    {
        var msg = new Dictionary<string, object>();
        if (payload != null)
        {
            var fields = Json.DeserializeObject(Json.Serialize(payload)) as Dictionary<string, object>;
            if (fields != null) foreach (KeyValuePair<string, object> kv in fields) msg[kv.Key] = kv.Value;
        }
        msg["type"] = type;
        return Json.Serialize(msg);
    }

    // Returns null unless json is an object with a string "type".
    public static Dictionary<string, object> Parse(string json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try
        {
            var d = Json.DeserializeObject(json) as Dictionary<string, object>;
            if (d == null) return null;
            object t;
            if (!d.TryGetValue("type", out t) || !(t is string)) return null;
            return d;
        }
        catch (Exception)
        {
            return null;
        }
    }

    // Typed field access for parsed messages. A missing or wrongly typed field gives null / the fallback, never
    // an exception; numbers must be real JSON numbers (a numeric string or a bool is not one).
    public static string Str(Dictionary<string, object> d, string key)
    {
        object v;
        return d != null && d.TryGetValue(key, out v) ? v as string : null;
    }

    public static bool? Bool(Dictionary<string, object> d, string key)
    {
        object v;
        if (d != null && d.TryGetValue(key, out v) && v is bool) return (bool)v;
        return null;
    }

    public static double Num(Dictionary<string, object> d, string key, double fallback)
    {
        object v;
        double n;
        return d != null && d.TryGetValue(key, out v) && TryNumber(v, out n) ? n : fallback;
    }

    // [[x, y, w, h], ...] -> rects; entries that are not four finite numbers with w, h >= 0 are skipped; at most max.
    public static RectangleF[] Rects(Dictionary<string, object> d, string key, int max)
    {
        var list = new List<RectangleF>();
        object v;
        IList items = d != null && d.TryGetValue(key, out v) ? v as IList : null;
        if (items == null) return list.ToArray();
        foreach (object item in items)
        {
            if (list.Count >= max) break;
            IList r = item as IList;
            double x, y, w, h;
            if (r == null || r.Count != 4 || !TryNumber(r[0], out x) || !TryNumber(r[1], out y)
                || !TryNumber(r[2], out w) || !TryNumber(r[3], out h) || w < 0 || h < 0) continue;
            list.Add(new RectangleF((float)x, (float)y, (float)w, (float)h));
        }
        return list.ToArray();
    }

    // A finite JSON number as JavaScriptSerializer returns it (int, long, decimal or double).
    public static bool TryNumber(object v, out double n)
    {
        if (v is int) n = (int)v;
        else if (v is long) n = (long)v;
        else if (v is decimal) n = (double)(decimal)v;
        else if (v is double) n = (double)v;
        else { n = 0; return false; }
        return !double.IsNaN(n) && !double.IsInfinity(n);
    }

    void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string json;
        try { json = e.WebMessageAsJson; }
        catch (Exception) { return; }
        Dispatch(json);
    }
}
