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

    public static void Test_DispatchIsolatesHandlers()
    {
        var errors = new List<string>();
        var posted = new List<string>();
        var b = new Bridge(posted.Add, delegate(string what, Exception ex) { errors.Add(what + ": " + ex.Message); });
        var seen = new List<string>();
        b.Received += delegate(string type, Dictionary<string, object> d) { throw new InvalidOperationException("boom"); };
        b.Received += delegate(string type, Dictionary<string, object> d) { seen.Add(type + "/" + d["a"]); };
        b.Dispatch("{\"type\":\"hitRects\",\"a\":1}");
        Assert.Eq("hitRects/1", string.Join(",", seen.ToArray()), "second handler still ran");
        Assert.Eq(1, errors.Count, "the throwing handler was reported");
        Assert.True(errors[0].Contains("hitRects") && errors[0].Contains("boom"), "report names the message: " + errors[0]);
        b.Dispatch("{not json");
        b.Dispatch(null);
        Assert.Eq(1, seen.Count, "malformed messages reach no handler");
        var empty = new Bridge(posted.Add, null);
        empty.Dispatch("{\"type\":\"x\"}");   // no handlers, no error callback: nothing happens
    }

    public static void Test_SendQueuesUntilOpen()
    {
        var posted = new List<string>();
        var b = new Bridge(posted.Add, null);
        b.Send("session", new { kind = "lock", ms = 1L });
        b.Send("menu", new { action = "feed" });
        Assert.Eq(0, posted.Count, "nothing reaches the page before init");
        b.Open("init", new { nowMs = 5L });
        Assert.Eq("init,session,menu", Types(posted), "init first, then the queued messages in order");
        b.Send("dragEnd", null);
        Assert.Eq("init,session,menu,dragEnd", Types(posted), "sent at once while open");
        b.Hold();   // the page navigates: queue again until its init
        b.Send("visibility", new { visible = false });
        Assert.Eq(4, posted.Count, "held");
        b.Open("init", new { nowMs = 6L });
        Assert.Eq("init,session,menu,dragEnd,init,visibility", Types(posted), "second init, then the held message");
    }

    public static void Test_QueueIsBounded()
    {
        var posted = new List<string>();
        var b = new Bridge(posted.Add, null);
        for (int i = 0; i < 250; i++) b.Send("session", new { n = i });
        b.Open("init", null);
        Assert.Eq(1 + Bridge.MaxQueued, posted.Count, "init plus the newest MaxQueued messages");
        Assert.Eq(250 - Bridge.MaxQueued, Convert.ToInt32(Bridge.Parse(posted[1])["n"]), "the oldest were dropped");
    }

    static string Types(List<string> posted)
    {
        var t = new List<string>();
        foreach (string json in posted) t.Add((string)Bridge.Parse(json)["type"]);
        return string.Join(",", t.ToArray());
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
