import path from "node:path";

export default {
    sourceDir: "build/web-ext-firefox-src",
    run: {
        firefoxProfile: path.resolve(".webext-profile"),
        keepProfileChanges: true,
        startUrl: ["https://x.com/run-opdeck"],
    },
    verbose: false,
};
