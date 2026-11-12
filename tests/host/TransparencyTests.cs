using System;

public static class TransparencyTests
{
    public static void Test_BothCallsWorking()
    {
        Assert.True(Transparency.Failure(0, true, 0) == null, "S_OK and layered: transparent window");
        Assert.True(Transparency.Failure(1, true, 0) == null, "S_FALSE is a success code");
    }

    // R-F6: a failure is reported (error.log, once) and the window goes on with an opaque background.
    public static void Test_EachFailureIsNamed()
    {
        Assert.Eq("DwmEnableBlurBehindWindow 0x80263001", Transparency.Failure(unchecked((int)0x80263001), true, 0), "blur-behind failed");
        Assert.Eq("SetLayeredWindowAttributes error 87", Transparency.Failure(0, false, 87), "layered failed");
        Assert.Eq("DwmEnableBlurBehindWindow 0x80004005, SetLayeredWindowAttributes error 5",
            Transparency.Failure(unchecked((int)0x80004005), false, 5), "both");
    }
}
