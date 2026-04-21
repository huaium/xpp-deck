import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareConfig } from "./webext-prepare.config.mjs";

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
