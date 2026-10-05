import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("sidebar renders three keyboard-accessible API rows with icons", () => {
    const { create_api_sidebar_html } = loadFunctions("../src/content/prelude.ts", ["create_api_sidebar_html", "escape_profile_name"], "", {
        i18n_message_or_fallback: () => "API Usage",
    });
    const html = create_api_sidebar_html();
    assert.equal((html.match(/<button /g) ?? []).length, 3);
    assert.equal((html.match(/<svg /g) ?? []).length, 3);
    for (const key of ["time_line", "recommend_timeline", "search"]) assert.ok(html.includes(`data-api-key="${key}"`));
});

test("sidebar shows each API quota independently with accessible tooltips", () => {
    const rows = new Map();
    for (const key of ["time_line", "recommend_timeline", "search"]) {
        const label = {};
        const value = {};
        rows.set(`[data-api-key="${key}"]`, { dataset: {}, label, value,
            querySelector: (selector) => selector.endsWith("label") ? label : value,
            setAttribute(name, text) { this[name] = text; },
        });
    }
    const { update_api_sidebar } = loadFunctions("../src/content/prelude.ts", ["update_api_sidebar", "api_quota_state"], "const api_limit_obj = {time_line:{limit:100,remaining:70},recommend_timeline:{limit:500,remaining:50}};", {
        document: { querySelector: (selector) => rows.get(selector) },
        i18n_message: (key, values = []) => `${key}:${values.join()}`,
    });
    update_api_sidebar();
    const following = rows.get('[data-api-key="time_line"]');
    assert.equal(following.value.textContent, "70%");
    assert.equal(following.dataset.level, "green");
    assert.equal(following["aria-label"], following.title);
    assert.equal(rows.get('[data-api-key="recommend_timeline"]').value.textContent, "10%");
    assert.equal(rows.get('[data-api-key="search"]').dataset.level, "unknown");
});
