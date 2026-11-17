using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Globalization;

public class ProbeRecord
{
    public string Source;
    public int EventId;
    public DateTime TimeLocal;
}

// Finds when the PC was first used today (logon or wake) from the System event log; and (1.1.5) when the user left it
// after the app had ended: the last time it went to sleep or was shut down later that day (LastLeave). Read-only, the
// local System log, no admin rights; any failure is "none".
public static class EventLogProbe
{
    // Earliest Winlogon 7001 / Power-Troubleshooter 1 at or after dayStartLocal, as epoch ms; null if none or log unreadable.
    public static long? EarliestToday(DateTime dayStartLocal)
    {
        try
        {
            var records = new List<ProbeRecord>();
            var query = new EventLogQuery("System", PathType.LogName, BuildQuery(dayStartLocal));
            using (var reader = new EventLogReader(query))
            {
                EventRecord e;
                while ((e = reader.ReadEvent()) != null)
                {
                    using (e)
                    {
                        if (!e.TimeCreated.HasValue) continue;
                        records.Add(new ProbeRecord
                        {
                            Source = e.ProviderName,
                            EventId = e.Id,
                            TimeLocal = e.TimeCreated.Value
                        });
                    }
                }
            }
            return Earliest(records, dayStartLocal);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public static string BuildQuery(DateTime dayStartLocal)
    {
        string t = dayStartLocal.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
        return "*[System[((Provider[@Name='Microsoft-Windows-Winlogon'] and EventID=7001)"
            + " or (Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1)"
            + " or (Provider[@Name='Microsoft-Windows-Kernel-Power'] and EventID=507)"
            + " or (Provider[@Name='Microsoft-Windows-Kernel-General'] and EventID=12))"
            + " and TimeCreated[@SystemTime>='" + t + "']]]";
    }

    public static long? Earliest(IEnumerable<ProbeRecord> records, DateTime dayStartLocal)
    {
        DateTime? best = null;
        foreach (ProbeRecord r in records)
        {
            if (r.TimeLocal < dayStartLocal) continue;
            if (!Matches(r)) continue;
            if (best == null || r.TimeLocal < best.Value) best = r.TimeLocal;
        }
        if (best == null) return null;
        return (long)(best.Value.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }

    // ---- 1.1.5: the leave after an exit ----
    // The PC "left" (a 「提早下班？」 question's time): Kernel-Power 506 (into Modern Standby), Kernel-Power 42 (sleep),
    // User32 1074 (a shutdown or restart asked for), EventLog 6006 (the event log stopped: shutdown).
    // The query reads only (afterLocal, untilLocal]: the exit stamp's day, after it.
    public static string BuildLeaveQuery(DateTime afterLocal, DateTime untilLocal)
    {
        string a = afterLocal.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
        string u = untilLocal.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
        return "*[System[((Provider[@Name='Microsoft-Windows-Kernel-Power'] and (EventID=506 or EventID=42))"
            + " or (Provider[@Name='User32'] and EventID=1074)"
            + " or (Provider[@Name='EventLog'] and EventID=6006))"
            + " and TimeCreated[@SystemTime>'" + a + "' and @SystemTime<='" + u + "']]]";
    }

    // The System log's records for that query, at most MaxLeaveRecords of them (a day has a few dozen at most).
    public const int MaxLeaveRecords = 500;
    public static IEnumerable<ProbeRecord> ReadLeaves(DateTime afterLocal, DateTime untilLocal)
    {
        var records = new List<ProbeRecord>();
        var query = new EventLogQuery("System", PathType.LogName, BuildLeaveQuery(afterLocal, untilLocal));
        using (var reader = new EventLogReader(query))
        {
            EventRecord e;
            while (records.Count < MaxLeaveRecords && (e = reader.ReadEvent()) != null)
            {
                using (e)
                {
                    if (!e.TimeCreated.HasValue) continue;
                    records.Add(new ProbeRecord { Source = e.ProviderName, EventId = e.Id, TimeLocal = e.TimeCreated.Value });
                }
            }
        }
        return records;
    }

    // The latest leave in (afterLocal, untilLocal], as epoch ms; null when there is none.
    public static long? Latest(IEnumerable<ProbeRecord> records, DateTime afterLocal, DateTime untilLocal)
    {
        DateTime? best = null;
        foreach (ProbeRecord r in records)
        {
            if (r.TimeLocal <= afterLocal || r.TimeLocal > untilLocal || !IsLeave(r)) continue;
            if (best == null || r.TimeLocal > best.Value) best = r.TimeLocal;
        }
        if (best == null) return null;
        return (long)(best.Value.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }

    // The last leave after exitMs on its day (the day the page keys it to: dayStart .. dayStart + 1 day), read through
    // source (tests: fixtures; the app: ReadLeaves). Null when exitMs is null, nothing is found or the source fails.
    public static long? LastLeave(long? exitMs, Func<DateTime, DateTime> dayStart, Func<DateTime, DateTime, IEnumerable<ProbeRecord>> source)
    {
        if (!exitMs.HasValue) return null;
        try
        {
            DateTime exit = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(exitMs.Value).ToLocalTime();
            exit = DateTime.SpecifyKind(exit, DateTimeKind.Local);
            DateTime until = dayStart(exit).AddDays(1);
            return Latest(source(exit, until), exit, until);
        }
        catch (Exception) { return null; }
    }

    static bool IsLeave(ProbeRecord r)
    {
        if (r.EventId == 506 || r.EventId == 42) return SourceIs(r.Source, "Kernel-Power");
        if (r.EventId == 1074) return string.Equals(r.Source, "User32", StringComparison.OrdinalIgnoreCase);
        if (r.EventId == 6006) return string.Equals(r.Source, "EventLog", StringComparison.OrdinalIgnoreCase);
        return false;
    }

    static bool Matches(ProbeRecord r)
    {
        if (r.EventId == 7001) return SourceIs(r.Source, "Winlogon");
        if (r.EventId == 1) return SourceIs(r.Source, "Power-Troubleshooter");
        if (r.EventId == 507) return SourceIs(r.Source, "Kernel-Power");   // exit from connected (modern) standby
        if (r.EventId == 12) return SourceIs(r.Source, "Kernel-General");  // OS start
        return false;
    }

    static bool SourceIs(string source, string shortName)
    {
        return string.Equals(source, shortName, StringComparison.OrdinalIgnoreCase)
            || string.Equals(source, "Microsoft-Windows-" + shortName, StringComparison.OrdinalIgnoreCase);
    }
}
