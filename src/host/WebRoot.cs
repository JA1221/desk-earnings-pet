using System;
using System.IO;
using System.Reflection;

public static class WebRoot
{
    // %QJZ_WEB_ROOT% if set, else <repo>\src\web found above the exe, else null (release path added in Task 14).
    public static string Resolve()
    {
        string env = Environment.GetEnvironmentVariable("QJZ_WEB_ROOT");
        if (!string.IsNullOrEmpty(env)) return env;
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        string dir = exeDir;
        for (int i = 0; i < 2; i++)
        {
            dir = Path.GetDirectoryName(dir);
            if (dir == null) break;
            string candidate = Path.Combine(dir, Path.Combine("src", "web"));
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }
}
