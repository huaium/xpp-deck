import fs from "node:fs/promises";

for (const directory of [".output", ".wxt", "build"]) {
    await fs.rm(directory, { recursive: true, force: true });
}
