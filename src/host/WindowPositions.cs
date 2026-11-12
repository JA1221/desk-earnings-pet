using System;
using System.Collections.Generic;
using System.Drawing;
using System.Web.Script.Serialization;

// Per layout, owned by the host only: the window's top-left (physical px) and the page's last reported size (CSS px,
// for the first-show safety net). Stored as %AppData%\錢進中\window.json:
// {"U1":{"x":100,"y":200,"w":347,"h":593},"U7":{"x":-900,"y":40}}. Both parts are optional per layout.
// Unreadable text and bad values are skipped, never thrown.
public class WindowPositions
{
    const int MaxNameLength = 32;
    const double MaxCoordinate = 1000000;
    const int MaxCssSize = 4096;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    readonly SortedDictionary<string, Point> positions = new SortedDictionary<string, Point>(StringComparer.Ordinal);
    readonly SortedDictionary<string, Size> sizes = new SortedDictionary<string, Size>(StringComparer.Ordinal);

    public bool TryGet(string layout, out Point position)
    {
        position = Point.Empty;
        return ValidName(layout) && positions.TryGetValue(layout, out position);
    }

    public void Set(string layout, Point position)
    {
        if (ValidName(layout)) positions[layout] = position;
    }

    public bool TryGetSize(string layout, out Size cssSize)
    {
        cssSize = Size.Empty;
        return ValidName(layout) && sizes.TryGetValue(layout, out cssSize);
    }

    public void SetSize(string layout, Size cssSize)
    {
        if (ValidName(layout) && ValidSize(cssSize.Width) && ValidSize(cssSize.Height)) sizes[layout] = cssSize;
    }

    public string ToJson()
    {
        var names = new SortedSet<string>(positions.Keys, StringComparer.Ordinal);
        names.UnionWith(sizes.Keys);
        var o = new Dictionary<string, object>();
        foreach (string name in names)
        {
            var e = new Dictionary<string, object>();
            Point p;
            Size s;
            if (positions.TryGetValue(name, out p)) { e["x"] = p.X; e["y"] = p.Y; }
            if (sizes.TryGetValue(name, out s)) { e["w"] = s.Width; e["h"] = s.Height; }
            o[name] = e;
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
            if (e == null) continue;
            int x, y, w, h;
            if (Number(e, "x", MaxCoordinate, out x) && Number(e, "y", MaxCoordinate, out y)) result.Set(kv.Key, new Point(x, y));
            if (Number(e, "w", MaxCssSize, out w) && Number(e, "h", MaxCssSize, out h)) result.SetSize(kv.Key, new Size(w, h));
        }
        return result;
    }

    static bool Number(Dictionary<string, object> e, string key, double max, out int value)
    {
        value = 0;
        object v;
        double n;
        if (!e.TryGetValue(key, out v) || !Bridge.TryNumber(v, out n) || Math.Abs(n) > max) return false;
        value = (int)Math.Round(n, MidpointRounding.AwayFromZero);
        return true;
    }

    static bool ValidName(string layout)
    {
        return !string.IsNullOrEmpty(layout) && layout.Length <= MaxNameLength;
    }

    static bool ValidSize(int v)
    {
        return v >= 1 && v <= MaxCssSize;
    }
}
