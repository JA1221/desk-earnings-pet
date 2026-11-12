using System;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;

// %AppData%\錢進中\session.json = {"lastExitMs": <epoch ms>}: when the app last ended (結束, a close from outside, or
// Windows ending the session). Written synchronously and flushed to the disk (TextStore, no .bak) while the app
// shuts down; read once at the next start and handed to the page in init, which treats a shutdown without a lock as
// leaving work.
public class ExitStamp
{
    readonly TextStore store;

    public ExitStamp(string path)
    {
        store = new TextStore(path, false);
    }

    // The recorded exit time, or null (no file, unreadable, or not a stamp). Never throws.
    public long? Read()
    {
        try { return Parse(store.Read()); }
        catch (Exception) { return null; }
    }

    // Throws when the file cannot be written.
    public void Write(long ms)
    {
        store.Write(Format(ms));
    }

    public static string Format(long ms)
    {
        return "{\"lastExitMs\":" + ms.ToString(CultureInfo.InvariantCulture) + "}";
    }

    // A positive whole number of ms under "lastExitMs" in a JSON object; anything else is null.
    public static long? Parse(string text)
    {
        if (string.IsNullOrEmpty(text)) return null;
        Dictionary<string, object> d;
        try { d = new JavaScriptSerializer().DeserializeObject(text) as Dictionary<string, object>; }
        catch (Exception) { return null; }
        object v;
        if (d == null || !d.TryGetValue("lastExitMs", out v)) return null;
        long ms;
        if (v is int) ms = (int)v;
        else if (v is long) ms = (long)v;
        else return null;   // a string, a bool, a fraction or a number too large for a long
        return ms > 0 ? (long?)ms : null;
    }
}
