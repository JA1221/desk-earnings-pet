using System;
using System.Threading;
using Microsoft.Win32;

// Raises Activity(kind, epochMs) for logon|unlock|lock|suspend|resume.
// SystemEvents fires on its own thread; Activity is posted to the captured SynchronizationContext.
// Create the watcher on the UI thread once Application has a WindowsFormsSynchronizationContext
// (for example in the form's Load); with no context, Activity is raised on the SystemEvents thread.
public class SessionWatcher : IDisposable
{
    public event Action<string, long> Activity;
    readonly SynchronizationContext context;
    bool disposed;

    public SessionWatcher() : this(SynchronizationContext.Current)
    {
    }

    public SessionWatcher(SynchronizationContext context)
    {
        this.context = context;
        SystemEvents.SessionSwitch += OnSessionSwitch;
        SystemEvents.PowerModeChanged += OnPowerModeChanged;
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        SystemEvents.SessionSwitch -= OnSessionSwitch;
        SystemEvents.PowerModeChanged -= OnPowerModeChanged;
    }

    void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
    {
        switch (e.Reason)
        {
            case SessionSwitchReason.SessionLogon: Raise("logon"); break;
            case SessionSwitchReason.SessionUnlock: Raise("unlock"); break;
            case SessionSwitchReason.SessionLock: Raise("lock"); break;
        }
    }

    void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
    {
        if (e.Mode == PowerModes.Suspend) Raise("suspend");
        else if (e.Mode == PowerModes.Resume) Raise("resume");
    }

    void Raise(string kind)
    {
        Raise(kind, (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds);
    }

    // Marshals to the captured context when there is one; the seam tests use.
    internal void Raise(string kind, long ms)
    {
        if (context != null) context.Post(delegate { Fire(kind, ms); }, null);
        else Fire(kind, ms);
    }

    void Fire(string kind, long ms)
    {
        Action<string, long> h = Activity;
        if (h != null) h(kind, ms);
    }
}
