using System;
using System.Collections.Generic;
using System.Diagnostics;

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
            using (var log = new EventLog("System"))
            {
                for (int i = log.Entries.Count - 1; i >= 0; i--)
                {
                    EventLogEntry e = log.Entries[i];
                    if (e.TimeGenerated < dayStartLocal) break; // entries are chronological
                    records.Add(new ProbeRecord
                    {
                        Source = e.Source,
                        EventId = (int)(e.InstanceId & 0xFFFF),
                        TimeLocal = e.TimeGenerated
                    });
                }
            }
            return Earliest(records, dayStartLocal);
        }
        catch (Exception)
        {
            return null;
        }
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
