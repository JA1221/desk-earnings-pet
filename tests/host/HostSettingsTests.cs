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

    // #12: the app starts in the layout used last: layout.current (the last main layout), or M3 when it was left as the
    // mini badge (layout.mini). layout.start (1.0's start picker) is no longer read; old files keep it unused.
    public static void Test_StartsInTheLastUsedLayout()
    {
        Assert.Eq("U3", HostSettings.Parse("{\"layout\":{\"start\":\"U7\",\"current\":\"U3\"}}").StartLayout, "an old 1.0 file: current, not start");
        Assert.Eq("U5B", HostSettings.Parse("{\"layout\":{\"current\":\"U5B\",\"mini\":false}}").StartLayout, "a main layout");
        Assert.Eq("M3", HostSettings.Parse("{\"layout\":{\"current\":\"U7\",\"mini\":true}}").StartLayout, "left as the mini badge");
        Assert.Eq("U1", HostSettings.Parse("{\"layout\":{\"start\":\"U7\"}}").StartLayout, "no current: U1 (the first run's layout)");
        Assert.Eq("U1", HostSettings.Parse("{\"layout\":{\"current\":\"M3\"}}").StartLayout, "a hand-edited M3 in current would loop: U1, as the page does");
        Assert.Eq("U7", HostSettings.Parse("{\"layout\":{\"current\":\"U7\",\"mini\":\"yes\"}}").StartLayout, "mini must be a boolean");
    }

    // Review M-2: a 1.0 file whose start layout was M3 (開啟時的版型 = 迷你徽章) and that has no layout.mini yet opens in M3,
    // as the page reads it (settings.js). A layout.mini that is there wins.
    public static void Test_A10StartLayoutOfM3StillOpensTheMiniBadge()
    {
        Assert.Eq("M3", HostSettings.Parse("{\"layout\":{\"start\":\"M3\",\"current\":\"U3\"}}").StartLayout, "start M3, no mini");
        Assert.Eq("M3", HostSettings.Parse("{\"layout\":{\"start\":\"M3\"}}").StartLayout, "start M3 alone");
        Assert.Eq("U3", HostSettings.Parse("{\"layout\":{\"start\":\"M3\",\"current\":\"U3\",\"mini\":false}}").StartLayout, "a saved mini wins");
        Assert.Eq("U1", HostSettings.Parse("{\"layout\":{\"start\":\"M3\",\"mini\":\"yes\"}}").StartLayout, "a mini that is there but not a boolean: not mini");
        Assert.Eq("U3", HostSettings.Parse("{\"layout\":{\"start\":\"U7\",\"current\":\"U3\"}}").StartLayout, "another start layout: the last used one");
    }

    // 1.1's layouts (§5.7): U10 (the top capsule) floats on top like U7 and M3; U12 and U13 are main windows like U1.
    // Each one is a last used layout the host starts, pre-places and rescues in (Ruling M5).
    public static void Test_NewLayoutsAndTheirTopmost()
    {
        HostSettings d = HostSettings.Parse(null);
        Assert.True(Top(d, "U10"), "U10 topmost by default");
        Assert.True(!Top(d, "U12") && !Top(d, "U13"), "U12 and U13 not topmost by default");
        Assert.Eq("U12", HostSettings.Parse("{\"layout\":{\"current\":\"U12\"}}").StartLayout, "U12 as the last used layout");
        Assert.Eq("U10", HostSettings.Parse("{\"layout\":{\"current\":\"U10\"}}").StartLayout, "U10 as the last used layout");
        Assert.Eq("U13", HostSettings.Parse("{\"layout\":{\"current\":\"U13\"}}").StartLayout, "U13 as the last used layout");
        Assert.Eq("M3", HostSettings.Parse("{\"layout\":{\"current\":\"U13\",\"mini\":true}}").StartLayout, "left as the mini badge");
        Assert.Eq("U1", HostSettings.Parse("{\"layout\":{\"current\":\"U99\"}}").StartLayout, "an unknown layout: U1");
        HostSettings s = HostSettings.Parse("{\"layout\":{\"topmost\":{\"U10\":false,\"U12\":true,\"U13\":\"yes\"}}}");
        Assert.True(!Top(s, "U10") && Top(s, "U12"), "a saved topmost for the new layouts is read");
        Assert.True(!Top(s, "U13"), "a non-boolean keeps the default");
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
        Assert.Eq("U1", s.StartLayout, "layout.start is not read any more (#12): no last used layout here");
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
                         "{\"privacy\":{\"hideFromCapture\":0}}", "{\"layout\":{\"start\":\"PANEL\"}}", "{\"layout\":{\"start\":7}}",
                         "{\"layout\":{\"current\":\"PANEL\"}}", "{\"layout\":{\"current\":7,\"mini\":1}}", "{\"layout\":\"U3\"}" };
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
        Assert.True(HostSettings.SyncAutostart(null, false, null), "first run (no settings.json, no .bak): defaults apply");
        Assert.True(HostSettings.SyncAutostart("{\"autostart\":false}", false, null), "parsed settings");
        Assert.True(HostSettings.SyncAutostart("{}", false, null), "an empty object parses (autostart defaults on)");
        string[] corrupt = { "", "   ", "\0\0\0", "{bad", "[]", "42", "null", "\"x\"" };
        foreach (string text in corrupt)
        {
            Assert.True(!HostSettings.SyncAutostart(text, false, null), "settings that exist but do not parse, no .bak: <" + text + ">");
            Assert.True(!HostSettings.SyncAutostart(text, false, "{bad"), "nor a .bak that parses: <" + text + ">");
            Assert.True(HostSettings.SyncAutostart(text, false, "{\"autostart\":false}"), "the .bak parses: its settings count: <" + text + ">");
        }
        Assert.True(!HostSettings.SyncAutostart(null, true, null), "settings.json exists but could not be read");
        Assert.True(!HostSettings.SyncAutostart("{\"autostart\":true}", true, null), "read failure wins");
        Assert.True(!HostSettings.SyncAutostart(null, true, "{\"autostart\":true}"), "read failure wins over a .bak too");
        Assert.True(HostSettings.SyncAutostart(null, false, "{\"autostart\":false}"), "settings.json gone but its .bak is there: not a first run, the .bak counts");
        Assert.True(!HostSettings.SyncAutostart(null, false, "   "), "settings.json gone and a blank .bak: not a first run either");
    }

    // The host's own reading of settings (hotkey, capture guard, topmost, start layout, autostart) falls back to
    // settings.json.bak like the page does when the main text is blank or does not parse.
    public static void Test_EffectiveSettingsFallBackToTheBak()
    {
        string good = "{\"autostart\":false,\"privacy\":{\"hotkey\":\"Ctrl+Alt+J\"}}";
        string bak = "{\"autostart\":false,\"privacy\":{\"hotkey\":\"Ctrl+Alt+K\"}}";
        Assert.Eq(good, HostSettings.Effective(good, bak), "the main text when it parses");
        foreach (string main in new[] { null, "", "  \n", "\0\0", "{bad", "[]" })
            Assert.Eq(bak, HostSettings.Effective(main, bak), "the .bak for <" + main + ">");
        Assert.True(HostSettings.Effective("{bad", "{worse") == null, "neither parses: null (defaults)");
        Assert.True(HostSettings.Effective(null, null) == null, "nothing at all");
        Assert.Eq("Ctrl+Alt+K", HostSettings.Parse(HostSettings.Effective("", bak)).Hotkey, "settings read from the .bak");
        Assert.True(!HostSettings.Parse(HostSettings.Effective("", bak)).Autostart, "autostart from the .bak");
    }
}
