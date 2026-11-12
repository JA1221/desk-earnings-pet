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

    // Before the window exists: puts it where the layout the page will start in is going to show, so the page loads
    // at that monitor's DPR. Otherwise the page would lay out for the creation monitor, the first setLayout would
    // move the window across a DPI change, and the first frame would show the old-size surface. Without a saved
    // spot that is the primary work area's bottom-right (where Place will put it), never CenterScreen (which
    // centres under the cursor, possibly on a monitor with another DPI).
    public void PrePlace(Form window, string layout)
    {
        Point saved;
        Point? spot = positions.TryGet(layout, out saved) ? saved : (Point?)null;
        window.StartPosition = FormStartPosition.Manual;
        window.Bounds = StartBounds(spot, window.Size, WorkAreas(), Screen.PrimaryScreen.WorkingArea);
    }

    // The saved spot kept on screen (the same rule as Place), else Decide's first-ever spot.
    public static Rectangle StartBounds(Point? saved, Size size, Rectangle[] areas, Rectangle primaryWorkArea)
    {
        bool hostChosen;
        return Decide(saved, null, size, areas, primaryWorkArea, out hostChosen);
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
