import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { watchExtensions } from "./extension-build.mjs";

let runner;
let closing;
await fs.mkdir(".webext-profile", { recursive: true });
const watcher = await watchExtensions(() => {
    if (runner || closing) return;
    const cli = fileURLToPath(
        new URL("./bin/web-ext.js", import.meta.resolve("web-ext")),
    );
    runner = spawn(
        process.execPath,
        [cli, "run", "--config=web-ext-config.mjs"],
        { stdio: "inherit" },
    );
    runner.on("error", (error) => {
        console.error(error);
        void shutdown(1);
    });
    runner.on("exit", (code) => {
        void shutdown(code ?? 0);
    });
});

function shutdown(code = 0) {
    if (closing) return closing;
    closing = watcher.close().then(() => {
        if (runner && runner.exitCode === null) runner.kill("SIGINT");
        process.exitCode = code;
    });
    return closing;
}
process.on("SIGINT", () => {
    void shutdown();
});
process.on("SIGTERM", () => {
    void shutdown();
});
