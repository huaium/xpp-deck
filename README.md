# XPP-Deck

![icon](https://github.com/kawa-nobu/Open-Deck/assets/44832116/3d4d1e64-6a74-4587-a248-da8424190d41)

## Features

- Timeline columns
- Notification columns
- Explore (Universal Column\*1)
- Add as many columns as your device and browser can handle
- Two-row column layout
- Auto-refresh every content column, with a paced loading queue
- Freely adjustable column width settings (in `1rem` units)
- Unlimited profile save/switch support (column layout and settings)

\*1 A universal column that can be configured freely for DMs, lists, and more, in addition to trends and search.

**If you use Firefox ESR115 (including ESR-based builds), Tweet Type Display Mode does not work.  
This is because ESR does not support the CSS selectors used by this extension.**

## Languages

The sidebar language selector supports English, Japanese, Simplified Chinese,
Traditional Chinese, Korean, Spanish, French, German, and Brazilian Portuguese.
It follows the browser language by default and falls back to English.
Changing the extension language does not change embedded X pages or user-entered names.

## Screenshots

<img width="960" alt="image" src="https://github.com/kawa-nobu/Open-Deck/assets/44832116/0970c89f-d099-4d8e-ac84-54037d8c9868">  
<img width="962" alt="image" src="https://github.com/kawa-nobu/Open-Deck/assets/44832116/2753c97a-f8e5-4eab-b096-82cfed081fb0">

## Usage

Coming soon.

## Installation (Recommended)

### Via Chrome Web Store

Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/open-deck/gmkadaeibmhchpimnfplodelecmogdic),  
then click the **Add to Chrome (or Brave, etc.)** button to install it easily.

### Via Mozilla Official Site

Visit [addons.mozilla.org (AMO)](https://addons.mozilla.org/ja/firefox/addon/open-deck/),  
then click the **Add to Firefox** button to install it easily.

## Installation (Developer Mode)

**Only use this if you already know how to install extensions in developer mode.**

- Download the ZIP from the browser-specific branch you want
- Install it in developer mode
- Open the extension runtime URL: https://twitter.com/run-xppdeck

## Development

WXT manages the Vite build, entrypoints, manifests, development browser runner,
and packaging. Chrome uses Manifest V3; Firefox retains Manifest V2. The early
reload guard runs at document start. Injected X-page helpers remain standalone
classic scripts and communicate through DOM events.

Use Node.js 22.13+ (or a supported newer release) and pnpm.

### Install

```sh
pnpm install
pnpm run prepare
```

### Develop

```sh
pnpm run dev
pnpm run dev:firefox
```

Chrome development uses Chromium or Chrome for Testing. To select its executable:

```sh
CHROMIUM_BINARY="/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" pnpm run dev
```

WXT opens the target browser and watches source files and public assets. Popup
modules use Vite HMR. The existing deck is not state-preserving HMR: Chrome deck
reinjection reloads the X page to avoid duplicate listeners, observers and timers.
Firefox MV2 uses extension reload; refresh existing X pages after updates.
Helper and background changes can also require an X-page refresh.
Ctrl+C stops development. Type checking remains separate from watch transpilation.

Development output is in `.output/chrome-mv3-dev/` and
`.output/firefox-mv2-dev/`. Separate browser profiles retain logins.
Browser profiles are stored in `.wxt-profiles/chrome/` and
`.wxt-profiles/firefox/`, separately from generated output.

### Validate

```sh
pnpm test
pnpm run lint
pnpm run test:watch
```

### Build

```sh
pnpm run build:bundle
pnpm run build
```

Production bundles are in `.output/chrome-mv3/` and `.output/firefox-mv2/`.
WXT ZIP packages are written to `.output/`; the Firefox build also produces a
source archive.

WXT manages build output cleanup automatically.
`pnpm run clean` removes generated output without deleting browser profiles.

WXT uses `web-ext` internally to launch development browsers. The dependency
and WXT-native `webExt` runner options are retained for automatic browser startup;
there are no standalone web-ext commands or configuration files.

### Signed-out startup

The deck checks X's rendered navigation for account/profile or login controls.
No cookies are read, no additional permission is required, and no X API requests
are made by the session check. A short-lived observer waits up to five seconds for
X to render; inconclusive pages show a retry state rather than assuming logout.

Sign-in opens X's official page in a separate tab. Returning to the deck checks
again. If the original page is still stale, “I've signed in” reloads it for a fresh
check. Existing profiles are preserved. Detection uses structural markers, not
translated text, but may require maintenance if X changes its markup.
