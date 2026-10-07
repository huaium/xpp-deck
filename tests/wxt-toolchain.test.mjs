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
    assert.match(workflow, /require-lockfile: true/);
    assert.match(workflow, /push:\s+tags:\s+- "v\*"/);
    assert.match(workflow, /workflow_dispatch:\s+inputs:\s+tag_name:/);
    assert.ok(
        workflow.includes(
            "TAG_NAME: ${{ github.event.inputs.tag_name || github.ref_name }}",
        ),
    );
    assert.doesNotMatch(workflow, /run: pnpm install/);
    assert.match(workflow, /pnpm run build/);
    for (const browser of ["chrome", "firefox"]) {
        assert.ok(workflow.includes(`.output/*-${browser}.zip`));
        assert.ok(workflow.includes(`./.output/*-${browser}.zip`));
    }
    assert.doesNotMatch(workflow, /\.output\/\*\.zip/);
    assert.doesNotMatch(workflow, /package\.sh|\.\/package\//);
    assert.deepEqual(
        [...workflow.matchAll(/uses: (\S+)/g)].map((match) => match[1]),
        [
            "actions/checkout@v7",
            "actions/setup-node@v7",
            "pnpm/setup@v3",
            "actions/upload-artifact@v7",
            "actions/download-artifact@v8",
        ],
    );
    const pkg = JSON.parse(
        await fs.readFile(new URL("package.json", root), "utf8"),
    );
    assert.match(pkg.scripts.build, /wxt zip -b chrome/);
    assert.match(pkg.scripts.build, /wxt zip -b firefox --mv2/);
    assert.match(workflow, /publish:\s+needs: build/);
    assert.match(workflow, /environment:\s+name: release/);
    assert.ok(workflow.includes('$GITHUB_STEP_SUMMARY'));
    assert.match(workflow, /cat release_notes\.md/);
    assert.match(workflow, /include-hidden-files: true/);
    assert.doesNotMatch(workflow, /--draft/);
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
