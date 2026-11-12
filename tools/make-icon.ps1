# Draws the exe icon assets\app.ico with the tray coin's own code (src\host\TrayMenu.cs CoinBitmap): an A1 coin,
# #FFC857 with a #3D2C24 outline and a "$", at 16, 24, 32, 48 and 256 px. Run it again only when the coin changes;
# build.ps1 embeds the committed assets\app.ico (/win32icon) in both build modes.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'build\make-icon'
New-Item -ItemType Directory -Force $out | Out-Null
New-Item -ItemType Directory -Force (Join-Path $root 'assets') | Out-Null
$exe = Join-Path $out 'make-icon.exe'
$srcs = @((Join-Path $root 'tools\make-icon.cs')) + @('TrayMenu.cs', 'MenuEscape.cs', 'Native.cs' | ForEach-Object { Join-Path $root "src\host\$_" })
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /codepage:65001 /target:exe "/out:$exe" `
    /reference:System.Drawing.dll /reference:System.Windows.Forms.dll @srcs
if ($LASTEXITCODE -ne 0) { throw 'make-icon build failed' }
& $exe (Join-Path $root 'assets\app.ico')
if ($LASTEXITCODE -ne 0) { throw 'make-icon failed' }
