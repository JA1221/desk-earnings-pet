using System;
using System.IO;
using System.Text;

// Durable, atomic UTF-8 text file. A write goes to path.tmp, is flushed through to the disk (FileStream.Flush(true)),
// and only then replaces the target; the version it replaces becomes path.bak. A power cut or an OS crash leaves the
// old file, the new one, or (if the new one is damaged) the .bak with the version before it. A replaced file that was
// corrupt (BackupCorrupt) or blank (empty, whitespace, NULs) never becomes the .bak: the good .bak stays.
public class TextStore
{
    static readonly Encoding Utf8NoBom = new UTF8Encoding(false);
    readonly string path;
    readonly bool backup;
    bool corrupt;   // BackupCorrupt saw the current file: the next write must not make it the .bak

    // backup: keep the replaced version as path.bak (false for files nobody needs an older copy of).
    public TextStore(string path, bool backup = true)
    {
        this.path = path;
        this.backup = backup;
    }

    // Returns null when the file does not exist. A UTF-8 BOM is not part of the text.
    public string Read()
    {
        return ReadText(path);
    }

    // The previous version (path.bak), or null when there is none.
    public string ReadBackup()
    {
        return ReadText(path + ".bak");
    }

    // Throws when the file cannot be written (locked, read-only); the target then keeps its old text.
    public void Write(string text)
    {
        string dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        string tmp = path + ".tmp";
        byte[] bytes = Utf8NoBom.GetBytes(text);
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            fs.Write(bytes, 0, bytes.Length);
            fs.Flush(true);   // through the OS cache to the disk before the rename makes it the real file
        }
        if (!File.Exists(path)) File.Move(tmp, path);
        else if (!backup || corrupt || IsBlank(path)) File.Replace(tmp, path, null);   // keeps the .bak there is
        else
        {
            try { File.Replace(tmp, path, path + ".bak"); }
            catch (IOException) { ReplaceWithoutBackup(tmp); }
            catch (UnauthorizedAccessException) { ReplaceWithoutBackup(tmp); }
        }
        corrupt = false;
    }

    // Copies the current file to path.corrupt-yyyyMMdd-HHmmss; null when there is nothing to copy. The next write
    // then replaces the corrupt file without making it the .bak, so the .bak keeps the last good version.
    public string BackupCorrupt()
    {
        if (!File.Exists(path)) return null;
        string dest = path + ".corrupt-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
        File.Copy(path, dest, true);
        corrupt = true;
        return dest;
    }

    // The .bak could not be replaced (read-only, or held open by another program): saving the newest text matters
    // more than the backup. If the target itself is the problem this throws as well.
    void ReplaceWithoutBackup(string tmp)
    {
        if (!File.Exists(tmp)) throw new IOException("the new text for " + path + " is gone");
        if (File.Exists(path)) File.Replace(tmp, path, null);
        else File.Move(tmp, path);   // ReplaceFile moved the old file away but could not move the new one in
    }

    // Nothing but a UTF-8 BOM, whitespace and NULs (a power cut can leave a file empty or zero-filled): not worth
    // keeping as the .bak, and the page has restored from the .bak anyway. Reads only up to the first other byte (the
    // first byte of a normal JSON file). A file that cannot be opened counts as not blank.
    static bool IsBlank(string p)
    {
        try
        {
            using (var fs = new FileStream(p, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                byte[] buf = new byte[4096];
                long pos = 0;
                int n;
                while ((n = fs.Read(buf, 0, buf.Length)) > 0)
                {
                    for (int i = 0; i < n; i++, pos++)
                    {
                        byte b = buf[i];
                        bool bom = pos < 3 && b == (pos == 0 ? 0xEF : pos == 1 ? 0xBB : 0xBF);
                        if (!bom && b != 0x20 && b != 0x09 && b != 0x0A && b != 0x0D && b != 0x00) return false;
                    }
                }
                return true;
            }
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    static string ReadText(string p)
    {
        if (!File.Exists(p)) return null;
        return File.ReadAllText(p, Encoding.UTF8);
    }
}
