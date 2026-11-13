using System;
using System.Collections.Generic;
using System.Windows.Forms;

public static class TrayMenuTests
{
    static ToolStripMenuItem Item(TrayMenu t, string action)
    {
        ToolStripItem[] found = t.Menu.Items.Find(action, true);
        Assert.Eq(1, found.Length, "one item for " + action);
        return (ToolStripMenuItem)found[0];
    }

    // Labels in order, "-" for a separator.
    static string Labels(ToolStripItemCollection items)
    {
        var labels = new List<string>();
        foreach (ToolStripItem i in items) labels.Add(i is ToolStripSeparator ? "-" : i.Text);
        return string.Join("|", labels.ToArray());
    }

    // Labels in order, separators left out.
    static string ItemLabels(ToolStripItemCollection items)
    {
        var labels = new List<string>();
        foreach (ToolStripItem i in items) if (!(i is ToolStripSeparator)) labels.Add(i.Text);
        return string.Join("|", labels.ToArray());
    }

    // Simplification #2 (spec 4.9): by how often each is used. The top group is 記一杯水 (with the cups), 開始番茄鐘,
    // then 1.0's 餵食; then the work item (開始上班 / 下班 / 繼續上班) with 調整起算時間; 版型 ▶, 紀錄, 設定; 隱藏, 結束.
    public static void Test_HealthItemsLeadTheMenu()
    {
        using (var t = new TrayMenu())
        {
            Assert.Eq("記一杯水|少記一杯|我剛起來動過了|開始番茄鐘|餵食|開始上班|調整起算時間|版型|紀錄|設定|隱藏|結束", ItemLabels(t.Menu.Items), "top level");
        }
    }

    // 版型 ▶: the layouts, 縮成迷你, 永遠在最上層, and last 膠囊位置 ▶, which only U10 shows (spec 4.9 #2, 5.7).
    public static void Test_LayoutSubmenu()
    {
        using (var t = new TrayMenu())
        {
            ToolStripItemCollection items = Item(t, "layouts").DropDownItems;
            Assert.Eq("U1 經典直式|U3 遊戲畫面|U5-B 橫向極簡|U7 桌面寵物|U10 頂端小膠囊|U12 健康儀表板|U13 番茄鐘優先|-|縮成迷你|-|永遠在最上層|膠囊位置",
                Labels(items), "版型 submenu");
            ToolStripMenuItem capsule = Item(t, "capsule");
            Assert.True(object.ReferenceEquals(capsule, items[items.Count - 1]), "膠囊位置 is the last item");
            Assert.Eq("上方正中間|左下|中下|右下", Labels(capsule.DropDownItems), "膠囊位置 submenu");
            Assert.True(!capsule.Available, "no layout yet: hidden");
            t.SetState("U10", true, true, "bottomRight");
            Assert.True(capsule.Available, "shown in U10");
            Assert.True(Item(t, "layout:U10").Checked, "U10 checked");
            Assert.True(Item(t, "capsule:bottomRight").Checked, "the current dock checked");
            Assert.True(!Item(t, "capsule:top").Checked && !Item(t, "capsule:bottomLeft").Checked && !Item(t, "capsule:bottomCenter").Checked,
                "the other docks unchecked");
            t.SetState("U10", true, true, "top");
            Assert.True(Item(t, "capsule:top").Checked && !Item(t, "capsule:bottomRight").Checked, "the check follows the dock");
            t.SetState("U1", false, true);
            Assert.True(!capsule.Available, "hidden for U1");
            t.SetState("M3", false, true, "top");
            Assert.True(!capsule.Available, "hidden for the mini badge");
            t.SetState("U13", false, true);
            Assert.True(Item(t, "layout:U13").Checked && !Item(t, "layout:U10").Checked, "U13 checked");
        }
    }

    public static void Test_EachItemSendsItsActionId()
    {
        string[] ids = { "layout:U1", "layout:U3", "layout:U5B", "layout:U7", "mini", "topmost", "feed", "adjust",
                         "settings", "history", "toggleVisible", "quit",
                         "layout:U10", "layout:U12", "layout:U13", "pomodoro", "drink", "undrink", "stoodUp",
                         "capsule:top", "capsule:bottomLeft", "capsule:bottomCenter", "capsule:bottomRight" };
        using (var t = new TrayMenu())
        {
            t.SetHealth("1/8", "idle", 0, true);   // 少記一杯 shows only with a cup today, 我剛起來動過了 with 起來動 on
            var got = new List<string>();
            t.ItemClicked += got.Add;
            foreach (string id in ids) Item(t, id).PerformClick();
            Assert.Eq(string.Join(",", ids), string.Join(",", got.ToArray()), "action ids");
        }
    }

    // The work item: 開始上班 before work (and on a day off), 下班 while the day runs (working, lunch, 可以下班), and
    // 繼續上班 after 下班 (the page's start action continues an ended day). Before the page says anything: 開始上班.
    public static void Test_WorkItemFollowsTheStatus()
    {
        using (var t = new TrayMenu())
        {
            var got = new List<string>();
            t.ItemClicked += got.Add;
            ToolStripMenuItem w = Item(t, "work");
            Assert.Eq("開始上班", w.Text, "before the page reports");
            w.PerformClick();
            t.SetWork("working");
            Assert.Eq("下班", w.Text, "working");
            w.PerformClick();
            t.SetWork("ended");
            Assert.Eq("繼續上班", w.Text, "after 下班");
            w.PerformClick();
            t.SetWork("before");
            Assert.Eq("開始上班", w.Text, "not started");
            w.PerformClick();
            t.SetWork("bogus");
            Assert.Eq("開始上班", w.Text, "anything else");
            t.SetWork(null);
            Assert.Eq("開始上班", w.Text, "nothing");
            Assert.Eq("start,end,start,start", string.Join(",", got.ToArray()), "the page's action ids");
            Assert.True(object.ReferenceEquals(w, Item(t, "work")), "one item that changes, not three");
        }
    }

    public static void Test_FeedShowsTheSnackCount()
    {
        using (var t = new TrayMenu())
        {
            ToolStripMenuItem f = Item(t, "feed");
            Assert.True(string.IsNullOrEmpty(f.ShortcutKeyDisplayString), "no count before the page reports");
            t.SetSnacks(3);
            Assert.Eq("餵食", f.Text, "label");
            Assert.Eq("×3", f.ShortcutKeyDisplayString, "the count on the right");
            Assert.True(f.ShowShortcutKeys, "shown");
            t.SetSnacks(0);
            Assert.Eq("×0", f.ShortcutKeyDisplayString, "none left");
            Assert.True(f.Enabled, "still clickable: the pet says how far the next snack is");
            t.SetSnacks(-1);
            Assert.True(string.IsNullOrEmpty(f.ShortcutKeyDisplayString), "unknown: no count");
        }
    }

    // 開始番茄鐘 reads 停止番茄鐘（還剩 N 分） while a focus or a break runs, N rounded up and at least 1.
    public static void Test_PomodoroLabel()
    {
        double now = 1794470400000;   // a fixed time in ms
        Assert.Eq("開始番茄鐘", TrayMenu.PomodoroLabel("idle", 0, now), "idle");
        Assert.Eq("停止番茄鐘（還剩 12 分）", TrayMenu.PomodoroLabel("focus", now + 12 * 60000, now), "focus, 12 min left");
        Assert.Eq("停止番茄鐘（還剩 12 分）", TrayMenu.PomodoroLabel("focus", now + 11 * 60000 + 1, now), "a part minute counts as one");
        Assert.Eq("停止番茄鐘（還剩 3 分）", TrayMenu.PomodoroLabel("break", now + 3 * 60000, now), "break");
        Assert.Eq("停止番茄鐘（還剩 1 分）", TrayMenu.PomodoroLabel("focus", now - 5000, now), "already over: at least 1");
        Assert.Eq("開始番茄鐘", TrayMenu.PomodoroLabel("breakOver", now + 60000, now), "休息結束: nothing runs");
        Assert.Eq("開始番茄鐘", TrayMenu.PomodoroLabel(null, 0, now), "not reported");
        using (var t = new TrayMenu())
        {
            var got = new List<string>();
            t.ItemClicked += got.Add;
            ToolStripMenuItem p = Item(t, "pomodoro");
            Assert.Eq("開始番茄鐘", p.Text, "before the page reports");
            double soon = (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds + 12 * 60000 - 2000;
            t.SetHealth(null, "focus", soon);
            Assert.Eq("停止番茄鐘（還剩 12 分）", p.Text, "the label follows the page");
            p.PerformClick();
            t.SetHealth(null, "idle", 0);
            Assert.Eq("開始番茄鐘", p.Text, "back to start");
            p.PerformClick();
            Assert.Eq("pomodoro,pomodoro", string.Join(",", got.ToArray()), "one action id for start and stop: the page toggles");
        }
    }

    // 記一杯水 shows today's cups (3/8) on the right when the page shows them (spec 4.9 #8), else nothing.
    public static void Test_CupsCount()
    {
        using (var t = new TrayMenu())
        {
            ToolStripMenuItem d = Item(t, "drink");
            Assert.True(string.IsNullOrEmpty(d.ShortcutKeyDisplayString), "nothing before the page reports");
            t.SetHealth("3/8", "idle", 0);
            Assert.Eq("記一杯水", d.Text, "label");
            Assert.Eq("3/8", d.ShortcutKeyDisplayString, "the cups on the right");
            Assert.True(d.ShowShortcutKeys, "shown");
            t.SetHealth(null, "idle", 0);
            Assert.True(string.IsNullOrEmpty(d.ShortcutKeyDisplayString), "hidden by the page: empty");
            Assert.True(d.Enabled, "still clickable");
        }
    }

    // 1.1.1: 少記一杯 sits right under 記一杯水 and shows only while today's cups (healthMenu cups, "N/goal") are above 0;
    // the page takes one cup off (undrink), never below 0.
    public static void Test_UndrinkShowsOnlyWithACupToday()
    {
        using (var t = new TrayMenu())
        {
            ToolStripMenuItem u = Item(t, "undrink");
            Assert.Eq("少記一杯", u.Text, "label");
            Assert.Eq(t.Menu.Items.IndexOf(Item(t, "drink")) + 1, t.Menu.Items.IndexOf(u), "directly under 記一杯水");
            Assert.True(!u.Available, "nothing reported yet: hidden");
            t.SetHealth("3/8", "idle", 0);
            Assert.True(u.Available, "3 cups: shown");
            Assert.True(string.IsNullOrEmpty(u.ShortcutKeyDisplayString), "no count of its own");
            var got = new List<string>();
            t.ItemClicked += got.Add;
            u.PerformClick();
            Assert.Eq("undrink", string.Join(",", got.ToArray()), "its action id");
            t.SetHealth("0/8", "idle", 0);
            Assert.True(!u.Available, "0 cups: hidden");
            t.SetHealth("1/8", "focus", 0);
            Assert.True(u.Available, "1 cup: shown");
            t.SetHealth(null, "idle", 0);
            Assert.True(!u.Available, "cups hidden by the page (water off, none today): hidden");
        }
    }

    // 1.1.2 item 7a: 我剛起來動過了 (stoodUp: the page counts a stand-up, restarts the sit timer and the pet says 「收到！」)
    // sits right after 少記一杯, so right after 記一杯水 while 少記一杯 is hidden, and shows only while the 起來動 reminder is
    // on (healthMenu sitOn).
    public static void Test_StoodUpShowsOnlyWhileTheSitReminderIsOn()
    {
        using (var t = new TrayMenu())
        {
            ToolStripMenuItem s = Item(t, "stoodUp");
            Assert.Eq("我剛起來動過了", s.Text, "label");
            Assert.Eq(t.Menu.Items.IndexOf(Item(t, "undrink")) + 1, t.Menu.Items.IndexOf(s), "right after 少記一杯");
            Assert.True(!s.Available, "nothing reported yet: hidden");
            t.SetHealth("3/8", "idle", 0, true);
            Assert.True(s.Available, "起來動 on: shown");
            Assert.Eq("記一杯水|少記一杯|我剛起來動過了|開始番茄鐘", Shown(t, 4), "after 少記一杯");
            t.SetHealth(null, "idle", 0, true);
            Assert.Eq("記一杯水|我剛起來動過了|開始番茄鐘|餵食", Shown(t, 4), "少記一杯 hidden: right after 記一杯水");
            var got = new List<string>();
            t.ItemClicked += got.Add;
            s.PerformClick();
            Assert.Eq("stoodUp", string.Join(",", got.ToArray()), "its action id");
            t.SetHealth("3/8", "focus", 0, false);
            Assert.True(!s.Available, "起來動 off: hidden");
            t.SetHealth("3/8", "idle", 0);
            Assert.True(!s.Available, "a page that does not say: hidden");
        }
    }

    // The first n items the menu shows (Available), by label.
    static string Shown(TrayMenu t, int n)
    {
        var labels = new List<string>();
        foreach (ToolStripItem i in t.Menu.Items)
            if (i.Available && !(i is ToolStripSeparator) && labels.Count < n) labels.Add(i.Text);
        return string.Join("|", labels.ToArray());
    }

    public static void Test_CupsToday()
    {
        Assert.Eq(3, TrayMenu.CupsToday("3/8"), "3/8");
        Assert.Eq(0, TrayMenu.CupsToday("0/8"), "0/8");
        Assert.Eq(12, TrayMenu.CupsToday("12/8"), "over the goal");
        Assert.Eq(0, TrayMenu.CupsToday(null), "null");
        Assert.Eq(0, TrayMenu.CupsToday(""), "empty");
        Assert.Eq(0, TrayMenu.CupsToday("x/8"), "garbage");
        Assert.Eq(0, TrayMenu.CupsToday("-2/8"), "negative");
        Assert.Eq(0, TrayMenu.CupsToday("99999999999/8"), "absurd");
    }

    public static void Test_StateShowsChecksAndToggleLabel()
    {
        using (var t = new TrayMenu())
        {
            t.SetState("U7", true, true);
            Assert.True(Item(t, "layout:U7").Checked, "current layout checked");
            Assert.True(!Item(t, "layout:U1").Checked, "other layouts unchecked");
            Assert.True(!Item(t, "mini").Checked, "not the mini badge");
            Assert.True(Item(t, "topmost").Checked, "topmost checked");
            Assert.Eq("隱藏", Item(t, "toggleVisible").Text, "visible -> 隱藏");
            t.SetState("M3", false, false);
            Assert.True(!Item(t, "layout:U7").Checked, "mini is not a main layout");
            Assert.True(Item(t, "mini").Checked, "縮成迷你 is checked while the mini badge shows");
            Assert.True(!Item(t, "topmost").Checked, "topmost unchecked");
            Assert.Eq("顯示", Item(t, "toggleVisible").Text, "hidden -> 顯示");
            t.SetState(null, false, false);
            Assert.True(!Item(t, "mini").Checked && !Item(t, "layout:U1").Checked, "no layout yet");
        }
    }

    // Esc closes the innermost open submenu first (膠囊位置, then 版型), then the menu.
    public static void Test_CloseInnermostWithoutAnOpenMenuIsSafe()
    {
        using (var t = new TrayMenu())
        {
            t.CloseInnermost();
            Assert.True(!t.Menu.Visible, "nothing open, nothing thrown");
        }
    }

    public static void Test_CoinIconSizes()
    {
        using (System.Drawing.Icon small = TrayMenu.CoinIcon(16))
        using (System.Drawing.Icon large = TrayMenu.CoinIcon(32))
        {
            Assert.Eq(16, small.Width, "16 px");
            Assert.Eq(32, large.Width, "32 px");
            using (System.Drawing.Bitmap b = large.ToBitmap())
            {
                Assert.Eq(0, (int)b.GetPixel(0, 0).A, "corner transparent");
                System.Drawing.Color c = b.GetPixel(16, 4);
                Assert.True(c.A == 255, "coin opaque near the top");
            }
        }
    }
}
