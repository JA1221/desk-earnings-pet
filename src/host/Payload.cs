using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

// The release build's runtime files. build.ps1 -Release embeds them in the exe as plain resources (no packer):
//   web.zip                                   the page (src\web without the dev pages, fonts included)
//   Microsoft.Web.WebView2.Core.dll, Microsoft.Web.WebView2.WinForms.dll
//   x64/WebView2Loader.dll, x86/WebView2Loader.dll
// Ensure() unpacks them once to %LocalAppData%\錢進中\app\<id>\ (<id> = first 12 hex digits of the SHA-256 of
// web.zip): web\..., the two managed DLLs, x64\ and x86\ with the native loader. The two managed DLLs then load
// from there through AppDomain.AssemblyResolve; WebViewEnv points WebView2 at the loader; WebRoot serves web\.
// A folder is used as it is when its stamp (payload.sha256, written last) matches the embedded files and nothing
// is missing; otherwise it is emptied and unpacked again, so a crash halfway or a newer WebView2 DLL behind the
// same web.zip is repaired at the next start. Other versions' folders are deleted. Dev builds embed nothing:
// Ensure() returns null and the page and DLLs come from the repo as before.
public static class Payload
{
    public const string WebZip = "web.zip";
    public const string StampName = "payload.sha256";
    public static readonly string[] Binaries =
        { "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "x64/WebView2Loader.dll", "x86/WebView2Loader.dll" };
    const int IdLength = 12;
    static string dir;

    // The unpacked folder; null in a dev build or before Ensure.
    public static string Dir
    {
        get { return dir; }
    }

    // The unpacked page folder; null in a dev build or before Ensure.
    public static string WebDir
    {
        get { return dir == null ? null : Path.Combine(dir, "web"); }
    }

    // Call once, before anything touches WebView2 (Program, after the single-instance check). Returns the
    // unpacked folder, or null for a dev build. Throws when the files cannot be written.
    public static string Ensure()
    {
        if (dir != null) return dir;
        Assembly exe = typeof(Payload).Assembly;
        byte[] webZip = ReadResource(exe, WebZip);
        if (webZip == null) return null;
        var resources = new Dictionary<string, byte[]>();
        resources[WebZip] = webZip;
        foreach (string name in Binaries) resources[name] = ReadResource(exe, name);
        dir = Install(Path.Combine(AppPaths.LocalDir, "app"), resources, ErrorLog.Write);
        AppDomain.CurrentDomain.AssemblyResolve += OnAssemblyResolve;
        return dir;
    }

    // Unpacks resources (WebZip + Binaries) into root\<id>\ unless that folder is already complete, then deletes
    // other versions' folders in root (failures logged, retried next time). Returns root\<id>.
    public static string Install(string root, IDictionary<string, byte[]> resources, Action<string, Exception> log)
    {
        foreach (string name in AllNames())
        {
            byte[] b;
            if (!resources.TryGetValue(name, out b) || b == null) throw new InvalidDataException("missing embedded file " + name);
        }
        byte[] webZip = resources[WebZip];
        List<string> webFiles = WebFiles(webZip);
        string id = FolderName(webZip);
        string target = Path.Combine(root, id);
        string stamp = Stamp(resources);
        if (!IsComplete(target, stamp, webFiles)) Unpack(target, resources, webFiles, stamp);
        RemoveStale(root, id, log);
        return target;
    }

    public static string FolderName(byte[] webZip)
    {
        return Sha256Hex(webZip).Substring(0, IdLength);
    }

    // Folder names in app\ that belong to other versions: 12 lowercase hex digits, not current. Anything else
    // (a folder someone put there) is left alone.
    public static List<string> StaleFolders(IEnumerable<string> names, string current)
    {
        var stale = new List<string>();
        foreach (string n in names)
            if (IsId(n) && !string.Equals(n, current, StringComparison.OrdinalIgnoreCase)) stale.Add(n);
        return stale;
    }

    // baseDir joined with a zip entry or resource name ('/' or '\' separated), or null when the name could reach
    // outside baseDir or is not a plain relative file path (rooted, drive, '..', '.', empty part, reserved chars).
    public static string EntryPath(string baseDir, string name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        string rel = name.Replace('\\', '/');
        foreach (char c in rel)
            if (c < 32 || "<>:\"|?*".IndexOf(c) >= 0) return null;
        string[] parts = rel.Split('/');
        foreach (string p in parts)
            if (p.Length == 0 || p == "." || p == "..") return null;
        return Path.Combine(baseDir, string.Join(Path.DirectorySeparatorChar.ToString(), parts));
    }

    // The embedded file for an assembly the runtime could not find: one of the two WebView2 DLLs, else null.
    public static string ManagedFile(string assemblyName)
    {
        if (string.IsNullOrEmpty(assemblyName)) return null;
        string simple;
        try { simple = new AssemblyName(assemblyName).Name; }
        catch (Exception) { return null; }
        foreach (string f in Binaries)
            if (f.IndexOf('/') < 0 && string.Equals(f, simple + ".dll", StringComparison.OrdinalIgnoreCase)) return f;
        return null;
    }

    static Assembly OnAssemblyResolve(object sender, ResolveEventArgs e)
    {
        string d = dir;
        string file = ManagedFile(e.Name);
        if (d == null || file == null) return null;
        return Assembly.LoadFrom(Path.Combine(d, file));   // LoadFrom: WinForms finds Core beside it, the same instance
    }

    static IEnumerable<string> AllNames()
    {
        yield return WebZip;
        foreach (string name in Binaries) yield return name;
    }

    // The files in web.zip (directory entries skipped). Throws InvalidDataException for a name that EntryPath refuses.
    static List<string> WebFiles(byte[] webZip)
    {
        var files = new List<string>();
        using (var zip = new ZipArchive(new MemoryStream(webZip, false), ZipArchiveMode.Read))
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                string name = e.FullName;
                if (name.EndsWith("/") || name.EndsWith("\\")) continue;
                if (EntryPath("x", name) == null) throw new InvalidDataException("unsafe file name in web.zip: " + name);
                files.Add(name);
            }
        return files;
    }

    // One "<sha256>  <name>" line per embedded file (web.zip first, so the line starts with the folder id).
    static string Stamp(IDictionary<string, byte[]> resources)
    {
        var sb = new StringBuilder();
        foreach (string name in AllNames()) sb.Append(Sha256Hex(resources[name])).Append("  ").Append(name).Append('\n');
        return sb.ToString();
    }

    static bool IsComplete(string target, string stamp, List<string> webFiles)
    {
        string stampPath = Path.Combine(target, StampName);
        if (!File.Exists(stampPath) || File.ReadAllText(stampPath) != stamp) return false;
        foreach (string name in Binaries)
            if (!File.Exists(EntryPath(target, name))) return false;
        string web = Path.Combine(target, "web");
        foreach (string name in webFiles)
            if (!File.Exists(EntryPath(web, name))) return false;
        return true;
    }

    // Empties target and writes everything; the stamp goes last, so only a finished folder carries it.
    static void Unpack(string target, IDictionary<string, byte[]> resources, List<string> webFiles, string stamp)
    {
        if (Directory.Exists(target)) Directory.Delete(target, true);
        Directory.CreateDirectory(target);
        foreach (string name in Binaries) WriteFile(EntryPath(target, name), resources[name]);
        string web = Path.Combine(target, "web");
        Directory.CreateDirectory(web);
        using (var zip = new ZipArchive(new MemoryStream(resources[WebZip], false), ZipArchiveMode.Read))
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                if (!webFiles.Contains(e.FullName)) continue;   // directory entries
                string path = EntryPath(web, e.FullName);
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                using (Stream src = e.Open())
                using (var dst = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None))
                    src.CopyTo(dst);
            }
        File.WriteAllText(Path.Combine(target, StampName), stamp);
    }

    static void RemoveStale(string root, string current, Action<string, Exception> log)
    {
        var names = new List<string>();
        try
        {
            foreach (string d in Directory.GetDirectories(root)) names.Add(Path.GetFileName(d));
        }
        catch (Exception ex)
        {
            if (log != null) log("listing old app files in " + root, ex);
            return;
        }
        foreach (string n in StaleFolders(names, current))
        {
            try { Directory.Delete(Path.Combine(root, n), true); }
            catch (Exception ex) { if (log != null) log("could not delete old app files " + n, ex); }
        }
    }

    static void WriteFile(string path, byte[] bytes)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        File.WriteAllBytes(path, bytes);
    }

    static bool IsId(string name)
    {
        if (name == null || name.Length != IdLength) return false;
        foreach (char c in name)
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
        return true;
    }

    static string Sha256Hex(byte[] data)
    {
        byte[] hash;
        using (var sha = new SHA256Cng()) hash = sha.ComputeHash(data);   // CNG: allowed under the FIPS policy
        var sb = new StringBuilder(hash.Length * 2);
        foreach (byte b in hash) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    static byte[] ReadResource(Assembly asm, string name)
    {
        using (Stream s = asm.GetManifestResourceStream(name))
        {
            if (s == null) return null;
            var ms = new MemoryStream();
            s.CopyTo(ms);
            return ms.ToArray();
        }
    }
}
