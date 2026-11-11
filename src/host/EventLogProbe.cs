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

// Finds when the PC was first used today (logon or wake) from the System event log.
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
            + " or (Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1))"
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

    static bool Matches(ProbeRecord r)
    {
        if (r.EventId == 7001) return SourceIs(r.Source, "Winlogon");
        if (r.EventId == 1) return SourceIs(r.Source, "Power-Troubleshooter");
        return false;
    }

    static bool SourceIs(string source, string shortName)
    {
        return string.Equals(source, shortName, StringComparison.OrdinalIgnoreCase)
            || string.Equals(source, "Microsoft-Windows-" + shortName, StringComparison.OrdinalIgnoreCase);
    }
}
