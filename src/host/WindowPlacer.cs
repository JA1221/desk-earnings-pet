using System;
using System.Drawing;
using System.Windows.Forms;

// Where the window goes on a layout change, and remembering where the user moved it. Positions are per layout,
// physical px, in window.json, owned by the host. The decision is pure (Decide, Refit):
// saved position (kept by ScreenFit.Clamp) -> else where the window is now (fully inside its monitor) -> else
// the bottom-right of the primary work area.
public class WindowPlacer
{
    public const int DefaultMargin = 24;   // physical px in from the work-area corner for a first-ever position
    readonly UserFiles files;
    WindowPositions positions = new WindowPositions();
    bool placed;

    public WindowPlacer(UserFiles files)
    {
        this.files = files;
    }

    // Reads the positions (after UserFiles.LoadAll).
    public void Load()
    {
        positions = WindowPositions.Parse(files.Window.Text);
    }

    // Before the window exists: puts it at the saved spot of the layout the page will start in (when there is one),
    // so the page loads at that monitor's DPR. Otherwise the page would lay out for the creation monitor, the first
    // setLayout would move the window across a DPI change, and the first frame would show the old-size surface.
    public void PrePlace(Control window, string layout)
    {
        Point saved;
        Rectangle? r = StartBounds(positions.TryGet(layout, out saved) ? saved : (Point?)null, window.Size, WorkAreas());
        if (r.HasValue) window.Bounds = r.Value;
    }

    // The saved spot kept on screen (the same rule as Place), or null without one.
    public static Rectangle? StartBounds(Point? saved, Size size, Rectangle[] areas)
    {
        if (!saved.HasValue) return null;
        return ScreenFit.Clamp(new Rectangle(saved.Value, size), areas);
    }

    // Moves window to its spot for layout; call after the window has the layout's size.
    public void Place(Control window, string layout)
    {
        Rectangle[] areas = WorkAreas();
        Point saved;
        Point? savedSpot = positions.TryGet(layout, out saved) ? saved : (Point?)null;
        Point? current = placed ? window.Location : (Point?)null;
        bool hostChosen;
        window.Bounds = Decide(savedSpot, current, window.Size, areas, Screen.PrimaryScreen.WorkingArea, out hostChosen);
        placed = true;
        // Landing on a monitor with another DPI resizes the window (WM_DPICHANGED); fit the new size.
        Rectangle now = window.Bounds;
        Rectangle fit = Refit(now, hostChosen, areas);
        if (fit != now) window.Bounds = fit;
    }

    // The user finished moving the window (WM_EXITSIZEMOVE): remember the spot for this layout.
    public void Remember(string layout, Point location)
    {
        if (layout == null) return;
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

    public static Rectangle[] WorkAreas()
    {
        Screen[] screens = Screen.AllScreens;
        Rectangle[] areas = new Rectangle[screens.Length];
        for (int i = 0; i < screens.Length; i++) areas[i] = screens[i].WorkingArea;
        return areas;
    }
}
