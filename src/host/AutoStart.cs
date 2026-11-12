using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Microsoft.Win32;

// HKCU Run-key autostart; no admin rights needed.
public class AutoStart
{
    const string ValueName = "錢進中";
    readonly string runKeyPath;

    public AutoStart(string runKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run")
    {
        this.runKeyPath = runKeyPath;
    }

    public bool IsEnabled()
    {
        using (RegistryKey k = Registry.CurrentUser.OpenSubKey(runKeyPath))
        {
            return k != null && k.GetValue(ValueName) != null;
        }
    }

    // The "autostart" setting in settings.json text; like the page's sanitizer, anything but a JSON bool
    // (no file, corrupt text, missing field) means the default, on.
    public static bool SettingOn(string settingsJson)
    {
        if (string.IsNullOrEmpty(settingsJson)) return true;
        try
        {
            var d = new JavaScriptSerializer().DeserializeObject(settingsJson) as Dictionary<string, object>;
            object v;
            if (d != null && d.TryGetValue("autostart", out v) && v is bool) return (bool)v;
        }
        catch (Exception) { }
        return true;
    }

    public void Set(bool on, string exePath)
    {
        if (on)
        {
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey(runKeyPath))
                k.SetValue(ValueName, "\"" + exePath + "\"", RegistryValueKind.String);
        }
        else
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(runKeyPath, true))
            {
                if (k != null) k.DeleteValue(ValueName, false);
            }
        }
    }
}
