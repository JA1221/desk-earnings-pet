using System;
using System.Collections.Generic;
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
