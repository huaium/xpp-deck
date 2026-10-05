$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "..")
try {
    node utils/package.mjs
    if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }
} finally {
    Pop-Location
}
