# Headless screenshot of a page, for visual checks while the user works on this PC: headless Edge, so no window ever
# shows, with its own profile build\shots\.edge-profile. Afterwards it stops the msedge processes of that profile and
# no other (never the user's Edge, never test.ps1's).
#   .\tools\shot.ps1 -Page "dev.html?layout=U7" -Out build\shots\t7-u7.png [-Size 480,360]
# -Page  a page under src\web, or a path from the repo root or an absolute one (build\review\...), with an optional
#        ?query or #hash.
# -Out   the PNG; a relative path is from the repo root.
# -Size  the viewport in CSS px as W,H (default 800,600), at device scale 1.
# Exits 1 when no PNG was written.
param(
    [Parameter(Mandatory = $true)][string]$Page,
    [Parameter(Mandatory = $true)][string]$Out,
    [string]$Size = '800,600'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$BudgetMs = 3000   # virtual time the page runs before the shot (its start-up, fonts, first animations)

$sz = [regex]::Match($Size, '^\s*(\d+)\s*[,x ]\s*(\d+)\s*$')
if (-not $sz.Success) { Write-Host "shot: -Size must be W,H, not '$Size'"; exit 1 }
$w = [int]$sz.Groups[1].Value; $h = [int]$sz.Groups[2].Value

$edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe') |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host 'shot: msedge.exe not found'; exit 1 }

# the page file and the rest of the URL (?query, #hash)
$cut = $Page.IndexOfAny([char[]]'?#')
$path = if ($cut -ge 0) { $Page.Substring(0, $cut) } else { $Page }
$rest = if ($cut -ge 0) { $Page.Substring($cut) } else { '' }
$path = $path.Replace('/', '\')
$file = $null
if ([IO.Path]::IsPathRooted($path)) { $file = $path }
else {
    foreach ($c in @((Join-Path $root ('src\web\' + $path)), (Join-Path $root $path))) {
        if (Test-Path -LiteralPath $c -PathType Leaf) { $file = $c; break }
    }
}
if (-not $file -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { Write-Host "shot: no page '$path'"; exit 1 }
$url = ([Uri][IO.Path]::GetFullPath($file)).AbsoluteUri + $rest

$outFile = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }))
New-Item -ItemType Directory -Force (Split-Path $outFile -Parent) | Out-Null
if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force }

$profileDir = [IO.Path]::GetFullPath((Join-Path $root 'build\shots\.edge-profile'))
New-Item -ItemType Directory -Force $profileDir | Out-Null
# this profile's processes: the path as a whole argument or a folder in one (crashpad's database), never a longer name
$mine = [regex]::Escape($profileDir) + '(["\\\s]|$)'
function Stop-Mine {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match $mine } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

$log = Join-Path ([IO.Path]::GetTempPath()) ('qjz-shot-' + [Guid]::NewGuid().ToString('N') + '.txt')
$edgeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
    "--user-data-dir=`"$profileDir`"", "--window-size=$w,$h", '--force-device-scale-factor=1', "--virtual-time-budget=$BudgetMs",
    "--screenshot=`"$outFile`"", "`"$url`"")
try {
    $proc = Start-Process -PassThru -FilePath $edge -ArgumentList $edgeArgs -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')
    if (-not $proc.WaitForExit(60000)) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
} finally {
    Start-Sleep -Milliseconds 300
    Stop-Mine
    Remove-Item -LiteralPath $log, ($log + '.err') -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $outFile -PathType Leaf)) { Write-Host "shot: no PNG written for $url"; exit 1 }
Write-Host ('shot: {0} ({1}x{2})' -f $outFile, $w, $h)
