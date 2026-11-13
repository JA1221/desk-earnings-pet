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

    // While a prompt bubble shows, the window is raised above everything (spec 5.1); afterwards the layout's own
    // 永遠在最上層 applies again. 1.1.1: while a full-screen window is in front on the pet's monitor the window steps
    // back (never topmost, prompt or not), and comes back as it was when that ends.
    public static void Test_EffectiveTopmost()
    {
        Assert.True(!ShowRescue.EffectiveTopmost(false, false, false), "layout not topmost, no prompt: not topmost");
        Assert.True(ShowRescue.EffectiveTopmost(false, true, false), "a prompt raises a non-topmost layout");
        Assert.True(ShowRescue.EffectiveTopmost(true, false, false), "a topmost layout stays topmost");
        Assert.True(ShowRescue.EffectiveTopmost(true, true, false), "both");
        Assert.True(!ShowRescue.EffectiveTopmost(true, false, true), "full screen here: a topmost layout steps back");
        Assert.True(!ShowRescue.EffectiveTopmost(false, true, true), "full screen here wins over a prompt's raise");
        Assert.True(!ShowRescue.EffectiveTopmost(true, true, true), "and over both");
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

    // R-F3: the hotkey hides only a window the user sees on top; a covered window comes to the front instead.
    public static void Test_HotkeyHidesOnlyWhatIsSeenOnTop()
    {
        // (shownToUser, foreground, topmost, covered, steppedBack)
        Assert.True(!ShowRescue.HotkeyHides(false, false, false, false, false), "hidden (or still starting): show");
        Assert.True(!ShowRescue.HotkeyHides(false, false, true, false, false), "hidden topmost layout: show");
        Assert.True(ShowRescue.HotkeyHides(true, true, false, false, false), "visible and foreground: hide");
        Assert.True(ShowRescue.HotkeyHides(true, true, false, true, false), "foreground wins over anything above it");
        Assert.True(ShowRescue.HotkeyHides(true, false, true, false, false), "visible topmost layout: hide");
        Assert.True(ShowRescue.HotkeyHides(true, false, true, true, false), "a topmost layout hides even under another topmost window");
        Assert.True(!ShowRescue.HotkeyHides(true, false, false, true, false), "U1 behind Excel: show and raise, not hide");
        Assert.True(ShowRescue.HotkeyHides(true, false, false, false, false),
            "nothing covers it (U7/M3 with topmost off never become foreground; U1 after a raise): hide");
    }

    // 1.1.1: stepped back behind a full-screen window on its monitor, the window is where it belongs, and it may not be
    // raised above that window: the hotkey hides it (it never pops up over a slide show).
    public static void Test_HotkeyHidesAWindowSteppedBackForFullScreen()
    {
        // (shownToUser, foreground, topmost, covered, steppedBack)
        Assert.True(ShowRescue.HotkeyHides(true, false, false, true, true), "covered by the full-screen window: hide");
        Assert.True(!ShowRescue.HotkeyHides(false, false, false, true, true), "hidden: show (behind the full-screen window)");
        Assert.True(!ShowRescue.HotkeyHides(true, false, false, true, false), "covered, nothing full screen: raise");
    }

    // Review §4a: a panel the user opens from the tray or the menu (設定, 紀錄, 調整起算時間, which is 設定 at 起算) comes in
    // front of a full-screen window on the pet's monitor and takes the keyboard; nothing else the menu does beats it.
    public static void Test_PanelsTheUserOpensBeatFullScreen()
    {
        foreach (string a in new[] { "settings", "history", "adjust" })
            Assert.True(ShowRescue.UserPanel(a), a + " is a panel the user asked for");
        foreach (string a in new[] { "toggleVisible", "layout:U1", "mini", "feed", "start", "end", "topmost", "drink", "undrink", "stoodUp",
            "pomodoro", "capsule:top", "quit", null })
            Assert.True(!ShowRescue.UserPanel(a), (a ?? "null") + " is not");
    }

    // Stepped back: full screen on the pet's monitor, unless the panel the user asked for shows (then it is in front, and
    // the step-back applies again once it closes).
    public static void Test_StepsBack()
    {
        Assert.True(ShowRescue.StepsBack(true, false), "full screen here: steps back");
        Assert.True(!ShowRescue.StepsBack(true, true), "the user's panel: in front");
        Assert.True(!ShowRescue.StepsBack(false, false), "nothing full screen here");
        Assert.True(!ShowRescue.StepsBack(false, true), "nothing full screen here, panel or not");
    }

    // R-F3: tray and menu actions show and raise the window (the user wants to see the result); 隱藏/顯示 toggles,
    // 結束 quits, and 永遠在最上層 only changes the z-order band.
    public static void Test_MenuActionsThatShowTheWindow()
    {
        foreach (string a in new[] { "layout:U1", "layout:U7", "mini", "feed", "start", "adjust", "end", "settings", "history",
            "layout:U10", "capsule:top", "capsule:bottomRight" })
            Assert.True(ShowRescue.MenuShows(a), a + " shows and raises");
        // quick actions (記一杯水, 少記一杯, 我剛起來動過了, 開始番茄鐘) never un-hide the window
        foreach (string a in new[] { "toggleVisible", "quit", "topmost", "drink", "undrink", "stoodUp", "pomodoro", null })
            Assert.True(!ShowRescue.MenuShows(a), (a ?? "null") + " does not");
    }

    // The current layout takes the keyboard at once unless the action switches layouts (that one decides when its
    // setLayout arrives: U7/M3 never take it).
    public static void Test_MenuActionsThatActivateTheCurrentLayout()
    {
        foreach (string a in new[] { "feed", "start", "adjust", "end", "settings", "history" })
            Assert.True(ShowRescue.MenuActivatesNow(a), a + " activates now");
        foreach (string a in new[] { "layout:U1", "layout:U7", "mini", "toggleVisible", "quit", "topmost", null,
            "capsule:top", "capsule:bottomRight", "drink", "undrink", "stoodUp", "pomodoro" })
            Assert.True(!ShowRescue.MenuActivatesNow(a), (a ?? "null") + " does not");
    }

    // 1.1.2 item 5: the layout whose 永遠在最上層 counts now. A panel's is the layout it came from, as the page's
    // topmostFor and toggleTopmost have it, so the title bar's pin (setTopmost), the menu's check and settings.json all
    // name one layout, also once a settings save replaced the host's copy (which has no PANEL entry).
    public static void Test_TopmostLayout()
    {
        Assert.Eq("U1", ShowRescue.TopmostLayout("U1", "U7"), "a layout: its own");
        Assert.Eq("U13", ShowRescue.TopmostLayout("PANEL", "U13"), "a panel: the layout it came from");
        Assert.Eq("M3", ShowRescue.TopmostLayout("PANEL", "M3"), "from the mini badge");
        Assert.Eq("PANEL", ShowRescue.TopmostLayout("PANEL", null), "nothing before it: its own");
        var topmost = HostSettings.Parse("{\"layout\":{\"topmost\":{\"U12\":true}}}").TopmostByLayout();
        Assert.True(topmost[ShowRescue.TopmostLayout("PANEL", "U12")], "settings in U12's window, U12 pinned: the check stays after a save");
        Assert.True(!topmost.ContainsKey("PANEL"), "the saved settings have no PANEL entry to look up");
    }

    public static void Test_StartLayoutNoActivate()
    {
        Assert.True(ShowRescue.NoActivateLayout("U7"), "U7");
        Assert.True(ShowRescue.NoActivateLayout("M3"), "M3");
        Assert.True(ShowRescue.NoActivateLayout("U10"), "U10");
        Assert.True(!ShowRescue.NoActivateLayout("U1"), "U1");
        Assert.True(!ShowRescue.NoActivateLayout("U12"), "U12");
        Assert.True(!ShowRescue.NoActivateLayout("U13"), "U13");
        Assert.True(!ShowRescue.NoActivateLayout(null), "null");
    }
}
