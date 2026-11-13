using System;
using System.Collections.Generic;

public static class MenuEscapeTests
{
    class Fake
    {
        public bool RegisterResult = true;
        public bool EscDown;
        public int Registers, Unregisters, Closes;
        public bool CloseThrows;
        public MenuEscape Make()
        {
            return new MenuEscape(
                delegate { Registers++; return RegisterResult; },
                delegate { Unregisters++; },
                delegate { return EscDown; },
                delegate { Closes++; if (CloseThrows) throw new InvalidOperationException("close failed"); });
        }
    }

    public static void Test_NeededOnlyWhenTheMenuCannotSeeEsc()
    {
        Assert.True(MenuEscape.Needed(true, 7, 7), "no-activate layout: always");
        Assert.True(!MenuEscape.Needed(false, 7, 7), "keyboard focus on our UI thread: the menu handles Esc itself");
        Assert.True(MenuEscape.Needed(false, 9, 7), "focus in another thread (the user's app, or the WebView2 child)");
        Assert.True(MenuEscape.Needed(false, 0, 7), "focus unknown");
    }

    public static void Test_RegistersEscWhileOpenAndReleasesOnce()
    {
        var f = new Fake();
        using (MenuEscape m = f.Make())
        {
            m.Start();
            m.Start();   // opened again while open: no second registration
            Assert.True(m.Active && m.Registered && !m.Polling, "Esc registered as a hotkey");
            Assert.Eq(1, f.Registers, "registered once");
            Assert.True(m.OnHotKey(MenuEscape.Id), "our Esc id is handled");
            Assert.Eq(1, f.Closes, "Esc closes the menu");
            Assert.True(!m.OnHotKey(MenuEscape.Id + 1), "another hotkey id is not ours");
            m.Stop();
            m.Stop();
            Assert.Eq(1, f.Unregisters, "released exactly once");
            Assert.True(!m.Active && !m.Registered, "inactive after the menu closed");
            Assert.True(m.OnHotKey(MenuEscape.Id), "a late WM_HOTKEY is still recognised");
            Assert.Eq(1, f.Closes, "but closes nothing once the menu is closed");
        }
        Assert.Eq(1, f.Unregisters, "Dispose after Stop does not release again");
    }

    public static void Test_FallsBackToPollingWhenEscIsTaken()
    {
        var f = new Fake();
        f.RegisterResult = false;
        f.EscDown = true;   // held while the menu opens: must not close it
        using (MenuEscape m = f.Make())
        {
            m.Start();
            Assert.True(m.Active && !m.Registered && m.Polling, "polling instead of a hotkey");
            m.PollOnce();
            Assert.Eq(0, f.Closes, "a key held since before the menu opened does not count");
            f.EscDown = false; m.PollOnce();
            f.EscDown = true; m.PollOnce();
            Assert.Eq(1, f.Closes, "a new press closes the menu");
            m.PollOnce();
            Assert.Eq(1, f.Closes, "holding it does not close again");
            m.Stop();
            Assert.True(!m.Polling, "polling stops with the menu");
            Assert.Eq(0, f.Unregisters, "nothing to release: it was never registered");
            f.EscDown = false; m.PollOnce(); f.EscDown = true; m.PollOnce();
            Assert.Eq(1, f.Closes, "no closing after Stop");
        }
    }

    public static void Test_ReleasedOnDisposeAndWhenClosingThrows()
    {
        var f = new Fake();
        MenuEscape m = f.Make();
        m.Start();
        m.Dispose();
        Assert.Eq(1, f.Unregisters, "Dispose releases Esc (app exit with the menu open)");

        var g = new Fake();
        g.CloseThrows = true;
        using (MenuEscape n = g.Make())
        {
            n.Start();
            bool threw = false;
            try { n.OnHotKey(MenuEscape.Id); }
            catch (InvalidOperationException) { threw = true; }
            Assert.True(threw, "the failure is not hidden");
            Assert.True(!n.Registered && !n.Active, "but Esc is released anyway");
            Assert.Eq(1, g.Unregisters, "released once");
        }
    }

    public static void Test_ReopenCycleRegistersAgain()
    {
        var f = new Fake();
        using (MenuEscape m = f.Make())
        {
            m.Start();
            m.Stop();
            m.Start();
            Assert.Eq(2, f.Registers, "registered for each open");
            Assert.Eq(1, f.Unregisters, "released once so far (the second menu is still open)");
            Assert.True(m.Active && m.Registered, "active again");
        }
    }
}

// 1.1.2 item 2: a click on our own window closes the menu, in every layout. Neither of the menu's own ways to notice a
// click reaches it (the press goes to the WebView2 browser process's thread, and the window's activation does not
// change), so the mouse buttons are polled while the menu is open (MenuClickAway).
public static class MenuClickAwayTests
{
    const short Down = unchecked((short)0x8000);
    const short Tapped = 0x0001;   // GetAsyncKeyState's "pressed since the last call" bit

    class Fake
    {
        public readonly Dictionary<int, short> State = new Dictionary<int, short>();
        public bool OverOurWindow = true;
        public int Closes, Looks;
        public bool CloseThrows;
        public MenuClickAway Make()
        {
            return new MenuClickAway(
                delegate(int vk) { short s; return State.TryGetValue(vk, out s) ? s : (short)0; },
                delegate { Looks++; return OverOurWindow; },
                delegate { Closes++; if (CloseThrows) throw new InvalidOperationException("close failed"); });
        }
        public void Set(int vk, short s) { State[vk] = s; }
    }

    public static void Test_WatchesTheThreeButtons()
    {
        Assert.Eq("1,2,4", string.Join(",", Array.ConvertAll(MenuClickAway.Buttons, delegate(int b) { return b.ToString(); })),
            "VK_LBUTTON, VK_RBUTTON, VK_MBUTTON");
    }

    public static void Test_Pressed()
    {
        Assert.True(MenuClickAway.Pressed(Down, false), "went down since the last look");
        Assert.True(!MenuClickAway.Pressed(Down, true), "still held");
        Assert.True(!MenuClickAway.Pressed(0, false), "up");
        Assert.True(!MenuClickAway.Pressed(0, true), "let go");
        Assert.True(MenuClickAway.Pressed(Tapped, false), "a tap shorter than one poll (down and up between two looks)");
        Assert.True(MenuClickAway.Pressed(unchecked((short)(0x8000 | 1)), true), "let go and pressed again between two looks");
    }

    public static void Test_APressOnOurWindowClosesTheMenu()
    {
        var f = new Fake();
        using (MenuClickAway m = f.Make())
        {
            m.Start();
            Assert.True(m.Active && m.Polling, "polling while the menu is open");
            m.PollOnce();
            Assert.Eq(0, f.Closes, "no press: nothing");
            Assert.Eq(0, f.Looks, "and no window lookup either");
            f.Set(MenuClickAway.Buttons[0], Down);
            m.PollOnce();
            Assert.Eq(1, f.Closes, "left press on our window: closed");
            m.PollOnce();
            Assert.Eq(1, f.Closes, "holding it does not close again");
            f.Set(MenuClickAway.Buttons[0], 0);
            f.Set(MenuClickAway.Buttons[1], Down);
            m.PollOnce();
            Assert.Eq(2, f.Closes, "a right press too (the page then opens the menu again where it was pressed)");
            f.Set(MenuClickAway.Buttons[1], 0);
            m.PollOnce();
            f.Set(MenuClickAway.Buttons[2], Tapped);
            m.PollOnce();
            Assert.Eq(3, f.Closes, "a quick middle tap between two looks");
        }
    }

    // On the menu itself (its popups are their own top-level windows) or on another program's window, the press is not
    // ours: the menu handles its own items, and a click elsewhere already closes it by the activation change.
    public static void Test_APressElsewhereIsLeftToTheMenu()
    {
        var f = new Fake();
        f.OverOurWindow = false;
        using (MenuClickAway m = f.Make())
        {
            m.Start();
            f.Set(MenuClickAway.Buttons[0], Down);
            m.PollOnce();
            Assert.Eq(0, f.Closes, "not over our window: left alone");
            Assert.Eq(1, f.Looks, "looked once, on the press");
        }
    }

    // The right-click that opened the menu (or a button still held when it opens) is not a click away from it.
    public static void Test_AButtonHeldWhenTheMenuOpensDoesNotCount()
    {
        var f = new Fake();
        f.Set(MenuClickAway.Buttons[1], unchecked((short)(0x8000 | 1)));
        using (MenuClickAway m = f.Make())
        {
            m.Start();
            f.Set(MenuClickAway.Buttons[1], Down);   // the "pressed since" bit went with the look at Start
            m.PollOnce();
            Assert.Eq(0, f.Closes, "still the same press");
            f.Set(MenuClickAway.Buttons[1], 0);
            m.PollOnce();
            f.Set(MenuClickAway.Buttons[1], Down);
            m.PollOnce();
            Assert.Eq(1, f.Closes, "a new press does");
        }
    }

    public static void Test_StopsWithTheMenu()
    {
        var f = new Fake();
        MenuClickAway m = f.Make();
        m.Start();
        m.Stop();
        m.Stop();
        Assert.True(!m.Active && !m.Polling, "stopped");
        f.Set(MenuClickAway.Buttons[0], Down);
        m.PollOnce();
        Assert.Eq(0, f.Closes, "no closing after Stop");
        m.Start();
        f.Set(MenuClickAway.Buttons[0], 0);
        m.PollOnce();
        f.Set(MenuClickAway.Buttons[0], Down);
        m.PollOnce();
        Assert.Eq(1, f.Closes, "the next menu is watched again");
        m.Dispose();
        Assert.True(!m.Active && !m.Polling, "Dispose stops it (app exit with the menu open)");

        var g = new Fake();
        g.CloseThrows = true;
        using (MenuClickAway n = g.Make())
        {
            n.Start();
            g.Set(MenuClickAway.Buttons[0], Down);
            bool threw = false;
            try { n.PollOnce(); }
            catch (InvalidOperationException) { threw = true; }
            Assert.True(threw, "the failure is not hidden");
            Assert.True(!n.Active && !n.Polling, "but the poll stops");
        }
    }
}
