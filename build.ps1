# Builds build\錢進中.exe (icon assets\app.ico, version from AppHost.Version via src\host\AssemblyInfo.cs).
#   .\build.ps1           dev build: the page loads from src\web on disk; the WebView2 DLLs are copied beside the exe.
#   .\build.ps1 -Release  one self-contained exe, nothing beside it: web.zip (index.html, everything it loads, the
#                         licence texts and the guide), the two WebView2 DLLs and the x64/x86/arm64 WebView2Loader.dll are embedded
#                         as plain resources, which Payload.cs unpacks to %LocalAppData%\錢進中\app\<id>\ at the first start.
param([switch]$Release)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$buildDir = Join-Path $root 'build'
New-Item -ItemType Directory -Force $buildDir | Out-Null
$wv = Join-Path $root 'vendor\webview2'

# Git-ignored copies the page uses: vendor\fonts\* -> src\web\fonts\ (the font and its OFL), and the WebView2 SDK
# licence -> src\web\licenses\ (its BSD licence asks for the notice to ship with the binary; 設定 → 關於 shows it).
$webFonts = Join-Path $root 'src\web\fonts'
New-Item -ItemType Directory -Force $webFonts | Out-Null
Copy-Item (Join-Path $root 'vendor\fonts\*') $webFonts -Force
$webLicenses = Join-Path $root 'src\web\licenses'
New-Item -ItemType Directory -Force $webLicenses | Out-Null
Copy-Item (Join-Path $wv 'LICENSE.txt') (Join-Path $webLicenses 'WebView2-SDK.txt') -Force

# What a release ships besides index.html and what it loads: files the page fetches at run time (the licence texts
# and the plain-text guide that 設定 → 關於 → 使用說明 shows).
$ShipExtra = @('fonts/OFL.txt', 'licenses/WebView2-SDK.txt', 'guide.txt')

# index.html and everything it loads: each <script src> and <link href>, and each url(...) in those stylesheets (the
# font). Paths are '/' separated and relative to webDir. Fails on a remote URL or a file that does not exist.
function Get-IndexClosure([string]$webDir) {
    $base = (Resolve-Path $webDir).Path.TrimEnd('\') + '\'
    $need = New-Object 'System.Collections.Generic.List[string]'
    $need.Add('index.html')
    $html = [IO.File]::ReadAllText((Join-Path $base 'index.html'))
    $tags = [regex]::Matches($html, '<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["'']([^"'']+)["'']', 'IgnoreCase')
    foreach ($m in $tags) {
        $ref = $m.Groups[1].Value -replace '[?#].*$', ''
        if ($ref -match '^[a-z][a-z0-9+.-]*:' -or $ref.StartsWith('//')) { throw "index.html loads $ref from outside the app" }
        $need.Add($ref.TrimStart('/'))
    }
    foreach ($css in @($need | Where-Object { $_ -like '*.css' })) {
        $cssDir = Split-Path (Join-Path $base $css) -Parent
        foreach ($m in [regex]::Matches([IO.File]::ReadAllText((Join-Path $base $css)), 'url\(\s*["'']?([^"'')]+?)["'']?\s*\)')) {
            $u = $m.Groups[1].Value -replace '[?#].*$', ''
            if ($u -match '^(data|https?):' -or $u -eq '') { continue }
            $full = [IO.Path]::GetFullPath((Join-Path $cssDir $u))
            if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw "$css loads $u from outside src\web" }
            $need.Add($full.Substring($base.Length).Replace('\', '/'))
        }
    }
    $list = @($need | Select-Object -Unique)
    $missing = @($list | Where-Object { -not (Test-Path -LiteralPath (Join-Path $base $_) -PathType Leaf) })
    if ($missing.Count -gt 0) { throw ('index.html needs files that do not exist: ' + ($missing -join ', ')) }
    return , $list
}

# Writes web.zip from an allow-list of '/' separated paths under webDir. Sorted entries with a fixed timestamp:
# unchanged files give a byte-identical zip, so the exe keeps the same unpack folder id.
function New-WebZip([string]$webDir, [string[]]$files, [string]$zipPath) {
    Add-Type -AssemblyName System.IO.Compression
    $base = (Resolve-Path $webDir).Path.TrimEnd('\') + '\'
    $sorted = [string[]]@($files | Select-Object -Unique)
    [Array]::Sort($sorted, [StringComparer]::Ordinal)
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    $when = New-Object DateTimeOffset -ArgumentList 2026, 1, 1, 0, 0, 0, ([TimeSpan]::Zero)
    $fs = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
    try {
        $zip = New-Object IO.Compression.ZipArchive -ArgumentList $fs, ([IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($rel in $sorted) {
                $entry = $zip.CreateEntry($rel, [IO.Compression.CompressionLevel]::Optimal)
                $entry.LastWriteTime = $when
                $bytes = [IO.File]::ReadAllBytes((Join-Path $base $rel))
                $s = $entry.Open()
                try { $s.Write($bytes, 0, $bytes.Length) } finally { $s.Dispose() }
            }
        } finally { $zip.Dispose() }
    } finally { $fs.Dispose() }
    return , $sorted
}

$exe = Join-Path $buildDir '錢進中.exe'
$srcs = @(Get-ChildItem (Join-Path $root 'src\host') -Filter *.cs -Recurse | ForEach-Object { $_.FullName })
$cscArgs = @('/nologo', '/codepage:65001', '/target:winexe', '/platform:anycpu', '/optimize+', "/out:$exe",
    "/win32manifest:$(Join-Path $root 'src\host\app.manifest')",
    "/win32icon:$(Join-Path $root 'assets\app.ico')",
    "/reference:$(Join-Path $wv 'Microsoft.Web.WebView2.Core.dll')",
    "/reference:$(Join-Path $wv 'Microsoft.Web.WebView2.WinForms.dll')",
    '/reference:System.Web.Extensions.dll', '/reference:System.Core.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
    '/reference:System.IO.Compression.dll') + $srcs
if ($Release) {
    $obj = Join-Path $buildDir 'obj'
    New-Item -ItemType Directory -Force $obj | Out-Null
    $webZip = Join-Path $obj 'web.zip'
    $webDir = Join-Path $root 'src\web'
    $closure = Get-IndexClosure $webDir
    foreach ($x in $ShipExtra) { if (-not (Test-Path -LiteralPath (Join-Path $webDir $x) -PathType Leaf)) { throw "missing $x" } }
    $entries = New-WebZip $webDir ($closure + $ShipExtra) $webZip
    # resource names are what Payload.cs looks up
    $cscArgs += "/resource:$webZip,web.zip"
    $cscArgs += "/resource:$(Join-Path $wv 'Microsoft.Web.WebView2.Core.dll'),Microsoft.Web.WebView2.Core.dll"
    $cscArgs += "/resource:$(Join-Path $wv 'Microsoft.Web.WebView2.WinForms.dll'),Microsoft.Web.WebView2.WinForms.dll"
    foreach ($arch in 'x64', 'x86', 'arm64') { $cscArgs += "/resource:$(Join-Path $wv "$arch\WebView2Loader.dll"),$arch/WebView2Loader.dll" }
} else {
    $cscArgs += '/debug'
}
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { Write-Host 'BUILD FAILED'; exit 1 }

if ($Release) {
    # Nothing beside the exe that it could load instead of its own embedded files (dev build leftovers).
    foreach ($f in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', '錢進中.pdb')) {
        $p = Join-Path $buildDir $f
        if (Test-Path $p) { Remove-Item $p -Force }
    }
    $id = (Get-FileHash $webZip -Algorithm SHA256).Hash.Substring(0, 12).ToLowerInvariant()
    Write-Host ('Built {0} (release, {1:N0} bytes; web.zip {2} files: index.html + {3} it loads + {4} texts it fetches; unpacks to app\{5})' -f
        $exe, (Get-Item $exe).Length, $entries.Count, ($closure.Count - 1), $ShipExtra.Count, $id)
} else {
    # dev build: DLLs next to the exe
    Copy-Item (Join-Path $wv 'Microsoft.Web.WebView2.Core.dll') $buildDir -Force
    Copy-Item (Join-Path $wv 'Microsoft.Web.WebView2.WinForms.dll') $buildDir -Force
    Write-Host "Built $exe"
}
