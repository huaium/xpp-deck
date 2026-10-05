$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "..")
try {
    pnpm run build
    if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }
} finally {
    Pop-Location
}
