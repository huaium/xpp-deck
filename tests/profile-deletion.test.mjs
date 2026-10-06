import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { profileHarness } from "./helpers/profile.mjs";

function deletion(h) {
    return loadFunctions(
        "../src/content/run.ts",
        ["profile_delete_button_handler"],
        "function set_last_load_profile(value) { last_load_profile = value; }",
        h.globals,
    ).profile_delete_button_handler;
}

test("deleting the active profile replaces its columns before storage callbacks", async () => {
    for (const active of [0, 1, 2]) {
        const h = profileHarness(true, active);
        h.store.forEach((profile, index) => {
            profile.profile = [
                { type: ["home", "notification", "explore"][index] },
            ];
        });
        const expected = h.store[active === 0 ? 1 : active - 1].profile;
        let visible = h.store[active].profile;
        let removed = false;
        const pending = [];
        h.globals.document.querySelector = (selector) =>
            selector === "#opd_main_element"
                ? {
                      remove() {
                          removed = true;
                      },
                  }
                : null;
        h.globals.run = (settings) => {
            assert.equal(removed, true);
            visible = settings.column_settings;
        };
        h.globals.chrome.storage.local.set = (value, done) => {
            h.writes.push(value);
            pending.push(done);
        };
        await deletion(h)();
        assert.equal(visible, expected);
        assert.equal(h.store[Math.max(0, active - 1)].profile, expected);
        // A subsequent column save must use the replacement layout, not the deleted one.
        h.store[Math.max(0, active - 1)].profile = visible;
        assert.equal(h.store[Math.max(0, active - 1)].profile, expected);
        while (pending.length) pending.shift()();
        assert.equal(
            JSON.parse(h.writes[1].opd_settings).last_load_profile,
            Math.max(0, active - 1),
        );
    }
});

test("deletion offers every profile and preserves the active profile when another is removed", async () => {
    for (const [active, selected, remainingActive] of [
        [1, 0, 0],
        [0, 2, 0],
        [2, 1, 1],
    ]) {
        const h = profileHarness(true, active);
        let options;
        let confirmationName;
        h.globals.run = () =>
            assert.fail(
                "unselected profile deletion must not rebuild the deck",
            );
        h.globals.i18n_message = (key, substitutions) => {
            if (key === "msg_profile_delete_confirm")
                confirmationName = substitutions[0];
            return key;
        };
        h.globals.open_opd_dialog = async (value) => {
            options = value;
            return String(selected);
        };
        await deletion(h)();
        assert.equal(confirmationName, `profile-${selected}`);
        assert.equal(options.type, "select");
        assert.equal(options.defaultValue, String(active));
        assert.deepEqual(
            Array.from(options.choices, (choice) => choice.value),
            ["0", "1", "2"],
        );
        assert.equal(
            h.store.some((profile) => profile.name === `profile-${selected}`),
            false,
        );
        assert.equal(h.store[remainingActive].name, `profile-${active}`);
        assert.equal(
            JSON.parse(h.writes[1].opd_settings).last_load_profile,
            remainingActive,
        );
    }
});

test("cancelled and invalid selections never delete or confirm", async () => {
    for (const selected of [null, "invalid", "-1", "3", "0.5"]) {
        const h = profileHarness(true);
        h.globals.open_opd_dialog = async () => selected;
        h.globals.opd_confirm = async () =>
            assert.fail("Unexpected confirmation");
        await deletion(h)();
        assert.equal(h.store.length, 3);
        assert.equal(h.writes.length, 0);
    }
});

test("the final profile is protected even if the store changes during confirmation", async () => {
    const h = profileHarness(true, 0, 2);
    h.globals.opd_confirm = async () => {
        h.store.splice(1, 1);
        return true;
    };
    await deletion(h)();
    assert.equal(h.store.length, 1);
    assert.equal(h.writes.length, 0);
});
