using System;
using System.IO;
using System.Text;

public static class TextStoreTests
{
    static string NewDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-ts-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    public static void Test_WriteThenRead_RoundTrips()
    {
        string dir = NewDir();
        try
        {
            var s = new TextStore(Path.Combine(dir, "a.json"));
            s.Write("{\"x\":\"錢進中\"}");
            Assert.Eq("{\"x\":\"錢進中\"}", s.Read(), "roundtrip");
            s.Write("second");
            Assert.Eq("second", s.Read(), "overwrite");
            Assert.True(!File.Exists(Path.Combine(dir, "a.json.tmp")), "no tmp left behind");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Read_Missing_ReturnsNull()
    {
        string dir = NewDir();
        try { Assert.True(new TextStore(Path.Combine(dir, "none.json")).Read() == null, "null expected"); }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Read_StripsUtf8Bom()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "bom.json");
            File.WriteAllText(p, "hello", new UTF8Encoding(true));
            Assert.Eq("hello", new TextStore(p).Read(), "bom stripped");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Write_NoBom()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "nb.json");
            new TextStore(p).Write("abc");
            Assert.Eq(3, File.ReadAllBytes(p).Length, "no BOM bytes");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_BackupCorrupt_CopiesFile()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "c.json");
            var s = new TextStore(p);
            s.Write("broken");
            string b = s.BackupCorrupt();
            Assert.True(b != null && File.Exists(b), "backup exists");
            Assert.True(Path.GetFileName(b).StartsWith("c.json.corrupt-"), "backup name");
            Assert.Eq("broken", File.ReadAllText(b), "backup content");
            Assert.True(File.Exists(p), "original kept");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_BackupCorrupt_MissingFile_ReturnsNull()
    {
        string dir = NewDir();
        try { Assert.True(new TextStore(Path.Combine(dir, "none.json")).BackupCorrupt() == null, "null expected"); }
        finally { Directory.Delete(dir, true); }
    }
}
