# Tests

Run `pnpm test` for the behavior suite. It uses Node's test runner and the
TypeScript 7 native AST API to extract production functions and event handlers,
and Node's built-in type stripping to execute them in isolated fixtures.
Source modules are bundled by Vite into classic extension scripts. The fixture
helper strips export modifiers from extracted declarations. Type stripping requires Node 22.13 or newer
and currently emits an experimental API warning. The native API is exposed by
TypeScript under `unstable` paths; its processes are closed after extraction.

Coverage includes dialogs, queue recovery, IME keyboard handling, profile
creation/switching/deletion, column serialization and refresh defaults, sidebar
state, language persistence and fallback, theme transitions, and reload guards.
DOM adapters validate event behavior; they do not validate browser layout.

The behavior suite also builds all six Vite entry points, checks classic-script
syntax and manifest resource paths, and tests coordinated watch publication.
Run `pnpm run test:watch` for native filesystem watcher integration in an isolated
temporary project. It checks syntax-error recovery, asset additions/deletions,
and shutdown; cleanup uses `trash`.

Run `pnpm run test:browser:extension` after `pnpm run build:bundle` to exercise the
actual bundled deck in Chromium with local X-page fixtures. It checks module
initialization, iframe helper injection, banner detection, settings expansion,
and display-mode persistence after a full iframe reload. Use the Playwright and
browser-path overrides described below. This is not authenticated live-X testing
or a test of installation in an actual Firefox extension environment.

Column loading randomly targets one or two concurrent navigations, samples an
800-1,200 ms gap after each start, and uses a 30-second slot timeout. Lowering the
target does not interrupt active loads; two remains the hard maximum.
Scheduler tests cover visibility priority,
deduplication, failure recovery, and profile cancellation. Run
`pnpm test:browser:loading` with the same Playwright environment overrides below
to verify real Chromium iframe navigation and refresh pacing.

Run `pnpm test:browser` with an existing Playwright installation. If it is not
resolvable locally, set `PLAYWRIGHT_MODULE_PATH` to that package's absolute path.
The runner never installs packages or downloads browsers.

The browser runner exercises Chromium and Firefox with real DOM focus and
keyboard events. It checks prompt submission, Cancel activation, focus cycling
and restoration, synthetic IME events, dialog queueing, narrow and desktop input
bounds, and About dismissal. It uses isolated fixtures with production dialog
code; it does not connect to a live X account or test authenticated iframe content.

When using existing browser binaries from a different Playwright installation,
set `CHROMIUM_EXECUTABLE_PATH` and `FIREFOX_EXECUTABLE_PATH`. A matching browser
and Playwright version is preferable. Missing or unusable browsers fail the
browser command rather than silently skipping coverage.

Before refactoring, run both suites and `pnpm run typecheck`. The tests assert
current behavior: active profiles may be deleted when another profile remains;
the final profile is protected. Existing `top_visible` properties are ignored
and are omitted from newly serialized columns.
