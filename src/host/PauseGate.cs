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
    // steppedBack (1.1.1): the window stepped back behind a full-screen window on its monitor, which nothing may raise
    // it above; it is where it belongs, so a shown one is hidden.
    public static bool HotkeyHides(bool shownToUser, bool foreground, bool topmost, bool covered, bool steppedBack)
    {
        return shownToUser && (foreground || topmost || !covered || steppedBack);
    }

    // Tray and menu actions the user wants to see the result of: they show and raise the window (and give it the
    // keyboard in an activating layout). 隱藏視窗/顯示視窗 toggles on its own; 結束 quits; 永遠在最上層 changes only the
    // band; the quick actions 記一杯水 (drink) and 開始／停止番茄鐘 (pomodoro) never un-hide the window.
    public static bool MenuShows(string action)
    {
        return action != null && action != "toggleVisible" && action != "quit" && action != "topmost"
            && action != "drink" && action != "pomodoro";
    }

    // What a menu item sends the page (null: nothing). 版型 ▶ 7 迷你浮窗 (layout:M3) is the page's mini, which is a toggle,
    // so in M3 it sends nothing: there it only shows and raises the window (MenuShows), as picking the current layout does
    // anywhere else (1.1.3 review M-1). Every other id goes as it is.
    public static string PageAction(string action, string layout)
    {
        if (action != "layout:M3") return action;
        return layout == "M3" ? null : "mini";
    }

    // Of those, the ones whose result shows in the current layout, which then takes the keyboard at once (if it is
    // an activating one). A layout switch (layout:*, mini) leaves that to the new layout's setLayout; moving U10's
    // capsule (capsule:*) never takes the keyboard.
    public static bool MenuActivatesNow(string action)
    {
        return MenuShows(action) && !action.StartsWith("layout:") && action != "mini" && !action.StartsWith("capsule:");
    }

    // U7, M3 and U10 never take focus when clicked.
    public static bool NoActivateLayout(string layout)
    {
        return layout == "U7" || layout == "M3" || layout == "U10";
    }

    // Review §4a: the panels the user opens from the tray or the menu (設定, 紀錄, and 調整起算時間, which is 設定 at 起算).
    // One of them comes in front of a full-screen window on the pet's monitor and takes the keyboard like any panel the
    // user asked for; a panel the page opens by itself (a question) does not.
    public static bool UserPanel(string action)
    {
        return action == "settings" || action == "history" || action == "adjust";
    }

    // Whether the window steps back behind a full-screen window: one is on its monitor (here), and the panel the user
    // asked for is not showing (userPanel). Once that panel closes, it steps back again.
    public static bool StepsBack(bool here, bool userPanel)
    {
        return here && !userPanel;
    }

    // The layout whose 永遠在最上層 counts now (1.1.2 item 5): a panel's is the layout it came from (from), as the page's
    // topmostFor and toggleTopmost have it, so the title bar's pin, the menu's check and settings.json name one layout.
    public static string TopmostLayout(string layout, string from)
    {
        return layout == "PANEL" && from != null ? from : layout;
    }

    // Whether the window is topmost: the layout's own 永遠在最上層, or raised while a prompt bubble shows (raise {on},
    // spec 5.1). The tray's check mark shows layoutTopmost only. steppedBack (1.1.1 item 7): a full-screen window is in
    // front on the pet window's monitor, so the window steps back behind it, prompt or not; the full-screen window wins.
    public static bool EffectiveTopmost(bool layoutTopmost, bool raised, bool steppedBack)
    {
        return !steppedBack && (layoutTopmost || raised);
    }
}

public enum VisibilityAction { None, Show, Hide, ForceShow }
