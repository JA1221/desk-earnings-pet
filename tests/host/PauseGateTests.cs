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

    public static void Test_VisibilityDecisionTable()
    {
        // (wantVisible, layoutKnown, rescued, quitting, winFormsVisible, shownToUser)
        Assert.Eq(VisibilityAction.Show, ShowRescue.Visibility(true, true, false, false, false, false), "wanted, layout known, hidden: show");
        Assert.Eq(VisibilityAction.Show, ShowRescue.Visibility(true, false, true, false, false, false), "rescued counts as a layout");
        Assert.Eq(VisibilityAction.None, ShowRescue.Visibility(true, false, false, false, false, false), "no layout yet, not rescued: stay hidden");
        Assert.Eq(VisibilityAction.Hide, ShowRescue.Visibility(false, true, false, false, true, true), "the user hid it: hide");
        Assert.Eq(VisibilityAction.None, ShowRescue.Visibility(false, true, false, false, false, false), "already hidden: nothing");
        Assert.Eq(VisibilityAction.Hide, ShowRescue.Visibility(true, true, false, true, true, true), "quitting: hide");
        Assert.Eq(VisibilityAction.None, ShowRescue.Visibility(true, true, true, true, false, false), "quitting and hidden: nothing");
        Assert.Eq(VisibilityAction.None, ShowRescue.Visibility(true, true, false, false, true, true), "visible and wanted: nothing");
        Assert.Eq(VisibilityAction.ForceShow, ShowRescue.Visibility(true, true, false, false, true, false), "WinForms says visible, Windows disagrees: force");
        Assert.Eq(VisibilityAction.Hide, ShowRescue.Visibility(false, true, false, false, true, false), "not wanted: hide, never force");
        Assert.Eq(VisibilityAction.Hide, ShowRescue.Visibility(true, false, false, false, true, true), "visible without a layout and not rescued: hide");
    }

    public static void Test_StartLayoutNoActivate()
    {
        Assert.True(ShowRescue.NoActivateLayout("U7"), "U7");
        Assert.True(ShowRescue.NoActivateLayout("M3"), "M3");
        Assert.True(!ShowRescue.NoActivateLayout("U1"), "U1");
        Assert.True(!ShowRescue.NoActivateLayout(null), "null");
    }
}
