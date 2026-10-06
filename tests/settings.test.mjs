import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { setImmediate } from "node:timers";

function column(attributes, controls = {}) {
    return {
        getAttribute: (name) => attributes[name] ?? null,
        querySelector: (selector) => controls[selector] ?? null,
    };
}

test("initial setup persists a default profile before acknowledgement and reload", async () => {
    const writes = [];
    let acknowledge;
    let reloaded = false;
    const { settings_init } = loadFunctions(
        "../src/content/settings.ts",
        ["settings_init"],
        "",
        {
            manifest: { version: "1.2.3" },
            chrome: {
                runtime: {},
                storage: {
                    local: {
                        set(value, callback) {
                            writes.push(value);
                            callback();
                        },
                    },
                },
            },
            i18n_message: (key) => key,
            opd_alert: () =>
                new Promise((resolve) => {
                    acknowledge = resolve;
                }),
            request_page_reload: () => {
                reloaded = true;
            },
        },
    );
    settings_init();
    assert.equal(writes.length, 2);
    const profiles = JSON.parse(writes[0].opd_profile_store);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, "ui_profile_switch_label");
    assert.ok(profiles[0].profile.some((column) => column.type === "home"));
    assert.ok(
        profiles[0].profile.every((column) => !("top_visible" in column)),
    );
    assert.deepEqual(JSON.parse(writes[1].opd_settings), {
        last_load_profile: 0,
        version: "1.2.3",
    });
    assert.equal(reloaded, false);
    acknowledge();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reloaded, true);
});

test("column snapshots preserve display, width, homepage URL, title, and refresh settings", () => {
    const writes = [];
    const profiles = [
        { name: "old", profile: [] },
        { name: "untouched", profile: [] },
    ];
    const columns = [
        column(
            {
                opd_column_type: "explore",
                opd_column_width: "30",
                opd_explore_path: "/search?q=test",
                opd_homepage_path: "/i/bookmarks",
                opd_explore_title: "Saved",
            },
            {
                ".opd_banner": { checked: true },
                ".opd_tw_view_mode": { value: "2" },
                ".opd_a_reload_bar": { checked: true },
                ".opd_a_reload_time_setting": { value: "5" },
            },
        ),
        column({ opd_column_type: "notification", opd_column_width: "null" }),
    ];
    const { column_settings_save: save } = loadFunctions(
        "../src/content/run.ts",
        ["column_settings_save"],
        "",
        {
            manifest: { version: "1" },
            last_load_profile: 0,
            profile_store: profiles,
            document: { querySelectorAll: () => columns },
            chrome: {
                storage: {
                    local: {
                        set(value, done) {
                            writes.push(value);
                            done();
                        },
                    },
                },
            },
        },
    );
    const snapshot = save("profile_out");
    assert.equal(writes.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot.column_settings[0])), {
        type: "explore",
        banner: true,
        tw_view_mode: "2",
        column_save_path: "/search?q=test",
        column_save_title: "Saved",
        column_homepage_path: "/i/bookmarks",
        auto_reload: true,
        auto_reload_time: 5000,
        column_width: "30",
    });
    assert.equal(snapshot.column_settings[1].column_width, null);
    assert.equal(save(), null);
    assert.equal(writes.length, 1);
    assert.equal(profiles[1].name, "untouched");
    assert.deepEqual(
        JSON.parse(writes[0].opd_profile_store)[0].profile,
        JSON.parse(JSON.stringify(snapshot.column_settings)),
    );
});

test("invalid refresh intervals fall back to ten seconds", () => {
    for (const value of ["0", "-1", "invalid", "0.5"]) {
        const { column_settings_save: save } = loadFunctions(
            "../src/content/run.ts",
            ["column_settings_save"],
            "",
            {
                manifest: { version: "1" },
                last_load_profile: 0,
                document: {
                    querySelectorAll: () => [
                        column(
                            { opd_column_type: "home" },
                            { ".opd_a_reload_time_setting": { value } },
                        ),
                    ],
                },
            },
        );
        assert.equal(
            save("profile_out").column_settings[0].auto_reload_time,
            10000,
        );
    }
});
