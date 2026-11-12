using System;
using System.Diagnostics;
using Microsoft.Web.WebView2.Core;

// Is the Evergreen WebView2 Runtime installed? QJZ_FORCE_NO_WEBVIEW2=1 answers no (to test the dialog).
public static class WebView2Check
{
    // Microsoft's Evergreen bootstrapper download.
    public const string DownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

    // Shown (是 / 否) when the runtime is missing; 是 opens DownloadUrl in the default browser.
    public const string MissingMessage = "這台電腦缺少 Microsoft Edge WebView2 執行階段，錢進中需要它才能顯示畫面。\n\n" +
        "按「是」開啟下載頁面，下載安裝後再開啟錢進中。\n\n下載網址：" + DownloadUrl;

    public static bool IsAvailable()
    {
        if (Environment.GetEnvironmentVariable("QJZ_FORCE_NO_WEBVIEW2") == "1") return false;
        try
        {
            WebViewEnv.EnsureLoaderFolder();   // must precede the first WebView2 call
            return !string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString());
        }
        catch (Exception ex)
        {
            ErrorLog.Write("WebView2 runtime not available", ex);
            return false;
        }
    }

    // The download page, opened by the shell in the default browser.
    public static ProcessStartInfo DownloadPage()
    {
        ProcessStartInfo p = new ProcessStartInfo(DownloadUrl);
        p.UseShellExecute = true;
        return p;
    }

    public static void OpenDownloadPage()
    {
        try { using (Process.Start(DownloadPage())) { } }
        catch (Exception ex) { ErrorLog.Write("opening the WebView2 download page", ex); }
    }
}
