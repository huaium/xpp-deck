import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { URL } from "node:url";

test("project links and installation documentation use the XPP-Deck repository", () => {
    const root = new URL("../", import.meta.url);
    const source = readFileSync(
        new URL("src/content/prelude.ts", root),
        "utf8",
    );
    const readme = readFileSync(new URL("README.md", root), "utf8");
    const config = readFileSync(new URL("wxt.config.mjs", root), "utf8");
    assert.equal((config.match(/id: "xpp-deck@huaium"/g) ?? []).length, 2);
    for (const content of [source, readme, config])
        assert.doesNotMatch(content, /open-?deck|run-opdeck/i);
    assert.ok(source.includes('href="https://github.com/huaium/xpp-deck"'));
    assert.ok(
        source.includes('href="https://github.com/huaium/xpp-deck/releases"'),
    );
    assert.ok(
        source.includes('"https://github.com/huaium/xpp-deck/releases/tag/v"'),
    );
    assert.ok(readme.includes("https://github.com/huaium/xpp-deck/releases"));
    assert.ok(readme.includes('src="public/icons/logo_icon.svg"'));
    assert.ok(readme.includes('srcset="docs/logo-dark.svg"'));
    assert.ok(readme.includes('media="(prefers-color-scheme: dark)"'));
    assert.ok(existsSync(new URL("public/icon.png", root)));
    assert.ok(existsSync(new URL("LICENSE.original", root)));
});
