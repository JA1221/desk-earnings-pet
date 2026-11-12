using System;
using System.Collections.Generic;
using System.IO;

public static class SavedTextTests
{
    static string NewDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-st-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    static FileStream Lock(string path)
    {
        return new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
    }

    public static void Test_LoadAndSave()
    {
        string dir = NewDir();
        try
        {
            string path = Path.Combine(dir, "settings.json");
            var errors = new List<Exception>();
            var s = new SavedText(new TextStore(path), delegate(string what, Exception ex) { errors.Add(ex); });
            Assert.True(s.Load() == null, "missing file -> null");
            Assert.True(s.Save("a"), "saved");
            Assert.Eq("a", File.ReadAllText(path), "on disk");
            Assert.Eq("a", s.Text, "newest text");
            Assert.True(!s.Pending, "nothing pending");
            var t = new SavedText(new TextStore(path), delegate(string what, Exception ex) { errors.Add(ex); });
            Assert.Eq("a", t.Load(), "load reads the file");
            Assert.Eq("a", t.Text, "loaded text is the newest text");
            Assert.Eq(0, errors.Count, "no errors");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_LockedFileKeepsNewestAndRetries()
    {
        string dir = NewDir();
        try
        {
            string path = Path.Combine(dir, "history.json");
            File.WriteAllText(path, "old");
            var errors = new List<Exception>();
            var s = new SavedText(new TextStore(path), delegate(string what, Exception ex) { errors.Add(ex); });
            Assert.Eq("old", s.Load(), "loaded");
            using (Lock(path))
            {
                Assert.True(!s.Save("new1"), "write fails while locked");
                Assert.True(s.Pending, "pending");
                Assert.True(!s.Save("new2"), "still locked");
                Assert.Eq("new2", s.Text, "newest text kept in memory");
                Assert.True(!s.Flush(), "retry fails while locked");
            }
            Assert.True(errors.Count >= 1, "failures reported, not thrown");
            Assert.True(s.Flush(), "retry succeeds after unlock");
            Assert.True(!s.Pending, "nothing pending");
            Assert.Eq("new2", File.ReadAllText(path), "newest text on disk");
            Assert.True(s.Flush(), "flush with nothing pending is a no-op");
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_UnreadableFileIsNeverOverwritten()
    {
        string dir = NewDir();
        try
        {
            string path = Path.Combine(dir, "settings.json");
            File.WriteAllText(path, "user data");
            var errors = new List<Exception>();
            var s = new SavedText(new TextStore(path), delegate(string what, Exception ex) { errors.Add(ex); });
            using (Lock(path))
            {
                Assert.True(s.Load() == null, "unreadable -> null");
            }
            Assert.True(s.ReadFailed, "read failure remembered");
            Assert.True(errors.Count >= 1, "read failure reported");
            Assert.True(!s.Save("defaults"), "write refused");
            Assert.Eq("defaults", s.Text, "page text kept in memory");
            Assert.True(!s.Flush(), "still refused");
            Assert.Eq("user data", File.ReadAllText(path), "file we could not read is untouched");
        }
        finally { Directory.Delete(dir, true); }
    }
}
