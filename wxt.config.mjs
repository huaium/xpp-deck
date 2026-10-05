import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { defineConfig } from "wxt";
import { trashPaths } from "./utils/trash.mjs";

const matches = ["https://*.twitter.com/*", "https://*.x.com/*"];
export default defineConfig({
    imports: false,
    manifest: ({ browser }) => ({
        name: "XPP-Deck",
        description: "The OpenSource Deck",
        default_locale: browser === "firefox" ? "ja" : "en",
        icons: { 128: "icon.png" },
        permissions: ["storage", "webRequest", "declarativeNetRequest"],
        host_permissions: [
            "*://*.twitter.com/*",
            "*://*.x.com/*",
            "*://*.twimg.com/*",
        ],
        ...(browser === "firefox"
            ? { browser_action: { default_icon: "icon.png" } }
            : { action: { default_icon: "icon.png" } }),
        ...(browser === "firefox"
            ? {
                  browser_specific_settings: {
                      gecko: {
                          id: "opd_release@kwdev",
                          strict_min_version: "115.0",
                      },
                      gecko_android: {
                          id: "opd_release@kwdev",
                          strict_min_version: "115.0",
                      },
                  },
              }
            : {}),
        web_accessible_resources: [
            {
                matches,
                resources: [
                    "icon.png",
                    "auto_reload_helper.js",
                    "media_viewer_block_helper.js",
                    "public/icons/*.svg",
                    "_locales/*/messages.json",
                ],
            },
        ],
    }),
    webExt: {
        binaries: { chrome: process.env.CHROMIUM_BINARY },
        chromiumArgs: ["--disable-infobars"],
        firefoxProfile: path.resolve(".wxt-profiles/firefox"),
        chromiumProfile: path.resolve(".wxt-profiles/chrome"),
        keepProfileChanges: true,
        startUrls: ["https://x.com/run-opdeck"],
    },
    vite: () => ({
        build: { target: "es2022", minify: false, sourcemap: true },
    }),
    hooks: {
        "server:started": async (wxt) => {
            if (wxt.config.webExt.config.disabled) return;
            const profile =
                wxt.config.browser === "firefox"
                    ? ".wxt-profiles/firefox"
                    : ".wxt-profiles/chrome";
            await fs.mkdir(path.resolve(profile), { recursive: true });
        },
        // WXT cleans its output after this hook; preserve previous output first.
        "build:before": async (wxt) => {
            await trashPaths([wxt.config.outDir]);
        },
        "build:publicAssets": async (_, assets) => {
            for (const asset of assets) {
                if (asset.relativeDest.startsWith("icons/"))
                    asset.relativeDest = "public/" + asset.relativeDest;
            }
            for (const file of ["LICENSE", "LICENSE.original"]) {
                assets.push({
                    absoluteSrc: path.resolve(file),
                    relativeDest: file,
                });
            }
        },
    },
});
