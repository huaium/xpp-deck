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

## Development

Vite builds TypeScript modules into standalone classic-script bundles. The early
reload guard, main content script, background script, popup, and two injected page
helpers have separate entry points. Page helpers remain web-accessible resources
and communicate with the content script through DOM events.

Use Node.js 22.13+ (or a supported newer release) and pnpm. TypeScript checks types
separately; Vite handles transpilation and bundling.

### 1) Install dependencies

```
pnpm install
```

### 2) Watch development in Firefox

```
pnpm run webext:dev
```

Vite watches module dependencies, manifests, locale files, popup HTML, and public
assets. Changes are debounced and synchronized only after successful builds;
compilation errors leave the last working extension in place. `web-ext` reloads
Firefox's extension after synchronization finishes. Refresh the X page manually
to apply content-script changes; this is extension reload, not state-preserving
HMR. Ctrl+C stops both the watcher and the browser runner.

Watch mode transpiles without checking types on each save. Run `pnpm run typecheck`
or `pnpm run lint` to check types. A changed Vite configuration requires restarting
the development command.

### 3) Validate

```
pnpm test
pnpm run lint
pnpm run webext:lint
```

### 4) Build and package

```
pnpm run build
```

Browser-specific ZIPs are written to `build/package/`. Prepared extensions are in
`build/web-ext-firefox-src/` and `build/web-ext-chromium-src/`; each contains the
correct `manifest.json` and only runtime assets. `pnpm run build:bundle` prepares
these directories without creating ZIPs. `build:ts` remains a compatibility alias
for that command, but no longer emits the old `build/ts-out` tree.

Obsolete generated files and `pnpm run webext:clean` use the `trash` command so
deletions are recoverable. If `trash` is unavailable, cleanup stops rather than
permanently deleting files.
