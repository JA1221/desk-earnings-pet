using System;
using Microsoft.Win32;

public static class AutoStartTests
{
    public static void Test_SetOnAndOff()
    {
        try
        {
            var a = new AutoStart(@"Software\QJZTest\Run");
            string exe = @"C:\x\錢進中.exe";
            Assert.True(!a.IsEnabled(), "initially off");
            a.Set(true, exe);
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Software\QJZTest\Run"))
                Assert.Eq("\"" + exe + "\"", k.GetValue("錢進中"), "quoted value");
            Assert.True(a.IsEnabled(), "enabled");
            a.Set(false, exe);
            Assert.True(!a.IsEnabled(), "disabled");
            a.Set(false, exe); // idempotent
        }
        finally { Registry.CurrentUser.DeleteSubKeyTree(@"Software\QJZTest", false); }
    }
}
