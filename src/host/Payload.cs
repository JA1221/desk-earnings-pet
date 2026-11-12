using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

// The release build's runtime files. build.ps1 -Release embeds them in the exe as plain resources (no packer):
//   web.zip                                   the page (index.html and what it loads, fonts, licence texts)
//   Microsoft.Web.WebView2.Core.dll, Microsoft.Web.WebView2.WinForms.dll
//   x64/, x86/, arm64/WebView2Loader.dll
// Ensure() unpacks them once to %LocalAppData%\錢進中\app\<id>\ (<id> = first 12 hex digits of the SHA-256 of
// web.zip): web\..., the two managed DLLs, and a folder per architecture with the native loader. The two managed
// DLLs then load from there through AppDomain.AssemblyResolve; WebViewEnv points WebView2 at the loader; WebRoot
// serves web\. A folder is used as it is when its stamp (payload.sha256, written last: the hash and size of each
// embedded file, the size of each page file) matches the exe and every file is there at its size; otherwise it is
// emptied and unpacked again, so a crash halfway, a damaged file or a newer WebView2 DLL behind the same web.zip is
// repaired at the next start. Other versions' folders are deleted, never following a junction or link out of them.
// Dev builds embed nothing: Ensure() returns null and the page and DLLs come from the repo as before.
public static class Payload
{
    public const string WebZip = "web.zip";
    public const string StampName = "payload.sha256";
    public static readonly string[] Binaries = { "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll",
        "x64/WebView2Loader.dll", "x86/WebView2Loader.dll", "arm64/WebView2Loader.dll" };
    const int IdLength = 12;
    static readonly string[] Devices = { "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$" };
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

    // A release exe that has unpacked its files. The dev switches (QJZ_WEB_ROOT, QJZ_DEVTOOLS) count only when false:
    // a release exe serves only the pages it carries and never opens DevTools.
    public static bool IsRelease
    {
        get { return dir != null; }
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

    // The loader folder for a process architecture (x86, x64, arm64), or null where WebView2 has no loader.
    public static string LoaderFolder(Architecture arch)
    {
        switch (arch)
        {
            case Architecture.X86: return "x86";
            case Architecture.X64: return "x64";
            case Architecture.Arm64: return "arm64";
            default: return null;
        }
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
        List<KeyValuePair<string, long>> webFiles = WebFiles(webZip);
        string id = FolderName(webZip);
        string target = Path.Combine(root, id);
        string stamp = Stamp(resources, webFiles);
        if (!IsComplete(target, stamp, resources, webFiles)) Unpack(target, resources, webFiles, stamp);
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
    // outside baseDir or is not a plain relative file path: rooted, a drive, '..', '.', an empty part, reserved
    // characters, a part ending in a dot or a space, or a device name (CON, NUL, COM1, LPT1, ... also as nul.js).
    public static string EntryPath(string baseDir, string name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        string rel = name.Replace('\\', '/');
        foreach (char c in rel)
            if (c < 32 || "<>:\"|?*".IndexOf(c) >= 0) return null;
        string[] parts = rel.Split('/');
        foreach (string p in parts)
            if (p.Length == 0 || p == "." || p == ".." || p.EndsWith(".") || p.EndsWith(" ") || IsDevice(p)) return null;
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

    // Windows device names, which name a device instead of a file whatever the folder or extension.
    static bool IsDevice(string part)
    {
        int dot = part.IndexOf('.');
        string b = (dot < 0 ? part : part.Substring(0, dot)).TrimEnd(' ').ToUpperInvariant();
        if (Array.IndexOf(Devices, b) >= 0) return true;
        return b.Length == 4 && (b.StartsWith("COM") || b.StartsWith("LPT")) && "0123456789¹²³".IndexOf(b[3]) >= 0;
    }

    // The files in web.zip with their sizes (directory entries skipped). Throws InvalidDataException for a name
    // that EntryPath refuses, before anything is written.
    static List<KeyValuePair<string, long>> WebFiles(byte[] webZip)
    {
        var files = new List<KeyValuePair<string, long>>();
        using (var zip = new ZipArchive(new MemoryStream(webZip, false), ZipArchiveMode.Read))
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                string name = e.FullName;
                if (name.EndsWith("/") || name.EndsWith("\\")) continue;
                if (EntryPath("x", name) == null) throw new InvalidDataException("unsafe file name in web.zip: " + name);
                files.Add(new KeyValuePair<string, long>(name, e.Length));
            }
        return files;
    }

    // "<sha256>  <bytes>  <name>" per embedded file (web.zip first, so the stamp starts with the folder id), then
    // "-  <bytes>  web/<path>" per page file.
    static string Stamp(IDictionary<string, byte[]> resources, List<KeyValuePair<string, long>> webFiles)
    {
        var sb = new StringBuilder();
        foreach (string name in AllNames())
            sb.Append(Sha256Hex(resources[name])).Append("  ").Append(resources[name].Length).Append("  ").Append(name).Append('\n');
        foreach (KeyValuePair<string, long> f in webFiles)
            sb.Append("-  ").Append(f.Value).Append("  web/").Append(f.Key.Replace('\\', '/')).Append('\n');
        return sb.ToString();
    }

    static bool IsComplete(string target, string stamp, IDictionary<string, byte[]> resources, List<KeyValuePair<string, long>> webFiles)
    {
        string stampPath = Path.Combine(target, StampName);
        if (!File.Exists(stampPath) || File.ReadAllText(stampPath) != stamp) return false;
        foreach (string name in Binaries)
            if (!HasSize(EntryPath(target, name), resources[name].Length)) return false;
        string web = Path.Combine(target, "web");
        foreach (KeyValuePair<string, long> f in webFiles)
            if (!HasSize(EntryPath(web, f.Key), f.Value)) return false;
        return true;
    }

    static bool HasSize(string path, long length)
    {
        var fi = new FileInfo(path);
        return fi.Exists && fi.Length == length;
    }

    // Empties target and writes everything; the stamp goes last, so only a finished folder carries it.
    static void Unpack(string target, IDictionary<string, byte[]> resources, List<KeyValuePair<string, long>> webFiles, string stamp)
    {
        if (Directory.Exists(target)) DeleteTree(target);
        Directory.CreateDirectory(target);
        foreach (string name in Binaries) WriteFile(EntryPath(target, name), resources[name]);
        string web = Path.Combine(target, "web");
        Directory.CreateDirectory(web);
        var wanted = new HashSet<string>();
        foreach (KeyValuePair<string, long> f in webFiles) wanted.Add(f.Key);
        using (var zip = new ZipArchive(new MemoryStream(resources[WebZip], false), ZipArchiveMode.Read))
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                if (!wanted.Contains(e.FullName)) continue;   // directory entries
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
            try { DeleteTree(Path.Combine(root, n)); }
            catch (Exception ex) { if (log != null) log("could not delete old app files " + n, ex); }
        }
    }

    // Deletes a folder and what is in it without following links: a junction or symbolic link (inside, or the
    // folder itself) is removed as a link, and what it points to is never touched.
    static void DeleteTree(string path)
    {
        var d = new DirectoryInfo(path);
        if ((d.Attributes & FileAttributes.ReparsePoint) == 0)
            foreach (FileSystemInfo e in d.EnumerateFileSystemInfos())
            {
                if ((e.Attributes & FileAttributes.Directory) != 0) { DeleteTree(e.FullName); continue; }
                if ((e.Attributes & FileAttributes.ReadOnly) != 0) e.Attributes &= ~FileAttributes.ReadOnly;
                e.Delete();   // a file symbolic link: the link only
            }
        d.Delete(false);   // an empty folder, or the link itself
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
