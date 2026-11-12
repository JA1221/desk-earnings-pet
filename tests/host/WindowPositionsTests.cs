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
}
