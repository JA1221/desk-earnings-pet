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
}
