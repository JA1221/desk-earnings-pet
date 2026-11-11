using System;
using System.IO;
using System.Text;

// Atomic UTF-8 text file: writes go to path.tmp first, then replace the target.
public class TextStore
{
    static readonly Encoding Utf8NoBom = new UTF8Encoding(false);
    readonly string path;

    public TextStore(string path)
    {
        this.path = path;
    }

    // Returns null when the file does not exist. A UTF-8 BOM is not part of the text.
    public string Read()
    {
        if (!File.Exists(path)) return null;
        return File.ReadAllText(path, Encoding.UTF8);
    }

    public void Write(string text)
    {
        string dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        string tmp = path + ".tmp";
        File.WriteAllText(tmp, text, Utf8NoBom);
        if (File.Exists(path)) File.Replace(tmp, path, null);
        else File.Move(tmp, path);
    }

    // Copies the current file to path.corrupt-yyyyMMdd-HHmmss; null when there is nothing to copy.
    public string BackupCorrupt()
    {
        if (!File.Exists(path)) return null;
        string dest = path + ".corrupt-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
        File.Copy(path, dest, true);
        return dest;
    }
}
