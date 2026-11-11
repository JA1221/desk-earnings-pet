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
