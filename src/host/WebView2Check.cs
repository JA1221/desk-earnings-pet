using System;
using Microsoft.Web.WebView2.Core;

// Is the Evergreen WebView2 Runtime installed? QJZ_FORCE_NO_WEBVIEW2=1 answers no (to test the dialog).
public static class WebView2Check
{
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
}
