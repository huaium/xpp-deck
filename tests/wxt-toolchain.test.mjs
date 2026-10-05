import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { URL } from "node:url";
import config from "../wxt.config.mjs";

const root = new URL("../", import.meta.url);
test("Chrome development launches include the requested infobar flag", () => {
    assert.ok(config.webExt.chromiumArgs.includes("--disable-infobars"));
});

test("development and packaging expose only WXT commands", async () => {
    const pkg = JSON.parse(
        await fs.readFile(new URL("package.json", root), "utf8"),
    );
    assert.ok(
        !Object.keys(pkg.scripts).some((name) => name.startsWith("webext:")),
    );
    assert.ok(
        !Object.values(pkg.scripts).some((command) =>
            /\bweb-ext\b/.test(command),
        ),
    );
    assert.equal(pkg.scripts.dev, "wxt -b chrome");
    assert.equal(pkg.scripts["dev:firefox"], "wxt -b firefox --mv2");
    assert.equal(pkg.scripts.clean, "node utils/wxt-clean.mjs");
    assert.ok(
        pkg.devDependencies["web-ext"],
        "WXT needs its browser-runner peer",
    );
});

test("WXT profiles persist outside disposable build output", () => {
    assert.match(config.webExt.firefoxProfile, /\.wxt-profiles[/\\]firefox$/);
    assert.match(config.webExt.chromiumProfile, /\.wxt-profiles[/\\]chrome$/);
    assert.equal(config.webExt.keepProfileChanges, true);
});

test("release workflow packages and uploads WXT artifacts", async () => {
    const workflow = await fs.readFile(
        new URL(".github/workflows/release.yml", root),
        "utf8",
    );
    assert.match(workflow, /pnpm install --frozen-lockfile/);
    assert.match(workflow, /pnpm run build/);
    assert.match(workflow, /\.\/\.output\/\*\.zip/);
    assert.match(workflow, /trash-cli/);
    assert.doesNotMatch(workflow, /package\.sh|\.\/package\//);
});

test("formatter and linter ignore generated WXT output and browser data", async () => {
    const prettier = await fs.readFile(
        new URL(".prettierignore", root),
        "utf8",
    );
    for (const directory of [".wxt/", ".output/", ".wxt-profiles/"])
        assert.ok(prettier.includes(directory));
    const clean = await fs.readFile(
        new URL("utils/wxt-clean.mjs", root),
        "utf8",
    );
    assert.doesNotMatch(clean, /wxt-profiles/);
});
