using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;

// JSON message bridge between the host and the page; every message is an object with a string "type".
public class Bridge
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    readonly CoreWebView2 web;

    public event Action<string, Dictionary<string, object>> Received;

    public Bridge(CoreWebView2 web)
    {
        this.web = web;
        web.WebMessageReceived += OnMessage;
    }

    public void Send(string type, object payload)
    {
        web.PostWebMessageAsJson(BuildMessage(type, payload));
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
        Dictionary<string, object> d = Parse(json);
        if (d == null) return;
        Action<string, Dictionary<string, object>> h = Received;
        if (h != null) h((string)d["type"], d);
    }
}
