using System;

// The page may animate only while the window is shown and the session is unlocked. Each setter returns true
// when that combined state flipped; the caller then sends visibility {visible: Running} and pauses or resumes
// the hit poll.
public class PauseGate
{
    bool shown;
    bool locked;

    public bool Running { get { return shown && !locked; } }

    public bool SetShown(bool value)
    {
        bool was = Running;
        shown = value;
        return was != Running;
    }

    public bool SetLocked(bool value)
    {
        bool was = Running;
        locked = value;
        return was != Running;
    }
}

// Showing the window, decided on what the user actually sees (IsWindowVisible), not on WinForms' state. Lives here
// next to PauseGate: both are about whether the window is shown.
public static class ShowRescue
{
    // A show/hide toggle (Ctrl+Alt+H, tray double-click, the menu) hides the window only when it is visible now.
    // While nothing is visible, for example during the hidden start before the page's first setLayout, a toggle
    // means "show". It used to flip the pending first show into "stay hidden" for good.
    public static bool NextWantVisible(bool shownToUser)
    {
        return !shownToUser;
    }

    // Why the first-show safety net must show the window (null: no need). Only when the user wants it, it is not
    // visible, and the app is not quitting.
    public static string Reason(bool quitting, bool wantVisible, bool shownToUser, bool layoutReported)
    {
        if (quitting || !wantVisible || shownToUser) return null;
        return layoutReported ? "setLayout arrived but the window is not visible" : "no setLayout from the page";
    }

    // What ApplyVisibility must do with the window. wantVisible: the user's choice; layoutKnown: the page has sent
    // a setLayout; rescued: the safety net showed it anyway; winFormsVisible: Form.Visible; shownToUser: Windows'
    // own view (visible and not minimized). ForceShow: WinForms says shown but Windows disagrees.
    public static VisibilityAction Visibility(bool wantVisible, bool layoutKnown, bool rescued, bool quitting, bool winFormsVisible, bool shownToUser)
    {
        bool show = wantVisible && (layoutKnown || rescued) && !quitting;
        if (show && !winFormsVisible) return VisibilityAction.Show;
        if (!show && winFormsVisible) return VisibilityAction.Hide;
        if (show && !shownToUser) return VisibilityAction.ForceShow;
        return VisibilityAction.None;
    }

    // The hide hotkey (Ctrl+Alt+H) hides the window only when the user sees it on top: visible and either the
    // foreground window, a topmost layout, or not covered by another app's window. A hidden or covered window is
    // shown and raised instead, so the hotkey never "hides" a window the user could not see (U1 behind Excel).
    // covered matters for the windows that are never foreground: U7/M3 with topmost off, U1 after a raise.
    public static bool HotkeyHides(bool shownToUser, bool foreground, bool topmost, bool covered)
    {
        return shownToUser && (foreground || topmost || !covered);
    }

    // Tray and menu actions the user wants to see the result of: they show and raise the window (and give it the
    // keyboard in an activating layout). 隱藏/顯示 toggles on its own; 結束 quits; 永遠在最上層 changes only the band.
    public static bool MenuShows(string action)
    {
        return action != null && action != "toggleVisible" && action != "quit" && action != "topmost";
    }

    // Of those, the ones whose result shows in the current layout, which then takes the keyboard at once (if it is
    // an activating one). A layout switch (layout:*, mini) leaves that to the new layout's setLayout.
    public static bool MenuActivatesNow(string action)
    {
        return MenuShows(action) && !action.StartsWith("layout:") && action != "mini";
    }

    // U7 and M3 never take focus when clicked.
    public static bool NoActivateLayout(string layout)
    {
        return layout == "U7" || layout == "M3";
    }
}

public enum VisibilityAction { None, Show, Hide, ForceShow }
