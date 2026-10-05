import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

const { api_quota_state } = loadFunctions("../src/content/prelude.ts", ["api_quota_state"]);

test("API quota validates missing and invalid data", () => {
    for (const value of [undefined, { limit: null, remaining: 0 }, { limit: 0, remaining: 0 }, { limit: "bad", remaining: 3 }, { limit: 500, remaining: -1 }]) {
        assert.equal(api_quota_state(value), null);
    }
});

test("API quota displays remaining percentage and threshold colors", () => {
    assert.equal(api_quota_state({ limit: "500", remaining: "492" }).percentage, 98.4);
    for (const [remaining, level] of [[51, "green"], [50, "amber"], [20, "amber"], [19, "red"], [0, "red"]]) {
        assert.equal(api_quota_state({ limit: 100, remaining }).level, level);
    }
    assert.equal(api_quota_state({ limit: 100, remaining: 200 }).percentage, 100);
});

test("API cards show unknown data, update live, and release their listener", async () => {
    class Element {
        children = [];
        dataset = {};
        style = {};
        attributes = {};
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.append(child); }
        replaceChildren() { this.children = []; }
        setAttribute(key, value) { this.attributes[key] = value; }
    }
    const dialog = new Element();
    let listener;
    let cleanup;
    const { open_api_limits_dialog } = loadFunctions("../src/content/prelude.ts", ["api_quota_state", "open_api_limits_dialog"], "let api_limit_obj = null;", {
        document: { createElement: () => new Element() },
        i18n_message: (key, values = []) => `${key}:${values.join("/")}`,
        open_opd_dialog: (options) => { cleanup = options.mount(dialog); },
        chrome: { storage: { onChanged: {
            addListener: (value) => { listener = value; },
            removeListener: (value) => { assert.equal(value, listener); listener = null; },
        } } },
    });
    await open_api_limits_dialog();
    const cards = dialog.children[1];
    assert.equal(cards.children.length, 3);
    assert.equal(cards.children[0].children[0].children[1].textContent, "ui_api_no_data:");
    listener({ api_access_limit: { newValue: { recommend_timeline: { limit: 500, remaining: 492, reset_unix_time: 1800000000 } } } });
    const card = cards.children[1];
    assert.equal(card.children[0].children[1].textContent, "ui_api_percent_left:98");
    assert.equal(card.children[1].attributes["aria-valuenow"], "492");
    assert.equal(card.children[1].children[0].style.width, "98.4%");
    assert.equal(card.children[2].textContent, "ui_api_remaining:492/500");
    assert.ok(card.children[3].textContent.startsWith("ui_api_reset:"));
    cleanup();
    assert.equal(listener, null);
});
