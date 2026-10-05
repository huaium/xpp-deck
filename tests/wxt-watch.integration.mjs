import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import console from "node:console";
import { setTimeout } from "node:timers/promises";
import { createServer } from "wxt";
import { trashPaths } from "../utils/trash.mjs";

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "xpp-wxt-watch-"));
let server;
async function waitFor(predicate) {
    const deadline = Date.now() + 20000;
    while (!(await predicate())) {
        if (Date.now() > deadline)
            throw new Error("Timed out waiting for WXT rebuild");
        await setTimeout(100);
    }
}
try {
    for (const file of [
        "src",
        "entrypoints",
        "public",
        "utils/trash.mjs",
        "wxt.config.mjs",
        "package.json",
        "LICENSE",
        "LICENSE.original",
    ]) {
        await fs.mkdir(path.dirname(path.join(fixture, file)), {
            recursive: true,
        });
        await fs.cp(file, path.join(fixture, file), { recursive: true });
    }
    await fs.symlink(
        path.resolve("node_modules"),
        path.join(fixture, "node_modules"),
        "dir",
    );
    server = await createServer({
        root: fixture,
        browser: "chrome",
        webExt: { disabled: true },
        dev: { server: { port: 31987 } },
    });
    await server.start();
    const source = path.join(fixture, "src/content/index.ts");
    const output = path.join(
        fixture,
        ".output/chrome-mv3-dev/content-scripts/deck.js",
    );
    const original = await fs.readFile(source, "utf8");
    const previous = await fs.readFile(output, "utf8");
    await fs.writeFile(source, "const invalid = ;");
    await setTimeout(1500);
    assert.equal(await fs.readFile(output, "utf8"), previous);
    await fs.writeFile(
        source,
        original + '\nconsole.log("watch-recovered");\n',
    );
    await waitFor(async () =>
        (await fs.readFile(output, "utf8")).includes("watch-recovered"),
    );
    await fs.writeFile(path.join(fixture, "public/watch-probe.txt"), "first");
    await waitFor(async () => {
        try {
            return (
                (await fs.readFile(
                    path.join(
                        fixture,
                        ".output/chrome-mv3-dev/watch-probe.txt",
                    ),
                    "utf8",
                )) === "first"
            );
        } catch {
            return false;
        }
    });
    await server.stop();
    server = null;
    console.log(
        "WXT watch integration passed: rebuild, error recovery, public assets, shutdown.",
    );
} finally {
    await server?.stop();
    await trashPaths([fixture]);
}
