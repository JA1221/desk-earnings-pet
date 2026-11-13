using System;
using System.Drawing;

public static class WindowPositionsTests
{
    static Point Get(WindowPositions p, string layout)
    {
        Point pt;
        Assert.True(p.TryGet(layout, out pt), "has " + layout);
        return pt;
    }

    static void Missing(WindowPositions p, string layout)
    {
        Point pt;
        Assert.True(!p.TryGet(layout, out pt), "no " + (layout ?? "<null>"));
    }

    public static void Test_RoundTrip()
    {
        var p = new WindowPositions();
        p.Set("U1", new Point(100, -200));
        p.Set("U7", new Point(-1500, 300));
        WindowPositions q = WindowPositions.Parse(p.ToJson());
        Assert.Eq(new Point(100, -200), Get(q, "U1"), "U1");
        Assert.Eq(new Point(-1500, 300), Get(q, "U7"), "U7 on a monitor left of the primary");
        Missing(q, "U3");
    }

    public static void Test_JsonShape()
    {
        var p = new WindowPositions();
        p.Set("U1", new Point(1, 2));
        Assert.Eq("{\"U1\":{\"x\":1,\"y\":2}}", p.ToJson(), "layout -> {x, y}");
        p.Set("U1", new Point(3, 4));
        Assert.Eq("{\"U1\":{\"x\":3,\"y\":4}}", p.ToJson(), "set overwrites");
    }

    public static void Test_ParseCorruptIsEmpty()
    {
        string[] bad = { null, "", "   ", "{not json", "[]", "42", "\"x\"", "null" };
        foreach (string s in bad)
        {
            WindowPositions p = WindowPositions.Parse(s);
            Assert.True(p != null, "never null: " + (s ?? "<null>"));
            Missing(p, "U1");
            Assert.Eq("{}", p.ToJson(), "empty: " + (s ?? "<null>"));
        }
    }

    public static void Test_ParseSkipsBadEntries()
    {
        WindowPositions p = WindowPositions.Parse(
            "{\"U1\":{\"x\":1,\"y\":2},\"U3\":{\"x\":\"a\",\"y\":2},\"U5B\":{\"x\":1},\"U7\":5," +
            "\"M3\":{\"x\":1.5e10,\"y\":0},\"PANEL\":{\"x\":10.4,\"y\":-3.6}," +
            "\"" + new string('L', 33) + "\":{\"x\":1,\"y\":1}}");
        Assert.Eq(new Point(1, 2), Get(p, "U1"), "good entry kept");
        Missing(p, "U3");
        Missing(p, "U5B");
        Missing(p, "U7");
        Missing(p, "M3");
        Assert.Eq(new Point(10, -4), Get(p, "PANEL"), "fractions rounded");
        Missing(p, new string('L', 33));
    }

    public static void Test_BadLayoutNamesIgnored()
    {
        var p = new WindowPositions();
        p.Set(null, new Point(1, 1));
        p.Set("", new Point(1, 1));
        p.Set(new string('L', 33), new Point(1, 1));
        Assert.Eq("{}", p.ToJson(), "nothing stored");
        Missing(p, null);
    }

    public static void Test_SizesRoundTripNextToPositions()
    {
        var p = new WindowPositions();
        p.SetSize("U1", new Size(347, 593));
        p.Set("U1", new Point(-599, 463));
        p.SetSize("M3", new Size(175, 175));   // a size without a position is kept too
        Assert.Eq("{\"M3\":{\"w\":175,\"h\":175},\"U1\":{\"x\":-599,\"y\":463,\"w\":347,\"h\":593}}", p.ToJson(), "json shape");
        WindowPositions q = WindowPositions.Parse(p.ToJson());
        Size s;
        Assert.True(q.TryGetSize("U1", out s) && s == new Size(347, 593), "U1 size");
        Assert.Eq(new Point(-599, 463), Get(q, "U1"), "U1 position unchanged by the size");
        Assert.True(q.TryGetSize("M3", out s) && s == new Size(175, 175), "M3 size");
        Missing(q, "M3");
        Assert.True(!q.TryGetSize("U7", out s), "no size for U7");
    }

    // 1.1.2: the shared anchor is one more entry, "anchor", beside the layouts; its w / h are the physical size of the
    // window it was set with. The layouts' own entries stay as they are (a downgrade to 1.1.1 still reads them).
    public static void Test_AnchorIsAnEntryBesideTheLayouts()
    {
        WindowPositions p = WindowPositions.Parse("{\"U1\":{\"x\":-602,\"y\":520,\"w\":347,\"h\":609}}");
        Point at;
        Size? size;
        Assert.True(!p.TryGetAnchor(out at, out size), "a 1.1.1 file has no anchor");
        p.SetAnchor(new Point(-602, 520), new Size(521, 914));
        Assert.Eq("{\"U1\":{\"x\":-602,\"y\":520,\"w\":347,\"h\":609},\"anchor\":{\"x\":-602,\"y\":520,\"w\":521,\"h\":914}}", p.ToJson(), "json shape");
        WindowPositions q = WindowPositions.Parse(p.ToJson());
        Assert.True(q.TryGetAnchor(out at, out size), "read back");
        Assert.Eq(new Point(-602, 520), at, "anchor spot");
        Assert.Eq((Size?)new Size(521, 914), size, "the size it was set with");
        Assert.Eq(new Point(-602, 520), Get(q, "U1"), "U1's own entry is untouched");
        // 1.1.1 reads "anchor" as a layout it never shows: it keeps it and writes it back as it was
        q.Set("U3", new Point(1, 2));
        Assert.True(q.ToJson().Contains("\"anchor\":{\"x\":-602,\"y\":520,\"w\":521,\"h\":914}"), "kept through another save");
    }

    public static void Test_AnchorWithoutASizeOrWithABadOne()
    {
        Point at;
        Size? size;
        WindowPositions p = WindowPositions.Parse("{\"anchor\":{\"x\":10,\"y\":-20}}");
        Assert.True(p.TryGetAnchor(out at, out size) && at == new Point(10, -20), "a spot alone");
        Assert.True(!size.HasValue, "no size: unknown");
        p = WindowPositions.Parse("{\"anchor\":{\"x\":10,\"y\":-20,\"w\":0,\"h\":5}}");
        Assert.True(p.TryGetAnchor(out at, out size) && !size.HasValue, "a bad size: unknown");
        p = WindowPositions.Parse("{\"anchor\":{\"w\":300,\"h\":300}}");
        Assert.True(!p.TryGetAnchor(out at, out size), "a size alone is no anchor");
        p = WindowPositions.Parse("{\"anchor\":5}");
        Assert.True(!p.TryGetAnchor(out at, out size), "garbage");
    }

    public static void Test_BadSizesAreSkipped()
    {
        WindowPositions p = WindowPositions.Parse(
            "{\"U1\":{\"x\":1,\"y\":2,\"w\":0,\"h\":593},\"U3\":{\"w\":5000,\"h\":10},\"U7\":{\"w\":\"a\",\"h\":1},\"M3\":{\"w\":100.4,\"h\":99.6}}");
        Size s;
        Assert.True(!p.TryGetSize("U1", out s), "zero width");
        Assert.Eq(new Point(1, 2), Get(p, "U1"), "the position survives a bad size");
        Assert.True(!p.TryGetSize("U3", out s), "too large");
        Assert.True(!p.TryGetSize("U7", out s), "not a number");
        Assert.True(p.TryGetSize("M3", out s) && s == new Size(100, 100), "fractions rounded");
        p.SetSize("U5B", new Size(0, 10));
        Assert.True(!p.TryGetSize("U5B", out s), "SetSize ignores an empty size");
    }
}
