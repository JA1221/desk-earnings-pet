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

    public static void Test_LoadAllReadsTheBakTexts()
    {
        string dir = NewDir();
        try
        {
            File.WriteAllText(Path.Combine(dir, "settings.json"), "\0\0\0");   // zero-filled after a power loss
            File.WriteAllText(Path.Combine(dir, "settings.json.bak"), "{\"s\":1}");
            File.WriteAllText(Path.Combine(dir, "history.json.bak"), "[\"h\"]");
            using (var f = new UserFiles(dir, null))
            {
                Assert.True(f.SettingsBackup == null && f.HistoryBackup == null, "nothing before LoadAll");
                f.LoadAll();
                Assert.Eq("{\"s\":1}", f.SettingsBackup, "settings.json.bak");
                Assert.Eq("[\"h\"]", f.HistoryBackup, "history.json.bak, even without history.json");
            }
            File.Delete(Path.Combine(dir, "settings.json.bak"));
            using (var f = new UserFiles(dir, null))
            {
                f.LoadAll();
                Assert.True(f.SettingsBackup == null, "no .bak -> null");
            }
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_AnUnreadableBakIsNullAndLogged()
    {
        string dir = NewDir();
        try
        {
            File.WriteAllText(Path.Combine(dir, "history.json"), "h");
            File.WriteAllText(Path.Combine(dir, "history.json.bak"), "old h");
            var errors = new List<string>();
            using (var f = new UserFiles(dir, delegate(string what, Exception ex) { errors.Add(what); }))
            {
                using (Lock(Path.Combine(dir, "history.json.bak"))) f.LoadAll();
                Assert.True(f.HistoryBackup == null, "unreadable .bak -> null");
                Assert.Eq("h", f.History.Text, "the main file is read as usual");
                Assert.Eq(0, f.Unreadable.Count, "a .bak never makes the main file unreadable");
                Assert.True(errors.Count == 1 && errors[0].StartsWith("history.json.bak"), "logged with the file name");
            }
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Test_SavesKeepThePreviousVersionAsBak()
    {
        string dir = NewDir();
        try
        {
            using (var f = new UserFiles(dir, null))
            {
                f.LoadAll();
                f.Save(f.History, "h1");
                f.Save(f.History, "h2");
                f.Save(f.Settings, "s1");
                f.Save(f.Settings, "s2");
            }
            Assert.Eq("h2", File.ReadAllText(Path.Combine(dir, "history.json")), "history");
            Assert.Eq("h1", File.ReadAllText(Path.Combine(dir, "history.json.bak")), "history .bak");
            Assert.Eq("s1", File.ReadAllText(Path.Combine(dir, "settings.json.bak")), "settings .bak");
        }
        finally { Directory.Delete(dir, true); }
    }
}
