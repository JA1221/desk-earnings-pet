using System;
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
