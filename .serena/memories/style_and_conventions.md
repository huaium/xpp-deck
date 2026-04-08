# Style and Conventions

- Language: Plain JavaScript (no TypeScript build pipeline in repo despite Serena detecting TS in environment metadata).
- Formatting style observed:
  - 4-space indentation in most JS files.
  - Semicolons commonly used.
  - `const`/`let` preferred over `var`.
  - Mix of English identifiers and Japanese comments/strings.
- Architecture conventions:
  - Browser APIs accessed via `chrome.*` APIs.
  - Messaging between content and background via `chrome.runtime.sendMessage` and `onMessage` listeners.
  - Feature code split under `extensions/` with `*_helper.js` paired files.
- i18n convention: Use `chrome.i18n.getMessage` and `_locales/*/messages.json` entries.
- Repo currently has no explicit ESLint/Prettier config; preserve existing local style in edited files.
