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
