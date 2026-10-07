import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";
import { loadFunctions } from "./helpers/source.mjs";

test("column titles rename through click and keyboard without touching frames", async () => {
    for (const [input, connected, expected] of [
        ["  My Feed  ", true, "My Feed"],
        [null, true, "Home"],
        ["   ", true, "Home"],
        ["Home", true, "Home"],
        ["New", false, "Home"],
    ]) {
        const attributes = new Map();
        const handlers = new Map();
        const column = {
            setAttribute: (key, value) => attributes.set(key, value),
        };
        const title = {
            textContent: "Home",
            isConnected: connected,
            style: {},
            hasAttribute: (key) => attributes.has(key),
            setAttribute: (key, value) => attributes.set(key, value),
            closest: () => column,
            addEventListener: (name, fn) => handlers.set(name, fn),
        };
        let saves = 0;
        let prompts = 0;
        const { column_rename } = loadFunctions(
            "../src/content/run.ts",
            ["column_rename"],
            "",
            {
                document: { querySelectorAll: () => [title] },
                last_load_profile: 0,
                column_settings_save: () => saves++,
                i18n_message_or_fallback: (_key, fallback) => fallback,
                xpd_prompt: async (_message, value) => {
                    prompts++;
                    assert.equal(value, "Home");
                    return input;
                },
            },
        );
        column_rename();
        column_rename();
        assert.equal(attributes.get("role"), "button");
        assert.equal(attributes.get("tabindex"), "0");
        assert.equal(attributes.get("draggable"), "false");
        handlers.get("keydown")({
            key: "Enter",
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise(setImmediate);
        assert.equal(title.textContent, expected);
        assert.equal(saves, expected === "Home" ? 0 : 1);
        assert.equal(prompts, 1);
        if (expected !== "Home")
            assert.equal(attributes.get("xpd_custom_title"), expected);
        assert.ok(handlers.has("click"));
    }
});

test("custom titles serialize independently of Explore navigation titles", () => {
    for (const type of ["home", "explore", "post", "notification"]) {
        const attributes = {
            xpd_column_type: type,
            xpd_custom_title: "<My Column>",
            xpd_explore_title: "Detected title",
        };
        const { column_settings_save } = loadFunctions(
            "../src/content/run.ts",
            ["column_settings_save"],
            "",
            {
                document: {
                    querySelectorAll: () => [
                        {
                            getAttribute: (key) => attributes[key] ?? null,
                            querySelector: () => null,
                        },
                    ],
                },
                last_load_profile: 0,
                manifest: { version: "1" },
            },
        );
        const saved = column_settings_save("profile_out").column_settings[0];
        assert.equal(saved.custom_title, "<My Column>");
        assert.equal(
            saved.column_save_title,
            type === "explore" ? "Detected title" : null,
        );
    }
});
