import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { URL } from "node:url";
import { setTimeout } from "node:timers/promises";
import { build } from "vite";
import { extensionConfig, extensionEntries } from "../vite.config.mjs";
import {
    browserArtifacts,
    createPublishQueue,
} from "../utils/extension-build.mjs";

test("Vite produces standalone classic scripts and complete browser distributions", async () => {
    const artifacts = [];
    for (const name of Object.keys(extensionEntries)) {
        const config = extensionConfig(name, {
            onBundle: (output) => artifacts.push(...output),
        });
        config.logLevel = "silent";
        await build(config);
    }
    for (const artifact of artifacts.filter((item) =>
        item.fileName.endsWith(".js"),
    )) {
        assert.doesNotThrow(() => new vm.Script(artifact.source));
        assert.doesNotMatch(artifact.source, /\bimport\s*\(/);
    }
    for (const browser of ["firefox", "chromium"]) {
        const files = new Map(
            browserArtifacts(artifacts, browser).map((item) => [
                item.fileName,
                item.source,
            ]),
        );
        const manifest = JSON.parse(files.get("manifest.json"));
        assert.equal(manifest.manifest_version, browser === "firefox" ? 2 : 3);
        const scripts = manifest.content_scripts.flatMap((entry) => entry.js);
        assert.deepEqual(scripts, [
            "src/content/reload_guard.js",
            "src/content/index.js",
        ]);
        const resources =
            browser === "firefox"
                ? manifest.web_accessible_resources
                : manifest.web_accessible_resources.flatMap(
                      (entry) => entry.resources,
                  );
        for (const file of [
            ...scripts,
            ...resources,
            "src/background.js",
            "src/popup/popup.html",
            "src/popup/popup.js",
        ]) {
            assert.ok(files.has(file), `Missing ${browser} resource ${file}`);
        }
        assert.ok(files.has("_locales/en/messages.json"));
        assert.ok(!files.has("package.json"));
        assert.ok(!files.has("manifest_firefox.json"));
        const context = {
            URL,
            console: { log() {} },
            location: { href: "https://x.com/home" },
            document: { addEventListener() {} },
            window: { matchMedia: () => ({ matches: false }) },
            chrome: {
                runtime: { getManifest: () => ({ version: "1" }) },
                storage: { local: { get(key, callback) { callback({}); } }, onChanged: { addListener() {} } },
            },
        };
        assert.doesNotThrow(() =>
            vm.runInNewContext(files.get("src/content/index.js"), context),
        );
    }
});

test("watch publication is debounced and waits for successful builds of every entry", async () => {
    const published = [];
    const queue = createPublishQueue(
        async (artifacts) => published.push(artifacts),
        5,
    );
    const names = Object.keys(extensionEntries);
    for (const name of names) {
        queue.event(name, { code: "START" });
        queue.output(name, [{ fileName: `${name}.js`, source: "good" }]);
        queue.event(name, { code: "BUNDLE_END" });
    }
    queue.event(names[0], { code: "START" });
    queue.event(names[0], { code: "ERROR" });
    await setTimeout(30);
    assert.equal(published.length, 0);
    queue.event(names[0], { code: "START" });
    queue.event(names[0], { code: "BUNDLE_END" });
    await setTimeout(30);
    assert.equal(published.length, 1);
    assert.equal(published[0].length, names.length);
    for (let i = 0; i < 3; i++) {
        queue.event(names[0], { code: "START" });
        queue.event(names[0], { code: "BUNDLE_END" });
    }
    await setTimeout(30);
    assert.equal(published.length, 2);
    queue.event(names[0], { code: "BUNDLE_END" });
    await queue.close();
    await setTimeout(30);
    assert.equal(published.length, 2);
});
