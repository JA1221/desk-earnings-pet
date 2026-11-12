# Makes or removes a test profile for app runs beside the user's own app (QJZ_PROFILE, Ruling R2).
# A profile <name> has its own %AppData% and %LocalAppData% folders (the app folder name plus -<name>), its own
# single-instance mutex, and never touches the autostart Run value. Run the app with QJZ_PROFILE=<name>.
#
#   tools\test-profile.ps1 -Name t11 [-Settings '<json>'] [-Window '<json>'] [-History <file>]
#       A fresh profile (both folders emptied first) with:
#       - settings.json: 50000 monthly, onboarded, health.asked, autostart off, capture guard off and the hotkey
#         Ctrl+Alt+F11 (so it never clashes with the user's own app), with -Settings merged on top (objects merge
#         key by key, anything else replaces);
#       - window.json: every layout on DISPLAY1, the left portrait monitor; -Window entries replace whole layouts;
#       - history.json: a byte-for-byte copy of -History, else none.
#   tools\test-profile.ps1 -Name t11 -FromDir <dir>
#       A fresh profile with settings.json, history.json and window.json copied from <dir> byte for byte, no merge
#       (a file missing in <dir> is left out; without a window.json the DISPLAY1 default is written).
#   tools\test-profile.ps1 -Remove -Name t11
#       Deletes both of the profile's folders.
# Refuses while the profile's app is running (its single-instance mutex exists).
[CmdletBinding(DefaultParameterSetName = 'Make')]
param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(ParameterSetName = 'Make')][string]$Settings = '',
    [Parameter(ParameterSetName = 'Make')][string]$Window = '',
    [Parameter(ParameterSetName = 'Make')][string]$History = '',
    [Parameter(ParameterSetName = 'From', Mandatory = $true)][string]$FromDir,
    [Parameter(ParameterSetName = 'Remove', Mandatory = $true)][switch]$Remove
)
$ErrorActionPreference = 'Stop'

# The same rule as AppPaths.ValidProfile: the app ignores any other name and would use the user's own folders.
if ($Name -cnotmatch '\A[A-Za-z0-9]{1,16}\z') { throw "-Name must be 1 to 16 ASCII letters or digits, not '$Name'" }
$folder = [string][char]0x9322 + [char]0x9032 + [char]0x4E2D + '-' + $Name   # the app folder name (AppPaths) + -<name>
$dataDir = Join-Path ([Environment]::GetFolderPath('ApplicationData')) $folder
$localDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) $folder
$utf8 = New-Object Text.UTF8Encoding $false

# Physical px (window.json), all on DISPLAY1: -1080,-445 1080x1920 at 150 %, work-area bottom 1403.
$DefaultWindow = '{"U1":{"x":-599,"y":463},"U3":{"x":-1000,"y":700},"U5B":{"x":-1000,"y":1100},"U7":{"x":-470,"y":960},' +
    '"M3":{"x":-372,"y":1082},"PANEL":{"x":-1000,"y":300},"U10":{"x":-900,"y":-400},"U12":{"x":-1000,"y":300},"U13":{"x":-1000,"y":300}}'
$BaseSettings = '{"version":1,"salary":{"mode":"monthly","amount":50000,"divisor":22},"onboarded":true,"health":{"asked":true},' +
    '"autostart":false,"privacy":{"hideFromCapture":false,"hotkey":"Ctrl+Alt+F11"}}'

# The profile's single-instance mutex (SingleInstance.MutexNameFor) exists while its app runs.
function Assert-NotRunning {
    $m = $null
    if ([Threading.Mutex]::TryOpenExisting('Local\QianJinZhong-' + $Name, [ref]$m)) {
        $m.Dispose()
        throw "the app is running with QJZ_PROFILE=$Name; close it first"
    }
}

function Read-JsonObject([string]$text, [string]$what) {
    try { $o = $text | ConvertFrom-Json } catch { throw "$what is not JSON: $text" }
    if (-not ($o -is [System.Management.Automation.PSCustomObject])) { throw "$what must be a JSON object: $text" }
    return $o
}

# Merges from into into: objects key by key (recursively), anything else replaces.
function Merge-Json($into, $from) {
    foreach ($p in $from.PSObject.Properties) {
        $cur = $into.PSObject.Properties[$p.Name]
        if ($cur -and $cur.Value -is [System.Management.Automation.PSCustomObject] -and $p.Value -is [System.Management.Automation.PSCustomObject]) {
            Merge-Json $cur.Value $p.Value
        } elseif ($cur) {
            $cur.Value = $p.Value
        } else {
            $into | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value
        }
    }
}

function Write-Text([string]$file, [string]$text) {
    [IO.File]::WriteAllText((Join-Path $dataDir $file), $text, $utf8)
}

# Deletes dir; WebView2 can hold files for a moment after the app ends, so it retries for a few seconds.
function Remove-Folder([string]$dir) {
    for ($i = 0; (Test-Path -LiteralPath $dir) -and $i -lt 20; $i++) {
        try { Remove-Item -LiteralPath $dir -Recurse -Force } catch { Start-Sleep -Milliseconds 250 }
    }
    if (Test-Path -LiteralPath $dir) { throw "could not delete $dir" }
}

function Reset-Profile {
    Remove-Folder $dataDir
    Remove-Folder $localDir
    New-Item -ItemType Directory -Force $dataDir | Out-Null
}

Assert-NotRunning
switch ($PSCmdlet.ParameterSetName) {
    'Remove' {
        Remove-Folder $dataDir
        Remove-Folder $localDir
        Write-Host "Removed profile $Name ($dataDir, $localDir)"
    }
    'From' {
        if (-not (Test-Path -LiteralPath $FromDir -PathType Container)) { throw "-FromDir $FromDir is not a folder" }
        Reset-Profile
        foreach ($f in @('settings.json', 'history.json', 'window.json')) {
            $src = Join-Path $FromDir $f
            if (Test-Path -LiteralPath $src -PathType Leaf) {
                Copy-Item -LiteralPath $src -Destination (Join-Path $dataDir $f)
                Write-Host "copied $f"
            } elseif ($f -eq 'window.json') {
                Write-Text $f $DefaultWindow
                Write-Host 'no window.json in -FromDir: wrote the DISPLAY1 default'
            } else {
                Write-Host "no $f in -FromDir: left out"
            }
        }
        Write-Host "Profile $Name from $FromDir in $dataDir"
    }
    'Make' {
        $s = Read-JsonObject $BaseSettings 'base settings'
        if ($Settings) { Merge-Json $s (Read-JsonObject $Settings '-Settings') }
        $w = Read-JsonObject $DefaultWindow 'default window'
        if ($Window) {
            foreach ($p in (Read-JsonObject $Window '-Window').PSObject.Properties) {
                if ($w.PSObject.Properties[$p.Name]) { $w.PSObject.Properties[$p.Name].Value = $p.Value }
                else { $w | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
            }
        }
        if ($History -and -not (Test-Path -LiteralPath $History -PathType Leaf)) { throw "-History $History is not a file" }
        Reset-Profile
        Write-Text 'settings.json' ($s | ConvertTo-Json -Depth 32 -Compress)
        Write-Text 'window.json' ($w | ConvertTo-Json -Depth 32 -Compress)
        if ($History) { Copy-Item -LiteralPath $History -Destination (Join-Path $dataDir 'history.json') }
        Write-Host "Profile $Name in $dataDir"
    }
}
