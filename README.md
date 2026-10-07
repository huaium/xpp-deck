# XPP-Deck

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
  <img src="public/icons/logo_icon.svg" alt="XPP-Deck logo" width="160" height="160">
</picture>

Browse X in multiple columns, with saved layouts and adjustable settings.

## Features

- Timeline, Notifications, Explore, Lists, Post, and custom URL columns
- One- or two-row layouts with adjustable column widths
- Named profiles for saving and switching layouts
- A custom homepage for each column
- Optional auto-refresh, with paced loading and rate-limit pauses
- Light, dark, and system themes
- Nine interface languages, following your browser language by default

## Get Started

Download a browser package from [Releases](https://github.com/huaium/xpp-deck/releases),
when available, or build it locally using the instructions below.

1. Load the browser bundle through your browser's extension developer tools.
2. Open [XPP-Deck](https://x.com/run-xppdeck).
3. Sign in to X if prompted, then add columns and save your layout as a profile.

Sign-in uses X's official page in a separate tab. XPP-Deck does not read cookies
to check your session. If it cannot confirm your session, use the retry option.

Open **Settings** beside the sidebar logo to change the theme, layout, or language.
Column settings let you change the homepage, width, view mode, and auto-refresh.

Supported languages: English, Japanese, Simplified Chinese, Traditional Chinese,
Korean, Spanish, French, German, and Brazilian Portuguese. The interface falls
back to English; changing its language does not change embedded X pages.

## Development

Requires Node.js 22.13+ and pnpm. WXT handles development and packaging for
Chrome (Manifest V3) and Firefox (Manifest V2).

### Setup

```sh
pnpm install
pnpm run prepare
```

### Run

```sh
pnpm run dev          # Chrome / Chromium
pnpm run dev:firefox  # Firefox
```

To use Chrome for Testing on macOS:

```sh
CHROMIUM_BINARY="/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" pnpm run dev
```

WXT opens the browser and watches for changes. Chrome deck updates reload the
page rather than preserving its state. In Firefox, refresh existing X pages
after extension updates. Helper or background changes may also need a page refresh.
Stop development with Ctrl+C.

Browser profiles and logins are kept in `.wxt-profiles/`, separate from build output.

### Check and Build

```sh
pnpm test              # Automated tests, including browser builds
pnpm run lint          # Type checking and linting
pnpm run test:watch    # Development watcher integration test
pnpm run build:bundle  # Unpacked browser bundles
pnpm run build         # ZIP packages
```

Unpacked bundles are in `.output/chrome-mv3/` and `.output/firefox-mv2/`.
ZIP packages are in `.output/`. Run `pnpm run clean` to remove generated output
without deleting development browser profiles.

Firefox ESR 115 does not support the column view-mode filters.

## License Reminder

XPP-Deck uses the [MIT License](LICENSE), copyright 2026 huaium.

This project builds on the original work of kawa-nobu. Thank you for creating
the foundation that made XPP-Deck possible. The original MIT license and
copyright notice (2023 kawa-nobu) are preserved in [LICENSE.original](LICENSE.original).
