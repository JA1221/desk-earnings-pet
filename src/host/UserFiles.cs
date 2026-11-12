using System;
using System.Collections.Generic;
using System.IO;

// The user's files in %AppData%\錢進中: settings.json and history.json (the page's text) and window.json (window
// positions). A failed write keeps the newest text and is retried by the next save and by a 10 s timer. A file
// that exists but could not be read at start is never written in this session and not retried; Unreadable
// lists it for the page (storageError). Every write keeps the version it replaces as <file>.bak (TextStore); the
// page gets the .bak texts of settings and history in init, for when the main text does not parse.
public class UserFiles : IDisposable
{
    const int RetryMs = 10000;
    readonly System.Windows.Forms.Timer retry = new System.Windows.Forms.Timer();
    readonly Action<string, Exception> log;

    public UserFiles(string dir, Action<string, Exception> log)
    {
        this.log = log;
        Settings = new SavedText(new TextStore(Path.Combine(dir, "settings.json")), Logger("settings.json", log));
        History = new SavedText(new TextStore(Path.Combine(dir, "history.json")), Logger("history.json", log));
        Window = new SavedText(new TextStore(Path.Combine(dir, "window.json")), Logger("window.json", log));
        retry.Interval = RetryMs;
        retry.Tick += delegate { FlushAll(); };
    }

    public SavedText Settings { get; private set; }
    public SavedText History { get; private set; }
    public SavedText Window { get; private set; }

    // settings.json.bak / history.json.bak as LoadAll found them; null when missing or unreadable.
    public string SettingsBackup { get; private set; }
    public string HistoryBackup { get; private set; }

    // The retry timer is running (a write is pending and may still succeed).
    public bool RetryArmed { get { return retry.Enabled; } }

    // "settings" / "history" when that file exists but could not be read.
    public List<string> Unreadable
    {
        get
        {
            var list = new List<string>();
            if (Settings.ReadFailed) list.Add("settings");
            if (History.ReadFailed) list.Add("history");
            return list;
        }
    }

    public void LoadAll()
    {
        Settings.Load();
        History.Load();
        Window.Load();
        SettingsBackup = ReadBackup(Settings.Store, "settings.json.bak");
        HistoryBackup = ReadBackup(History.Store, "history.json.bak");
    }

    public void Save(SavedText file, string text)
    {
        if (text == null) return;
        if (!file.Save(text) && file.Retryable) retry.Start();
    }

    // Writes everything pending; true when no write is left to retry (the timer then stops).
    public bool FlushAll()
    {
        Settings.Flush();
        History.Flush();
        Window.Flush();
        bool done = !Settings.Retryable && !History.Retryable && !Window.Retryable;
        if (done) retry.Stop();
        return done;
    }

    // The page found settings or history corrupt: keep a copy before anything overwrites it.
    public void BackupCorrupt(string which)
    {
        SavedText file = which == "settings" ? Settings : which == "history" ? History : null;
        if (file == null) return;
        try { file.Store.BackupCorrupt(); }
        catch (Exception ex) { ErrorLog.Write("backup of corrupt " + which, ex); }
    }

    public void Dispose()
    {
        retry.Dispose();
    }

    // Like SavedText.Load: a few tries, since a virus scan may hold the file for a moment.
    string ReadBackup(TextStore store, string name)
    {
        for (int attempt = 1; ; attempt++)
        {
            try { return store.ReadBackup(); }
            catch (Exception ex)
            {
                if (attempt < 3) { System.Threading.Thread.Sleep(100); continue; }
                if (log != null) log(name + ": read failed", ex);
                return null;
            }
        }
    }

    static Action<string, Exception> Logger(string name, Action<string, Exception> log)
    {
        if (log == null) return null;
        return delegate(string what, Exception ex) { log(name + ": " + what, ex); };
    }
}
