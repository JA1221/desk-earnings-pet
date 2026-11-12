using System;

public static class HostSettingsTests
{
    public static void Test_DefaultsWithoutSettings()
    {
        foreach (string text in new[] { null, "", "   " })
        {
            HostSettings s = HostSettings.Parse(text);
            Assert.True(s.Autostart, "autostart defaults on");
            Assert.Eq("Ctrl+Alt+H", s.Hotkey, "default hotkey");
            Assert.True(s.Topmost("U7") && s.Topmost("M3"), "floating layouts default topmost");
            Assert.True(!s.Topmost("U1") && !s.Topmost("U3") && !s.Topmost("U5B"), "main layouts default not topmost");
            Assert.True(!s.Topmost("spike") && !s.Topmost(null), "unknown layout not topmost");
        }
    }

    public static void Test_ReadsConfiguredValues()
    {
        HostSettings s = HostSettings.Parse(
            "{\"autostart\":false,\"privacy\":{\"hideFromCapture\":true,\"hotkey\":\" ctrl + alt + j \"}," +
            "\"layout\":{\"start\":\"U7\",\"topmost\":{\"U1\":true,\"U7\":false}},\"salary\":{\"amount\":50000}}");
        Assert.True(!s.Autostart, "autostart off");
        Assert.Eq("Ctrl+Alt+J", s.Hotkey, "configured hotkey, normalized");
        Assert.True(s.Topmost("U1"), "U1 configured topmost");
        Assert.True(!s.Topmost("U7"), "U7 configured not topmost");
        Assert.True(s.Topmost("M3"), "M3 keeps its default");
        Assert.True(!s.Topmost("U3"), "U3 keeps its default");
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
                         "{\"layout\":{\"topmost\":[true,true]}}" };
        foreach (string text in bad)
        {
            HostSettings s = HostSettings.Parse(text);
            Assert.True(s.Autostart, "autostart default for " + text);
            Assert.Eq("Ctrl+Alt+H", s.Hotkey, "hotkey default for " + text);
            Assert.True(!s.Topmost("U1") && s.Topmost("U7"), "topmost defaults for " + text);
        }
    }
}
