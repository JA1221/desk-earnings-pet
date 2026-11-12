using System;
using System.IO;

public static class WebRootTests
{
    public static void Test_ResolveOrderIsPayloadThenEnvThenRepo()
    {
        string b = Path.Combine(Path.GetTempPath(), "qjz-wr-" + Guid.NewGuid().ToString("N"));
        string repoWeb = Path.Combine(b, @"repo\src\web");
        string exeDir = Path.Combine(b, @"repo\build");
        string elsewhere = Path.Combine(b, @"other\bin");
        Directory.CreateDirectory(repoWeb);
        Directory.CreateDirectory(exeDir);
        Directory.CreateDirectory(elsewhere);
        try
        {
            Assert.Eq(@"C:\packed\web", WebRoot.Resolve(@"X:\snap\web", @"C:\packed\web", exeDir), "a release exe ignores QJZ_WEB_ROOT");
            Assert.Eq(@"C:\packed\web", WebRoot.Resolve(null, @"C:\packed\web", exeDir), "a release exe uses its own pages, even inside the repo");
            Assert.Eq(@"X:\snap\web", WebRoot.Resolve(@"X:\snap\web", null, exeDir), "dev build: QJZ_WEB_ROOT wins over src\\web");
            Assert.Eq(repoWeb, WebRoot.Resolve(null, null, exeDir), "dev build: src\\web above the exe");
            Assert.Eq(repoWeb, WebRoot.Resolve("", null, exeDir), "empty env = unset");
            Assert.True(WebRoot.Resolve(null, null, elsewhere) == null, "nothing found");
        }
        finally { Directory.Delete(b, true); }
    }

    public static void Test_PageFileMapsTheUrlPathIntoTheRoot()
    {
        string r = @"C:\app\web";
        Assert.Eq(@"C:\app\web\index.html", WebRoot.PageFile(r, "/index.html"), "URL path");
        Assert.Eq(@"C:\app\web\index.html", WebRoot.PageFile(r, "index.html"), "relative page");
        Assert.Eq(@"C:\app\web\dev.html", WebRoot.PageFile(r, "/dev.html?layout=U7&fresh=1"), "query dropped");
        Assert.Eq(@"C:\app\web\sub\p.html", WebRoot.PageFile(r, "/sub/p.html#top"), "folders, fragment dropped");
        Assert.Eq(@"C:\app\web\a b.html", WebRoot.PageFile(r, "/a%20b.html"), "escapes decoded");
        string[] bad = { null, "", "/", "/../x.html", "/a/../../x.html", "/%2e%2e/x.html", "//server/x.html", "/C:/x.html", "/sub/" };
        foreach (string p in bad) Assert.True(WebRoot.PageFile(r, p) == null, "rejected: <" + p + ">");
    }
}
