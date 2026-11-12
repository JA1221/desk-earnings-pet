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

    public static void Test_SetRepointsStalePath()
    {
        try
        {
            var a = new AutoStart(@"Software\QJZTest\Run");
            a.Set(true, @"C:\old\錢進中.exe");
            a.Set(true, @"D:\new\錢進中.exe");   // what the host does on every start while the setting is on
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Software\QJZTest\Run"))
                Assert.Eq("\"D:\\new\\錢進中.exe\"", k.GetValue("錢進中"), "points at the current exe");
        }
        finally { Registry.CurrentUser.DeleteSubKeyTree(@"Software\QJZTest", false); }
    }
}
