# Agent Guide

## Project

XPP-Deck is a browser extension that displays X pages in configurable columns.
The deck runs at `https://x.com/run-xppdeck`. The repository is
`https://github.com/huaium/xpp-deck`.

- Toolchain: WXT, TypeScript, pnpm, and Web Awesome.
- Targets: Chrome Manifest V3 and Firefox Manifest V2.
- Use `xpd_` for internal identifiers and storage keys.
- Do not restore legacy branding, storage migrations, or the old web-ext build workflow.

## Repository Map

- `entrypoints/`: WXT background, content scripts, page helpers, and popup entrypoints.
- `src/content/`: deck UI, settings, session detection, loading, and lifecycle management.
- `src/background.ts`: request rules, API counters, and background message handling.
- `src/profile-storage.ts`: serialized profile mutations with stable profile IDs.
- `public/`: icons and localized messages under `_locales/`.
- `tests/`: Node tests, browser fixtures, and build/watcher checks.
- `wxt.config.mjs`: browser-specific build configuration.

## Commands

Requires Node.js 22.13+ and pnpm. Use existing dependencies; do not install them
on the host on the user's behalf.

```sh
pnpm test
pnpm run lint
pnpm run build:bundle
pnpm run test:watch
pnpm run dev
pnpm run dev:firefox
```

- `pnpm test` includes extension build tests.
- `pnpm run lint` runs type checking and ESLint.
- Browser checks: `test:browser`, `test:browser:loading`, and `test:browser:extension`.
  See `tests/README.md` for requirements.
- Generated bundles are in `.output/`; do not edit generated files.
- Preserve `.wxt-profiles/`, which contains development browser profiles and logins.
- WXT configuration/plugin changes can require restarting the development runner.

## Implementation Rules

- Preserve Chrome compatibility when fixing Firefox, and vice versa. Verify both
  builds when changing entrypoints, browser APIs, polyfills, or build configuration.
- Initialize component compatibility support before registering Web Awesome
  components. Keep Firefox-specific realm handling scoped to Firefox builds.
- Use in-page dialogs and shared Web Awesome controls rather than browser alerts,
  confirms, or prompts. Keep dropdown and button styling consistent.
- Localize user-facing text in the supported locale files; retain English fallback.
- Keep column titles static unless explicitly renamed by the user.
- Route profile mutations through the background storage service. Do not write a
  stale whole-profile store from a deck tab.
- Check deck-lifetime cancellation after asynchronous work, before mounting UI,
  rebuilding the deck, or displaying errors. Dispose owned observers, listeners,
  timers, styles, and schedulers on teardown.
- Scope deck UI, theme overrides, and leave-page warnings to the top-level deck.
  Do not change ordinary X browsing or embedded documents unnecessarily.
- Keep frame-protection header changes limited to deck-related embedded requests
  and explicit supported domains. Do not weaken browser-wide security rules.
- Keep auto-load off by default, pause hidden/offscreen loading, and honor X's
  rate-limit cooldowns. Preserve these protections when exposing loading settings.
- Strip `lang` parameters from copied links and captured homepage URLs.
- Use X's native media viewer; retain the column view-mode filters.

## Validation

Add regression tests for behavior changes. Prefer behavioral assertions over
checks that only match source text. Run focused tests while iterating, then
`pnpm test` and `pnpm run lint` for substantive changes. Report any checks not run.
For rendered UI or browser-specific failures, verify the affected interactions
and console in the browser when available. Do not expose cookies, credentials,
or authorization headers, or modify real user profiles during testing.

## Agent Workflow

- Follow `/Users/huaium/.codex/RTK.md`: prefix agent shell commands with `rtk`.
  Commands shown to the user must not include that prefix.
- If `.codegraph/` exists, use CodeGraph before searching or reading source to
  locate or understand code. Do not create an index without the user's request.
- Use Context7 for current library-specific documentation. Resolve the library
  first, keep requests scoped, and run its CLI outside the default sandbox.
- Do not install dependencies on the host. Explain the need, provide the exact
  user command, and stop until the user has installed them. Installation inside
  a development container is allowed.
- For direct agent file deletion, use `trash`, not `rm`. If unavailable, ask
  before deleting. Do not add trash dependencies to application or build code.
- Preserve unrelated working-tree changes. Never reset or revert them.
- Keep changes focused; do not run repository-wide formatting for a small fix.
- Commit only when requested. With the auto-commit skill, review the diff,
  propose a `<type>: <description>` message, and wait for confirmation without
  editing files.
