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

    public static void Test_Write_KeepsThePreviousVersionAsBak()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "h.json");
            var s = new TextStore(p);
            s.Write("one");
            Assert.True(!File.Exists(p + ".bak"), "a first write has nothing to back up");
            s.Write("two");
            Assert.Eq("one", File.ReadAllText(p + ".bak"), "the previous version is the .bak");
            Assert.Eq("one", s.ReadBackup(), "ReadBackup reads it");
            s.Write("three");
            Assert.Eq("three", s.Read(), "newest text in the file");
            Assert.Eq("two", s.ReadBackup(), "the .bak moves on with every write");
            Assert.True(!File.Exists(p + ".tmp"), "no tmp left behind");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_ReadBackup_MissingIsNull()
    {
        string dir = NewDir();
        try { Assert.True(new TextStore(Path.Combine(dir, "x.json")).ReadBackup() == null, "no .bak -> null"); }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Write_WithoutBackupKeepsNoBak()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "session.json");
            var s = new TextStore(p, false);
            s.Write("a");
            s.Write("b");
            Assert.Eq("b", s.Read(), "written");
            Assert.True(!File.Exists(p + ".bak"), "no .bak for a store without backups");
            Assert.True(!File.Exists(p + ".tmp"), "no tmp left behind");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Write_SavesEvenWhenTheBakCannotBeReplaced()
    {
        string dir = NewDir();
        string bak = null;
        try
        {
            string p = Path.Combine(dir, "s.json");
            bak = p + ".bak";
            var s = new TextStore(p);
            s.Write("one");
            s.Write("two");
            File.SetAttributes(bak, FileAttributes.ReadOnly);   // a .bak someone made read-only
            s.Write("three");
            Assert.Eq("three", s.Read(), "the newest text is saved without a fresh backup");
            Assert.True(!File.Exists(p + ".tmp"), "no tmp left behind");
        }
        finally
        {
            if (bak != null && File.Exists(bak)) File.SetAttributes(bak, FileAttributes.Normal);
            Directory.Delete(dir, true);
        }
    }

    // After the page reports the file corrupt (backupCorrupt), the next write does not make the corrupt text the .bak:
    // the .bak keeps the last good version the page may have just restored from.
    public static void Test_Write_AfterBackupCorruptKeepsTheGoodBak()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "history.json");
            var s = new TextStore(p);
            s.Write("good");
            s.Write("\0\0\0\0");   // stands in for a file zero-filled by a power cut
            Assert.Eq("good", s.ReadBackup(), "the good version is the .bak");
            Assert.True(s.BackupCorrupt() != null, "corrupt copy made");
            s.Write("restored");
            Assert.Eq("restored", s.Read(), "written");
            Assert.Eq("good", s.ReadBackup(), "the corrupt text did not replace the good .bak");
            s.Write("next");
            Assert.Eq("restored", s.ReadBackup(), "later writes rotate the .bak again");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_Write_LockedTargetThrowsAndKeepsTheOldText()
    {
        string dir = NewDir();
        try
        {
            string p = Path.Combine(dir, "l.json");
            var s = new TextStore(p);
            s.Write("first");
            s.Write("second");
            bool threw = false;
            using (new FileStream(p, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                try { s.Write("new"); }
                catch (IOException) { threw = true; }
                catch (UnauthorizedAccessException) { threw = true; }
            }
            Assert.True(threw, "a locked file is reported to the caller (SavedText retries)");
            Assert.Eq("second", s.Read(), "the file keeps its text");
            Assert.Eq("first", s.ReadBackup(), "and the .bak its own");
        }
        finally { Directory.Delete(dir, true); }
    }
}
