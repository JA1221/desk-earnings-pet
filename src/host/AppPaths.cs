using System;
using System.IO;

// The app's two data folders, %AppData%\錢進中 and %LocalAppData%\錢進中.
// QJZ_PROFILE=<name> (1 to 16 ASCII letters or digits) is a test profile: both folders become 錢進中-<name>, the
// single-instance mutex and event get their own names (SingleInstance), and AppHost never touches the autostart Run
// value. Ruling R2: unlike the other dev switches it also counts in a release build, because the release e2e and the
// CPU measurement must run beside the user's own app. A set but invalid value (a typo, or the trailing space of cmd's
// "set QJZ_PROFILE=t11 && ...") must not fall back to the user's own identity: Program.Main refuses to start then
// (ProfileRejected). Unset or empty means no profile.
public static class AppPaths
{
    const string AppFolder = "錢進中";
    const int MaxProfileLength = 16;
    const string ProfileVariable = "QJZ_PROFILE";

    // The test profile from QJZ_PROFILE, or null.
    public static readonly string Profile = ValidProfile(Environment.GetEnvironmentVariable(ProfileVariable));

    // QJZ_PROFILE as this process got it (unchecked).
    public static string RawProfile
    {
        get { return Environment.GetEnvironmentVariable(ProfileVariable); }
    }

    // True when raw is set (non-empty) but not a valid profile, taken as it is (no trimming).
    public static bool ProfileRejected(string raw)
    {
        return !string.IsNullOrEmpty(raw) && ValidProfile(raw) == null;
    }

    // %AppData%\<FolderName> (settings.json, history.json); created on first access.
    public static string DataDir
    {
        get { return Ensure(Environment.SpecialFolder.ApplicationData); }
    }

    // %LocalAppData%\<FolderName> (extracted runtime files, WebView2 user data); created on first access.
    public static string LocalDir
    {
        get { return Ensure(Environment.SpecialFolder.LocalApplicationData); }
    }

    // 錢進中-<profile> for a valid profile, else 錢進中.
    public static string FolderName(string profile)
    {
        return ValidProfile(profile) != null ? AppFolder + "-" + profile : AppFolder;
    }

    // profile when it is 1 to 16 ASCII letters or digits (^[A-Za-z0-9]{1,16}$, with no trailing newline), else null.
    public static string ValidProfile(string profile)
    {
        if (string.IsNullOrEmpty(profile) || profile.Length > MaxProfileLength) return null;
        foreach (char c in profile)
            if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))) return null;
        return profile;
    }

    static string Ensure(Environment.SpecialFolder root)
    {
        string dir = Path.Combine(Environment.GetFolderPath(root), FolderName(Profile));
        Directory.CreateDirectory(dir);
        return dir;
    }
}
