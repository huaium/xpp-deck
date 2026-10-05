import fs from "node:fs/promises";
import {
    browserDirectories,
    reloadMarker,
    trashPaths,
} from "./extension-build.mjs";

const existing = [];
for (const file of [...Object.values(browserDirectories), reloadMarker]) {
    try {
        await fs.access(file);
        existing.push(file);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}
await trashPaths(existing);
