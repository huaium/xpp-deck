import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
/* global window, document, innerWidth, open_opd_dialog */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { URL } from "node:url";
import ts from "typescript";

// Use an existing Playwright installation; never install packages implicitly.
const require = createRequire(import.meta.url);
let playwright;
try {
    playwright = require("playwright");
} catch {
    const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
    if (!modulePath)
        throw new Error(
            "Set PLAYWRIGHT_MODULE_PATH to an existing Playwright package to run browser tests.",
        );
    playwright = require(modulePath);
}
const source = readFileSync(
    new URL("../src/content/prelude.ts", import.meta.url),
    "utf8",
);
const tree = ts.createSourceFile(
    "prelude.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
);
const names = new Set([
    "ensure_opd_dialog_style",
    "enqueue_opd_dialog",
    "open_opd_dialog",
    "open_about_page_modal",
    "i18n_message_or_fallback",
]);
const declarations = tree.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text),
);
assert.equal(declarations.length, names.size);
const script = ts.transpileModule(
    `
const manifest = {version: '1.0.0'};
const chrome = {runtime: {getManifest: () => manifest, getURL: (path) => 'https://fixture.invalid/' + path}};
const ui_icon_define = {column_close: 'close.svg'};
let opd_dialog_queue = Promise.resolve();
function i18n_message(key) {return key === 'ui_dialog_cancel_button' ? 'Cancel' : 'OK';}
function is_opd_dark_theme_enabled() {return false;}
${declarations.map((node) => node.getText(tree)).join("\n")}
window.openTestDialog = (options) => {window.result = 'pending'; open_opd_dialog(options).then(value => window.result = value);};
window.openTestAbout = open_about_page_modal;
`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

for (const engine of ["chromium", "firefox"]) {
    const executablePath =
        process.env[`${engine.toUpperCase()}_EXECUTABLE_PATH`];
    const browser = await playwright[engine].launch({
        headless: true,
        timeout: 15000,
        ...(executablePath ? { executablePath } : {}),
    });
    try {
        const page = await browser.newPage({
            viewport: { width: 1100, height: 720 },
        });
        await page.setContent('<button id="trigger">Open</button>');
        await page.addScriptTag({ content: script });
        await page.locator("#trigger").focus();
        await page.evaluate(() =>
            window.openTestDialog({
                type: "prompt",
                message: "Width",
                defaultValue: "30",
            }),
        );
        const input = page.locator(".opd_dialog_input");
        await input.waitFor();
        assert.equal(
            await input.evaluate((el) => document.activeElement === el),
            true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
            await page
                .locator(".opd_dialog_primary")
                .evaluate((el) => document.activeElement === el),
            true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
            await input.evaluate((el) => document.activeElement === el),
            true,
        );
        await input.fill("45");
        await input.dispatchEvent("keydown", {
            key: "Enter",
            isComposing: true,
        });
        assert.equal(await page.locator(".opd_dialog").count(), 1);
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => window.result === "45");
        assert.equal(
            await page
                .locator("#trigger")
                .evaluate((el) => document.activeElement === el),
            true,
        );
        await page.evaluate(() =>
            window.openTestDialog({ type: "confirm", message: "Delete?" }),
        );
        const cancel = page.getByRole("button", {
            name: "Cancel",
            exact: true,
        });
        await cancel.waitFor();
        await cancel.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => window.result === false);
        await page.evaluate(() => {
            window.openTestDialog({ type: "alert", message: "First" });
            window.second = open_opd_dialog({
                type: "prompt",
                message: "Second",
            });
        });
        await page
            .locator(".opd_dialog_message")
            .filter({ hasText: "First" })
            .waitFor();
        assert.equal(await page.locator(".opd_dialog").count(), 1);
        await page.getByRole("button", { name: "OK", exact: true }).click();
        await page.locator(".opd_dialog_input").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => window.second), null);
        for (const width of [360, 1100]) {
            await page.setViewportSize({ width, height: 640 });
            await page.evaluate(() =>
                window.openTestDialog({
                    type: "prompt",
                    message: "Enter a URL",
                    defaultValue: "https://x.com/i/bookmarks",
                }),
            );
            await input.waitFor();
            const rects = await page.evaluate(() => {
                const dialog = document
                    .querySelector(".opd_dialog")
                    .getBoundingClientRect();
                const input = document
                    .querySelector(".opd_dialog_input")
                    .getBoundingClientRect();
                return {
                    left: dialog.left,
                    right: dialog.right,
                    inputRight: input.right,
                    width: innerWidth,
                };
            });
            assert.ok(
                rects.left >= 0 &&
                    rects.right <= rects.width &&
                    rects.inputRight <= rects.right,
                JSON.stringify(rects),
            );
            await page.keyboard.press("Escape");
            await page.locator(".opd_dialog").waitFor({ state: "detached" });
            await page.evaluate(() => {
                window.aboutResult = window.openTestAbout();
            });
            await page.locator(".opd_about_dialog").waitFor();
            await page.keyboard.press("Escape");
            await page.evaluate(() => window.aboutResult);
        }
        console.log(
            `${engine}: dialog focus, submit/cancel, IME, queue, responsive bounds, and About dismissal passed`,
        );
    } finally {
        await browser.close();
    }
}
