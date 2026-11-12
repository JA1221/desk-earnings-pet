using System.Reflection;
using System.Runtime.InteropServices;

// The app's own P/Invokes (user32, gdi32, kernel32, dwmapi, shcore) load from System32 only, never a same-named DLL
// beside the exe (Program.RestrictDllSearch covers DLLs that Windows itself loads by name).
[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]

// The exe's version block (Explorer: 內容 → 詳細資料; Task Manager shows the title). One version: AppHost.Version.
// No company or copyright: coworkers pass the exe around as it is.
[assembly: AssemblyTitle("錢進中")]
[assembly: AssemblyProduct("錢進中")]
[assembly: AssemblyDescription("上班時一秒一秒顯示今天賺了多少錢的桌面小寵物")]
[assembly: AssemblyVersion(AppHost.Version)]
[assembly: AssemblyFileVersion(AppHost.Version)]
[assembly: AssemblyInformationalVersion(AppHost.Version)]
