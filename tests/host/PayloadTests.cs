using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;

public static class PayloadTests
{
    static string NewDir()
    {
        string d = Path.Combine(Path.GetTempPath(), "qjz-pl-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(d);
        return d;
    }

    static byte[] Zip(params string[] nameThenText)
    {
        using (var ms = new MemoryStream())
        {
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
                for (int i = 0; i < nameThenText.Length; i += 2)
                {
                    ZipArchiveEntry e = zip.CreateEntry(nameThenText[i]);
                    e.LastWriteTime = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);   // the same bytes on every call (now: two calls across a 2 s step differed)
                    if (nameThenText[i + 1] == null) continue;   // directory entry
                    byte[] b = Encoding.UTF8.GetBytes(nameThenText[i + 1]);
                    using (Stream s = e.Open()) s.Write(b, 0, b.Length);
                }
            return ms.ToArray();
        }
    }

    // A release payload: web.zip plus the binaries (fake contents, tagged so a change is visible).
    static Dictionary<string, byte[]> Resources(byte[] webZip, string dllTag)
    {
        var r = new Dictionary<string, byte[]>();
        r[Payload.WebZip] = webZip;
        foreach (string name in Payload.Binaries) r[name] = Encoding.UTF8.GetBytes(name + " " + dllTag);
        return r;
    }

    static byte[] SampleWeb()
    {
        return Zip("index.html", "<p>hi</p>", "js/", null, "js/core/time.js", "var t;", "fonts/Fredoka-Variable.ttf", "font");
    }

    static string Text(string path)
    {
        return File.ReadAllText(path, Encoding.UTF8);
    }

    public static void Test_FolderNameIsTheFirst12HexOfTheSha256OfWebZip()
    {
        // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
        Assert.Eq("ba7816bf8f01", Payload.FolderName(Encoding.ASCII.GetBytes("abc")), "first 12 lowercase hex");
    }

    public static void Test_StaleFoldersAreOtherVersionIdsOnly()
    {
        string[] names = { "ba7816bf8f01", "0123456789ab", "ffffffffffff", "0123456789AB", "0123456789abc", "0123456789a",
            "WebView2", "notes", "0123456789ab.old", "g123456789ab" };
        List<string> stale = Payload.StaleFolders(names, "ba7816bf8f01");
        Assert.Eq("0123456789ab,ffffffffffff", string.Join(",", stale.ToArray()),
            "only 12-lowercase-hex names other than the current one; anything else is left alone");
        Assert.Eq(0, Payload.StaleFolders(new[] { "ba7816bf8f01" }, "ba7816bf8f01").Count, "the current folder is kept");
    }

    public static void Test_EntryPathKeepsZipNamesInsideTheFolder()
    {
        string b = Path.Combine(Path.GetTempPath(), "qjz-base");
        Assert.Eq(Path.Combine(b, "index.html"), Payload.EntryPath(b, "index.html"), "plain name");
        Assert.Eq(Path.Combine(b, @"js\core\time.js"), Payload.EntryPath(b, "js/core/time.js"), "forward slashes become folders");
        Assert.Eq(Path.Combine(b, @"x64\WebView2Loader.dll"), Payload.EntryPath(b, "x64/WebView2Loader.dll"), "resource names too");
        string[] bad = { "", null, "../evil.txt", "js/../../evil.txt", @"js\..\..\evil.txt", "/abs.txt", @"\abs.txt", "C:/x.txt",
            "C:x.txt", "a//b.txt", "./a.txt", "js/", "a/./b.txt", "a?.txt", "a*.txt", "a|b.txt", "a\u0001.txt" };
        foreach (string n in bad)
            Assert.True(Payload.EntryPath(b, n) == null, "rejected: <" + n + ">");
    }

    public static void Test_EntryPathRefusesDeviceNamesAndTrailingDotsOrSpaces()
    {
        string b = Path.Combine(Path.GetTempPath(), "qjz-base");
        string[] bad = { "CON", "con", "nul.js", "NUL.tar.gz", "prn.txt", "aux.css", "js/aux/x.js", "COM1", "com9.log", "LPT1.txt",
            "lpt9", "COM0.js", "com\u00B9.txt", "conin$", "CONOUT$.txt", "nul .js", "Con  ", "a.", "a ", "js./x.js", "js /x.js", "index.html." };
        foreach (string n in bad)
            Assert.True(Payload.EntryPath(b, n) == null, "rejected: <" + n + ">");
        string[] good = { "console.js", "nul_x.js", "null.js", "com10.js", "lpt.js", "auxiliary.css", "a.b.c", "js/con-tag.js", ".hidden" };
        foreach (string n in good)
            Assert.True(Payload.EntryPath(b, n) != null, "accepted: <" + n + ">");
    }

    public static void Test_LoaderFolderFollowsTheProcessArchitecture()
    {
        Assert.Eq("x86", Payload.LoaderFolder(System.Runtime.InteropServices.Architecture.X86), "32-bit");
        Assert.Eq("x64", Payload.LoaderFolder(System.Runtime.InteropServices.Architecture.X64), "64-bit");
        Assert.Eq("arm64", Payload.LoaderFolder(System.Runtime.InteropServices.Architecture.Arm64), "Windows on ARM (.NET 4.8.1)");
        Assert.True(Payload.LoaderFolder(System.Runtime.InteropServices.Architecture.Arm) == null, "no WebView2 loader for 32-bit ARM");
        foreach (string f in new[] { "x86", "x64", "arm64" })
            Assert.True(Array.IndexOf(Payload.Binaries, f + "/WebView2Loader.dll") >= 0, "embedded: " + f);
    }

    public static void Test_ManagedFileMatchesOnlyTheTwoWebView2Assemblies()
    {
        Assert.Eq("Microsoft.Web.WebView2.Core.dll",
            Payload.ManagedFile("Microsoft.Web.WebView2.Core, Version=1.0.3351.48, Culture=neutral, PublicKeyToken=2a8ab48044d2601e"), "Core");
        Assert.Eq("Microsoft.Web.WebView2.WinForms.dll", Payload.ManagedFile("Microsoft.Web.WebView2.WinForms"), "WinForms, short name");
        Assert.Eq("Microsoft.Web.WebView2.Core.dll", Payload.ManagedFile("microsoft.web.webview2.core, Version=1.0.0.0"), "case-insensitive like the loader");
        Assert.True(Payload.ManagedFile("Microsoft.Web.WebView2.WinForms.resources, Version=1.0.0.0, Culture=zh-TW") == null, "satellite resources are not ours");
        Assert.True(Payload.ManagedFile("WebView2Loader") == null, "the native loader is not a managed assembly");
        Assert.True(Payload.ManagedFile("System.Xml") == null, "framework assemblies are not ours");
        Assert.True(Payload.ManagedFile("") == null && Payload.ManagedFile(null) == null, "nothing");
        Assert.True(Payload.ManagedFile("not a, valid=, name==") == null, "a malformed name does not throw");
    }

    public static void Test_EnsureIsNullInABuildWithoutResources()
    {
        Assert.True(Payload.Ensure() == null, "dev build (and this test exe): nothing to unpack");
        Assert.True(Payload.Dir == null && Payload.WebDir == null, "no payload folder");
        Assert.True(!Payload.IsRelease, "dev switches (QJZ_WEB_ROOT, QJZ_DEVTOOLS) count");
    }

    public static void Test_TargetDirIsWhereInstallUnpacks()
    {
        string root = NewDir();
        try
        {
            byte[] web = SampleWeb();
            Assert.Eq(Path.Combine(root, Payload.FolderName(web)), Payload.TargetDir(root, web), "root\\<id>");
            Assert.Eq(Payload.TargetDir(root, web), Payload.Install(root, Resources(web, "v1"), null), "the same folder Install fills");
        }
        finally { Directory.Delete(root, true); }
    }

    // §5.10: a WebView2 DLL beside the exe that exists but cannot be read is foreign too (fail closed).
    public static void Test_ForeignCopies_UnreadableBesideIsForeign()
    {
        string exeDir = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            Func<string, byte[]> embedded = delegate(string name) { return res[name]; };
            string path = Path.Combine(exeDir, "Microsoft.Web.WebView2.Core.dll");
            File.WriteAllBytes(path, res["Microsoft.Web.WebView2.Core.dll"]);
            using (new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                Assert.Eq("Microsoft.Web.WebView2.Core.dll", string.Join(",", Payload.ForeignCopies(exeDir, embedded).ToArray()),
                    "held open, unreadable: listed as foreign");
            }
            Assert.Eq(0, Payload.ForeignCopies(exeDir, embedded).Count, "released and identical: start");
        }
        finally { Directory.Delete(exeDir, true); }
    }

    // M10: the start-up decision. A Microsoft.Web.WebView2.*.dll beside a release exe that is not byte-identical to
    // its embedded copy (another program's, in Downloads) makes Program refuse to start (the runtime would load it
    // first); identical copies and anything else beside the exe are fine; a dev build (nothing embedded) never refuses.
    public static void Test_ForeignCopiesAreTheManagedDllsBesideTheExeThatDiffer()
    {
        string exeDir = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            Func<string, byte[]> embedded = delegate(string name) { return res[name]; };
            Assert.Eq(0, Payload.ForeignCopies(exeDir, embedded).Count, "nothing beside the exe: start");
            File.WriteAllBytes(Path.Combine(exeDir, "Microsoft.Web.WebView2.Core.dll"), res["Microsoft.Web.WebView2.Core.dll"]);
            File.WriteAllBytes(Path.Combine(exeDir, "Microsoft.Web.WebView2.WinForms.dll"), res["Microsoft.Web.WebView2.WinForms.dll"]);
            Assert.Eq(0, Payload.ForeignCopies(exeDir, embedded).Count, "identical copies: start");
            File.WriteAllText(Path.Combine(exeDir, "Microsoft.Web.WebView2.WinForms.dll"), "someone else's");
            File.WriteAllText(Path.Combine(exeDir, "WebView2Loader.dll"), "native, found only through the loader folder");
            Assert.Eq("Microsoft.Web.WebView2.WinForms.dll", string.Join(",", Payload.ForeignCopies(exeDir, embedded).ToArray()), "the different one: refuse");
            File.WriteAllText(Path.Combine(exeDir, "Microsoft.Web.WebView2.Core.dll"), "garbage");
            Assert.Eq("Microsoft.Web.WebView2.Core.dll,Microsoft.Web.WebView2.WinForms.dll",
                string.Join(",", Payload.ForeignCopies(exeDir, embedded).ToArray()), "both");
            Assert.Eq(0, Payload.ForeignCopies(null, embedded).Count, "no exe folder: nothing");
            Assert.Eq(0, Payload.ForeignCopies(exeDir, delegate(string name) { return null; }).Count,
                "a dev build embeds nothing and keeps its DLLs beside the exe: start");
            Assert.Eq(0, Payload.ForeignCopies(exeDir, Payload.Embedded).Count, "this test exe embeds nothing either");
        }
        finally { Directory.Delete(exeDir, true); }
    }

    public static void Test_InstallUnpacksEverythingWithTheStampLast()
    {
        string root = NewDir();
        try
        {
            byte[] web = SampleWeb();
            var errors = new List<string>();
            string dir = Payload.Install(root, Resources(web, "v1"), delegate(string what, Exception ex) { errors.Add(what); });
            Assert.Eq(Path.Combine(root, Payload.FolderName(web)), dir, "folder named after web.zip");
            Assert.Eq("<p>hi</p>", Text(Path.Combine(dir, @"web\index.html")), "page");
            Assert.Eq("var t;", Text(Path.Combine(dir, @"web\js\core\time.js")), "nested script");
            Assert.Eq("font", Text(Path.Combine(dir, @"web\fonts\Fredoka-Variable.ttf")), "font");
            Assert.Eq("Microsoft.Web.WebView2.Core.dll v1", Text(Path.Combine(dir, "Microsoft.Web.WebView2.Core.dll")), "managed DLL at the top");
            Assert.Eq("Microsoft.Web.WebView2.WinForms.dll v1", Text(Path.Combine(dir, "Microsoft.Web.WebView2.WinForms.dll")), "WinForms DLL");
            Assert.Eq("x64/WebView2Loader.dll v1", Text(Path.Combine(dir, @"x64\WebView2Loader.dll")), "x64 loader");
            Assert.Eq("x86/WebView2Loader.dll v1", Text(Path.Combine(dir, @"x86\WebView2Loader.dll")), "x86 loader");
            Assert.Eq("arm64/WebView2Loader.dll v1", Text(Path.Combine(dir, @"arm64\WebView2Loader.dll")), "arm64 loader");
            string stamp = Text(Path.Combine(dir, Payload.StampName));
            Assert.True(stamp.StartsWith(Payload.FolderName(web)), "stamp lists web.zip's hash first: " + stamp);
            Assert.True(stamp.Contains("  " + web.Length + "  web.zip\n"), "with its size: " + stamp);
            Assert.True(stamp.Contains("  " + "arm64/WebView2Loader.dll v1".Length + "  arm64/WebView2Loader.dll\n"), "every resource, with its size");
            Assert.True(stamp.Contains("  9  web/index.html\n") && stamp.Contains("  6  web/js/core/time.js\n"), "every page file with its size");
            Assert.True(!stamp.Contains("web/js/\n"), "no directory entries");
            Assert.Eq(1, Directory.GetDirectories(root).Length, "nothing else in app\\");
            Assert.Eq(0, errors.Count, "no errors");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallSkipsACompleteFolder()
    {
        string root = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            string dir = Payload.Install(root, res, null);
            DateTime old = new DateTime(2001, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            string page = Path.Combine(dir, @"web\index.html");
            string stamp = Path.Combine(dir, Payload.StampName);
            File.SetLastWriteTimeUtc(page, old);
            File.SetLastWriteTimeUtc(stamp, old);
            File.WriteAllText(Path.Combine(dir, "web\\extra.txt"), "left by someone");
            Assert.Eq(dir, Payload.Install(root, res, null), "same folder");
            Assert.Eq(old, File.GetLastWriteTimeUtc(page), "page not rewritten");
            Assert.Eq(old, File.GetLastWriteTimeUtc(stamp), "stamp not rewritten");
            Assert.True(File.Exists(Path.Combine(dir, "web\\extra.txt")), "folder not recreated");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallRedoesAFolderWithoutItsStamp()
    {
        string root = NewDir();
        try
        {
            byte[] web = SampleWeb();
            string dir = Path.Combine(root, Payload.FolderName(web));
            Directory.CreateDirectory(Path.Combine(dir, "web"));
            File.WriteAllText(Path.Combine(dir, @"web\index.html"), "half written");   // a crash during the first unpack
            File.WriteAllText(Path.Combine(dir, "junk.tmp"), "x");
            Assert.Eq(dir, Payload.Install(root, Resources(web, "v1"), null), "same folder");
            Assert.Eq("<p>hi</p>", Text(Path.Combine(dir, @"web\index.html")), "rewritten");
            Assert.True(File.Exists(Path.Combine(dir, @"x86\WebView2Loader.dll")), "completed");
            Assert.True(!File.Exists(Path.Combine(dir, "junk.tmp")), "started from an empty folder");
            Assert.True(File.Exists(Path.Combine(dir, Payload.StampName)), "now complete");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallRedoesAFolderWithAMissingFile()
    {
        string root = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            string dir = Payload.Install(root, res, null);
            File.Delete(Path.Combine(dir, @"web\js\core\time.js"));
            File.Delete(Path.Combine(dir, @"x64\WebView2Loader.dll"));
            Payload.Install(root, res, null);
            Assert.True(File.Exists(Path.Combine(dir, @"web\js\core\time.js")), "page file restored");
            Assert.True(File.Exists(Path.Combine(dir, @"x64\WebView2Loader.dll")), "loader restored");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallRedoesAFolderWithATruncatedFile()
    {
        string root = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            string dir = Payload.Install(root, res, null);
            string dll = Path.Combine(dir, "Microsoft.Web.WebView2.Core.dll");
            string page = Path.Combine(dir, @"web\index.html");
            using (var f = new FileStream(dll, FileMode.Open, FileAccess.Write)) f.SetLength(f.Length - 3);   // the stamp still matches
            Payload.Install(root, res, null);
            Assert.Eq("Microsoft.Web.WebView2.Core.dll v1", Text(dll), "DLL rewritten in full");
            using (var f = new FileStream(page, FileMode.Open, FileAccess.Write)) f.SetLength(0);
            Payload.Install(root, res, null);
            Assert.Eq("<p>hi</p>", Text(page), "an emptied page file too");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallRedoesTheFolderWhenOnlyTheDllsChanged()
    {
        string root = NewDir();
        try
        {
            byte[] web = SampleWeb();
            string dir = Payload.Install(root, Resources(web, "v1"), null);
            Assert.Eq(dir, Payload.Install(root, Resources(web, "v2"), null), "same web.zip, same folder");
            Assert.Eq("Microsoft.Web.WebView2.Core.dll v2", Text(Path.Combine(dir, "Microsoft.Web.WebView2.Core.dll")), "new DLL unpacked");
            Assert.Eq("x64/WebView2Loader.dll v2", Text(Path.Combine(dir, @"x64\WebView2Loader.dll")), "new loader unpacked");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallDeletesOtherVersionsAndKeepsUnknownFolders()
    {
        string root = NewDir();
        try
        {
            Directory.CreateDirectory(Path.Combine(root, @"0123456789ab\web"));
            File.WriteAllText(Path.Combine(root, @"0123456789ab\web\index.html"), "old version");
            Directory.CreateDirectory(Path.Combine(root, "fedcba987654"));
            Directory.CreateDirectory(Path.Combine(root, "notes"));
            File.WriteAllText(Path.Combine(root, "notes\\mine.txt"), "user file");
            var errors = new List<string>();
            string dir = Payload.Install(root, Resources(SampleWeb(), "v1"), delegate(string what, Exception ex) { errors.Add(what); });
            Assert.True(!Directory.Exists(Path.Combine(root, "0123456789ab")), "old version deleted");
            Assert.True(!Directory.Exists(Path.Combine(root, "fedcba987654")), "empty old version deleted");
            Assert.True(File.Exists(Path.Combine(root, "notes\\mine.txt")), "a folder that is not ours stays");
            Assert.True(Directory.Exists(dir), "current one stays");
            Assert.Eq(0, errors.Count, "no errors");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallLogsAnOldVersionItCannotDeleteAndCarriesOn()
    {
        string root = NewDir();
        string old = Path.Combine(root, "0123456789ab");
        try
        {
            Directory.CreateDirectory(old);
            var errors = new List<string>();
            string dir;
            using (new FileStream(Path.Combine(old, "busy.dll"), FileMode.Create, FileAccess.ReadWrite, FileShare.None))
                dir = Payload.Install(root, Resources(SampleWeb(), "v1"), delegate(string what, Exception ex) { errors.Add(what); });
            Assert.True(File.Exists(Path.Combine(dir, Payload.StampName)), "installed anyway");
            Assert.Eq(1, errors.Count, "one log line");
            Assert.True(errors[0].Contains("0123456789ab"), "names the folder: " + errors[0]);
            Assert.Eq(dir, Payload.Install(root, Resources(SampleWeb(), "v1"), null), "next start");
            Assert.True(!Directory.Exists(old), "deleted on the next start");
        }
        finally { Directory.Delete(root, true); }
    }

    public static void Test_InstallRefusesAZipEntryOutsideTheFolder()
    {
        string root = NewDir();
        try
        {
            foreach (string evil in new[] { "../../evil.txt", "web/nul.js" })
            {
                byte[] web = Zip("index.html", "ok", evil, "bad");
                bool threw = false;
                try { Payload.Install(Path.Combine(root, "app"), Resources(web, "v1"), null); }
                catch (InvalidDataException) { threw = true; }
                Assert.True(threw, evil + " -> InvalidDataException");
                Assert.True(!Directory.Exists(Path.Combine(root, "app")), evil + ": nothing at all was written");
                Assert.Eq(0, Directory.GetFileSystemEntries(root).Length, evil + ": nothing beside it either");
            }
        }
        finally { Directory.Delete(root, true); }
    }

    static void Junction(string link, string target)
    {
        var psi = new System.Diagnostics.ProcessStartInfo("cmd.exe", "/c mklink /J \"" + link + "\" \"" + target + "\"");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        using (var p = System.Diagnostics.Process.Start(psi))
        {
            p.StandardOutput.ReadToEnd();
            p.WaitForExit();
        }
        Assert.True((File.GetAttributes(link) & FileAttributes.ReparsePoint) != 0, "junction made: " + link);
    }

    public static void Test_InstallDeletesOldVersionsWithoutFollowingJunctions()
    {
        string root = NewDir(), outside = NewDir();
        string inner = Path.Combine(root, @"0123456789ab\web\linked"), whole = Path.Combine(root, "fedcba987654");
        try
        {
            File.WriteAllText(Path.Combine(outside, "keep.txt"), "the user's file");
            Directory.CreateDirectory(Path.Combine(root, @"0123456789ab\web"));
            File.WriteAllText(Path.Combine(root, @"0123456789ab\web\index.html"), "old version");
            Junction(inner, outside);   // an old version's folder with a junction inside
            Junction(whole, outside);   // an old version's folder that is itself a junction
            var errors = new List<string>();
            Payload.Install(root, Resources(SampleWeb(), "v1"), delegate(string what, Exception ex) { errors.Add(what + ": " + ex); });
            Assert.Eq(0, errors.Count, "no errors: " + string.Join(" | ", errors.ToArray()));
            Assert.True(!Directory.Exists(Path.Combine(root, "0123456789ab")), "old version deleted");
            Assert.True(!Directory.Exists(whole), "the junction folder is gone");
            Assert.Eq("the user's file", Text(Path.Combine(outside, "keep.txt")), "what the junctions pointed to is untouched");
        }
        finally
        {
            foreach (string link in new[] { inner, whole })
                if (Directory.Exists(link)) Directory.Delete(link, false);   // the link only
            Directory.Delete(root, true);
            Directory.Delete(outside, true);
        }
    }

    public static void Test_InstallNeedsEveryResource()
    {
        string root = NewDir();
        try
        {
            var res = Resources(SampleWeb(), "v1");
            res.Remove("x86/WebView2Loader.dll");
            bool threw = false;
            try { Payload.Install(root, res, null); }
            catch (InvalidDataException) { threw = true; }
            Assert.True(threw, "a missing resource is an error, not a half-installed folder");
            Assert.Eq(0, Directory.GetDirectories(root).Length, "nothing created");
        }
        finally { Directory.Delete(root, true); }
    }
}
