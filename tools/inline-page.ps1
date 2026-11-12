# Builds one self-contained HTML file from a page, for review pages that are published or sent on: every local
# <script src> and <link rel="stylesheet"> is inlined, and CSS url(...) files (the Fredoka font) become base64 data:
# URIs, so the file fetches nothing. A remote or missing file is an error, never a silent leftover.
#   .\tools\inline-page.ps1 -Page poses-review.html -Out build\review\poses-review.html
# -Page  a page under src\web, or a path from the repo root, or an absolute one.
# -Out   the HTML file to write (UTF-8, no BOM); a relative path is from the repo root.
# The font lives in src\web\fonts, which build.ps1 copies from vendor\fonts (git-ignored): a fresh worktree that has
# not built yet gets it from vendor\fonts.
param(
    [Parameter(Mandatory = $true)][string]$Page,
    [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object Text.UTF8Encoding $false
$mime = @{ '.ttf' = 'font/ttf'; '.otf' = 'font/otf'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.png' = 'image/png';
    '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp' }

$file = $null
if ([IO.Path]::IsPathRooted($Page)) { $file = $Page }
else {
    foreach ($c in @((Join-Path $root ('src\web\' + $Page)), (Join-Path $root $Page))) {
        if (Test-Path -LiteralPath $c -PathType Leaf) { $file = $c; break }
    }
}
if (-not $file -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { Write-Host "inline-page: no page '$Page'"; exit 1 }
$file = [IO.Path]::GetFullPath($file)

# the local file a reference in a file of folder $base points at
function Resolve-Ref([string]$ref, [string]$base) {
    if ($ref -match '^\s*([a-z][a-z0-9+.-]*:|//)') { throw "inline-page: not a local file: $ref" }
    $clean = [Uri]::UnescapeDataString(($ref -split '[?#]')[0]).Replace('/', '\')
    $f = [IO.Path]::GetFullPath((Join-Path $base $clean))
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
        $vendor = Join-Path $root ('vendor\fonts\' + (Split-Path $f -Leaf))
        if ($f.StartsWith((Join-Path $root 'src\web\fonts\'), [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $vendor -PathType Leaf)) { return $vendor }
        throw "inline-page: missing $f (from '$ref')"
    }
    return $f
}

function Inline-Css([string]$path) {
    $css = [IO.File]::ReadAllText($path, $utf8)
    if ($css -match '@import') { throw "inline-page: @import is not supported ($path)" }
    if ($css -match '</style') { throw "inline-page: </style inside $path" }
    $dir = Split-Path $path -Parent
    return [regex]::Replace($css, 'url\(\s*([''"]?)([^''")]+)\1\s*\)', [Text.RegularExpressions.MatchEvaluator] {
        param($m)
        $ref = $m.Groups[2].Value
        if ($ref -match '^(data:|#)') { return $m.Value }
        $f = Resolve-Ref $ref $dir
        $type = $mime[[IO.Path]::GetExtension($f).ToLowerInvariant()]
        if (-not $type) { throw "inline-page: no media type for $f" }
        return 'url("data:' + $type + ';base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($f)) + '")'
    })
}

$pageDir = Split-Path $file -Parent
$html = [IO.File]::ReadAllText($file, $utf8)

$html = [regex]::Replace($html, '<link\b[^>]*>', [Text.RegularExpressions.MatchEvaluator] {
    param($m)
    if ($m.Value -notmatch '\brel\s*=\s*"stylesheet"') { return $m.Value }
    $href = [regex]::Match($m.Value, '\bhref\s*=\s*"([^"]+)"')
    if (-not $href.Success) { throw "inline-page: stylesheet without href: $($m.Value)" }
    return "<style>`n" + (Inline-Css (Resolve-Ref $href.Groups[1].Value $pageDir)) + "`n</style>"
})

$html = [regex]::Replace($html, '<script\b([^>]*?)\bsrc\s*=\s*"([^"]+)"([^>]*)>\s*</script>', [Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $js = [IO.File]::ReadAllText((Resolve-Ref $m.Groups[2].Value $pageDir), $utf8)
    # "</script" ends the element whatever the JS meant; "<\/script" means the same inside JS strings and comments
    $js = [regex]::Replace($js, '</(script)', '<\/$1', 'IgnoreCase')
    return '<script' + $m.Groups[1].Value.TrimEnd() + $m.Groups[3].Value + ">`n" + $js + "`n</script>"
})

# nothing local may be left to fetch
$left = [regex]::Matches($html, '<(script|img|iframe|link|source|audio|video)\b[^>]*\b(src|href)\s*=\s*"(?!data:|#)[^"]*"', 'IgnoreCase')
if ($left.Count -gt 0) { throw "inline-page: still fetches: $($left[0].Value)" }

$outFile = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }))
New-Item -ItemType Directory -Force (Split-Path $outFile -Parent) | Out-Null
[IO.File]::WriteAllText($outFile, $html, $utf8)
Write-Host ('inline-page: {0} ({1:N0} bytes)' -f $outFile, (Get-Item -LiteralPath $outFile).Length)
