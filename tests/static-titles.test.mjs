import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("navigation saves the URL without reading or replacing page titles", () => {
    let onload;
    let onmutation;
    let saves = 0;
    const attributes = new Map([["opd_explore_title", "Search"], ["opd_custom_title", "Search"]]);
    const frame = {
        contentWindow: { location: { href: "https://x.com/explore" }, document: {
            get title() { throw new Error("Page titles must not be read"); },
        } },
        addEventListener: (event, handler) => { onload = handler; },
    };
    const { mutate_url } = loadFunctions("../src/content/run.ts", ["mutate_url"], "", {
        MutationObserver: class {
            constructor(handler) { onmutation = handler; }
            observe() {}
        },
        column_settings_save: () => { saves++; },
        last_load_profile: 0,
    });
    mutate_url({ querySelector: () => frame, setAttribute: (key, value) => attributes.set(key, value) });
    onload();
    frame.contentWindow.location.href = "https://x.com/search?q=test";
    onmutation();
    assert.equal(attributes.get("opd_explore_path"), "/search?q=test");
    assert.equal(attributes.get("opd_explore_title"), "Search");
    assert.equal(attributes.get("opd_custom_title"), "Search");
    assert.equal(saves, 1);
});

for (const title of [null, "   ", "  My Search  "]) {
    test(`custom URL title prompt handles ${JSON.stringify(title)}`, async () => {
        const prompts = ["https://x.com/search?q=test", title];
        const added = [];
        let alerts = 0;
        const { add_custom_url_button_handler } = loadFunctions("../src/content/run.ts", ["add_custom_url_button_handler", "normalize_custom_x_path"], "", {
            opd_prompt: async () => prompts.shift(),
            opd_alert: async () => { alerts++; },
            i18n_message: (key) => key,
            add_explore_column_with_path: (...args) => added.push(args),
        });
        await add_custom_url_button_handler();
        if (title?.trim()) assert.deepEqual(added, [["/search?q=test", "My Search"]]);
        else assert.equal(added.length, 0);
        assert.equal(alerts, title === "   " ? 1 : 0);
    });
}
