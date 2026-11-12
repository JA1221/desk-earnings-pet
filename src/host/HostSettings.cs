using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// The values in settings.json (written by the page) that the host needs before the page runs: autostart, the hide
// hotkey, topmost per layout, the capture guard (privacy.hideFromCapture) and the layout the page starts in. Like
// the page's sanitizer (src/web/js/core/settings.js), anything missing, invalid or unreadable gives the default:
// autostart on, Ctrl+Alt+H, topmost only for U7 and M3, capture guard on, start layout U1.
// The start layout is the one used last, as the page picks it (layouts.js lastLayout): M3 when layout.mini is true,
// else layout.current when it is a main layout, else U1. A 1.0 file has no layout.mini: there a layout.start of M3
// counts as mini (1.0's 開啟時的版型 = 迷你徽章); 1.0's layout.start is not read otherwise.
public class HostSettings
{
    public const string DefaultHotkey = "Ctrl+Alt+H";
    // Must stay in sync with the page's LAYOUTS list in src/web/js/core/settings.js (the web side is not shared).
    static readonly string[] Layouts = { "U1", "U3", "U5B", "U7", "M3" };
    // The main layouts (layouts.js MAIN): what layout.current may name.
    static readonly string[] MainLayouts = { "U1", "U3", "U5B", "U7" };
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

    // The page's first layout, the one used last (WindowPlacer.PrePlace puts the hidden window at its saved spot).
    public string StartLayout { get; private set; }

    // Canonical combo (HotKey.Normalize).
    public string Hotkey { get; private set; }

    // A copy the host can update from setTopmost.
    public Dictionary<string, bool> TopmostByLayout()
    {
        return new Dictionary<string, bool>(topmost);
    }

    // The settings text the host goes by: settings.json when it parses as an object, else settings.json.bak when that
    // does (the page does the same: a power cut can leave settings.json blank or zero-filled), else null (defaults).
    public static string Effective(string main, string bak)
    {
        if (JsonObject(main) != null) return main;
        if (JsonObject(bak) != null) return bak;
        return null;
    }

    // Whether the start may re-point the autostart Run value at this exe from the settings: from settings that parse
    // (settings.json, or its .bak: Effective), or on a first run (neither file exists, the defaults apply). Not when
    // settings.json exists but could not be read, nor when nothing parses: the defaults (autostart on) would re-add a
    // Run value the user had turned off. A missing settings.json beside a .bak is not a first run.
    public static bool SyncAutostart(string main, bool readFailed, string bak)
    {
        if (readFailed) return false;
        if (Effective(main, bak) != null) return true;
        return main == null && bak == null;
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
        if (layout != null && layout.TryGetValue("current", out v) && v is string && Array.IndexOf(MainLayouts, (string)v) >= 0) s.StartLayout = (string)v;
        if (layout != null)
        {
            if (layout.TryGetValue("mini", out v)) { if (v is bool && (bool)v) s.StartLayout = "M3"; }
            else if (layout.TryGetValue("start", out v) && v as string == "M3") s.StartLayout = "M3";   // a 1.0 file
        }
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
