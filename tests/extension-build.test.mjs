import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, URL } from "node:url";

const execute = promisify(execFile);
const cli = fileURLToPath(
    new URL("../node_modules/wxt/bin/wxt.mjs", import.meta.url),
);

test("WXT builds complete Chrome MV3 and Firefox MV2 distributions", async () => {
    for (const browser of ["chrome", "firefox"]) {
        await execute(process.execPath, [
            cli,
            "build",
            "-b",
            browser,
            ...(browser === "firefox" ? ["--mv2"] : []),
        ]);
        const root =
            ".output/" + browser + (browser === "firefox" ? "-mv2" : "-mv3");
        const manifest = JSON.parse(
            await fs.readFile(path.join(root, "manifest.json"), "utf8"),
        );
        assert.equal(manifest.manifest_version, browser === "firefox" ? 2 : 3);
        assert.equal(manifest.version, "0.1.0");
        assert.equal(
            manifest.action?.default_popup ??
                manifest.browser_action?.default_popup,
            "popup.html",
        );
        const early = manifest.content_scripts.find(
            (entry) => entry.run_at === "document_start",
        );
        const deck = manifest.content_scripts.find(
            (entry) => entry.run_at === "document_idle",
        );
        assert.deepEqual(early.js, ["content-scripts/guard.js"]);
        assert.deepEqual(deck.js, ["content-scripts/deck.js"]);
        const background =
            manifest.background.service_worker ??
            manifest.background.scripts[0];
        for (const file of [
            ...early.js,
            ...deck.js,
            background,
            "auto_reload_helper.js",
            "media_viewer_block_helper.js",
        ]) {
            const source = await fs.readFile(path.join(root, file), "utf8");
            assert.doesNotThrow(() => new vm.Script(source), file);
            assert.doesNotMatch(source, /\bimport\s*\(/, file);
        }
        for (const locale of [
            "en",
            "ja",
            "zh_CN",
            "zh_TW",
            "ko",
            "es",
            "fr",
            "de",
            "pt_BR",
        ]) {
            await fs.access(
                path.join(root, "_locales", locale, "messages.json"),
            );
        }
        for (const file of [
            "icon.png",
            "public/icons/column_close.svg",
            "popup.html",
            "LICENSE",
            "LICENSE.original",
        ]) {
            await fs.access(path.join(root, file));
        }
        const resources =
            manifest.manifest_version === 2
                ? manifest.web_accessible_resources
                : manifest.web_accessible_resources.flatMap(
                      (entry) => entry.resources,
                  );
        for (const resource of [
            "auto_reload_helper.js",
            "media_viewer_block_helper.js",
            "public/icons/*.svg",
            "_locales/*/messages.json",
        ])
            assert.ok(resources.includes(resource));
        if (browser === "firefox") {
            assert.equal(
                manifest.browser_specific_settings.gecko.id,
                "opd_release@kwdev",
            );
            assert.ok(manifest.permissions.includes("*://*.x.com/*"));
        }
    }
});
