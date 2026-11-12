# One verification pass of build\錢進中.exe --spike (src\web\spike.html) over a busy backdrop:
# window size, per-pixel captures, click-through, drag and topmost. See README.md.
# -Scale = expected physical px per CSS px (page DPR). Test points are spike.html CSS coordinates.
param(
    [Parameter(Mandatory)][string]$Tag,
    [int]$BdX = 200, [int]$BdY = 150, [int]$BdW = 1000, [int]$BdH = 600,
    [int]$PetX = 400, [int]$PetY = 300,
    [double]$Scale = 1.0,
    [int]$DragDX = 200, [int]$DragDY = 100,
    [string]$OutDir = ''
)
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $OutDir) { $OutDir = Join-Path $VcBuild "runs\$Tag" }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$log = Join-Path $OutDir 'clicks.log'
$cssW = 520; $cssH = 340   # spike.html #stage
$procs = New-Object System.Collections.ArrayList
function Cap { $r = St capture @args; if (-not ($r -like 'captured*')) { "CAPTURE FAILED: $r ($($args -join ' '))" } }
function Rect($info) { $m = [regex]::Match($info, 'rootRect=(-?\d+),(-?\d+),(\d+),(\d+)'); return @([int]$m.Groups[1].Value, [int]$m.Groups[2].Value, [int]$m.Groups[3].Value, [int]$m.Groups[4].Value) }

& {
try {
    $bd = Start-Backdrop $BdX $BdY $BdW $BdH $log; [void]$procs.Add($bd)
    Cap $BdX $BdY $BdW $BdH (Join-Path $OutDir 'base.png')
    $pet = Start-Pet; [void]$procs.Add($pet.Proc)
    $h = $pet.Hwnd
    St settop $h
    $bdHwnd = (St find 'SPIKE-BACKDROP' | Select-Object -First 1).Split(' ')[0]
    St untop $bdHwnd   # backdrop = top of the normal band, pet = topmost above it
    St move $h $PetX $PetY
    Start-Sleep -Seconds 4
    $info = St info $h
    "INFO $info"
    Cap $BdX $BdY $BdW $BdH (Join-Path $OutDir 'over.png')
    $r = Rect $info
    $wx = $r[0]; $wy = $r[1]
    "RECT $wx $wy $($r[2]) $($r[3])"
    $ew = [int][Math]::Round($cssW * $Scale, [MidpointRounding]::AwayFromZero); $eh = [int][Math]::Round($cssH * $Scale, [MidpointRounding]::AwayFromZero)
    "SIZE expected ${ew}x${eh} got $($r[2])x$($r[3]) => $(if ($r[2] -eq $ew -and $r[3] -eq $eh) {'PASS'} else {'FAIL'})"

    function P($cx, $cy) { return @(($wx + [int][Math]::Round($cx * $Scale)), ($wy + [int][Math]::Round($cy * $Scale))) }
    $tests = [ordered]@{
        'gap (transparent, no hit rect)'           = @(280, 100, 'backdrop')
        'empty corner (transparent, no hit rect)'  = @(480, 300, 'backdrop')
        'glow centre (semi-transparent, no hit)'   = @(222, 282, 'backdrop')
        'P0 box corner (transparent, in hit rect)' = @(295, 13, 'either')
        'pet body (opaque, hit rect)'              = @(395, 150, 'pet')
        'card (opaque, hit rect)'                  = @(200, 100, 'pet')
        'card near right edge (fails if host scale != page DPR)' = @(255, 100, 'pet')
    }
    foreach ($k in $tests.Keys) {
        $t = $tests[$k]
        $p = P $t[0] $t[1]
        $before = if (Test-Path $log) { @(Get-Content $log).Count } else { 0 }
        $res = St click $p[0] $p[1]
        $after = if (Test-Path $log) { @(Get-Content $log).Count } else { 0 }
        $got = if ($after -gt $before) { 'backdrop' } else { 'pet' }
        $fg = ($res | Where-Object { $_ -like 'foreground*' }) -replace '.*rootTitle=''([^'']*)''.*', '$1'
        $ok = ($t[2] -eq 'either') -or ($t[2] -eq $got)
        "CLICK [$k] css=($($t[0]),$($t[1])) phys=($($p[0]),$($p[1])) expected=$($t[2]) got=$got foreground='$fg' => $(if ($ok) {'PASS'} else {'FAIL'})"
        if ($k -like 'pet body*') { Cap $wx $wy $r[2] $r[3] (Join-Path $OutDir 'happy.png') }
    }

    $p = P 150 60   # card text: mousedown there sends dragStart
    St drag $p[0] $p[1] ($p[0] + $DragDX) ($p[1] + $DragDY) | Out-Null
    $r2 = Rect (St info $h)
    "DRAG from ($wx,$wy) by ($DragDX,$DragDY) -> ($($r2[0]),$($r2[1])) => $(if ([Math]::Abs($r2[0] - $wx - $DragDX) -le 2 -and [Math]::Abs($r2[1] - $wy - $DragDY) -le 2) {'PASS'} else {'FAIL'})"
    $wx = $r2[0]; $wy = $r2[1]
    Cap $BdX $BdY $BdW $BdH (Join-Path $OutDir 'dragged.png')

    # topmost through the page button (Form.TopMost starts false; settop made the HWND topmost)
    $b = P 80 166
    $corner = @(($BdX + 20), ($BdY + 20))   # backdrop pixel outside the pet: clicking it activates/raises the backdrop
    St click $b[0] $b[1] | Out-Null
    $i1 = St info $h
    St click $corner[0] $corner[1] | Out-Null
    "TOPMOST on : flag=$([regex]::Match($i1, 'topmost=(\w+)').Groups[1].Value) (expected True); after activating backdrop pet still $(St above $h $bdHwnd) (expected above=True)"
    Cap $BdX $BdY $BdW $BdH (Join-Path $OutDir 'topmost-on.png')
    St click $b[0] $b[1] | Out-Null
    $i2 = St info $h
    St click $corner[0] $corner[1] | Out-Null
    "TOPMOST off: flag=$([regex]::Match($i2, 'topmost=(\w+)').Groups[1].Value) (expected False); after activating backdrop pet $(St above $h $bdHwnd) (expected above=False)"
    Cap $BdX $BdY $BdW $BdH (Join-Path $OutDir 'topmost-off.png')
}
finally {
    Stop-All $procs
}
} | Tee-Object -FilePath (Join-Path $OutDir 'result.txt')
