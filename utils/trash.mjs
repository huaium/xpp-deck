import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
export async function trashPaths(paths) {
    const existing = [];
    for (const file of paths) {
        try {
            await fs.access(file);
            existing.push(file);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }
    if (existing.length) {
        await execute("trash", existing);
    }
}
