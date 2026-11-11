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
}
