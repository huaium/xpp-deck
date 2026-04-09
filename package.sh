#!/bin/bash
set -euo pipefail

# Settings.
TARGET_DIR="."
TMP_DIR="./package_tmp"
OUTPUT_DIR="./package"

# Read version from manifest.
get_version() {
    local manifest_file=""
    if [ -f "$TARGET_DIR/manifest.json" ]; then
        manifest_file="$TARGET_DIR/manifest.json"
    elif [ -f "$TARGET_DIR/manifest_firefox.json" ]; then
        manifest_file="$TARGET_DIR/manifest_firefox.json"
    else
        echo "0.0.0"
        return
    fi

    # Extract version string.
    grep -oE '"version"\s*:\s*"[^"]+"' "$manifest_file" | sed -E 's/.*"([^"]+)"/\1/' | tr '.' '_' || echo "0_0_0"
}

VERSION="$(get_version)"
echo "version: $VERSION"

ZIP_FIREFOX="Open-Deck_firefox_${VERSION}.zip"
ZIP_CHROME="Open-Deck_chromium_${VERSION}.zip"

# Initialize.
mkdir -p "$OUTPUT_DIR"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Exclusion rules.
RSYNC_EXCLUDES=(
  --exclude=".git"
  --exclude=".github"
  --exclude=".gitignore"
  --exclude="README.md"
  --exclude=".DS_Store"
  --exclude="package_tmp"
  --exclude="package"
  --exclude="*.sh"
)

# Firefox ZIP.
rsync -av "${RSYNC_EXCLUDES[@]}" "$TARGET_DIR/" "$TMP_DIR/"
if [ -f "$TMP_DIR/manifest_firefox.json" ]; then
    mv "$TMP_DIR/manifest_firefox.json" "$TMP_DIR/manifest.json"
fi
(cd "$TMP_DIR" && zip -r "../$OUTPUT_DIR/$ZIP_FIREFOX" .)
rm -rf "$TMP_DIR"

# Chrome ZIP.
mkdir -p "$TMP_DIR"
rsync -av "${RSYNC_EXCLUDES[@]}" --exclude="manifest_firefox.json" "$TARGET_DIR/" "$TMP_DIR/"
(cd "$TMP_DIR" && zip -r "../$OUTPUT_DIR/$ZIP_CHROME" .)
rm -rf "$TMP_DIR"

echo "ZIP packaging completed:"
echo " - Firefox build: $OUTPUT_DIR/$ZIP_FIREFOX"
echo " - Chrome build:  $OUTPUT_DIR/$ZIP_CHROME"
