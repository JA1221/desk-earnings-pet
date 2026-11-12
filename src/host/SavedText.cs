using System;
using System.Threading;

// One user file (settings.json, history.json or window.json) holding the newest text the app has for it.
// A failed write (the file is locked by a backup tool or a virus scan, for example) keeps the text in memory
// and is retried by the next Save or Flush: the newest text is never lost and nothing throws. A file that
// exists but could not be read at start is never overwritten in this session, so a passing lock cannot
// replace the user's data with defaults. Failures go to onError (the first of each failing streak).
public class SavedText
{
    const int ReadAttempts = 3;
    const int ReadRetryMs = 100;
    readonly Action<string, Exception> onError;
    bool reported;

    public SavedText(TextStore store, Action<string, Exception> onError)
    {
        Store = store;
        this.onError = onError;
    }

    public TextStore Store { get; private set; }

    // Newest text: what Load read, or what Save was last given (written or not).
    public string Text { get; private set; }

    // Text has not reached the disk yet.
    public bool Pending { get; private set; }

    // The file exists but could not be read; it is left untouched from then on.
    public bool ReadFailed { get; private set; }

    // A pending write that a later Flush may still complete (never true for a file that could not be read).
    public bool Retryable { get { return Pending && !ReadFailed; } }

    // Reads the file (null when it does not exist or cannot be read).
    public string Load()
    {
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                Text = Store.Read();
                ReadFailed = false;
                return Text;
            }
            catch (Exception ex)
            {
                if (attempt >= ReadAttempts)
                {
                    Text = null;
                    ReadFailed = true;
                    Report("read failed; the file is left untouched this session", ex);
                    return null;
                }
                Thread.Sleep(ReadRetryMs);
            }
        }
    }

    // Keeps text as the newest and tries to write it; false when it is still pending.
    public bool Save(string text)
    {
        Text = text;
        Pending = true;
        return Flush();
    }

    // Writes pending text; true when nothing is pending afterwards.
    public bool Flush()
    {
        if (!Pending) return true;
        if (ReadFailed) return false;
        try
        {
            Store.Write(Text);
            Pending = false;
            reported = false;
            return true;
        }
        catch (Exception ex)
        {
            Report("write failed; kept in memory, will retry", ex);
            return false;
        }
    }

    void Report(string what, Exception ex)
    {
        if (reported || onError == null) return;
        reported = true;
        try { onError(what, ex); }
        catch (Exception) { }
    }
}
