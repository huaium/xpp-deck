import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

const { api_quota_state } = loadFunctions("../src/content/prelude.ts", [
    "api_quota_state",
]);

test("API quota validates missing and invalid data", () => {
    for (const value of [
        undefined,
        { limit: null, remaining: 0 },
        { limit: 0, remaining: 0 },
        { limit: "bad", remaining: 3 },
        { limit: 500, remaining: -1 },
    ]) {
        assert.equal(api_quota_state(value), null);
    }
});

test("API quota displays remaining percentage and threshold colors", () => {
    assert.equal(
        api_quota_state({ limit: "500", remaining: "492" }).percentage,
        98.4,
    );
    for (const [remaining, level] of [
        [51, "green"],
        [50, "amber"],
        [20, "amber"],
        [19, "red"],
        [0, "red"],
    ]) {
        assert.equal(api_quota_state({ limit: 100, remaining }).level, level);
    }
    assert.equal(
        api_quota_state({ limit: 100, remaining: 200 }).percentage,
        100,
    );
});

test("API cards show unknown data, update live, and release their listener", async () => {
    class Element {
        children = [];
        dataset = {};
        style = {};
        attributes = {};
        append(...children) {
            this.children.push(...children);
        }
        appendChild(child) {
            this.append(child);
        }
        prepend(child) {
            this.children.unshift(child);
        }
        replaceChildren() {
            this.children = [];
        }
        setAttribute(key, value) {
            this.attributes[key] = value;
        }
    }
    const dialog = new Element();
    let listener;
    let cleanup;
    let paused = false;
    let timer;
    const deadline = Date.now() + 60000;
    const { open_api_limits_dialog } = loadFunctions(
        "../src/content/prelude.ts",
        ["api_quota_state", "open_api_limits_dialog", "api_icon_path"],
        "let api_limit_obj = null;",
        {
            api_refresh_paused: () => paused,
            api_loading_paused_until: () => deadline,
            rate_limit_endpoint: "ViewerBadgeCounts",
            setTimeout: (callback) => {
                timer = callback;
                return 1;
            },
            clearTimeout() {},
            document: {
                createElement: () => new Element(),
                createElementNS: () => new Element(),
            },
            i18n_message: (key, values = []) => `${key}:${values.join("/")}`,
            formatting_locale: () => "en-US",
            open_opd_dialog: (options) => {
                cleanup = options.mount(dialog);
            },
            chrome: {
                storage: {
                    onChanged: {
                        addListener: (value) => {
                            listener = value;
                        },
                        removeListener: (value) => {
                            assert.equal(value, listener);
                            listener = null;
                        },
                    },
                },
            },
        },
    );
    await open_api_limits_dialog();
    const cards = dialog.children[1];
    assert.equal(cards.children.length, 3);
    const icons = cards.children.map(
        (card) => card.children[0].children[0].children[0],
    );
    for (const icon of icons)
        assert.equal(icon.attributes["aria-hidden"], "true");
    assert.equal(
        new Set(icons.map((icon) => icon.children[0].attributes.d)).size,
        3,
    );
    assert.equal(
        cards.children[0].children[0].children[1].textContent,
        "ui_api_no_data:",
    );
    listener({
        api_access_limit: {
            newValue: {
                recommend_timeline: {
                    limit: 500,
                    remaining: 492,
                    reset_unix_time: 1800000000,
                },
            },
        },
    });
    const card = cards.children[1];
    assert.equal(
        card.children[0].children[1].textContent,
        "ui_api_percent_left:98",
    );
    assert.equal(card.children[1].attributes["aria-valuenow"], "492");
    assert.equal(card.children[1].children[0].style.width, "98.4%");
    assert.equal(card.children[2].textContent, "ui_api_remaining:492/500");
    assert.ok(card.children[3].textContent.startsWith("ui_api_reset:"));
    paused = true;
    listener({ opd_rate_limit_until: { newValue: deadline } });
    assert.equal(dialog.children[2].hidden, false);
    assert.ok(
        dialog.children[2].textContent.startsWith("ui_api_loading_paused:"),
    );
    paused = false;
    timer();
    assert.equal(dialog.children[2].hidden, true);
    cleanup();
    assert.equal(listener, null);
});
