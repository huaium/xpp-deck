import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

const { AbortController } = globalThis;

test("deck disposal releases its active lifecycle exactly once", () => {
    let disposed = 0;
    const { dispose_deck } = loadFunctions(
        "../src/content/run.ts",
        ["dispose_deck"],
        "let opd_column_load_scheduler = scheduler;",
        {
            scheduler: { dispose: () => disposed++ },
        },
    );
    dispose_deck();
    dispose_deck();
    assert.equal(disposed, 1);
});

test("content-script teardown disposes deck resources as well as the session gate", async () => {
    const cleaned = [];
    const { start_content } = loadFunctions(
        "../src/content/index.ts",
        ["start_content"],
        "",
        {
            AbortController,
            location: { href: "https://x.com/run-xppdeck" },
            is_deck_location: () => true,
            ensure_dropdown_style() {},
            mount_webawesome_controls: () => () => cleaned.push("controls"),
            keep_deck_tab_title: () => () => cleaned.push("title"),
            chrome: { runtime: { getURL: (url) => url } },
            mount_session_gate: () => ({
                check() {},
                dispose: () => cleaned.push("gate"),
            }),
            i18n_message_or_fallback() {},
            request_page_reload() {},
            initialize_i18n_override: async () => {},
            dispose_deck: () => cleaned.push("deck"),
        },
    );
    const stop = start_content();
    await Promise.resolve();
    stop();
    stop();
    assert.deepEqual(cleaned, ["gate", "deck", "title", "controls"]);
});
