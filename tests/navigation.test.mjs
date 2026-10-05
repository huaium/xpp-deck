import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("custom columns accept X paths and URLs while rejecting foreign hosts", () => {
    const { normalize_custom_x_path: normalize } = loadFunctions(
        "../src/content/run.ts",
        ["normalize_custom_x_path"],
    );
    for (const [input, expected] of [
        [" /i/bookmarks ", "/i/bookmarks"],
        ["https://twitter.com/home", "/home"],
        ["www.x.com/search?q=hello#results", "/search?q=hello"],
        ["x.com", "/home"],
        ["someone/lists", "/someone/lists"],
        ["https://example.com/home", null],
        ["https://x.com.example.com/home", null],
        ["https://x.com@example.com/home", null],
        ["https://[invalid", null],
        ["", null],
        [null, null],
    ]) {
        assert.equal(normalize(input), expected, String(input));
    }
});

test("sidebar state updates both classes and localized action labels", () => {
    const states = new Map();
    const root = {
        classList: { toggle: (key, value) => states.set(key, value) },
    };
    const toggle = {
        classList: { toggle: (key, value) => states.set(key, value) },
    };
    const label = {};
    const { apply_sidebar_collapsed_state: apply } = loadFunctions(
        "../src/content/run.ts",
        ["apply_sidebar_collapsed_state"],
        "",
        {
            opd_main_root: root,
            sidebar_toggle_root: toggle,
            sidebar_toggle_text: label,
            i18n_message: (key) => key,
        },
    );
    for (const collapsed of [true, false]) {
        apply(collapsed);
        assert.equal(states.get("opd_sidebar_collapsed"), collapsed);
        assert.equal(states.get("opd_sidebar_toggle_is_collapsed"), collapsed);
        assert.equal(
            toggle.title,
            collapsed ? "ui_sidebar_expand_title" : "ui_sidebar_collapse_title",
        );
        assert.equal(
            label.textContent,
            collapsed ? "ui_sidebar_expand_label" : "ui_sidebar_collapse_label",
        );
    }
});

test("language selection saves changes before reload and ignores unchanged values", () => {
    class Select {}
    for (const language of ["browser", "ja", "en"]) {
        const writes = [];
        let reloads = 0;
        const { language_select_handler: change } = loadFunctions(
            "../src/content/run.ts",
            ["language_select_handler"],
            "",
            {
                HTMLSelectElement: Select,
                opd_i18n_language: "browser",
                request_page_reload: () => {
                    reloads++;
                },
                chrome: {
                    storage: {
                        local: {
                            set(value, done) {
                                writes.push(value);
                                assert.equal(reloads, 0);
                                done();
                            },
                        },
                    },
                },
            },
        );
        const select = new Select();
        select.value = language;
        change({ currentTarget: select });
        assert.equal(reloads, language === "browser" ? 0 : 1);
        assert.equal(writes.length, reloads);
        if (writes.length)
            assert.equal(writes[0].opd_language_override, language);
    }
});
