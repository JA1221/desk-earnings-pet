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

    // Simplification #2: by how often each is used. 餵食 (with the snack count) on top; one item that follows the
    // work status (開始上班 / 下班 / 繼續上班) with 調整起算時間; 版型 ▶ holds the layouts, 縮成迷你 and 永遠在最上層;
    // then 紀錄, 設定, 隱藏, 結束. Three separators (there were five).
    public static void Test_TopLevelItemsInOrder()
    {
        using (var t = new TrayMenu())
        {
            Assert.Eq("餵食|-|開始上班|調整起算時間|-|版型|紀錄|設定|-|隱藏|結束", Labels(t.Menu.Items), "top level");
            Assert.Eq("U1 經典直式|U3 遊戲畫面|U5-B 橫向極簡|U7 桌面寵物|-|縮成迷你|-|永遠在最上層",
                Labels(Item(t, "layouts").DropDownItems), "版型 submenu");
        }
    }

    public static void Test_EachItemSendsItsActionId()
    {
        string[] ids = { "layout:U1", "layout:U3", "layout:U5B", "layout:U7", "mini", "topmost", "feed", "adjust",
                         "settings", "history", "toggleVisible", "quit" };
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

    // Esc closes the open submenu first (the 版型 one), then the menu.
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
