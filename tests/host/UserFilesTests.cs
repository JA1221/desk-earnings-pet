using System;
using System.Collections.Generic;
using System.IO;

public static class UserFilesTests
{
    static string NewDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-uf-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    static FileStream Lock(string path)
    {
        return new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
    }

    public static void Test_LoadSaveAndUnreadableList()
    {
        string dir = NewDir();
        try
        {
            File.WriteAllText(Path.Combine(dir, "settings.json"), "user settings");
            var errors = new List<string>();
            using (var f = new UserFiles(dir, delegate(string what, Exception ex) { errors.Add(what); }))
            {
                using (Lock(Path.Combine(dir, "settings.json"))) f.LoadAll();
                Assert.True(f.Settings.Text == null && f.History.Text == null, "unreadable and missing both load as null");
                Assert.Eq("settings", string.Join(",", f.Unreadable.ToArray()), "settings reported unreadable, a missing file is not");
                Assert.True(errors.Count == 1 && errors[0].StartsWith("settings.json"), "logged with the file name");
                f.Save(f.Settings, "defaults from the page");
                Assert.True(!f.RetryArmed, "no pointless retry for a file that is never overwritten");
                Assert.Eq("user settings", File.ReadAllText(Path.Combine(dir, "settings.json")), "user data untouched");
                f.Save(f.History, "h1");
                Assert.Eq("h1", File.ReadAllText(Path.Combine(dir, "history.json")), "a normal file is written");
            }
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_LockedWriteArmsRetry()
    {
        string dir = NewDir();
        try
        {
            string path = Path.Combine(dir, "history.json");
            File.WriteAllText(path, "old");
            using (var f = new UserFiles(dir, null))
            {
                f.LoadAll();
                using (Lock(path))
                {
                    f.Save(f.History, "new");
                    Assert.True(f.RetryArmed, "retry armed while the write is pending");
                }
                Assert.True(f.FlushAll(), "flushed after unlock");
                Assert.True(!f.RetryArmed, "retry disarmed");
                Assert.Eq("new", File.ReadAllText(path), "newest text on disk");
            }
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_BackupCorrupt()
    {
        string dir = NewDir();
        try
        {
            File.WriteAllText(Path.Combine(dir, "history.json"), "broken{");
            using (var f = new UserFiles(dir, null))
            {
                f.BackupCorrupt("history");
                f.BackupCorrupt("window");     // not a page file: ignored
                f.BackupCorrupt("settings");   // missing: nothing to copy, no error
                f.BackupCorrupt(null);
            }
            Assert.Eq(1, Directory.GetFiles(dir, "history.json.corrupt-*").Length, "one backup of history.json");
            Assert.Eq(0, Directory.GetFiles(dir, "window.json*").Length, "window.json untouched");
        }
        finally { Directory.Delete(dir, true); }
    }
}
