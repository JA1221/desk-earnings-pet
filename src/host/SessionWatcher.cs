using System;
using Microsoft.Win32;

// Raises Activity(kind, epochMs) for logon|unlock|lock|suspend|resume.
public class SessionWatcher : IDisposable
{
    public event Action<string, long> Activity;
    bool disposed;

    public SessionWatcher()
    {
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
        Action<string, long> h = Activity;
        if (h == null) return;
        long ms = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
        h(kind, ms);
    }
}
