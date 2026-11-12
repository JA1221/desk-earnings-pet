using System;
using System.Threading;

// One running app per Windows session (named mutex Local\QianJinZhong). A second start signals the running
// one through a named event, so it shows its window and comes to the front, and then exits.
public static class SingleInstance
{
    const string MutexName = @"Local\QianJinZhong";
    const string EventName = @"Local\QianJinZhong.Show";
    static Mutex mutex;
    static EventWaitHandle showEvent;
    static RegisteredWaitHandle waiter;

    // True: this process is the only instance and keeps running. False: another instance is running and has
    // been asked to show itself; this process should exit.
    public static bool TryStart()
    {
        // The event exists before the mutex is checked, so a signal sent while the first instance is still
        // starting is kept (auto-reset event) until it listens.
        showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, EventName);
        mutex = new Mutex(false, MutexName);
        bool owned;
        try { owned = mutex.WaitOne(0); }
        catch (AbandonedMutexException) { owned = true; }   // the previous instance ended without releasing it
        if (owned) return true;
        Native.AllowSetForegroundWindow(Native.ASFW_ANY);   // lets the running instance come to the front
        showEvent.Set();
        mutex.Dispose();
        mutex = null;
        return false;
    }

    // Runs onShow on the calling thread's SynchronizationContext (the UI thread) whenever another start is
    // signalled.
    public static void Listen(Action onShow)
    {
        if (showEvent == null || waiter != null) return;
        SynchronizationContext ui = SynchronizationContext.Current;
        waiter = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate
        {
            if (ui != null) ui.Post(delegate { onShow(); }, null);
            else onShow();
        }, null, Timeout.Infinite, false);
    }

    // Call on the UI thread (the mutex owner) when the app quits.
    public static void Stop()
    {
        if (waiter != null)
        {
            using (var unregistered = new ManualResetEvent(false))   // the event may only close once no wait uses it
                if (waiter.Unregister(unregistered)) unregistered.WaitOne(1000);
            waiter = null;
        }
        if (showEvent != null) { showEvent.Dispose(); showEvent = null; }
        if (mutex != null)
        {
            try { mutex.ReleaseMutex(); }
            catch (Exception) { }
            mutex.Dispose();
            mutex = null;
        }
    }
}
