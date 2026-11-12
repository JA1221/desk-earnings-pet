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

    public static void Test_TopLevelItemsInOrder()
    {
        using (var t = new TrayMenu())
        {
            var labels = new List<string>();
            foreach (ToolStripItem i in t.Menu.Items)
                if (!(i is ToolStripSeparator)) labels.Add(i.Text);
            Assert.Eq("切換版型|縮成迷你|餵食|開始上班|調整起算時間|下班|永遠在最上層|設定|紀錄|隱藏|結束",
                string.Join("|", labels.ToArray()), "top-level labels");
            var sub = new List<string>();
            foreach (ToolStripItem i in ((ToolStripMenuItem)t.Menu.Items[0]).DropDownItems) sub.Add(i.Text);
            Assert.Eq("U1 經典直式|U3 遊戲畫面|U5-B 橫向極簡|U7 桌面寵物", string.Join("|", sub.ToArray()), "layout submenu");
        }
    }

    public static void Test_EachItemSendsItsActionId()
    {
        string[] ids = { "layout:U1", "layout:U3", "layout:U5B", "layout:U7", "mini", "feed", "start", "adjust", "end",
                         "topmost", "settings", "history", "toggleVisible", "quit" };
        using (var t = new TrayMenu())
        {
            var got = new List<string>();
            t.ItemClicked += got.Add;
            foreach (string id in ids) Item(t, id).PerformClick();
            Assert.Eq(string.Join(",", ids), string.Join(",", got.ToArray()), "action ids");
        }
    }

    public static void Test_StateShowsChecksAndToggleLabel()
    {
        using (var t = new TrayMenu())
        {
            t.SetState("U7", true, true);
            Assert.True(Item(t, "layout:U7").Checked, "current layout checked");
            Assert.True(!Item(t, "layout:U1").Checked, "other layouts unchecked");
            Assert.True(Item(t, "topmost").Checked, "topmost checked");
            Assert.Eq("隱藏", Item(t, "toggleVisible").Text, "visible -> 隱藏");
            t.SetState("M3", false, false);
            Assert.True(!Item(t, "layout:U7").Checked, "mini is not a main layout");
            Assert.True(!Item(t, "topmost").Checked, "topmost unchecked");
            Assert.Eq("顯示", Item(t, "toggleVisible").Text, "hidden -> 顯示");
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
