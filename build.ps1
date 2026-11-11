# Builds build\錢進中.exe. Dev build (default) loads src\web from disk; -Release is finalized in Task 14.
param([switch]$Release)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$buildDir = Join-Path $root 'build'
New-Item -ItemType Directory -Force $buildDir | Out-Null
$wv = Join-Path $root 'vendor\webview2'

# fonts: vendor\fonts\* -> src\web\fonts\ (git-ignored copy)
$webFonts = Join-Path $root 'src\web\fonts'
New-Item -ItemType Directory -Force $webFonts | Out-Null
Copy-Item (Join-Path $root 'vendor\fonts\*') $webFonts -Force

$exe = Join-Path $buildDir '錢進中.exe'
$srcs = @(Get-ChildItem (Join-Path $root 'src\host') -Filter *.cs -Recurse | ForEach-Object { $_.FullName })
$cscArgs = @('/nologo', '/codepage:65001', '/target:winexe', '/platform:anycpu', '/optimize+', "/out:$exe",
    "/win32manifest:$(Join-Path $root 'src\host\app.manifest')",
    "/reference:$(Join-Path $wv 'Microsoft.Web.WebView2.Core.dll')",
    "/reference:$(Join-Path $wv 'Microsoft.Web.WebView2.WinForms.dll')",
    '/reference:System.Web.Extensions.dll', '/reference:System.Core.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll') + $srcs
if (-not $Release) { $cscArgs += '/debug' }
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { Write-Host 'BUILD FAILED'; exit 1 }

# dev build: DLLs next to the exe
Copy-Item (Join-Path $wv 'Microsoft.Web.WebView2.Core.dll') $buildDir -Force
Copy-Item (Join-Path $wv 'Microsoft.Web.WebView2.WinForms.dll') $buildDir -Force
Write-Host "Built $exe"
