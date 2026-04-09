# XPP-Deck

![icon](https://github.com/kawa-nobu/Open-Deck/assets/44832116/3d4d1e64-6a74-4587-a248-da8424190d41)

## Features

- Timeline columns
- Notification columns
- Explore (Universal Column\*1)
- Add as many columns as your device and browser can handle
- Two-row column layout
- Auto-refresh columns with 1-second granularity (supports timeline and search)
- Freely adjustable column width settings (in `1rem` units)
- Unlimited profile save/switch support (column layout and settings)

\*1 A universal column that can be configured freely for DMs, lists, and more, in addition to trends and search.

**If you use Firefox ESR115 (including ESR-based builds), Tweet Type Display Mode does not work.  
This is because ESR does not support the CSS selectors used by this extension.**

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
- Open the extension runtime URL: https://twitter.com/run-opdeck

## For Developers (web-ext)

To speed up Firefox development, validation, and builds, this repository includes `web-ext` scripts.  
This repo uses `manifest.json` for Chromium and `manifest_firefox.json` for Firefox,  
so `npm run webext:prepare` generates a temporary source where `manifest_firefox.json` is handled as `manifest.json`.

### 1) Install dependencies

```
npm install
```

### 2) Hot-reload development in Firefox

```
npm run webext:dev
```

### 3) Lint for Firefox

```
npm run webext:lint
```

### 4) Build for Firefox

```
npm run webext:build
```

Build artifacts are output to `web-ext-artifacts/`.
