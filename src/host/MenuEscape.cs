using System;

// Esc for the menu when the menu cannot get the keyboard. In the no-activate layouts (U7, M3) the menu opens without
// the foreground, so Esc went to the user's app and the menu stayed open. While such a menu is open, Esc is
// registered as a hotkey on our window: it closes the menu, and the user's app does not get it. When another
// program holds Esc, GetAsyncKeyState is polled instead (the app then gets Esc too). Stop (the menu closed, app
// exit, Dispose, or a failure while closing) always releases it.
public class MenuEscape : IDisposable
{
    public const int Id = 0x5149;        // WM_HOTKEY id; the hide hotkey is HotKey.Id
    public const int VK_ESCAPE = 0x1B;
    const int PollMs = 30;
    readonly Func<bool> register;        // RegisterHotKey(our window, Id, MOD_NOREPEAT, VK_ESCAPE)
    readonly Action unregister;
    readonly Func<bool> escDown;         // GetAsyncKeyState(VK_ESCAPE) is down
    readonly Action close;               // closes the innermost open menu level
    readonly System.Windows.Forms.Timer poll = new System.Windows.Forms.Timer();
    bool wasDown;

    public MenuEscape(Func<bool> register, Action unregister, Func<bool> escDown, Action close)
    {
        this.register = register;
        this.unregister = unregister;
        this.escDown = escDown;
        this.close = close;
        poll.Interval = PollMs;
        poll.Tick += delegate { PollOnce(); };
    }

    public bool Active { get; private set; }
    public bool Registered { get; private set; }
    public bool Polling { get { return poll.Enabled; } }

    // The menu sees Esc by itself only when the keyboard focus (or the active window, without one) belongs to our
    // UI thread, outside the no-activate layouts. Anything else needs this.
    public static bool Needed(bool noActivate, uint focusThreadId, uint uiThreadId)
    {
        return noActivate || focusThreadId == 0 || focusThreadId != uiThreadId;
    }

    // The menu opened. Idempotent.
    public void Start()
    {
        if (Active) return;
        Active = true;
        Registered = register();
        if (Registered) return;
        wasDown = escDown();   // a key already held does not count
        poll.Start();
    }

    // The menu closed (any path). Idempotent.
    public void Stop()
    {
        if (!Active) return;
        Active = false;
        poll.Stop();
        if (!Registered) return;
        Registered = false;
        unregister();
    }

    // WM_HOTKEY: true when id is ours (then Esc closes the menu, if one is open).
    public bool OnHotKey(int id)
    {
        if (id != Id) return false;
        if (Active) Close();
        return true;
    }

    // One poll tick (the timer's, or a test's).
    internal void PollOnce()
    {
        if (!Active) return;
        bool down = escDown();
        bool pressed = down && !wasDown;
        wasDown = down;
        if (pressed) Close();
    }

    public void Dispose()
    {
        Stop();
        poll.Dispose();
    }

    void Close()
    {
        try { close(); }
        catch (Exception)
        {
            // Esc is released early on purpose when close() throws: a failed close must never leave Esc taken
            // system-wide, and the exception still reaches the caller.
            Stop();
            throw;
        }
    }
}

// A click on our own window closes the menu, in every layout (1.1.2 item 2). The menu is a WinForms ContextMenuStrip,
// not TrackPopupMenu, and it closes by itself only when (a) its message filter on this UI thread sees a mouse button
// press outside it (ToolStripManager.ModalMenuFilter.ProcessMouseButtonPressed: AppClicked), or (b) this thread's active
// window changes to one that is neither the menu nor the window active when it opened (ProcessActivationChange:
// AppFocusChange). A click on the page reaches neither:
// - the page is WebView2: its windows are children of ours, but they belong to the msedgewebview2.exe browser process,
//   so a press on them is queued to that process's thread and never passes through this thread's queue (a);
// - the window's activation does not change (b): a menu opened from the page made our window the active one first
//   (ShowContextMenu), so clicking it again changes nothing; and U7 / M3 / U10 never activate (WS_EX_NOACTIVATE), which is
//   also why a menu opened from the tray stayed open there while U1 / U3 / ... closed it.
// A click on the window's click-through parts (WS_EX_TRANSPARENT off every hit rect) lands on whatever is below, a click
// elsewhere, which (b) already handles. So while the menu is open the mouse buttons are polled (GetAsyncKeyState, as
// MenuEscape's fallback polls Esc): a new press with the cursor over our own window closes the whole menu. The menu's own
// popups are top-level windows of their own, so a press on an item is never one. A button already held when the menu
// opens does not count. Stop (the menu closed, app exit, Dispose, or a failure while closing) ends the poll.
public class MenuClickAway : IDisposable
{
    public const int PollMs = 15;
    public static readonly int[] Buttons = { 0x01, 0x02, 0x04 };   // VK_LBUTTON, VK_RBUTTON, VK_MBUTTON
    readonly Func<int, short> keyState;   // GetAsyncKeyState(vk)
    readonly Func<bool> overOurWindow;    // the cursor is over our window (WindowFromPoint's root), not the menu or another
    readonly Action close;                // closes every open level of the menu
    readonly System.Windows.Forms.Timer poll = new System.Windows.Forms.Timer();
    readonly bool[] wasDown = new bool[Buttons.Length];

    public MenuClickAway(Func<int, short> keyState, Func<bool> overOurWindow, Action close)
    {
        this.keyState = keyState;
        this.overOurWindow = overOurWindow;
        this.close = close;
        poll.Interval = PollMs;
        poll.Tick += delegate { PollOnce(); };
    }

    public bool Active { get; private set; }
    public bool Polling { get { return poll.Enabled; } }

    // A new press in GetAsyncKeyState's state: down now and not at the last look, or pressed since the last look (the
    // low bit: a tap shorter than one poll, or let go and pressed again).
    public static bool Pressed(short state, bool wasDown)
    {
        bool down = (state & 0x8000) != 0;
        return (down && !wasDown) || (state & 1) != 0;
    }

    // The menu opened. Idempotent. The first look also takes the "pressed since" bit of the press that opened it.
    public void Start()
    {
        if (Active) return;
        Active = true;
        for (int i = 0; i < Buttons.Length; i++) wasDown[i] = (keyState(Buttons[i]) & 0x8000) != 0;
        poll.Start();
    }

    // The menu closed (any path). Idempotent.
    public void Stop()
    {
        if (!Active) return;
        Active = false;
        poll.Stop();
    }

    // One poll tick (the timer's, or a test's). The cursor is looked at only on a press.
    internal void PollOnce()
    {
        if (!Active) return;
        bool pressed = false;
        for (int i = 0; i < Buttons.Length; i++)
        {
            short state = keyState(Buttons[i]);
            if (Pressed(state, wasDown[i])) pressed = true;
            wasDown[i] = (state & 0x8000) != 0;
        }
        if (!pressed || !overOurWindow()) return;
        try { close(); }
        catch (Exception)
        {
            Stop();   // a failed close must not keep polling; the exception still reaches the caller
            throw;
        }
    }

    public void Dispose()
    {
        Stop();
        poll.Dispose();
    }
}
