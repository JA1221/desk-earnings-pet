using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

// Where the window goes on a layout change, and remembering where the user moved it (physical px, window.json, owned
// by the host). The decisions are pure (AtAnchor, SeedAnchor, PanelBounds, Decide, Refit, FitAfterGrow, ResizeInside).
// 1.1.2: every layout but U10 shares ONE anchor, the window's top-left (item 1). A layout opens with its top-left there
// and stays there when it fits; only when it does not fit is it pushed inside the work area of the monitor the anchor
// was set on, and that push is never saved (Ruling C5), so the next layout that fits is back at the anchor (AtAnchor).
// The window the anchor was set with comes back exactly, an overhang the user chose included (ScreenFit.Clamp, as 1.1.1
// kept a saved spot). A drop in any layout but U10 moves the anchor (DragMovesAnchor; a panel's too: it is the same
// window). U10 docks on the monitor the window is on (AppHost.DockCapsule); its last dock spot is kept as its own entry
// for the next start in U10. The layouts' own entries (1.1.1) are still written on a drop and stay readable for a
// downgrade, but only the upgrade reads them: with no anchor in window.json, the first layout placed takes its own saved
// spot as the anchor (SeedAnchor), so a start in the layout the user left shows exactly where 1.1.1 showed it.
// PANEL (設定, 紀錄, onboarding, the questions) opens at the top-left of the window it came from, fully inside that
// window's work area (PanelBounds, 1.1.1), or in place when the page asks (1.1.2 item 3: the same window, untouched).
// A PANEL entry left in window.json by 1.0 / 1.1.0 is kept as it is but never read or written.
public enum LayoutMove { Anchor, Dock, Beside, InPlace }

public class WindowPlacer
{
    public const int DefaultMargin = 24;   // physical px in from the work-area corner for a first-ever position
    public const string PanelLayout = "PANEL";
    public const string CapsuleLayout = "U10";
    readonly UserFiles files;
    WindowPositions positions = new WindowPositions();
    Point? anchor;          // the shared top-left; null until set (the upgrade, the first placement, a drop)
    Size? anchorSize;       // the physical size of the window it was set with (null: unknown)
    bool startSpotKnown;    // PrePlace put the hidden window at a spot from window.json (PanelFrom)

    public WindowPlacer(UserFiles files)
    {
        this.files = files;
    }

    // Reads the positions (after UserFiles.LoadAll).
    public void Load()
    {
        positions = WindowPositions.Parse(files.Window.Text);
        Point at;
        Size? size;
        if (positions.TryGetAnchor(out at, out size)) { anchor = at; anchorSize = size; }
        else { anchor = null; anchorSize = null; }
    }

    // Before the window exists: puts it where the layout the page will start in is going to show, so the page loads
    // at that monitor's DPR. Otherwise the page would lay out for the creation monitor, the first setLayout would
    // move the window across a DPI change, and the first frame would show the old-size surface. The window gets the
    // layout's saved size at that monitor's scale (StartSize), so the spot is kept or pushed in exactly as the first
    // setLayout will do it, and a start that opens with a panel opens it beside the start layout's own rect (PanelFrom).
    // Every layout but U10 goes to the anchor. With none yet, the layout's own saved spot at its saved size becomes it
    // (the upgrade: SeedAnchor, written at once); a spot saved without a size waits for the first setLayout's size, and
    // the hidden window goes to the spot meanwhile. U10 goes to its last dock spot. With neither, the primary work
    // area's bottom-right (where the first setLayout will put it), never CenterScreen (which centres under the cursor,
    // possibly on a monitor with another DPI).
    public void PrePlace(Form window, string layout)
    {
        Rectangle[] areas = WorkAreas();
        Rectangle primary = Screen.PrimaryScreen.WorkingArea;
        Size? css = SavedSize(layout);
        Point saved;
        Point? spot = positions.TryGet(layout, out saved) ? saved : (Point?)null;
        bool anchored = layout != CapsuleLayout;
        window.StartPosition = FormStartPosition.Manual;
        if (anchored && !anchor.HasValue && spot.HasValue && css.HasValue)
        {
            Size was = StartSize(css, ScaleAt(new Rectangle(spot.Value, css.Value)), window.Size);
            SetAnchor(SeedAnchor(spot, was, null, was, areas, primary));
        }
        if (anchored && anchor.HasValue)
        {
            Size size = StartSize(css, css.HasValue ? ScaleAt(new Rectangle(anchor.Value, css.Value)) : 1, window.Size);
            window.Bounds = AtAnchor(anchor.Value, anchorSize, size, areas);
            startSpotKnown = true;
            return;
        }
        double scale = css.HasValue ? ScaleAt(spot.HasValue ? new Rectangle(spot.Value, css.Value) : primary) : 1;
        window.Bounds = StartBounds(spot, StartSize(css, scale, window.Size), areas, primary);
        startSpotKnown = spot.HasValue;
    }

    // The hidden window's size before the page reports one: the start layout's saved CSS size at scale (physical px
    // per CSS px; 0 or less: 1), rounded as PetWindow rounds it, else fallback (the window's own size).
    public static Size StartSize(Size? savedCss, double scale, Size fallback)
    {
        if (!savedCss.HasValue || savedCss.Value.Width < 1 || savedCss.Value.Height < 1) return fallback;
        return PetGeometry.WindowSize(savedCss.Value.Width, savedCss.Value.Height, scale > 0 ? scale : 1);
    }

    // Whether PrePlace put the hidden window at a spot from window.json (the anchor, or U10's dock spot) rather than the
    // first-ever spot: a start that opens with a panel opens it beside that window (PanelFrom).
    public bool StartSpotKnown { get { return startSpotKnown; } }

    // Physical px per CSS px on the monitor nearest r's centre (its effective DPI / 96); 1 when unknown.
    static double ScaleAt(Rectangle r)
    {
        try
        {
            Native.POINT pt;
            pt.X = r.X + r.Width / 2;
            pt.Y = r.Y + r.Height / 2;
            uint dx, dy;
            IntPtr mon = Native.MonitorFromPoint(pt, Native.MONITOR_DEFAULTTONEAREST);
            if (mon == IntPtr.Zero || Native.GetDpiForMonitor(mon, Native.MDT_EFFECTIVE_DPI, out dx, out dy) != 0) return 1;
            return PetGeometry.DpiScale((int)dy);
        }
        catch (Exception) { return 1; }
    }

    // The saved spot kept on screen (the same rule as PlaceAtOwnSpot), else Decide's first-ever spot.
    public static Rectangle StartBounds(Point? saved, Size size, Rectangle[] areas, Rectangle primaryWorkArea)
    {
        bool hostChosen;
        return Decide(saved, null, size, areas, primaryWorkArea, out hostChosen);
    }

    // Moves window (already at layout's size) to the anchor (every layout but U10). With no anchor yet, one is set first
    // (SeedAnchor, written at once): layout's own saved spot from 1.1.1 with ownSpotSize, the physical size its saved CSS
    // size has now (null: unknown); else current, the window's top-left once a layout has shown; else the first-ever spot.
    // A landing on a monitor with another DPI resizes the window (WM_DPICHANGED): it is placed again at its new size.
    public void PlaceAtAnchor(Control window, string layout, Size? ownSpotSize, Point? current)
    {
        Rectangle[] areas = WorkAreas();
        if (!anchor.HasValue)
        {
            Point saved;
            Point? spot = positions.TryGet(layout, out saved) ? saved : (Point?)null;
            SetAnchor(SeedAnchor(spot, ownSpotSize, current, window.Size, areas, Screen.PrimaryScreen.WorkingArea));
        }
        window.Bounds = AtAnchor(anchor.Value, anchorSize, window.Size, areas);
        Rectangle again = AtAnchor(anchor.Value, anchorSize, window.Size, areas);
        if (again != window.Bounds) window.Bounds = again;
    }

    // U10 only, and only when the safety net shows it before the page reported a layout: its last dock spot, kept on
    // screen (ScreenFit.Clamp); a landing that changed the DPI is fitted again.
    public void PlaceAtOwnSpot(Control window, string layout)
    {
        Rectangle[] areas = WorkAreas();
        Point saved;
        Point? savedSpot = positions.TryGet(layout, out saved) ? saved : (Point?)null;
        bool hostChosen;
        window.Bounds = Decide(savedSpot, null, window.Size, areas, Screen.PrimaryScreen.WorkingArea, out hostChosen);
        Rectangle now = window.Bounds;
        Rectangle fit = Refit(now, hostChosen, areas);
        if (fit != now) window.Bounds = fit;
    }

    // Where a window of size goes for the anchor at, set with a window of setSize (physical px; null: unknown). At its
    // top-left when that rect fits inside a work area. The window the anchor was set with (the same size) is the user's
    // own rect and comes back as 1.1.1 brought back a saved spot: kept while at least half of it is inside one work
    // area, an overhang the user chose included, else moved fully inside (ScreenFit.Clamp). Any other size that does not
    // fit is pushed fully inside the work area nearest the centre of the window the anchor was set with: the monitor the
    // user put it on, not whichever one a bigger window's centre would reach.
    public static Rectangle AtAnchor(Point at, Size? setSize, Size size, Rectangle[] areas)
    {
        Rectangle r = new Rectangle(at, size);
        if (areas == null || areas.Length == 0) return r;
        if (setSize.HasValue && setSize.Value == size) return ScreenFit.Clamp(r, areas);
        foreach (Rectangle a in areas) if (a.Contains(r)) return r;
        return ScreenFit.MoveInside(r, ScreenFit.NearestArea(new Rectangle(at, setSize.HasValue ? setSize.Value : size), areas));
    }

    // The anchor to set when there is none (its top-left and the size it is set with), for a window of size: spot, a
    // layout's own saved spot from 1.1.1 (the upgrade), with spotSize, the window size it was saved at (null: size);
    // else current, the window's top-left once a layout has shown, moved fully inside its monitor; else the first-ever
    // spot (Decide: the primary's bottom-right).
    public static Rectangle SeedAnchor(Point? spot, Size? spotSize, Point? current, Size size, Rectangle[] areas, Rectangle primaryWorkArea)
    {
        if (spot.HasValue) return new Rectangle(spot.Value, spotSize.HasValue ? spotSize.Value : size);
        bool hostChosen;
        return Decide(null, current, size, areas, primaryWorkArea, out hostChosen);
    }

    // What a layout change does with the window (1.1.2): U10 docks (AppHost.DockCapsule); a panel opens beside the
    // window it came from (PanelBounds), or in place when the page asks (the same window: not moved, not resized; only a
    // panel can); every other layout goes to the anchor (AtAnchor).
    public static LayoutMove MoveFor(string layout, bool inPlace)
    {
        if (layout == CapsuleLayout) return LayoutMove.Dock;
        if (layout == PanelLayout) return inPlace ? LayoutMove.InPlace : LayoutMove.Beside;
        return LayoutMove.Anchor;
    }

    // setLayout's inPlace (1.1.2 item 3): only the JSON true asks for it.
    public static bool InPlaceAsked(Dictionary<string, object> setLayout)
    {
        return Bridge.Bool(setLayout, "inPlace") == true;
    }

    // Whether the user's drop of layout moves the anchor: in every layout but U10, which snaps to a dock instead. A
    // panel's drop does too (it is the same window, and the layout it closes to comes back where it was dropped).
    public static bool DragMovesAnchor(string layout)
    {
        return layout != null && layout != CapsuleLayout;
    }

    // The anchor is now r's top-left, set with a window of r's size (a drop, or SeedAnchor): written when it changed.
    public void SetAnchor(Rectangle r)
    {
        if (anchor.HasValue && anchor.Value == r.Location && anchorSize.HasValue && anchorSize.Value == r.Size) return;
        anchor = r.Location;
        anchorSize = r.Size;
        positions.SetAnchor(r.Location, r.Size);
        files.Save(files.Window, positions.ToJson());
    }

    // Moves window (already at the panel's size) beside the window it came from (PanelFrom), or to the first-ever
    // spot without one. A landing that changed the DPI is fitted again.
    public void PlacePanel(Control window, Rectangle? from)
    {
        Rectangle[] areas = WorkAreas();
        window.Bounds = PanelBounds(from, window.Size, areas, Screen.PrimaryScreen.WorkingArea);
        Rectangle now = window.Bounds;
        Rectangle fit = Refit(now, true, areas);
        if (fit != now) window.Bounds = fit;
    }

    // A panel of size opens at from's top-left, moved fully inside the work area nearest from's centre (the monitor
    // the user sees that window on); without from it goes where a first-ever window goes (Decide).
    public static Rectangle PanelBounds(Rectangle? from, Size size, Rectangle[] areas, Rectangle primaryWorkArea)
    {
        bool hostChosen;
        if (!from.HasValue || areas == null || areas.Length == 0) return Decide(null, null, size, areas, primaryWorkArea, out hostChosen);
        return ScreenFit.MoveInside(new Rectangle(from.Value.Location, size), ScreenFit.NearestArea(from.Value, areas));
    }

    // The window a panel opens beside, given the window's rect now: that rect once a layout has shown (layoutShown: the
    // page reported one, or the safety net showed the start layout); before that, at a start that opens with a panel,
    // the same rect when PrePlace put the hidden window at a known spot (StartSpotKnown: the anchor, or U10's dock spot,
    // at the start layout's saved size), else null (a first-ever start: PanelBounds' first-ever spot).
    public static Rectangle? PanelFrom(bool layoutShown, bool startSpotKnown, Rectangle current)
    {
        return layoutShown || startSpotKnown ? current : (Rectangle?)null;
    }

    // CSS size the first-show safety net uses when the page has not reported one: U1's (340 + the 7 px shadow wide).
    public static readonly Size DefaultRescueCss = new Size(347, 580);

    // The page's size for layout as last remembered (CSS px), or null.
    public Size? SavedSize(string layout)
    {
        Size s;
        return positions.TryGetSize(layout, out s) ? s : (Size?)null;
    }

    // The page reported layout's size: keep it for the safety net (written only when it changed).
    public void RememberSize(string layout, Size cssSize)
    {
        Size old;
        if (layout == null || (positions.TryGetSize(layout, out old) && old == cssSize)) return;
        positions.SetSize(layout, cssSize);
        files.Save(files.Window, positions.ToJson());
    }

    // The size the safety net shows the window at: the saved one, else DefaultRescueCss.
    public static Size RescueSize(Size? saved)
    {
        return saved.HasValue && saved.Value.Width >= 1 && saved.Value.Height >= 1 ? saved.Value : DefaultRescueCss;
    }

    // The user finished moving the window (WM_EXITSIZEMOVE), or U10 docked: remember the spot for this layout
    // (written only when it changed).
    public void Remember(string layout, Point location)
    {
        Point old;
        if (layout == null || (positions.TryGet(layout, out old) && old == location)) return;
        positions.Set(layout, location);
        files.Save(files.Window, positions.ToJson());
    }

    // hostChosen: false when the result is the user's own saved spot, left as it was.
    public static Rectangle Decide(Point? saved, Point? current, Size size, Rectangle[] areas, Rectangle primaryWorkArea, out bool hostChosen)
    {
        if (saved.HasValue)
        {
            Rectangle user = new Rectangle(saved.Value, size);
            Rectangle kept = ScreenFit.Clamp(user, areas);
            hostChosen = kept != user;
            return kept;
        }
        hostChosen = true;
        if (current.HasValue)
        {
            Rectangle here = new Rectangle(current.Value, size);
            return ScreenFit.MoveInside(here, ScreenFit.NearestArea(here, areas));
        }
        Rectangle wa = primaryWorkArea;
        return ScreenFit.MoveInside(new Rectangle(wa.Right - size.Width - DefaultMargin, wa.Bottom - size.Height - DefaultMargin, size.Width, size.Height), wa);
    }

    // After the window changed size on another monitor: a spot the host chose stays fully inside; the user's own
    // spot only gets the Clamp rule.
    public static Rectangle Refit(Rectangle now, bool hostChosen, Rectangle[] areas)
    {
        return hostChosen ? ScreenFit.MoveInside(now, ScreenFit.NearestArea(now, areas)) : ScreenFit.Clamp(now, areas);
    }

    // Grow-inside (spec 5.7): the window at before now has the size after. It keeps its top-left (so it grows right
    // and down, like U5-B's extra column or a prompt bubble beside U7 / M3), unless before was fully inside its
    // nearest work area and the grown rect is not: then it is moved inside that area. A window the user left
    // hanging over an edge keeps that overhang.
    public static Rectangle FitAfterGrow(Rectangle before, Size after, Rectangle[] areas)
    {
        Rectangle grown = new Rectangle(before.Location, after);
        if (areas == null || areas.Length == 0) return grown;
        Rectangle area = ScreenFit.NearestArea(before, areas);
        return area.Contains(before) && !area.Contains(grown) ? ScreenFit.MoveInside(grown, area) : grown;
    }

    // The window shrank back after a grow that moved it from growFrom to growTo: back to growFrom if it is still at
    // growTo; anywhere else (the user moved it, or no grow moved it) it stays at now.
    public static Point AfterShrink(Point now, Point? growFrom, Point? growTo)
    {
        return growFrom.HasValue && growTo.HasValue && now == growTo.Value ? growFrom.Value : now;
    }

    // A same-layout size change (a prompt bubble beside U7 / M3 shows, changes or goes): the window at before now has
    // the size now; returns its new top-left. growFrom / growTo carry an outstanding push between calls: the window's
    // rect before a grow pushed it in, and the spot the push put it at (both null: none).
    // While the window is still at growTo its spot is worked out again from growFrom (FitAfterGrow), so a partial
    // shrink or a second grow keeps it fully inside, and once it fits at growFrom unpushed it goes back there and the
    // push is forgotten. A window the user moved meanwhile is no longer at growTo: it starts afresh from where it is,
    // so an overhang the user chose is kept (Ruling S9).
    public static Point ResizeInside(Rectangle before, Size now, Rectangle[] areas, ref Rectangle? growFrom, ref Point? growTo)
    {
        Point unpushed = AfterShrink(before.Location, growFrom.HasValue ? growFrom.Value.Location : (Point?)null, growTo);
        Rectangle basis = unpushed != before.Location ? growFrom.Value : before;
        Point at = FitAfterGrow(basis, now, areas).Location;
        if (at == basis.Location)
        {
            growFrom = null;
            growTo = null;
        }
        else
        {
            growFrom = basis;
            growTo = at;
        }
        return at;
    }

    public static Rectangle[] WorkAreas()
    {
        Screen[] screens = Screen.AllScreens;
        Rectangle[] areas = new Rectangle[screens.Length];
        for (int i = 0; i < screens.Length; i++) areas[i] = screens[i].WorkingArea;
        return areas;
    }
}
