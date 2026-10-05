import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import console from "node:console";
import { setTimeout } from "node:timers/promises";
import { assetRoots } from "../vite.config.mjs";
import { watchExtensions, trashPaths } from "../utils/extension-build.mjs";

const root = process.cwd();
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "xpp-vite-watch-"));
let watcher;
let published = 0;
async function waitFor(predicate) {
    const deadline = Date.now() + 15000;
    while (!(await predicate())) {
        if (Date.now() > deadline)
            throw new Error("Timed out waiting for Vite watch update");
        await setTimeout(50);
    }
}
try {
    for (const file of new Set(["src", ...assetRoots])) {
        await fs.cp(path.join(root, file), path.join(fixture, file), {
            recursive: true,
        });
    }
    process.chdir(fixture);
    watcher = await watchExtensions(() => {
        published++;
    });
    await waitFor(() => published === 1);
    const output = "build/web-ext-firefox-src/src/popup/popup.js";
    const original = await fs.readFile("src/popup/popup.ts", "utf8");
    const previous = await fs.readFile(output, "utf8");
    await fs.writeFile("src/popup/popup.ts", "const invalid = ;");
    await setTimeout(1200);
    assert.equal(published, 1);
    assert.equal(await fs.readFile(output, "utf8"), previous);
    await fs.writeFile(
        "src/popup/popup.ts",
        `${original}\nconsole.log("watch-recovered");\n`,
    );
    await waitFor(() => published === 2);
    assert.match(await fs.readFile(output, "utf8"), /watch-recovered/);
    await fs.writeFile("public/watch-probe.txt", "first");
    await waitFor(() => published >= 3);
    assert.equal(
        await fs.readFile(
            "build/web-ext-firefox-src/public/watch-probe.txt",
            "utf8",
        ),
        "first",
    );
    const before = published;
    await trashPaths(["public/watch-probe.txt"]);
    await waitFor(() => published > before);
    await assert.rejects(
        fs.access("build/web-ext-firefox-src/public/watch-probe.txt"),
    );
    await watcher.close();
    watcher = null;
    const afterClose = published;
    await fs.writeFile("src/popup/popup.ts", original);
    await setTimeout(300);
    assert.equal(published, afterClose);
    console.log(
        "Vite watch integration passed: rebuilds, error recovery, asset additions/deletions, shutdown.",
    );
} finally {
    await watcher?.close();
    process.chdir(root);
    await trashPaths([fixture]);
}
