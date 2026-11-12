using System;
using System.Collections.Generic;

public static class PresentationTests
{
    // SHQueryUserNotificationState: 2 busy (a fullscreen app), 3 Direct3D fullscreen, 4 presentation mode hold
    // reminders. 7 (a Store app in the foreground) does not: a windowed Store app must not hold them. 1 (locked,
    // screen saver) is the session's business; 0 / -1 mean the query failed.
    public static void Test_BusyStates()
    {
        foreach (int s in new[] { 1, 5, 6, 7, 0, -1 })
            Assert.True(!Presentation.IsBusy(s), s + " is not busy");
        foreach (int s in new[] { 2, 3, 4 })
            Assert.True(Presentation.IsBusy(s), s + " is busy");
    }

    public static void Test_ChangedOnlyOnChange()
    {
        int[] answers = { 5, 2, 2, 5 };
        int next = 0;
        var changes = new List<string>();
        using (var p = new Presentation(delegate { return answers[next++]; }))
        {
            p.Changed += delegate(bool on) { changes.Add(on.ToString()); };
            Assert.True(!p.Busy, "not busy before a poll");
            for (int i = 0; i < answers.Length; i++) p.Poll();
            Assert.Eq("True,False", string.Join(",", changes.ToArray()), "Changed fires on each flip only");
            Assert.True(!p.Busy, "busy follows the last poll");
        }
    }
}
