# Task Completion Checklist

Because this repository does not define automated lint/test tasks, complete work with these checks:

1. Verify modified manifests/scripts are syntactically valid and consistent for both browsers.
2. If packaging-related files changed, run `bash package.sh` and confirm ZIP files are generated in `package/`.
3. For runtime JS changes, manually load unpacked extension in target browser(s) and validate:
   - Popup opens `https://twitter.com/run-opdeck`.
   - Content scripts initialize on `x.com`/`twitter.com`.
   - Affected feature modules under `extensions/` behave as expected.
4. Check localization impact if UI strings changed in `_locales/ja` and `_locales/en`.
5. Run `git diff` and confirm no accidental edits to generated/package temp folders.
