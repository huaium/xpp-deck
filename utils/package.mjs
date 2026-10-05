import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildExtensions, browserDirectories } from "./extension-build.mjs";

await buildExtensions();
const manifest = JSON.parse(await fs.readFile("manifest.json", "utf8"));
const version = manifest.version.replaceAll(".", "_");
const cli = fileURLToPath(
    new URL("./bin/web-ext.js", import.meta.resolve("web-ext")),
);
for (const [browser, source] of Object.entries(browserDirectories)) {
    const result = spawnSync(
        process.execPath,
        [
            cli,
            "build",
            "--source-dir",
            source,
            "--artifacts-dir",
            "build/package",
            "--filename",
            `XPP-Deck_${browser}_${version}.zip`,
            "--overwrite-dest",
            "--no-config-discovery",
        ],
        { stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Packaging ${browser} failed`);
}
