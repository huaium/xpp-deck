import path from "node:path";

export default {
    sourceDir: "build/web-ext-firefox-src",
    run: {
        // Reload only after all bundles and assets have been synchronized.
        watchFile: [path.resolve("build/webext-reload")],
        firefoxProfile: path.resolve(".webext-profile"),
        keepProfileChanges: true,
        startUrl: ["https://x.com/run-opdeck"],
    },
    verbose: false,
};
