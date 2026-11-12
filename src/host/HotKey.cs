using System;

// The global hide/show hotkey. A combo is one or more modifiers, at least one of them Ctrl, Alt or Win (so
// plain typing is never swallowed), plus one key, joined by '+': "Ctrl+Alt+H". Modifiers: Ctrl (or Control),
// Alt, Shift, Win. Keys: A-Z, 0-9, F1-F24, Space, PageUp, PageDown, End, Home, Left, Up, Right, Down, Insert,
// Delete. Case and spaces do not matter. The registered window receives WM_HOTKEY with wParam == Id.
public static class HotKey
{
    public const int Id = 0x5148;
    public const int MOD_ALT = 0x1;
    public const int MOD_CONTROL = 0x2;
    public const int MOD_SHIFT = 0x4;
    public const int MOD_WIN = 0x8;
    const int MOD_NOREPEAT = 0x4000;   // holding the keys does not repeat the toggle

    static readonly string[] NamedKeys = { "Space", "PageUp", "PageDown", "End", "Home", "Left", "Up", "Right", "Down", "Insert", "Delete" };
    static readonly int[] NamedVks = { 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E };

    // Replaces this window's hotkey with combo. False when combo is invalid or already taken by another program
    // (then this window has no hotkey).
    public static bool Register(IntPtr hwnd, string combo)
    {
        Unregister(hwnd);
        int mods, vk;
        if (!TryParse(combo, out mods, out vk)) return false;
        return Native.RegisterHotKey(hwnd, Id, mods | MOD_NOREPEAT, vk);
    }

    public static void Unregister(IntPtr hwnd)
    {
        Native.UnregisterHotKey(hwnd, Id);
    }

    public static bool TryParse(string combo, out int modifiers, out int vk)
    {
        string key;
        return Parse(combo, out modifiers, out vk, out key);
    }

    // Canonical spelling ("Ctrl+Alt+H", modifiers in the order Ctrl, Alt, Shift, Win); null when invalid.
    public static string Normalize(string combo)
    {
        int mods, vk;
        string key;
        if (!Parse(combo, out mods, out vk, out key)) return null;
        string s = "";
        if ((mods & MOD_CONTROL) != 0) s += "Ctrl+";
        if ((mods & MOD_ALT) != 0) s += "Alt+";
        if ((mods & MOD_SHIFT) != 0) s += "Shift+";
        if ((mods & MOD_WIN) != 0) s += "Win+";
        return s + key;
    }

    static bool Parse(string combo, out int modifiers, out int vk, out string key)
    {
        modifiers = 0;
        vk = 0;
        key = null;
        if (combo == null) return false;
        foreach (string raw in combo.Split('+'))
        {
            string t = raw.Trim();
            int mod = Modifier(t);
            if (mod != 0)
            {
                if ((modifiers & mod) != 0) return false;   // repeated modifier
                modifiers |= mod;
                continue;
            }
            if (key != null) return false;                  // a second key
            if (!Key(t, out vk, out key)) return false;
        }
        return key != null && (modifiers & (MOD_CONTROL | MOD_ALT | MOD_WIN)) != 0;
    }

    static int Modifier(string t)
    {
        if (Is(t, "Ctrl") || Is(t, "Control")) return MOD_CONTROL;
        if (Is(t, "Alt")) return MOD_ALT;
        if (Is(t, "Shift")) return MOD_SHIFT;
        if (Is(t, "Win")) return MOD_WIN;
        return 0;
    }

    static bool Key(string t, out int vk, out string name)
    {
        vk = 0;
        name = null;
        if (t.Length == 1)
        {
            char c = char.ToUpperInvariant(t[0]);
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) { vk = c; name = c.ToString(); return true; }
            return false;
        }
        if (t.Length >= 2 && t.Length <= 3 && (t[0] == 'F' || t[0] == 'f'))
        {
            int n;
            if (int.TryParse(t.Substring(1), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out n)
                && n >= 1 && n <= 24 && t.Substring(1) == n.ToString(System.Globalization.CultureInfo.InvariantCulture))
            {
                vk = 0x70 + n - 1;
                name = "F" + n;
                return true;
            }
            return false;
        }
        for (int i = 0; i < NamedKeys.Length; i++)
            if (Is(t, NamedKeys[i])) { vk = NamedVks[i]; name = NamedKeys[i]; return true; }
        return false;
    }

    static bool Is(string a, string b)
    {
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
    }
}
