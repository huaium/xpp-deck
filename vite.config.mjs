import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

export const extensionEntries = {
    content: "src/content/index.ts",
    guard: "src/content/reload_guard.ts",
    background: "src/background.ts",
    popup: "src/popup/popup.ts",
    refreshHelper: "src/extensions/auto_reload_helper.ts",
    mediaHelper: "src/extensions/media_viewer_block_helper.ts",
};

export const assetRoots = [
    "public",
    "_locales",
    "icon.png",
    "src/popup/popup.html",
    "manifest.json",
    "manifest_firefox.json",
    "LICENSE",
    "LICENSE.original",
];

export function extensionConfig(name, { watch = false, onBundle } = {}) {
    const entry = extensionEntries[name];
    if (!entry) throw new Error(`Unknown extension entry: ${name}`);
    return defineConfig({
        configFile: false,
        publicDir: false,
        plugins: [
            {
                name: "extension-assets",
                buildStart() {
                    if (name !== "content") return;
                    const collect = (relative) => {
                        const file = path.resolve(relative);
                        this.addWatchFile(file);
                        if (fs.statSync(file).isDirectory()) {
                            for (const child of fs.readdirSync(file)) {
                                if (!child.startsWith("."))
                                    collect(`${relative}/${child}`);
                            }
                        } else {
                            this.emitFile({
                                type: "asset",
                                fileName: relative,
                                source: fs.readFileSync(file),
                            });
                        }
                    };
                    assetRoots.forEach(collect);
                },
                generateBundle(_options, bundle) {
                    onBundle?.(
                        Object.values(bundle).map((item) => ({
                            fileName: item.fileName,
                            source:
                                item.type === "chunk" ? item.code : item.source,
                        })),
                    );
                },
            },
        ],
        build: {
            target: "es2022",
            outDir: "build/vite",
            emptyOutDir: false,
            // Vite's watcher skips output generation entirely with write:false.
            // Watch output is staging only; publication happens after all builds succeed.
            write: watch,
            minify: false,
            sourcemap: watch,
            watch: watch ? {} : null,
            lib: {
                entry: path.resolve(entry),
                name: `XppDeck_${name}`,
                formats: ["iife"],
                fileName: () => entry.replace(/\.ts$/, ".js"),
            },
        },
    });
}

export default extensionConfig("content");
