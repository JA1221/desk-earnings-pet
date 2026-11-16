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

    // 1.1.3 item 4: four groups with a separator between them. 健康, 上班, 畫面 (版型 ▶, 隱藏視窗), 其他. The user's ruling
    // (1.1.3 A2, 「這種很直覺的不用做在選單」): no 隱藏金額, 少記一杯 or 我剛起來動過了 (a click on the amount, a long press
    // on a water button or on the 🧍 do them); 記一杯水 stays, since U7 and M3 have no water button.
    public static void Test_MenuIsGroupedInFour()
    {
        using (var t = new TrayMenu())
        {
            Assert.Eq("記一杯水|開始番茄鐘|-|開始上班|調整起算時間|餵食|-|版型|隱藏視窗|-|紀錄|設定|結束", Labels(t.Menu.Items), "groups");
            t.SetHealth("3/8", "focus", 0);
            Assert.Eq("記一杯水|停止番茄鐘（還剩 1 分）|開始上班|調整起算時間|餵食|版型|隱藏視窗|紀錄|設定|結束", Shown(t, 99), "with cups today, all shown");
            foreach (string gone in new[] { "mask", "undrink", "stoodUp" })
                Assert.Eq(0, t.Menu.Items.Find(gone, true).Length, "no " + gone + " item");
        }
    }

    // 版型 ▶: the layouts, 永遠在最上層, and last 膠囊位置 ▶, which only U10 shows (spec 4.9 #2, 5.7).
    public static void Test_LayoutSubmenu()
    {
        using (var t = new TrayMenu())
        {
            ToolStripItemCollection items = Item(t, "layouts").DropDownItems;
            Assert.Eq("1 經典直式|2 遊戲畫面|3 健康儀表板|4 番茄鐘優先|-|5 橫向極簡|6 頂端小膠囊|7 迷你浮窗|-|8 桌面寵物|-|永遠在最上層|膠囊位置",
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
        string[] ids = { "layout:U1", "layout:U3", "layout:U5B", "layout:U7", "layout:M3", "topmost", "feed", "adjust",
                         "settings", "history", "toggleVisible", "quit",
                         "layout:U10", "layout:U12", "layout:U13", "pomodoro", "drink",
                         "capsule:top", "capsule:bottomLeft", "capsule:bottomCenter", "capsule:bottomRight" };
        using (var t = new TrayMenu())
        {
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

    // The first n items the menu shows (Available), by label.
    static string Shown(TrayMenu t, int n)
    {
        var labels = new List<string>();
        foreach (ToolStripItem i in t.Menu.Items)
            if (i.Available && !(i is ToolStripSeparator) && labels.Count < n) labels.Add(i.Text);
        return string.Join("|", labels.ToArray());
    }

    public static void Test_StateShowsChecksAndToggleLabel()
    {
        using (var t = new TrayMenu())
        {
            t.SetState("U7", true, true);
            Assert.True(Item(t, "layout:U7").Checked, "current layout checked");
            Assert.True(!Item(t, "layout:U1").Checked, "other layouts unchecked");
            Assert.True(!Item(t, "layout:M3").Checked, "not the mini badge");
            Assert.True(Item(t, "topmost").Checked, "topmost checked");
            Assert.Eq("隱藏視窗", Item(t, "toggleVisible").Text, "visible -> 隱藏視窗");
            t.SetState("M3", false, false);
            Assert.True(!Item(t, "layout:U7").Checked, "mini is not a main layout");
            Assert.True(Item(t, "layout:M3").Checked, "7 迷你浮窗 is checked while the mini badge shows");
            Assert.True(!Item(t, "topmost").Checked, "topmost unchecked");
            Assert.Eq("顯示視窗", Item(t, "toggleVisible").Text, "hidden -> 顯示視窗");
            t.SetState(null, false, false);
            Assert.True(!Item(t, "layout:M3").Checked && !Item(t, "layout:U1").Checked, "no layout yet");
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
