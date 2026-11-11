using System;
using System.Threading;

public static class SessionWatcherTests
{
    class RecordingContext : SynchronizationContext
    {
        public int Posts;
        public override void Post(SendOrPostCallback d, object state)
        {
            Posts++;
            d(state);
        }
    }

    public static void Test_Raise_MarshalsThroughContext()
    {
        var ctx = new RecordingContext();
        using (var w = new SessionWatcher(ctx))
        {
            string kind = null; long ms = 0;
            w.Activity += delegate(string k, long m) { kind = k; ms = m; };
            w.Raise("lock", 1234L);
            Assert.Eq(1, ctx.Posts, "Post used");
            Assert.Eq("lock", kind, "kind");
            Assert.Eq(1234L, ms, "ms");
        }
    }

    public static void Test_Raise_NullContext_RaisesDirectly()
    {
        using (var w = new SessionWatcher((SynchronizationContext)null))
        {
            string kind = null;
            w.Activity += delegate(string k, long m) { kind = k; };
            w.Raise("resume", 1L);
            Assert.Eq("resume", kind, "direct");
        }
    }
}
