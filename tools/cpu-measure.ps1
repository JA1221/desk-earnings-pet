# Measures the app's CPU the 1.0 way (R-F5 in .superpowers/sdd/2026-11-11-qianjinzhong/final-fix-host-report.md),
# for spec 1.1 section 5.9: the exe plus every process below it (the WebView2 tree), summed over a fixed time, as a
# share of one core and of the whole machine. It runs beside the user's own app and never touches it:
#   1. a fresh test profile 'cpu' (tools\test-profile.ps1: every layout on DISPLAY1, autostart off) with the pet, the
#      layout and the power saver (display.powerSaver) under test, and today's record started an hour ago, so the pet
#      is at work (typing);
#   2. the exe started with QJZ_PROFILE=cpu (and QJZ_WEB_ROOT=-WebRoot, a dev build only); its window must come up on
#      DISPLAY1 (left of the primary monitor) or the run stops;
#   3. -Warmup seconds, then the TotalProcessorTime deltas of the PID tree over -Seconds (a process that starts in
#      between counts whole);
#   4. RESULT <pet> <layout>: <x> % of one core, <y> % of the machine (and the share of each process type);
#   5. WM_CLOSE posted to its window (spiketool post), the whole tree checked gone, the profile removed.
# No input is sent, and the window is never activated (U7 / M3 / U10 never take focus).
#
#   tools\cpu-measure.ps1 -Exe build\<exe> -Pet hamster:p0 [-Layout U7] [-PowerSaver] [-WebRoot <dir>] [-Seconds 60] [-Warmup 20]
param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(Mandatory = $true)][string]$Pet,
    [ValidateSet('U1', 'U3', 'U5B', 'U7', 'U10', 'U12', 'U13', 'M3')][string]$Layout = 'U7',
    [switch]$PowerSaver,
    [string]$WebRoot = '',
    [ValidateRange(5, 3600)][int]$Seconds = 60,
    [ValidateRange(0, 600)][int]$Warmup = 20
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ProfileName = 'cpu'
$Title = [string][char]0x9322 + [char]0x9032 + [char]0x4E2D   # the window title (PetWindow)
$Inv = [Globalization.CultureInfo]::InvariantCulture
$Skins = @('p0', 'p4', 'h2', 's4', 's5')   # QJZ.settings SKINS: any other skin would quietly fall back to p0

# ---- arguments ----
$m = [regex]::Match($Pet, '^(cat|hamster):(\w+)$')
if (-not $m.Success -or $Skins -cnotcontains $m.Groups[2].Value) { throw "-Pet must be cat|hamster:$($Skins -join '|'), not '$Pet'" }
$kind = $m.Groups[1].Value; $skin = $m.Groups[2].Value
$exePath = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($Exe)) { $Exe } else { Join-Path $root $Exe }))
if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) { throw "no exe at $exePath" }
$exeDir = Split-Path $exePath -Parent
$dev = Test-Path -LiteralPath (Join-Path $exeDir 'Microsoft.Web.WebView2.Core.dll')   # a dev build has the DLLs beside it
$webDir = ''
if ($WebRoot) {
    if (-not $dev) { throw '-WebRoot needs a dev build (a release exe serves only its own pages and ignores QJZ_WEB_ROOT)' }
    $webDir = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($WebRoot)) { $WebRoot } else { Join-Path $root $WebRoot }))
    if (-not (Test-Path -LiteralPath (Join-Path $webDir 'index.html') -PathType Leaf)) { throw "-WebRoot $webDir has no index.html" }
}

# spiketool (find, post); built by the visual-check helpers when missing or stale
. (Join-Path $root 'tools\visual-check\common.ps1')
$ErrorActionPreference = 'Stop'

# ---- 1. the profile ----
$now = Get-Date
$dayStart = $now.AddHours(-4).Date.AddHours(4)   # the day turns at 04:00 (QJZ.time.dayKey)
$start = $now.AddMinutes(-60)
if ($start -lt $dayStart) { $start = $dayStart }
$start = $start.Date.AddHours($start.Hour).AddMinutes($start.Minute)   # whole minutes, as the page keeps them
$day = $dayStart.ToString('yyyy-MM-dd', $Inv)
$startMs = ([DateTimeOffset]$start).ToUnixTimeMilliseconds()
if ($now.TimeOfDay -ge [TimeSpan]'12:00' -and $now.TimeOfDay -lt [TimeSpan]'13:00') {
    Write-Warning 'it is lunch time (12:00-13:00 in the profile): the pet sleeps instead of typing'
}
$history = '{"version":1,"days":{"' + $day + '":{"day":"' + $day + '","startMs":' + $startMs + ',"startSource":"manual","adjusted":false,' +
    '"endMs":null,"endSource":null,"lastLockMs":null,"offDay":false,"snacksEaten":0,"earned":null}}}'
$mini = if ($Layout -eq 'M3') { 'true' } else { 'false' }
$current = if ($Layout -eq 'M3') { 'U7' } else { $Layout }
$settings = '{"pet":{"kind":"' + $kind + '","skin":"' + $skin + '"},"layout":{"current":"' + $current + '","mini":' + $mini + '},' +
    '"display":{"powerSaver":' + $(if ($PowerSaver) { 'true' } else { 'false' }) + '}}'
# U7 further left than test-profile's default: its window (320 + 7 CSS px at 150 % = 491 px) would end 21 px into
# the primary monitor from x = -470
$window = '{"U7":{"x":-800,"y":960}}'
$histFile = Join-Path ([IO.Path]::GetTempPath()) ('qjz-cpu-history-' + [Guid]::NewGuid().ToString('N') + '.json')
[IO.File]::WriteAllText($histFile, $history, (New-Object Text.UTF8Encoding $false))
try { & (Join-Path $root 'tools\test-profile.ps1') -Name $ProfileName -Settings $settings -Window $window -History $histFile | Out-Null }
finally { Remove-Item -LiteralPath $histFile -Force -ErrorAction SilentlyContinue }

# ---- the process tree ----
# pid -> {Name, Type, Ms, Started} for root and every process below it, read now
function Get-Tree([int]$rootPid) {
    $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, CreationDate)
    $byParent = @{}
    foreach ($p in $all) { $k = [int]$p.ParentProcessId; if (-not $byParent.ContainsKey($k)) { $byParent[$k] = @() }; $byParent[$k] += $p }
    $out = @{}
    $queue = New-Object Collections.Queue
    $first = $all | Where-Object { $_.ProcessId -eq $rootPid }
    if ($first) { $queue.Enqueue($first) }
    while ($queue.Count -gt 0) {
        $p = $queue.Dequeue()
        $id = [int]$p.ProcessId
        if ($out.ContainsKey($id)) { continue }
        $type = if ($id -eq $rootPid) { 'host' } else {
            $t = [regex]::Match([string]$p.CommandLine, '--type=([\w-]+)')
            $sub = [regex]::Match([string]$p.CommandLine, '--utility-sub-type=([\w.-]+)')
            if (-not $t.Success) { 'browser' } elseif ($sub.Success) { $t.Groups[1].Value + ':' + ($sub.Groups[1].Value -split '\.')[-1] } else { $t.Groups[1].Value }
        }
        $ms = $null
        try { $ms = [Diagnostics.Process]::GetProcessById($id).TotalProcessorTime.TotalMilliseconds } catch { }
        if ($ms -ne $null) { $out[$id] = @{ Name = $p.Name; Type = $type; Ms = $ms; Started = $p.CreationDate } }
        # a child created before its parent is a reused PID, not ours
        if ($byParent.ContainsKey($id)) { foreach ($c in $byParent[$id]) { if ($c.CreationDate -ge $p.CreationDate) { $queue.Enqueue($c) } } }
    }
    return $out
}
# a process of the tree (Get-Tree's entry) still runs: the same PID, started at the same time (not a reused PID)
function Test-Ours([int]$id, $entry) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    return [bool]($p -and $entry.Started -and [Math]::Abs(($p.StartTime - $entry.Started).TotalSeconds) -lt 2)
}
# the app's visible window(s): spiketool find lists every visible window with the title (the user's own app too)
function Find-Window([int]$appPid) {
    foreach ($line in @(St find $Title)) {
        if ($line -match '^(\d+) .* pid=(\d+) .*rootRect=(-?\d+),(-?\d+),(\d+),(\d+)' -and [int]$Matches[2] -eq $appPid) {
            return @{ Hwnd = $Matches[1]; X = [int]$Matches[3]; Y = [int]$Matches[4]; W = [int]$Matches[5]; H = [int]$Matches[6] }
        }
    }
    return $null
}

# ---- 2. start ----
$psi = New-Object Diagnostics.ProcessStartInfo $exePath
$psi.UseShellExecute = $false
$psi.WorkingDirectory = $exeDir
$psi.EnvironmentVariables['QJZ_PROFILE'] = $ProfileName
foreach ($v in @('QJZ_WEB_ROOT', 'QJZ_DEVTOOLS', 'QJZ_TRACE')) { if ($psi.EnvironmentVariables.ContainsKey($v)) { $psi.EnvironmentVariables.Remove($v) } }
if ($webDir) { $psi.EnvironmentVariables['QJZ_WEB_ROOT'] = $webDir }
$hash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash.Substring(0, 12)
Write-Host ('exe {0} ({1} build, sha256 {2}...){3}' -f $exePath, $(if ($dev) { 'dev' } else { 'release' }), $hash, $(if ($webDir) { "; QJZ_WEB_ROOT=$webDir" } else { '' }))
Write-Host ('profile {0}: {1} {2}, {3}, today started {4:HH:mm}' -f $ProfileName, $Pet, $Layout, $(if ($PowerSaver) { 'power saver ON' } else { 'power saver off' }), $start)

$proc = $null; $win = $null; $tree = @{}; $result = $null; $failed = $null
try {
    $proc = [Diagnostics.Process]::Start($psi)
    for ($i = 0; $i -lt 160 -and -not $win; $i++) {
        if ($proc.HasExited) { throw "the app exited at start (code $($proc.ExitCode))" }
        Start-Sleep -Milliseconds 250
        $win = Find-Window $proc.Id
    }
    if (-not $win) { throw 'the app window did not show within 40 s' }
    Write-Host ('window {0} at {1},{2} {3}x{4} (physical px)' -f $win.Hwnd, $win.X, $win.Y, $win.W, $win.H)
    if ($win.X + $win.W -gt 0) { throw 'the window is not on DISPLAY1 (left of the primary monitor): stopped' }

    # ---- 3. warm up, then measure ----
    Start-Sleep -Seconds $Warmup
    $t0 = Get-Tree $proc.Id
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Start-Sleep -Seconds $Seconds
    $t1 = Get-Tree $proc.Id
    $elapsed = $sw.Elapsed.TotalMilliseconds
    foreach ($k in $t0.Keys) { $tree[$k] = $t0[$k] }
    foreach ($k in $t1.Keys) { $tree[$k] = $t1[$k] }
    if ($proc.HasExited) { throw 'the app exited while it was measured' }

    $byType = @{}; $total = 0.0; $lost = 0
    foreach ($k in $t1.Keys) {
        $before = if ($t0.ContainsKey($k) -and $t0[$k].Started -eq $t1[$k].Started) { $t0[$k].Ms } else { 0 }
        $d = $t1[$k].Ms - $before
        $total += $d
        $type = $t1[$k].Type
        if (-not $byType.ContainsKey($type)) { $byType[$type] = 0.0 }
        $byType[$type] += $d
    }
    foreach ($k in $t0.Keys) { if (-not $t1.ContainsKey($k)) { $lost++ } }
    $cores = [Environment]::ProcessorCount
    $pctCore = 100.0 * $total / $elapsed
    Write-Host ('measured {0:N1} s over {1} processes ({2} ended in between, not counted); {3} logical processors' -f ($elapsed / 1000), $t1.Count, $lost, $cores)
    foreach ($t in ($byType.Keys | Sort-Object { - $byType[$_] })) {
        Write-Host ([string]::Format($Inv, '  {0,-28} {1,8:F0} ms = {2,5:F2} % of one core', $t, $byType[$t], 100.0 * $byType[$t] / $elapsed))
    }
    $result = [string]::Format($Inv, 'RESULT {0} {1}{2}: {3:F2} % of one core, {4:F2} % of the machine', $Pet, $Layout,
        $(if ($PowerSaver) { ' saver' } else { '' }), $pctCore, $pctCore / $cores)
} catch {
    $failed = $_.Exception.Message
} finally {
    # ---- 5. close, check, clean up ----
    if ($proc -and -not $proc.HasExited) {
        $t = Get-Tree $proc.Id   # the whole tree while its root is there to find it by
        foreach ($k in $t.Keys) { $tree[$k] = $t[$k] }
        if (-not $win) { $win = Find-Window $proc.Id }
        if ($win) { St post $win.Hwnd 0x0010 0 0 | Out-Null }
        if (-not $proc.WaitForExit(20000)) { Write-Warning "no exit 20 s after WM_CLOSE: stopping pid $($proc.Id)"; Stop-Process -Id $proc.Id -Force }
    }
    $left = @()
    for ($i = 0; $i -lt 60; $i++) {
        $left = @($tree.Keys | Where-Object { Test-Ours $_ $tree[$_] })
        if ($left.Count -eq 0) { break }
        Start-Sleep -Milliseconds 250
    }
    if ($left.Count -gt 0) {
        Write-Warning ('process tree still running 15 s after the exit, stopped: ' + ($left -join ', '))
        foreach ($k in $left) { Stop-Process -Id $k -Force -ErrorAction SilentlyContinue }
    } else { Write-Host 'process tree gone' }
    & (Join-Path $root 'tools\test-profile.ps1') -Remove -Name $ProfileName | Out-Null
    Write-Host "profile $ProfileName removed"
}
if ($failed) { Write-Host "FAILED: $failed"; exit 1 }
Write-Host $result
