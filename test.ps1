# Runs JS tests (headless Edge) and host tests (csc). Exits 0 only when both pass.
param([string]$EdgeProfile = '', [switch]$WebOnly, [switch]$HostOnly)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$HostTestSources = @('src\host\AppPaths.cs', 'src\host\TextStore.cs', 'src\host\AutoStart.cs', 'src\host\SessionWatcher.cs', 'src\host\EventLogProbe.cs', 'src\host\Bridge.cs', 'src\host\PetGeometry.cs', 'src\host\ScreenFit.cs', 'src\host\Native.cs', 'src\host\HotKey.cs', 'src\host\WindowPositions.cs', 'src\host\SavedText.cs', 'src\host\PauseGate.cs', 'src\host\TrayMenu.cs', 'src\host\MenuEscape.cs', 'src\host\ErrorLog.cs', 'src\host\HostSettings.cs', 'src\host\WindowPlacer.cs', 'src\host\UserFiles.cs', 'src\host\Payload.cs', 'src\host\WebRoot.cs', 'src\host\ExitStamp.cs', 'src\host\CoverCheck.cs', 'src\host\Transparency.cs', 'src\host\WebView2Check.cs', 'src\host\WebViewEnv.cs', 'src\host\Presentation.cs', 'src\host\SingleInstance.cs', 'src\host\CapsuleDock.cs', 'src\host\PageZoom.cs', 'src\host\UpdateCheck.cs', 'src\host\UpdateInstall.cs')   # host source files (relative to repo root) compiled into the test exe; add as tasks need them
$exit = 0

# ---- WEB ----
if (-not $HostOnly) {
$edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host 'WEB: msedge.exe not found'; exit 1 }
$profileDir = if ($EdgeProfile) { [IO.Path]::GetFullPath($EdgeProfile) } else { Join-Path $root 'tests\web\.edge-profile' }
$outFile = Join-Path ([IO.Path]::GetTempPath()) ('qjz-web-' + [Guid]::NewGuid().ToString('N') + '.txt')
$url = ([Uri](Join-Path $root 'tests\web\run.html')).AbsoluteUri
# quiet Edge: no sync, no background networking, no component updater (they only slow a test run down and add processes)
$edgeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--disable-sync', '--disable-background-networking', '--disable-component-update',
    "--user-data-dir=`"$profileDir`"", '--virtual-time-budget=5000', '--dump-dom', "`"$url`"")
$proc = Start-Process -PassThru -FilePath $edge -ArgumentList $edgeArgs -RedirectStandardOutput $outFile -RedirectStandardError ($outFile + '.err') -WindowStyle Hidden
if (-not $proc.WaitForExit(120000)) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }   # the run takes ~50 s; room under load
Start-Sleep -Milliseconds 300
# stop leftover Edge processes that use our dedicated profile (crashpad handler etc.)
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like ('*' + $profileDir + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$dom = ''
if (Test-Path $outFile) { $dom = [IO.File]::ReadAllText($outFile, [Text.Encoding]::UTF8); Remove-Item $outFile, ($outFile + '.err') -Force -ErrorAction SilentlyContinue }
$m = [regex]::Match($dom, 'TESTS PASS (\d+) FAIL (\d+)')
if (-not $m.Success) {
    Write-Host 'WEB: no result found (runner missing or script error)'
    $exit = 1
} else {
    Write-Host ('WEB: ' + $m.Groups[1].Value + ' passed, ' + $m.Groups[2].Value + ' failed')
    if ([int]$m.Groups[2].Value -ne 0 -or [int]$m.Groups[1].Value -eq 0) {
        $pre = [regex]::Match($dom, '(?s)<pre id="results">(.*?)</pre>')
        if ($pre.Success) { Write-Host ([Net.WebUtility]::HtmlDecode($pre.Groups[1].Value)) }
        $exit = 1
    }
}

}

# ---- HOST ----
if (-not $WebOnly) {
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$buildDir = Join-Path $root 'build\tests'   # not build\: no WebView2 DLL may sit beside a release build\錢進中.exe
New-Item -ItemType Directory -Force $buildDir | Out-Null
$srcs = @(Get-ChildItem (Join-Path $root 'tests\host') -Filter *.cs | ForEach-Object { $_.FullName })
foreach ($s in $HostTestSources) { $srcs += (Join-Path $root $s) }
$testExe = Join-Path $buildDir 'tests-host.exe'
if (Test-Path $testExe) { Remove-Item $testExe -Force }
$wv = Join-Path $root 'vendor\webview2'
$cscArgs = @('/nologo', '/codepage:65001', '/target:exe', '/debug', "/out:$testExe",
    "/reference:$(Join-Path $wv 'Microsoft.Web.WebView2.Core.dll')", '/reference:System.Web.Extensions.dll', '/reference:System.Core.dll', '/reference:System.Windows.Forms.dll', '/reference:System.IO.Compression.dll') + $srcs
Copy-Item (Join-Path $wv 'Microsoft.Web.WebView2.Core.dll') $buildDir -Force
& $csc @cscArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $testExe)) {
    Write-Host 'HOST: compile failed'
    $exit = 1
} else {
    & $testExe
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
}
}
exit $exit
