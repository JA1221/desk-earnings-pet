using System;

// Whether Windows reports a fullscreen app or presentation mode (spec 5.1, 6): reminders wait while it does, because a
// projector or a meeting-room screen is outside the capture guard's protection. SHQueryUserNotificationState needs no
// permission. Polled every 2 s on the UI thread; Changed fires only when the answer flips (AppHost sends the page
// fullscreen {on} then, and after every init).
public class Presentation : IDisposable
{
    const int PollMs = 2000;
    // QUERY_USER_NOTIFICATION_STATE values that hold reminders
    const int QUNS_BUSY = 2;                      // a fullscreen app (or one that asked not to be disturbed)
    const int QUNS_RUNNING_D3D_FULL_SCREEN = 3;   // a Direct3D fullscreen game or video
    const int QUNS_PRESENTATION_MODE = 4;         // presentation settings / a slide show
    readonly Func<int> query;
    System.Windows.Forms.Timer timer;

    // query: the current QUNS state, or -1 when unknown (Query in the app, a fake in tests).
    public Presentation(Func<int> query)
    {
        this.query = query;
    }

    public event Action<bool> Changed;

    // False until a poll says otherwise.
    public bool Busy { get; private set; }

    // Ruling: 7 (QUNS_APP, a Store app in the foreground) is not busy, so a windowed Store app does not hold reminders.
    // 1 (locked, screen saver, another user) is the session's business (session lock / unlock).
    public static bool IsBusy(int state)
    {
        return state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE;
    }

    // Windows' answer now, or -1 when the query fails.
    public static int Query()
    {
        try
        {
            int state;
            return Native.SHQueryUserNotificationState(out state) == 0 ? state : -1;
        }
        catch (Exception) { return -1; }
    }

    // Polls once now (so the first init already knows), then every PollMs.
    public void Start()
    {
        if (timer != null) return;
        Poll();
        timer = new System.Windows.Forms.Timer();
        timer.Interval = PollMs;
        timer.Tick += delegate { Poll(); };
        timer.Start();
    }

    public void Poll()
    {
        bool busy = IsBusy(query());
        if (busy == Busy) return;
        Busy = busy;
        Action<bool> h = Changed;
        if (h != null) h(busy);
    }

    public void Dispose()
    {
        if (timer == null) return;
        timer.Stop();
        timer.Dispose();
        timer = null;
    }
}
