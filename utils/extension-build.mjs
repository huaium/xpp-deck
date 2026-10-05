import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "vite";
import { extensionConfig, extensionEntries } from "../vite.config.mjs";

const execute = promisify(execFile);
export const browserDirectories = {
    firefox: "build/web-ext-firefox-src",
    chromium: "build/web-ext-chromium-src",
};
export const reloadMarker = "build/webext-reload";

export async function trashPaths(paths) {
    if (!paths.length) return;
    try {
        await execute("trash", paths);
    } catch (error) {
        throw new Error(
            "Could not move obsolete build files to trash. Ensure the trash command is available and has permission before continuing.",
            { cause: error },
        );
    }
}

async function filesUnder(directory) {
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        const files = await Promise.all(
            entries.map(async (entry) => {
                const file = path.join(directory, entry.name);
                return entry.isDirectory() ? filesUnder(file) : [file];
            }),
        );
        return files.flat();
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

export function browserArtifacts(artifacts, browser) {
    const manifestName =
        browser === "firefox" ? "manifest_firefox.json" : "manifest.json";
    return artifacts
        .filter(
            (item) =>
                !item.fileName.startsWith("manifest") ||
                item.fileName === manifestName,
        )
        .map((item) => ({
            ...item,
            fileName:
                item.fileName === manifestName
                    ? "manifest.json"
                    : item.fileName,
        }));
}

export async function publishArtifacts(
    artifacts,
    directories = browserDirectories,
) {
    for (const [browser, directory] of Object.entries(directories)) {
        const selected = browserArtifacts(artifacts, browser);
        const wanted = new Set(
            selected.map((item) => path.resolve(directory, item.fileName)),
        );
        const stale = (await filesUnder(directory)).filter(
            (file) => !wanted.has(path.resolve(file)),
        );
        await trashPaths(stale);
        for (const item of selected) {
            const file = path.join(directory, item.fileName);
            const bytes = Buffer.from(item.source);
            let current;
            try {
                current = await fs.readFile(file);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
            if (current?.equals(bytes)) continue;
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, bytes);
        }
    }
}

export async function buildExtensions() {
    const artifacts = [];
    for (const name of Object.keys(extensionEntries)) {
        await build(
            extensionConfig(name, {
                onBundle: (output) => artifacts.push(...output),
            }),
        );
    }
    await publishArtifacts(artifacts);
    return artifacts;
}

// Coalesce completed builds; never publish while another entry is building or failing.
export function createPublishQueue(publish, delay = 200) {
    const active = new Set();
    const failed = new Set();
    const ready = new Set();
    const outputs = new Map();
    let timer;
    let running = Promise.resolve();
    let stopped = false;
    const schedule = () => {
        clearTimeout(timer);
        if (
            stopped ||
            active.size ||
            failed.size ||
            ready.size !== Object.keys(extensionEntries).length
        )
            return;
        timer = setTimeout(() => {
            running = running
                .then(async () => {
                    if (stopped || active.size || failed.size) return;
                    await publish([...outputs.values()].flat());
                })
                .catch((error) =>
                    console.error("Extension sync failed:", error),
                );
        }, delay);
    };
    return {
        output(name, artifacts) {
            outputs.set(name, artifacts);
        },
        event(name, event) {
            if (event.code === "START") {
                active.add(name);
                clearTimeout(timer);
            }
            if (event.code === "ERROR") {
                active.delete(name);
                failed.add(name);
            }
            if (event.code === "BUNDLE_END") {
                active.delete(name);
                failed.delete(name);
                ready.add(name);
                schedule();
            }
        },
        async close() {
            stopped = true;
            clearTimeout(timer);
            await running;
        },
    };
}

export async function watchExtensions(onPublished = () => {}) {
    const watchers = [];
    const queue = createPublishQueue(async (artifacts) => {
        await publishArtifacts(artifacts);
        await fs.writeFile(reloadMarker, String(Date.now()));
        console.log(
            "Extension rebuilt. Refresh the X page to apply content-script changes.",
        );
        await onPublished();
    });
    try {
        for (const name of Object.keys(extensionEntries)) {
            const watcher = await build(
                extensionConfig(name, {
                    watch: true,
                    onBundle: (output) => queue.output(name, output),
                }),
            );
            watchers.push(watcher);
            watcher.on("event", (event) => {
                queue.event(name, event);
                if (event.code === "ERROR")
                    console.error(
                        "Build failed; keeping the last working extension.",
                        event.error,
                    );
            });
        }
    } catch (error) {
        await queue.close();
        await Promise.all(watchers.map((watcher) => watcher.close()));
        throw error;
    }
    return {
        async close() {
            await queue.close();
            await Promise.all(watchers.map((watcher) => watcher.close()));
        },
    };
}
