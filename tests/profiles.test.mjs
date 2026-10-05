import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { profileHarness } from "./helpers/profile.mjs";

test("profile saving persists a snapshot only after confirmation", async () => {
    for (const confirmed of [false, true]) {
        const h = profileHarness(confirmed);
        const { profile_save_button_handler: save } = loadFunctions(
            "../src/content/run.ts",
            ["profile_save_button_handler"],
            "function set_last_load_profile(value) { last_load_profile = value; }",
            h.globals,
        );
        await save();
        assert.equal(h.store.length, confirmed ? 4 : 3);
        assert.equal(h.writes.length, confirmed ? 1 : 0);
        if (confirmed)
            assert.equal(
                JSON.parse(h.writes[0].opd_profile_store)[3].profile[0]
                    .column_save_path,
                "/i/bookmarks",
            );
    }
});

test("profile deletion cancels without writes and preserves the final profile", async () => {
    for (const [confirmed, count] of [
        [false, 3],
        [true, 1],
    ]) {
        const h = profileHarness(confirmed, 0, count);
        const { profile_delete_button_handler: remove } = loadFunctions(
            "../src/content/run.ts",
            ["profile_delete_button_handler"],
            "function set_last_load_profile(value) { last_load_profile = value; }",
            h.globals,
        );
        await remove();
        assert.equal(h.store.length, count);
        assert.equal(h.writes.length, 0);
        assert.equal(h.alerts.length, count === 1 ? 1 : 0);
    }
});

test("deleting the active profile selects the previous profile or first remaining profile", async () => {
    for (const active of [0, 1, 2]) {
        const h = profileHarness(true, active);
        const { profile_delete_button_handler: remove } = loadFunctions(
            "../src/content/run.ts",
            ["profile_delete_button_handler"],
            "function set_last_load_profile(value) { last_load_profile = value; }",
            h.globals,
        );
        await remove();
        assert.equal(h.store.length, 2);
        assert.ok(
            h.store.every((profile) => profile.name !== `profile-${active}`),
        );
        assert.equal(
            JSON.parse(h.writes[1].opd_settings).last_load_profile,
            Math.max(0, active - 1),
        );
    }
});

test("profile switching waits for confirmation, persists selection, and renders saved columns", async () => {
    for (const confirmed of [false, true]) {
        const h = profileHarness(confirmed);
        let removed = false;
        let rendered;
        h.globals.document.querySelector = (selector) =>
            selector === "#opd_main_element"
                ? {
                      remove() {
                          removed = true;
                      },
                  }
                : {
                      addEventListener(_event, handler) {
                          h.buttons.set(selector, handler);
                      },
                  };
        h.globals.run = (settings) => {
            rendered = settings;
        };
        const { create_profile_list_btn: bind } = loadFunctions(
            "../src/content/run.ts",
            ["create_profile_list_btn"],
            "function set_last_load_profile(value) { last_load_profile = value; }",
            h.globals,
        );
        bind();
        await h.buttons.get("#userProfile-2")();
        assert.equal(removed, confirmed);
        assert.equal(h.writes.length, confirmed ? 1 : 0);
        if (confirmed) {
            assert.equal(
                JSON.parse(h.writes[0].opd_settings).last_load_profile,
                2,
            );
            assert.equal(rendered.column_settings, h.store[2].profile);
        }
    }
});
