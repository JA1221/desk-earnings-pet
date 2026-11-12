using System;

public static class HotKeyTests
{
    static void Ok(string combo, int mods, int vk)
    {
        int m, k;
        Assert.True(HotKey.TryParse(combo, out m, out k), "should parse: " + combo);
        Assert.Eq(mods, m, "modifiers of " + combo);
        Assert.Eq(vk, k, "key of " + combo);
    }

    public static void Test_ParseDefault()
    {
        Ok("Ctrl+Alt+H", HotKey.MOD_CONTROL | HotKey.MOD_ALT, 0x48);
    }

    public static void Test_ParseIsCaseAndSpaceInsensitive()
    {
        Ok(" ctrl + ALT + h ", HotKey.MOD_CONTROL | HotKey.MOD_ALT, 0x48);
        Ok("Control+Shift+F5", HotKey.MOD_CONTROL | HotKey.MOD_SHIFT, 0x74);
        Ok("Win+Alt+1", HotKey.MOD_WIN | HotKey.MOD_ALT, 0x31);
        Ok("Alt+Shift+Space", HotKey.MOD_ALT | HotKey.MOD_SHIFT, 0x20);
        Ok("Ctrl+Alt+PageDown", HotKey.MOD_CONTROL | HotKey.MOD_ALT, 0x22);
        Ok("Ctrl+F24", HotKey.MOD_CONTROL, 0x87);
        Ok("Shift+Ctrl+Z", HotKey.MOD_CONTROL | HotKey.MOD_SHIFT, 0x5A);
    }

    public static void Test_ParseRejects()
    {
        string[] bad = { null, "", "   ", "H", "Shift+H", "Ctrl+Alt", "Ctrl+Ctrl+H", "Ctrl+Alt+H+J", "Ctrl+Alt+Foo",
                         "Ctrl+Alt+F25", "Ctrl+Alt+F0", "Ctrl++H", "Ctrl+Alt+ß", "Alt+Ｈ", "Ctrl+Alt+HH" };
        foreach (string s in bad)
        {
            int m, k;
            Assert.True(!HotKey.TryParse(s, out m, out k), "should be rejected: " + (s ?? "<null>"));
        }
    }

    public static void Test_FailureReason()
    {
        Assert.Eq("invalid", HotKey.FailureReason(HotKey.InvalidCombo), "unparseable combo");
        Assert.Eq("taken", HotKey.FailureReason(1409), "ERROR_HOTKEY_ALREADY_REGISTERED");
        Assert.Eq("error", HotKey.FailureReason(5), "any other Win32 error");
        Assert.Eq("error", HotKey.FailureReason(0), "failed without an error code");
    }

    public static void Test_RegisterInvalidComboReportsInvalid()
    {
        Assert.Eq(HotKey.InvalidCombo, HotKey.TryRegister(IntPtr.Zero, "Shift+H"), "invalid combo is not registered");
        Assert.Eq(HotKey.InvalidCombo, HotKey.TryRegister(IntPtr.Zero, null), "null combo");
    }

    public static void Test_Normalize()
    {
        Assert.Eq("Ctrl+Alt+H", HotKey.Normalize(" ctrl + alt + h "), "default");
        Assert.Eq("Ctrl+Shift+F5", HotKey.Normalize("shift+control+f5"), "order Ctrl Alt Shift Win");
        Assert.Eq("Alt+Win+1", HotKey.Normalize("win+alt+1"), "digit");
        Assert.Eq("Ctrl+Alt+PageDown", HotKey.Normalize("ctrl+alt+pagedown"), "named key");
        Assert.True(HotKey.Normalize("Shift+H") == null, "invalid -> null");
    }
}
