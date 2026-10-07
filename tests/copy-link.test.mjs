import assert from "node:assert/strict";
import test from "node:test";
import { URL, URLSearchParams } from "node:url";
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
        ["bind_column_copy_links", "without_language_parameter"],
        "",
        {
            URL,
            URLSearchParams,
            document: { querySelectorAll: () => [button] },
            navigator: {
                clipboard: { writeText: async (value) => copied.push(value) },
            },
            i18n_message: (key) => key,
            xpd_alert: async (message) => messages.push(message),
        },
    );
    bind();
    url = "https://x.com/search?q=test";
    await handler();
    assert.deepEqual(copied, [url]);
    assert.deepEqual(messages, ["ui_column_link_copied"]);
    for (const [current, expected] of [
        ["https://x.com/home?lang=", "https://x.com/home"],
        [
            "https://x.com/search?lang=&q=a%20b&f=live#results",
            "https://x.com/search?q=a%20b&f=live#results",
        ],
        ["https://x.com/home?lang=en&lang=#top", "https://x.com/home#top"],
        [
            "https://x.com/search?q=lang%3Den&lang=ja",
            "https://x.com/search?q=lang%3Den",
        ],
    ]) {
        url = current;
        await handler();
        assert.equal(copied.at(-1), expected);
        assert.equal(url, current);
    }
});
