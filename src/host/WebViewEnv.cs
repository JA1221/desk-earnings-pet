using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

// Process-wide WebView2 setup, done once: loader DLL folder and one shared environment whose user data
// lives in %LocalAppData%\錢進中\WebView2. Call from the UI thread only.
public static class WebViewEnv
{
    private static Task<CoreWebView2Environment> env;

    public static Task<CoreWebView2Environment> GetAsync()
    {
        if (env == null)
        {
            SetLoaderFolder();
            string userData = Path.Combine(AppPaths.LocalDir, "WebView2");
            Directory.CreateDirectory(userData);
            env = CoreWebView2Environment.CreateAsync(null, userData);
        }
        return env;
    }

    // <exeDir>\vendor\webview2\<arch> first, then the dev layout (build\ exe next to the repo's vendor\).
    private static void SetLoaderFolder()
    {
        string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
        string arch = Environment.Is64BitProcess ? "x64" : "x86";
        string rel = Path.Combine("vendor", Path.Combine("webview2", arch));
        string loader = Path.Combine(exeDir, rel);
        if (!Directory.Exists(loader)) loader = Path.Combine(Path.GetDirectoryName(exeDir) ?? exeDir, rel);
        if (Directory.Exists(loader)) CoreWebView2Environment.SetLoaderDllFolderPath(loader);
    }
}
