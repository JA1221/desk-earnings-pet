using System;
using System.IO;

public static class ExitStampTests
{
    static string NewDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-es-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    public static void Test_FormatAndParseRoundTrip()
    {
        Assert.Eq("{\"lastExitMs\":1762934400123}", ExitStamp.Format(1762934400123L), "JSON object with the epoch ms");
        Assert.Eq((long?)1762934400123L, ExitStamp.Parse(ExitStamp.Format(1762934400123L)), "round trip");
        Assert.Eq((long?)5L, ExitStamp.Parse("{\"lastExitMs\":5,\"other\":true}"), "other keys are ignored");
    }

    public static void Test_ParseRefusesAnythingElse()
    {
        string[] bad = { null, "", "   ", "{bad", "[]", "42", "null", "{}", "{\"lastExitMs\":null}", "{\"lastExitMs\":\"1762934400123\"}",
            "{\"lastExitMs\":true}", "{\"lastExitMs\":-1}", "{\"lastExitMs\":0}", "{\"lastExitMs\":1.5}", "{\"lastExitMs\":1e300}" };
        foreach (string text in bad) Assert.True(ExitStamp.Parse(text) == null, "null for <" + text + ">");
    }

    public static void Test_WriteThenReadAndNoBak()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "session.json");
            var s = new ExitStamp(p);
            Assert.True(s.Read() == null, "no file yet -> null");
            s.Write(1000L);
            s.Write(2000L);
            Assert.Eq((long?)2000L, s.Read(), "the newest exit time");
            Assert.Eq(ExitStamp.Format(2000L), File.ReadAllText(p), "on disk");
            Assert.True(!File.Exists(p + ".bak") && !File.Exists(p + ".tmp"), "no .bak, no tmp");
        }
        finally { Directory.Delete(dir, true); }
    }

    // Read once at start, then consumed: a later abnormal end (a crash, a kill, power loss) leaves no stale exit time
    // for the next start to apply.
    public static void Test_ClearConsumesTheExitTime()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "session.json");
            var s = new ExitStamp(p);
            s.Clear();
            Assert.True(!File.Exists(p), "nothing to clear: no file is made");
            s.Write(1794470182499L);
            Assert.Eq((long?)1794470182499L, s.Read(), "recorded");
            s.Clear();
            Assert.True(s.Read() == null, "consumed");
            Assert.Eq("{\"lastExitMs\":null}", File.ReadAllText(p), "on disk, flushed through TextStore");
            Assert.True(!File.Exists(p + ".bak") && !File.Exists(p + ".tmp"), "no .bak, no tmp");
            s.Write(1794470190302L);
            Assert.Eq((long?)1794470190302L, s.Read(), "the next exit is recorded as before");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_ReadOfABrokenOrLockedFileIsNull()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "session.json");
            File.WriteAllText(p, "\0\0\0\0");
            Assert.True(new ExitStamp(p).Read() == null, "garbage -> null");
            File.WriteAllText(p, ExitStamp.Format(7L));
            using (new FileStream(p, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
                Assert.True(new ExitStamp(p).Read() == null, "unreadable -> null, never throws");
        }
        finally { Directory.Delete(dir, true); }
    }
}
