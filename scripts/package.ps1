$ErrorActionPreference = "Stop"

# Settings.
$ScriptRoot = if ($PSScriptRoot) {
    $PSScriptRoot
} else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}
$TargetDir = (Resolve-Path (Join-Path $ScriptRoot "..")).Path
$TmpDir = Join-Path $TargetDir "package_tmp"
$OutputDir = Join-Path $TargetDir "package"

# Get version.
function Get-Version {
    $manifestPath = $null
    if (Test-Path (Join-Path $TargetDir "manifest.json")) {
        $manifestPath = Join-Path $TargetDir "manifest.json"
    } elseif (Test-Path (Join-Path $TargetDir "manifest_firefox.json")) {
        $manifestPath = Join-Path $TargetDir "manifest_firefox.json"
    } else {
        return "0_0_0"
    }

    $json = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if (-not $json.version) { return "0_0_0" }
    return ($json.version.ToString() -replace '\.', '_')
}

$Version = Get-Version
Write-Host "version: $Version"

$ZipFirefox = "XPP-Deck_Firefox_${Version}.zip"
$ZipChrome  = "XPP-Deck_Chromium_${Version}.zip"

# Initialize.
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Remove-Item -Recurse -Force -ErrorAction Ignore $TmpDir
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

# Excluded directories.
$ExcludeDirs = @(
    ".git",
    ".github",
    ".serena",
    ".webext-profile",
    "node_modules",
    "build",
    "scripts",
    "package_tmp",
    "package"
)

# Excluded files.
$ExcludeFiles = @(
    ".gitignore",
    "README.md",
    ".DS_Store",
    "pnpm-lock.yaml",
    "*.sh",
    "*.ps1"
)

function Invoke-RoboCopy {
    param(
        [Parameter(Mandatory=$true)][string]$Source,
        [Parameter(Mandatory=$true)][string]$Dest,
        [string[]]$XD,
        [string[]]$XF
    )

    $args = @(
        $Source, $Dest,
        "/E", "/R:0", "/W:0",
        "/NFL", "/NDL", "/NJH", "/NJS"
    )

    if ($XD -and $XD.Count -gt 0) { $args += "/XD"; $args += $XD }
    if ($XF -and $XF.Count -gt 0) { $args += "/XF"; $args += $XF }

    $null = & robocopy @args

    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed with exit code $LASTEXITCODE"
    }
}

# Build Firefox ZIP.
Invoke-RoboCopy -Source $TargetDir -Dest $TmpDir -XD $ExcludeDirs -XF $ExcludeFiles

$ffManifest = Join-Path $TmpDir "manifest_firefox.json"
$mainManifest = Join-Path $TmpDir "manifest.json"
if (Test-Path $ffManifest) {
    Move-Item $ffManifest $mainManifest -Force
}

$ffZipPath = Join-Path $OutputDir $ZipFirefox
if (Test-Path $ffZipPath) { Remove-Item -Force $ffZipPath }
Compress-Archive -Path (Join-Path $TmpDir "*") -DestinationPath $ffZipPath -Force

Remove-Item -Recurse -Force $TmpDir
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

# Build Chromium ZIP.
Invoke-RoboCopy -Source $TargetDir -Dest $TmpDir -XD $ExcludeDirs -XF ($ExcludeFiles + @("manifest_firefox.json"))

$chZipPath = Join-Path $OutputDir $ZipChrome
if (Test-Path $chZipPath) { Remove-Item -Force $chZipPath }
Compress-Archive -Path (Join-Path $TmpDir "*") -DestinationPath $chZipPath -Force

Remove-Item -Recurse -Force $TmpDir

Write-Host "ZIP packaging completed:"
Write-Host " - Firefox build: $ffZipPath"
Write-Host " - Chrome build:  $chZipPath"
