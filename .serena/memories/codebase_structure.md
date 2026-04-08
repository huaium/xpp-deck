# Codebase Structure

- `manifest.json`: Chromium extension manifest (MV3), service worker background entry, content scripts, web-accessible resources.
- `manifest_firefox.json`: Firefox extension manifest (MV2) with browser-specific settings.
- `content.js`: Main in-page logic injected into x.com/twitter.com.
- `background.js`: Background/service-worker logic (message handling, DNR updates, API calls, header observation).
- `popup.html` + `popup.js`: Extension popup; opens `https://twitter.com/run-opdeck` and closes.
- `extensions/`: Feature modules and helpers.
  - `text_review*.js`
  - `auto_reload*.js`
  - `media_viewer*/`
- `_locales/`: i18n message catalogs (`ja`, `en`).
- `icon/`: UI icons used by extension UI.
- `package.sh` / `package.ps1`: Build package ZIP files for Firefox/Chromium.
- `.github/workflows/release.yml`: Manual release workflow to package and create GitHub draft release.
