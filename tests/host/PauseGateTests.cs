using System;

public static class PauseGateTests
{
    public static void Test_RunsOnlyWhenShownAndUnlocked()
    {
        var g = new PauseGate();
        Assert.True(!g.Running, "not shown yet");
        Assert.True(g.SetShown(true), "show -> flips to running");
        Assert.True(g.Running, "running");
        Assert.True(!g.SetShown(true), "show again -> no change");
        Assert.True(g.SetLocked(true), "lock -> flips to paused");
        Assert.True(!g.Running, "paused while locked");
        Assert.True(g.SetLocked(false), "unlock -> running again");
        Assert.True(g.SetShown(false), "hide -> paused");
    }

    public static void Test_HiddenAndLockedCombine()
    {
        var g = new PauseGate();
        g.SetShown(true);
        Assert.True(g.SetShown(false), "hide -> paused");
        Assert.True(!g.SetLocked(true), "lock while hidden -> no change");
        Assert.True(!g.SetLocked(false), "unlock while hidden -> still paused, no change");
        Assert.True(!g.Running, "hidden");
        Assert.True(!g.SetLocked(true), "lock again while hidden");
        Assert.True(!g.SetShown(true), "show while locked -> still paused");
        Assert.True(g.SetLocked(false), "unlock while shown -> running");
        Assert.True(g.Running, "running");
    }
}

public static class ShowRescueTests
{
    public static void Test_ToggleDecidesOnWhatTheUserSees()
    {
        Assert.True(ShowRescue.NextWantVisible(false), "nothing visible (still starting, or hidden): a toggle means show");
        Assert.True(!ShowRescue.NextWantVisible(true), "visible: a toggle means hide");
    }

    public static void Test_RescueOnlyWhenWantedAndNotVisible()
    {
        Assert.True(ShowRescue.Reason(true, true, false, false) == null, "quitting: never");
        Assert.True(ShowRescue.Reason(false, false, false, false) == null, "the user hid it: never");
        Assert.True(ShowRescue.Reason(false, true, true, true) == null, "already visible: nothing to do");
        Assert.Eq("no setLayout from the page", ShowRescue.Reason(false, true, false, false), "page never reported");
        Assert.Eq("setLayout arrived but the window is not visible", ShowRescue.Reason(false, true, false, true), "shown in WinForms only");
    }
}
