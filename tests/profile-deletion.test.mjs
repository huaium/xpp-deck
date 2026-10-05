import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { profileHarness } from "./helpers/profile.mjs";

function deletion(h) {
    return loadFunctions(
        "../src/content/run.ts",
        ["profile_delete_button_handler"],
        "",
        h.globals,
    ).profile_delete_button_handler;
}

test("deletion offers every profile and preserves the active profile when another is removed", async () => {
    for (const [active, selected, remainingActive] of [
        [1, 0, 0],
        [0, 2, 0],
        [2, 1, 1],
    ]) {
        const h = profileHarness(true, active);
        let options;
        h.globals.open_opd_dialog = async (value) => {
            options = value;
            return String(selected);
        };
        await deletion(h)();
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
