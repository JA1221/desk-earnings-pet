using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// The values in settings.json (written by the page) that the host needs before the page runs: autostart, the hide
// hotkey and topmost per layout. Like the page's sanitizer (src/web/js/core/settings.js), anything missing,
// invalid or unreadable gives the default: autostart on, Ctrl+Alt+H, topmost only for U7 and M3.
public class HostSettings
{
    public const string DefaultHotkey = "Ctrl+Alt+H";
    static readonly string[] Layouts = { "U1", "U3", "U5B", "U7", "M3" };
    readonly Dictionary<string, bool> topmost = new Dictionary<string, bool>();

    HostSettings()
    {
        Autostart = true;
        Hotkey = DefaultHotkey;
        foreach (string l in Layouts) topmost[l] = l == "U7" || l == "M3";
    }

    public bool Autostart { get; private set; }

    // Canonical combo (HotKey.Normalize).
    public string Hotkey { get; private set; }

    public bool Topmost(string layout)
    {
        bool on;
        return layout != null && topmost.TryGetValue(layout, out on) && on;
    }

    // A copy the host can update from setTopmost.
    public Dictionary<string, bool> TopmostByLayout()
    {
        return new Dictionary<string, bool>(topmost);
    }

    public static HostSettings Parse(string settingsJson)
    {
        var s = new HostSettings();
        Dictionary<string, object> d = null;
        if (!string.IsNullOrEmpty(settingsJson))
        {
            try { d = new JavaScriptSerializer().DeserializeObject(settingsJson) as Dictionary<string, object>; }
            catch (Exception) { d = null; }
        }
        if (d == null) return s;
        object v;
        if (d.TryGetValue("autostart", out v) && v is bool) s.Autostart = (bool)v;
        Dictionary<string, object> privacy = Child(d, "privacy");
        if (privacy != null && privacy.TryGetValue("hotkey", out v))
        {
            string combo = HotKey.Normalize(v as string);
            if (combo != null) s.Hotkey = combo;
        }
        Dictionary<string, object> top = Child(Child(d, "layout"), "topmost");
        if (top != null)
            foreach (string l in Layouts)
                if (top.TryGetValue(l, out v) && v is bool) s.topmost[l] = (bool)v;
        return s;
    }

    static Dictionary<string, object> Child(Dictionary<string, object> d, string key)
    {
        object v;
        return d != null && d.TryGetValue(key, out v) ? v as Dictionary<string, object> : null;
    }
}
