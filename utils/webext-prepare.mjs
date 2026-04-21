import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareConfig } from "./webext-prepare.config.mjs";

const compiledOutDir = "build/ts-out";
const sourceDir = prepareConfig.sourceDir;
const outputDir = prepareConfig.outputDir;
const rsyncArgs = [
    "-a",
    ...prepareConfig.rsyncExcludes.flatMap((pattern) => [
        `--exclude=${pattern}`,
    ]),
    `${sourceDir}/`,
    `${outputDir}/`,
];

await fs.mkdir(".webext-profile", { recursive: true });
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

execFileSync("rsync", rsyncArgs, { stdio: "inherit" });

const firefoxManifestPath = path.join(
    outputDir,
    prepareConfig.firefoxManifestFile,
);
const outputManifestPath = path.join(
    outputDir,
    prepareConfig.outputManifestFile,
);
await fs.copyFile(firefoxManifestPath, outputManifestPath);

async function copyCompiledJsIfPresent() {
    const compiledSrcDir = path.join(compiledOutDir, "src");
    try {
        await fs.access(compiledSrcDir);
    } catch {
        return;
    }

    async function walkAndCopy(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkAndCopy(fullPath);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith(".js")) {
                continue;
            }

            const relativePath = path.relative(compiledOutDir, fullPath);
            const targetPath = path.join(outputDir, relativePath);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.copyFile(fullPath, targetPath);
        }
    }

    await walkAndCopy(compiledSrcDir);
}

await copyCompiledJsIfPresent();
