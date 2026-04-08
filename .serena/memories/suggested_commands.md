# Suggested Commands (Darwin/macOS)

## Basic navigation/utilities
- `pwd`
- `ls -la`
- `cd /Users/huaium/Work/Projects/Open-Deck`
- `find . -maxdepth 3 -type f`
- `rg "pattern"`
- `git status`
- `git diff`

## Build/package extension artifacts
- `bash package.sh`
  - Produces ZIP packages under `./package/` for Firefox and Chromium.

## Manual local validation (no automated test/lint scripts detected)
- `open /Users/huaium/Work/Projects/Open-Deck/manifest.json`
- `open /Users/huaium/Work/Projects/Open-Deck/manifest_firefox.json`
- Optional JSON parse check:
  - `cat manifest.json | jq . >/dev/null`
  - `cat manifest_firefox.json | jq . >/dev/null`

## Windows equivalent for packaging
- `pwsh -File .\package.ps1`

## Release flow reference
- GitHub Actions workflow: `.github/workflows/release.yml` (manual `workflow_dispatch`).
