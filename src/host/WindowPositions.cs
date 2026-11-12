using System;
using System.Collections.Generic;
using System.Drawing;
using System.Web.Script.Serialization;

// Window top-left per layout, in physical px, owned by the host only. Stored as %AppData%\錢進中\window.json:
// {"U1":{"x":100,"y":200},"U7":{"x":-900,"y":40}}. Unreadable text and bad entries are skipped, never thrown.
public class WindowPositions
{
    const int MaxNameLength = 32;
    const double MaxCoordinate = 1000000;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    readonly SortedDictionary<string, Point> map = new SortedDictionary<string, Point>(StringComparer.Ordinal);

    public bool TryGet(string layout, out Point position)
    {
        position = Point.Empty;
        return ValidName(layout) && map.TryGetValue(layout, out position);
    }

    public void Set(string layout, Point position)
    {
        if (ValidName(layout)) map[layout] = position;
    }

    public string ToJson()
    {
        var o = new Dictionary<string, object>();
        foreach (KeyValuePair<string, Point> kv in map)
        {
            var p = new Dictionary<string, object>();
            p["x"] = kv.Value.X;
            p["y"] = kv.Value.Y;
            o[kv.Key] = p;
        }
        return Json.Serialize(o);
    }

    public static WindowPositions Parse(string json)
    {
        var result = new WindowPositions();
        if (string.IsNullOrEmpty(json)) return result;
        Dictionary<string, object> d;
        try { d = Json.DeserializeObject(json) as Dictionary<string, object>; }
        catch (Exception) { return result; }
        if (d == null) return result;
        foreach (KeyValuePair<string, object> kv in d)
        {
            var e = kv.Value as Dictionary<string, object>;
            int x, y;
            if (e != null && Coordinate(e, "x", out x) && Coordinate(e, "y", out y)) result.Set(kv.Key, new Point(x, y));
        }
        return result;
    }

    static bool Coordinate(Dictionary<string, object> e, string key, out int value)
    {
        value = 0;
        object v;
        double n;
        if (!e.TryGetValue(key, out v) || !Bridge.TryNumber(v, out n) || Math.Abs(n) > MaxCoordinate) return false;
        value = (int)Math.Round(n, MidpointRounding.AwayFromZero);
        return true;
    }

    static bool ValidName(string layout)
    {
        return !string.IsNullOrEmpty(layout) && layout.Length <= MaxNameLength;
    }
}
