import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { setImmediate } from "node:timers";

const { AbortController } = globalThis;

for (const stage of ["storage", "acknowledgement"]) {
    test(`cancelled setup stops late UI and reload after ${stage}`, async () => {
        const controller = new AbortController();
        let finish;
        let alerts = 0;
        let reloads = 0;
        const { settings_init } = loadFunctions(
            "../src/content/settings.ts",
            ["settings_init"],
            "",
            {
                manifest: { version: "1" },
                i18n_message: (key) => key,
                profile_storage_request: () =>
                    stage === "storage"
                        ? new Promise((resolve) => {
                              finish = resolve;
                          })
                        : Promise.resolve(),
                xpd_alert: () => {
                    alerts++;
                    return new Promise((resolve) => {
                        finish = resolve;
                    });
                },
                request_page_reload: () => reloads++,
            },
        );
        const pending = settings_init(true, controller.signal);
        await Promise.resolve();
        controller.abort();
        finish();
        await pending;
        assert.equal(alerts, stage === "storage" ? 0 : 1);
        assert.equal(reloads, 0);
    });
}

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
            profile_storage_request: async (operation) => {
                writes.push({
                    xpd_profile_store: JSON.stringify(operation.profiles),
                });
                writes.push({
                    xpd_settings: JSON.stringify(operation.settings),
                });
            },
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
            xpd_alert: () =>
                new Promise((resolve) => {
                    acknowledge = resolve;
                }),
            request_page_reload: () => {
                reloaded = true;
            },
        },
    );
    const setup = settings_init();
    await Promise.resolve();
    assert.equal(writes.length, 2);
    const profiles = JSON.parse(writes[0].xpd_profile_store);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, "ui_profile_switch_label");
    assert.ok(profiles[0].profile.some((column) => column.type === "home"));
    assert.ok(
        profiles[0].profile.every((column) => !("top_visible" in column)),
    );
    assert.deepEqual(JSON.parse(writes[1].xpd_settings), {
        last_load_profile: 0,
        version: "1.2.3",
    });
    assert.equal(reloaded, false);
    acknowledge();
    await setup;
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
                xpd_column_type: "explore",
                xpd_column_width: "30",
                xpd_explore_path: "/search?q=test",
                xpd_homepage_path: "/i/bookmarks",
                xpd_explore_title: "Saved",
            },
            {
                ".xpd_banner": { checked: true },
                ".xpd_tw_view_mode": { value: "2" },
                ".xpd_a_reload_bar": { checked: true },
                ".xpd_a_reload_time_setting": { value: "5" },
            },
        ),
        column({ xpd_column_type: "notification", xpd_column_width: "null" }),
    ];
    const { column_settings_save: save } = loadFunctions(
        "../src/content/run.ts",
        ["column_settings_save"],
        "",
        {
            manifest: { version: "1" },
            last_load_profile: 0,
            profile_storage_request: async () => {
                writes.push({ xpd_profile_store: JSON.stringify(profiles) });
            },
            deck_lifetime: new AbortController(),
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
        JSON.parse(writes[0].xpd_profile_store)[0].profile,
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
                            { xpd_column_type: "home" },
                            { ".xpd_a_reload_time_setting": { value } },
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
