# XPP-Deck

![XPP-Deck icon](public/icon.png)

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

## Installation

Use [XPP-Deck releases](https://github.com/huaium/xpp-deck/releases) for published
browser packages, when available. Otherwise, build locally using the development
instructions below.

Load the appropriate browser bundle through your browser's extension developer
tools, then open [XPP-Deck](https://x.com/run-xppdeck).

The Firefox extension ID is `xpp-deck@huaium`. Firefox treats this as a separate
extension from previous builds using the legacy ID; saved profiles do not
transfer automatically. Original license and author attribution are retained.

Internal names use the `xpd_` namespace; legacy data is not migrated. Site data
and extension-local storage are separate. Clear both if you want a complete
fresh start.

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

### Loading Limits

By default, column loads and extension-triggered refreshes run one at a time per deck,
with a random 2–3-second gap between starts and a 30-second load timeout.
Settings → Advanced Settings lets you change concurrency (1–2), the randomized
gap range (0.5–60 seconds), and timeout (5–120 seconds). Click Save to apply
changes to future loads across open decks; Restore defaults fills the default
values for saving. Rate-limit cooldowns and hidden-tab pauses cannot be disabled.
Initial loads wait until their columns
are onscreen; hidden tabs do not start new loads. HTTP 429 responses pause queued
work until the response reset/retry deadline (at least 60 seconds when missing).
The API Usage dialog shows the pause. Last rate-limit attribution is stored
locally in `xpd_rate_limit_event`, without query parameters or credentials.
This does not throttle X's own requests inside already-loaded pages.

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
