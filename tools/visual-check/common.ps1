# Shared helpers for the visual checks (dot-source me). See README.md.
$ErrorActionPreference = 'Stop'
$VcRoot = $PSScriptRoot
$RepoRoot = Split-Path (Split-Path $VcRoot -Parent) -Parent
$VcBuild = Join-Path $RepoRoot 'build\visual-check'
$PetExe = Join-Path $RepoRoot 'build\錢進中.exe'
$tool = Join-Path $VcBuild 'spiketool.exe'

# (Re)build spiketool.exe into build\visual-check\ when missing or older than its source.
New-Item -ItemType Directory -Force $VcBuild | Out-Null
$toolSrc = Join-Path $VcRoot 'spiketool.cs'
if (-not (Test-Path $tool) -or (Get-Item $toolSrc).LastWriteTime -gt (Get-Item $tool).LastWriteTime) {
    & 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /codepage:65001 "/out:$tool" `
        /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $toolSrc
    if ($LASTEXITCODE -ne 0) { throw 'spiketool build failed' }
}

function St { & $tool @args }

function Start-Backdrop($x, $y, $w, $h, $log, $mode = 'topmost') {
    if (Test-Path $log) { Remove-Item $log }
    $p = Start-Process -PassThru -FilePath $tool -ArgumentList @('backdrop', $x, $y, $w, $h, $log, $mode)
    Start-Sleep -Milliseconds 1500
    return $p
}

function Find-Hwnd($title) {
    for ($i = 0; $i -lt 60; $i++) {
        $line = St find $title | Select-Object -First 1
        if ($line) { return [long]($line.Split(' ')[0]) }
        Start-Sleep -Milliseconds 250
    }
    throw "window '$title' not found"
}

# Starts build\錢進中.exe --spike and returns @{ Proc; Hwnd }.
function Start-Pet {
    $p = Start-Process -PassThru -FilePath $PetExe -ArgumentList '--spike'
    $h = Find-Hwnd '錢進中'
    return @{ Proc = $p; Hwnd = $h }
}

# Stops the given processes plus any leftover backdrop or --spike instance (never a normal 錢進中 run).
function Stop-All($procs) {
    foreach ($p in $procs) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
    Start-Sleep -Milliseconds 500
    Get-CimInstance Win32_Process -Filter "Name='錢進中.exe' OR Name='spiketool.exe'" |
        Where-Object { $_.CommandLine -like '*--spike*' -or $_.CommandLine -like '*backdrop*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
