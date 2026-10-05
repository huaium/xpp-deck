import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("copy link reads the current column URL at click time", async () => {
    let handler;
    let url = "https://x.com/home";
    const copied = [];
    const messages = [];
    const button = {
        hasAttribute: () => false,
        setAttribute() {},
        addEventListener(_event, callback) {
            handler = callback;
        },
        closest: () => ({
            querySelector: () => ({
                contentWindow: {
                    location: {
                        get href() {
                            return url;
                        },
                    },
                },
            }),
        }),
    };
    const { bind_column_copy_links: bind } = loadFunctions(
        "../src/content/run.ts",
        ["bind_column_copy_links"],
        "",
        {
            document: { querySelectorAll: () => [button] },
            navigator: {
                clipboard: { writeText: async (value) => copied.push(value) },
            },
            i18n_message: (key) => key,
            opd_alert: async (message) => messages.push(message),
        },
    );
    bind();
    url = "https://x.com/search?q=test";
    await handler();
    assert.deepEqual(copied, [url]);
    assert.deepEqual(messages, ["ui_column_link_copied"]);
});
