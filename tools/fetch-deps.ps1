# Downloads WebView2 SDK 1.0.4191.47 (nuget.org) and Fredoka (google/fonts) into vendor\
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ver = '1.0.4191.47'
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('qjz-deps-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null
try {
    $nupkg = Join-Path $tmp 'webview2.zip'
    Invoke-WebRequest -UseBasicParsing "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$ver" -OutFile $nupkg
    $x = Join-Path $tmp 'x'
    Expand-Archive -LiteralPath $nupkg -DestinationPath $x -Force
    $lib = Get-ChildItem (Join-Path $x 'lib') -Directory | Where-Object { $_.Name -like 'net4*' } | Sort-Object Name | Select-Object -First 1
    if (-not $lib) { throw 'no lib\net4* folder in nupkg' }
    Write-Host "Using lib folder: $($lib.Name)"
    $wv = Join-Path $root 'vendor\webview2'
    New-Item -ItemType Directory -Force (Join-Path $wv 'x64'), (Join-Path $wv 'x86') | Out-Null
    Copy-Item (Join-Path $lib.FullName 'Microsoft.Web.WebView2.Core.dll') $wv -Force
    Copy-Item (Join-Path $lib.FullName 'Microsoft.Web.WebView2.WinForms.dll') $wv -Force
    Copy-Item (Join-Path $x 'runtimes\win-x64\native\WebView2Loader.dll') (Join-Path $wv 'x64') -Force
    Copy-Item (Join-Path $x 'runtimes\win-x86\native\WebView2Loader.dll') (Join-Path $wv 'x86') -Force
    $lic = Get-ChildItem $x -File | Where-Object { $_.Name -like 'LICENSE*' } | Select-Object -First 1
    if (-not $lic) { throw 'no LICENSE in nupkg' }
    Copy-Item $lic.FullName (Join-Path $wv 'LICENSE.txt') -Force

    $fonts = Join-Path $root 'vendor\fonts'
    New-Item -ItemType Directory -Force $fonts | Out-Null
    Invoke-WebRequest -UseBasicParsing 'https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf' -OutFile (Join-Path $fonts 'Fredoka-Variable.ttf')
    Invoke-WebRequest -UseBasicParsing 'https://github.com/google/fonts/raw/main/ofl/fredoka/OFL.txt' -OutFile (Join-Path $fonts 'OFL.txt')
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
Write-Host 'Done.'
