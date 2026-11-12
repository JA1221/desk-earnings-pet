using System;
using System.Collections.Generic;

public static class BridgeTests
{
    public static void Test_ParseMalformedIsIgnored()
    {
        string[] bad = { null, "", "[]", "42", "{}", "{\"type\":5}", "{not json", "\"str\"" };
        foreach (string s in bad)
            Assert.True(Bridge.Parse(s) == null, "should be null: " + (s ?? "<null>"));
    }

    public static void Test_ParseTypeAndFields()
    {
        Dictionary<string, object> d = Bridge.Parse("{\"type\":\"saveSettings\",\"text\":\"hi\",\"on\":true}");
        Assert.True(d != null, "parsed");
        Assert.Eq("saveSettings", d["type"], "type");
        Assert.Eq("hi", d["text"], "text");
        Assert.Eq(true, d["on"], "bool");
    }

    public static void Test_BuildMessage_MergesPayload()
    {
        Dictionary<string, object> d = Bridge.Parse(Bridge.BuildMessage("session", new { kind = "lock", ms = 5L }));
        Assert.Eq("session", d["type"], "type");
        Assert.Eq("lock", d["kind"], "kind");
        Assert.Eq(5, Convert.ToInt32(d["ms"]), "ms");
        Dictionary<string, object> e = Bridge.Parse(Bridge.BuildMessage("dragEnd", null));
        Assert.Eq("dragEnd", e["type"], "null payload");
    }

    public static void Test_FieldAccessorsAreTyped()
    {
        Dictionary<string, object> d = Bridge.Parse(
            "{\"type\":\"x\",\"s\":\"hi\",\"b\":true,\"n\":1.25,\"i\":3,\"big\":12345678901,\"str7\":\"7\",\"nul\":null}");
        Assert.Eq("hi", Bridge.Str(d, "s"), "string");
        Assert.True(Bridge.Str(d, "b") == null, "bool is not a string");
        Assert.True(Bridge.Str(d, "missing") == null, "missing string");
        Assert.Eq(true, Bridge.Bool(d, "b"), "bool");
        Assert.True(Bridge.Bool(d, "s") == null, "string is not a bool");
        Assert.True(Bridge.Bool(d, "nul") == null, "null is not a bool");
        Assert.Eq(1.25, Bridge.Num(d, "n", -1), "fraction");
        Assert.Eq(3.0, Bridge.Num(d, "i", -1), "int");
        Assert.Eq(12345678901.0, Bridge.Num(d, "big", -1), "long");
        Assert.Eq(-1.0, Bridge.Num(d, "str7", -1), "numeric string is not a number");
        Assert.Eq(-1.0, Bridge.Num(d, "b", -1), "bool is not a number");
        Assert.Eq(-1.0, Bridge.Num(d, "missing", -1), "missing number");
        Assert.True(Bridge.Str(null, "s") == null && Bridge.Bool(null, "b") == null && Bridge.Num(null, "n", 2) == 2, "null message");
    }

    public static void Test_RectsSkipMalformedEntries()
    {
        Dictionary<string, object> d = Bridge.Parse(
            "{\"type\":\"hitRects\",\"rects\":[[1,2,3,4],[1,2],\"x\",[0,0,-1,5],[1.5,2.5,3,4],[0,0,\"w\",4],null,[0,0,0,0]]}");
        System.Drawing.RectangleF[] r = Bridge.Rects(d, "rects", 64);
        Assert.Eq(3, r.Length, "three usable rects");
        Assert.Eq(new System.Drawing.RectangleF(1, 2, 3, 4), r[0], "first");
        Assert.Eq(new System.Drawing.RectangleF(1.5f, 2.5f, 3, 4), r[1], "fractions");
        Assert.Eq(new System.Drawing.RectangleF(0, 0, 0, 0), r[2], "empty rect is valid (hits nothing)");
        Assert.Eq(0, Bridge.Rects(Bridge.Parse("{\"type\":\"hitRects\",\"rects\":5}"), "rects", 64).Length, "not a list");
        Assert.Eq(0, Bridge.Rects(Bridge.Parse("{\"type\":\"hitRects\"}"), "rects", 64).Length, "missing");
        Assert.Eq(2, Bridge.Rects(Bridge.Parse("{\"type\":\"hitRects\",\"rects\":[[0,0,1,1],[0,0,1,1],[0,0,1,1]]}"), "rects", 2).Length, "capped");
    }
}
