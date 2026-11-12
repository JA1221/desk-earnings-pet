using System;

public static class AppPathsTests
{
    // QJZ_PROFILE (Ruling R2): a valid name gets its own data folders; anything else is the user's own 錢進中.
    public static void Test_ProfileFolder()
    {
        Assert.Eq("錢進中", AppPaths.FolderName(null), "no profile");
        Assert.Eq("錢進中-t11", AppPaths.FolderName("t11"), "a profile");
        Assert.Eq("錢進中-AbC0123456789xyz", AppPaths.FolderName("AbC0123456789xyz"), "16 characters");
        // "a234567890123456b": 17 characters; "t11\n": a regex $ would let the newline through
        foreach (string bad in new[] { "../x", "", "a234567890123456b", "t11\n", "t 1", "t-1", "錢" })
            Assert.Eq("錢進中", AppPaths.FolderName(bad), "'" + bad + "' is not a profile");
    }

    // A QJZ_PROFILE that is set but invalid must not fall back to the user's own folders, mutex and Run value: the
    // app refuses to start (Program.Main). Unset or empty means no profile. No trimming: cmd's "set X=t11 && ..."
    // leaves a trailing space.
    public static void Test_ProfileRejected()
    {
        Assert.True(!AppPaths.ProfileRejected(null), "unset: the user's own app");
        Assert.True(!AppPaths.ProfileRejected(""), "empty: the user's own app");
        Assert.True(!AppPaths.ProfileRejected("t11"), "a valid profile");
        foreach (string bad in new[] { "t-15", "t11 ", "e2e_1", "../x", "a234567890123456b" })
            Assert.True(AppPaths.ProfileRejected(bad), "'" + bad + "' is refused");
    }

    public static void Test_ProfileMutex()
    {
        Assert.Eq(@"Local\QianJinZhong", SingleInstance.MutexNameFor(null), "mutex without a profile");
        Assert.Eq(@"Local\QianJinZhong.Show", SingleInstance.EventNameFor(null), "event without a profile");
        Assert.Eq(@"Local\QianJinZhong-t11", SingleInstance.MutexNameFor("t11"), "mutex for t11");
        Assert.Eq(@"Local\QianJinZhong-t11.Show", SingleInstance.EventNameFor("t11"), "event for t11");
        Assert.Eq(@"Local\QianJinZhong", SingleInstance.MutexNameFor("../x"), "not a profile: the app's own mutex");
    }
}
