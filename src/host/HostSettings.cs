using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// The values in settings.json (written by the page) that the host needs before the page runs: autostart, the hide
// hotkey, topmost per layout, the capture guard (privacy.hideFromCapture) and the layout the page starts in. Like
// the page's sanitizer (src/web/js/core/settings.js), anything missing, invalid or unreadable gives the default:
// autostart on, Ctrl+Alt+H, topmost only for U7 and M3, capture guard on, start layout U1.
public class HostSettings
{
    public const string DefaultHotkey = "Ctrl+Alt+H";
    // Must stay in sync with the page's LAYOUTS list in src/web/js/core/settings.js (the web side is not shared).
    static readonly string[] Layouts = { "U1", "U3", "U5B", "U7", "M3" };
    readonly Dictionary<string, bool> topmost = new Dictionary<string, bool>();

    HostSettings()
    {
        Autostart = true;
        Hotkey = DefaultHotkey;
        CaptureGuard = true;
        StartLayout = "U1";
        foreach (string l in Layouts) topmost[l] = l == "U7" || l == "M3";
    }

    public bool Autostart { get; private set; }

    // privacy.hideFromCapture: keep the window out of screen captures and sharing.
    public bool CaptureGuard { get; private set; }

    // layout.start: the page's first layout (WindowPlacer.PrePlace puts the hidden window at its saved spot).
    public string StartLayout { get; private set; }

    // Canonical combo (HotKey.Normalize).
    public string Hotkey { get; private set; }

    // A copy the host can update from setTopmost.
    public Dictionary<string, bool> TopmostByLayout()
    {
        return new Dictionary<string, bool>(topmost);
    }

    // Whether the start may re-point the autostart Run value at this exe from the settings: on a first run (no
    // settings.json, the defaults apply) or from settings that parse. Not when settings.json exists but could not be
    // read, or does not parse: its defaults (autostart on) would re-add a Run value the user had turned off.
    public static bool SyncAutostart(string settingsJson, bool readFailed)
    {
        if (readFailed) return false;
        return settingsJson == null || JsonObject(settingsJson) != null;
    }

    public static HostSettings Parse(string settingsJson)
    {
        var s = new HostSettings();
        Dictionary<string, object> d = JsonObject(settingsJson);
        if (d == null) return s;
        object v;
        if (d.TryGetValue("autostart", out v) && v is bool) s.Autostart = (bool)v;
        Dictionary<string, object> privacy = Child(d, "privacy");
        if (privacy != null && privacy.TryGetValue("hotkey", out v))
        {
            string combo = HotKey.Normalize(v as string);
            if (combo != null) s.Hotkey = combo;
        }
        if (privacy != null && privacy.TryGetValue("hideFromCapture", out v) && v is bool) s.CaptureGuard = (bool)v;
        Dictionary<string, object> layout = Child(d, "layout");
        if (layout != null && layout.TryGetValue("start", out v) && v is string && Array.IndexOf(Layouts, (string)v) >= 0) s.StartLayout = (string)v;
        Dictionary<string, object> top = Child(layout, "topmost");
        if (top != null)
            foreach (string l in Layouts)
                if (top.TryGetValue(l, out v) && v is bool) s.topmost[l] = (bool)v;
        return s;
    }

    // The settings text as a JSON object, or null (empty, not JSON, or JSON that is not an object).
    static Dictionary<string, object> JsonObject(string settingsJson)
    {
        if (string.IsNullOrEmpty(settingsJson)) return null;
        try { return new JavaScriptSerializer().DeserializeObject(settingsJson) as Dictionary<string, object>; }
        catch (Exception) { return null; }
    }

    static Dictionary<string, object> Child(Dictionary<string, object> d, string key)
    {
        object v;
        return d != null && d.TryGetValue(key, out v) ? v as Dictionary<string, object> : null;
    }
}
