import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("every content column saves its auto-load toggle and interval", () => {
    for (const type of ["home", "notification", "post", "explore"]) {
        const { column_settings_save } = loadFunctions(
            "../src/content/run.ts",
            ["column_settings_save"],
            "",
            {
                manifest: { version: "1" },
                last_load_profile: 0,
                document: {
                    querySelectorAll: () => [
                        {
                            getAttribute: (key) =>
                                key === "opd_column_type" ? type : null,
                            querySelector: (selector) =>
                                selector === ".opd_a_reload_bar"
                                    ? { checked: true }
                                    : selector === ".opd_a_reload_time_setting"
                                      ? { value: "15" }
                                      : null,
                        },
                    ],
                },
            },
        );
        const saved = column_settings_save("profile_out").column_settings[0];
        assert.equal(saved.auto_reload, true);
        assert.equal(saved.auto_reload_time, 15000);
    }
});

test("pages without an in-place refresh hook use queued reloads and pause while hovered", () => {
    for (const path of [
        "/notifications",
        "/compose/post",
        "/i/bookmarks",
        "/someone",
    ]) {
        let hovered = false;
        let enabled = true;
        let queued = 0;
        let reloaded = 0;
        const frame = {
            isConnected: true,
            contentWindow: {
                location: { pathname: path, reload: () => reloaded++ },
            },
            closest: () => ({ querySelector: () => ({ checked: enabled }) }),
            getAttribute: () => (hovered ? "true" : "false"),
        };
        const { queue_column_auto_refresh } = loadFunctions(
            "../src/content/run.ts",
            ["queue_column_auto_refresh"],
            "",
            {
                document: { hidden: false },
                api_refresh_paused: () => false,
                column_load_priority: () => 0,
                queue_column_navigation: (_frame, start, valid) => {
                    assert.equal(valid(), true);
                    queued++;
                    start();
                },
            },
        );
        queue_column_auto_refresh(frame, null);
        assert.equal(queued, 1);
        assert.equal(reloaded, 1);
        hovered = true;
        queue_column_auto_refresh(frame, null);
        hovered = false;
        enabled = false;
        queue_column_auto_refresh(frame, null);
        assert.equal(queued, 1);
    }
});

test("auto-load binding restores enabled state, validates intervals and stops disabled timers", () => {
    const attributes = new Set();
    const handlers = new Map();
    const enabled = {
        checked: true,
        hasAttribute: (key) => attributes.has(key),
        setAttribute: (key) => attributes.add(key),
        addEventListener: (name, handler) => handlers.set(name, handler),
    };
    const interval = { value: "bad", disabled: false, addEventListener() {} };
    let ticks;
    let delay;
    let cleared = 0;
    let refreshes = 0;
    const frame = {
        isConnected: true,
        closest: () => ({
            querySelector: (selector) =>
                selector === ".opd_a_reload_bar" ? enabled : interval,
        }),
        setAttribute() {},
        addEventListener() {},
    };
    const { bind_column_auto_reload } = loadFunctions(
        "../src/content/run.ts",
        ["bind_column_auto_reload"],
        "",
        {
            column_set_interval: (callback, ms) => {
                ticks = callback;
                delay = ms;
                return 1;
            },
            clearInterval: () => cleared++,
            queue_column_auto_refresh: () => refreshes++,
            column_settings_save() {},
            last_load_profile: 0,
        },
    );
    bind_column_auto_reload(frame, null);
    bind_column_auto_reload(frame, null);
    assert.equal(delay, 10000);
    assert.equal(interval.value, "10");
    assert.equal(interval.disabled, true);
    ticks();
    assert.equal(refreshes, 1);
    enabled.checked = false;
    handlers.get("change")();
    assert.equal(cleared, 1);
    assert.equal(interval.disabled, false);
});
