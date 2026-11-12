using System;
using System.Diagnostics;

public static class WebView2CheckTests
{
    // M7: 是 on the missing-runtime message opens Microsoft's Evergreen bootstrapper page in the default browser.
    public static void Test_DownloadPageOpensTheExactUrlThroughTheShell()
    {
        Assert.Eq("https://go.microsoft.com/fwlink/p/?LinkId=2124703", WebView2Check.DownloadUrl, "the download link");
        ProcessStartInfo p = WebView2Check.DownloadPage();
        Assert.Eq(WebView2Check.DownloadUrl, p.FileName, "the URL itself, so the default browser opens it");
        Assert.True(p.UseShellExecute, "through the shell");
        Assert.Eq("", p.Arguments, "no arguments");
    }

    public static void Test_MissingRuntimeMessageAsksAndShowsTheLink()
    {
        Assert.True(WebView2Check.MissingMessage.Contains(WebView2Check.DownloadUrl), "the link stays readable in the message");
        Assert.True(WebView2Check.MissingMessage.Contains("WebView2"), "names the runtime");
        Assert.True(WebView2Check.MissingMessage.Contains("「是」"), "says what 是 does");
    }
}
