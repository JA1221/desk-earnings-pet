using System;
using System.Collections.Generic;

public static class EventLogProbeTests
{
    static readonly DateTime Start = new DateTime(2026, 11, 12, 4, 0, 0);

    static ProbeRecord R(string src, int id, int h, int m)
    {
        return new ProbeRecord { Source = src, EventId = id, TimeLocal = new DateTime(2026, 11, 12, h, m, 0) };
    }

    static long Ms(DateTime local)
    {
        return (long)(local.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }

    // ---- 1.1.5: the last leave after an exit ----
    static ProbeRecord On(int d, string src, int id, int h, int m)
    {
        return new ProbeRecord { Source = src, EventId = id, TimeLocal = new DateTime(2026, 11, d, h, m, 0) };
    }
    static DateTime Day4(DateTime t) { DateTime d = t.Date.AddHours(4); return t >= d ? d : d.AddDays(-1); }
    static Func<DateTime, DateTime, IEnumerable<ProbeRecord>> Source(List<ProbeRecord> all, List<string> asked)
    {
        return delegate (DateTime a, DateTime u)
        {
            asked.Add(a.ToString("MM-dd HH:mm") + ".." + u.ToString("MM-dd HH:mm"));
            return all.FindAll(r => r.TimeLocal > a && r.TimeLocal <= u);   // the query's window, as the real one
        };
    }

    // This PC's 11/16 (System log): Modern Standby in and out all day; the app quit at 14:45; the last 506 at 17:48 (the
    // planned end 17:42). The leave is 17:48, so the page asks nothing.
    public static void Test_LastLeaveIsTheLatestSleepAfterTheExit()
    {
        var all = new List<ProbeRecord> {
            On(16, "Microsoft-Windows-Kernel-Power", 506, 12, 53), On(16, "Microsoft-Windows-Kernel-Power", 507, 13, 10),
            On(16, "Microsoft-Windows-Kernel-Power", 506, 15, 2), On(16, "Microsoft-Windows-Kernel-Power", 507, 15, 20),
            On(16, "Microsoft-Windows-Kernel-Power", 506, 17, 48), On(17, "Microsoft-Windows-Kernel-Power", 507, 8, 30),
            On(17, "Microsoft-Windows-Kernel-Power", 506, 9, 0) };
        var asked = new List<string>();
        long? r = EventLogProbe.LastLeave(Ms(new DateTime(2026, 11, 16, 14, 45, 0)), Day4, Source(all, asked));
        Assert.Eq(Ms(new DateTime(2026, 11, 16, 17, 48, 0)), r.Value, "the last 506 that day");
        Assert.Eq("11-16 14:45..11-17 04:00", string.Join("|", asked), "one query: after the exit, to the end of its day");
    }

    public static void Test_LastLeaveKindsAndNone()
    {
        DateTime exit = new DateTime(2026, 11, 16, 14, 45, 0);
        var early = new List<ProbeRecord> { On(16, "Microsoft-Windows-Kernel-Power", 506, 15, 0), On(16, "Microsoft-Windows-Kernel-Power", 507, 16, 0) };
        Assert.Eq(Ms(new DateTime(2026, 11, 16, 15, 0, 0)), EventLogProbe.LastLeave(Ms(exit), Day4, Source(early, new List<string>())).Value,
            "a real early leave: 15:00 (a wake after it is no leave)");
        Assert.True(EventLogProbe.LastLeave(Ms(exit), Day4, Source(new List<ProbeRecord>(), new List<string>())) == null, "none: the exit stamp stays");
        Assert.True(EventLogProbe.LastLeave(null, Day4, Source(early, new List<string>())) == null, "no exit stamp: nothing asked");
        Assert.True(EventLogProbe.LastLeave(Ms(exit), Day4, delegate (DateTime a, DateTime u) { throw new InvalidOperationException("log"); }) == null,
            "an unreadable log is none");
        foreach (var k in new[] { On(16, "Microsoft-Windows-Kernel-Power", 42, 16, 0), On(16, "Kernel-Power", 506, 16, 0),
            On(16, "User32", 1074, 16, 0), On(16, "EventLog", 6006, 16, 0) })
            Assert.Eq(Ms(new DateTime(2026, 11, 16, 16, 0, 0)), EventLogProbe.Latest(new[] { k }, exit, exit.AddHours(14)).Value, "a leave: " + k.Source + " " + k.EventId);
        foreach (var k in new[] { On(16, "Microsoft-Windows-Kernel-Power", 507, 16, 0), On(16, "Microsoft-Windows-Kernel-Power", 1074, 16, 0),
            On(16, "User32", 6006, 16, 0), On(16, "Other", 506, 16, 0), On(16, "Microsoft-Windows-Kernel-Power", 506, 14, 45),
            On(17, "Microsoft-Windows-Kernel-Power", 506, 4, 1) })
            Assert.True(EventLogProbe.Latest(new[] { k }, exit, new DateTime(2026, 11, 17, 4, 0, 0)) == null, "no leave: " + k.Source + " " + k.EventId + " " + k.TimeLocal);
        string q = EventLogProbe.BuildLeaveQuery(exit, new DateTime(2026, 11, 17, 4, 0, 0));
        Assert.True(q.Contains("EventID=506") && q.Contains("EventID=42") && q.Contains("'User32'") && q.Contains("'EventLog'") && q.Contains("@SystemTime>'") && q.Contains("@SystemTime<='"),
            "the query: the four kinds, that window only: " + q);
    }

    public static void Test_PicksEarliestAfterDayStart()
    {
        var recs = new List<ProbeRecord> {
            R("Microsoft-Windows-Winlogon", 7001, 3, 50),
            R("Microsoft-Windows-Winlogon", 7001, 8, 41),
            R("Microsoft-Windows-Power-Troubleshooter", 1, 8, 12) };
        long? r = EventLogProbe.Earliest(recs, Start);
        Assert.True(r.HasValue, "has value");
        Assert.Eq(Ms(new DateTime(2026, 11, 12, 8, 12, 0)), r.Value, "earliest");
    }

    public static void Test_ToleratesShortSourceNames()
    {
        var recs = new List<ProbeRecord> { R("Winlogon", 7001, 9, 0), R("Power-Troubleshooter", 1, 8, 30) };
        Assert.Eq(Ms(new DateTime(2026, 11, 12, 8, 30, 0)), EventLogProbe.Earliest(recs, Start).Value, "short names");
    }

    public static void Test_IgnoresOtherEventIds()
    {
        var recs = new List<ProbeRecord> {
            R("Microsoft-Windows-Winlogon", 7002, 8, 0),
            R("Microsoft-Windows-Power-Troubleshooter", 42, 8, 5),
            R("SomethingElse", 7001, 8, 6),
            R("Microsoft-Windows-Winlogon", 7001, 9, 0) };
        Assert.Eq(Ms(new DateTime(2026, 11, 12, 9, 0, 0)), EventLogProbe.Earliest(recs, Start).Value, "only matching");
    }

    public static void Test_PicksModernStandbyExitAndOsStart()
    {
        var a = new List<ProbeRecord> { R("Microsoft-Windows-Kernel-Power", 507, 8, 39), R("Microsoft-Windows-Winlogon", 7001, 9, 0) };
        Assert.Eq(Ms(new DateTime(2026, 11, 12, 8, 39, 0)), EventLogProbe.Earliest(a, Start).Value, "507");
        var b = new List<ProbeRecord> { R("Microsoft-Windows-Kernel-General", 12, 7, 5), R("Kernel-Power", 507, 8, 0) };
        Assert.Eq(Ms(new DateTime(2026, 11, 12, 7, 5, 0)), EventLogProbe.Earliest(b, Start).Value, "kernel-general 12");
    }

    public static void Test_IgnoresEnteringStandby506()
    {
        var recs = new List<ProbeRecord> { R("Microsoft-Windows-Kernel-Power", 506, 6, 0), R("Microsoft-Windows-Kernel-General", 13, 6, 1) };
        Assert.True(EventLogProbe.Earliest(recs, Start) == null, "506 and 13 ignored");
    }

    public static void Test_NoneReturnsNull()
    {
        Assert.True(EventLogProbe.Earliest(new List<ProbeRecord>(), Start) == null, "empty");
        Assert.True(EventLogProbe.Earliest(new List<ProbeRecord> { R("Microsoft-Windows-Winlogon", 7001, 3, 59) }, Start) == null, "all before");
    }

    public static void Test_RecordExactlyAtDayStartCounts()
    {
        var recs = new List<ProbeRecord> { R("Microsoft-Windows-Winlogon", 7001, 4, 0) };
        Assert.Eq(Ms(Start), EventLogProbe.Earliest(recs, Start).Value, "at start");
    }

    public static void Test_EarliestToday_NullOrNotBeforeDayStart()
    {
        DateTime start = DateTime.Today.AddHours(4);
        long? r = EventLogProbe.EarliestToday(start);
        if (r.HasValue) Assert.True(r.Value >= Ms(start), "result before dayStart");
    }

    public static void Test_BuildQuery_FormatsUtcTimestamp()
    {
        string q = EventLogProbe.BuildQuery(new DateTime(2026, 11, 12, 4, 0, 0, DateTimeKind.Utc));
        Assert.True(q.Contains("TimeCreated[@SystemTime>='2026-11-12T04:00:00.000Z']"), "timestamp: " + q);
        Assert.True(q.Contains("Provider[@Name='Microsoft-Windows-Winlogon'] and EventID=7001"), "winlogon: " + q);
        Assert.True(q.Contains("Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1"), "power: " + q);
        Assert.True(q.Contains("Provider[@Name='Microsoft-Windows-Kernel-Power'] and EventID=507"), "kernel-power: " + q);
        Assert.True(q.Contains("Provider[@Name='Microsoft-Windows-Kernel-General'] and EventID=12"), "kernel-general: " + q);
    }
}
