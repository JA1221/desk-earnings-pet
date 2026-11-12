using System;

public static class HostSettingsTests
{
    // Topmost for one layout, as the host uses it (a copy it updates from setTopmost).
    static bool Top(HostSettings s, string layout)
    {
        bool on;
        return layout != null && s.TopmostByLayout().TryGetValue(layout, out on) && on;
    }

    public static void Test_DefaultsWithoutSettings()
    {
        foreach (string text in new[] { null, "", "   " })
        {
            HostSettings s = HostSettings.Parse(text);
            Assert.True(s.Autostart, "autostart defaults on");
            Assert.Eq("Ctrl+Alt+H", s.Hotkey, "default hotkey");
            Assert.True(Top(s, "U7") && Top(s, "M3"), "floating layouts default topmost");
            Assert.True(!Top(s, "U1") && !Top(s, "U3") && !Top(s, "U5B"), "main layouts default not topmost");
            Assert.True(!Top(s, "spike") && !Top(s, null), "unknown layout not topmost");
            Assert.True(s.CaptureGuard, "capture guard defaults on");
            Assert.Eq("U1", s.StartLayout, "start layout defaults to U1");
        }
    }

    public static void Test_ReadsConfiguredValues()
    {
        HostSettings s = HostSettings.Parse(
            "{\"autostart\":false,\"privacy\":{\"hideFromCapture\":true,\"hotkey\":\" ctrl + alt + j \"}," +
            "\"layout\":{\"start\":\"U7\",\"topmost\":{\"U1\":true,\"U7\":false}},\"salary\":{\"amount\":50000}}");
        Assert.True(!s.Autostart, "autostart off");
        Assert.Eq("Ctrl+Alt+J", s.Hotkey, "configured hotkey, normalized");
        Assert.True(Top(s, "U1"), "U1 configured topmost");
        Assert.True(!Top(s, "U7"), "U7 configured not topmost");
        Assert.True(Top(s, "M3"), "M3 keeps its default");
        Assert.True(!Top(s, "U3"), "U3 keeps its default");
        Assert.True(s.CaptureGuard, "hideFromCapture true");
        Assert.Eq("U7", s.StartLayout, "layout.start");
        Assert.Eq("M3", HostSettings.Parse("{\"layout\":{\"start\":\"M3\"}}").StartLayout, "M3 may be the start layout");
        Assert.True(!HostSettings.Parse("{\"privacy\":{\"hideFromCapture\":false}}").CaptureGuard, "hideFromCapture false turns the guard off");
    }

    public static void Test_InvalidHotkeyFallsBackToDefault()
    {
        string[] bad = { "{\"privacy\":{\"hotkey\":\"Shift+H\"}}", "{\"privacy\":{\"hotkey\":5}}", "{\"privacy\":{\"hotkey\":\"\"}}",
                         "{\"privacy\":{\"hotkey\":\"Ctrl+Alt+Foo\"}}", "{\"privacy\":\"Ctrl+Alt+J\"}" };
        foreach (string text in bad) Assert.Eq("Ctrl+Alt+H", HostSettings.Parse(text).Hotkey, "fallback for " + text);
    }

    public static void Test_CorruptOrWrongTypesGiveDefaults()
    {
        string[] bad = { "{not json", "[]", "42", "\"x\"", "null",
                         "{\"autostart\":\"false\",\"layout\":{\"topmost\":{\"U1\":\"yes\",\"U7\":0}},\"privacy\":null}",
                         "{\"layout\":{\"topmost\":[true,true]}}", "{\"privacy\":{\"hideFromCapture\":\"false\"}}",
                         "{\"privacy\":{\"hideFromCapture\":0}}", "{\"layout\":{\"start\":\"PANEL\"}}", "{\"layout\":{\"start\":7}}" };
        foreach (string text in bad)
        {
            HostSettings s = HostSettings.Parse(text);
            Assert.True(s.Autostart, "autostart default for " + text);
            Assert.Eq("Ctrl+Alt+H", s.Hotkey, "hotkey default for " + text);
            Assert.True(!Top(s, "U1") && Top(s, "U7"), "topmost defaults for " + text);
            Assert.True(s.CaptureGuard, "capture guard default for " + text);
            Assert.Eq("U1", s.StartLayout, "start layout default for " + text);
        }
    }

    // M2: the Run value is re-pointed at start only from settings the host could read and parse (or on a first run,
    // without settings.json). Corrupt settings give defaults (autostart on), which must not re-add a Run value the
    // user turned off.
    public static void Test_AutostartSelfHealOnlyFromParsedSettings()
    {
        Assert.True(HostSettings.SyncAutostart(null, false), "first run (no settings.json): defaults apply");
        Assert.True(HostSettings.SyncAutostart("{\"autostart\":false}", false), "parsed settings");
        Assert.True(HostSettings.SyncAutostart("{}", false), "an empty object parses (autostart defaults on)");
        string[] corrupt = { "", "   ", "\0\0\0", "{bad", "[]", "42", "null", "\"x\"" };
        foreach (string text in corrupt)
            Assert.True(!HostSettings.SyncAutostart(text, false), "settings that exist but do not parse: <" + text + ">");
        Assert.True(!HostSettings.SyncAutostart(null, true), "settings.json exists but could not be read");
        Assert.True(!HostSettings.SyncAutostart("{\"autostart\":true}", true), "read failure wins");
    }
}
