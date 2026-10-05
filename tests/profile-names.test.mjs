import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { profileHarness } from "./helpers/profile.mjs";

function names(globals = {}) {
    return loadFunctions(
        "../src/content/prelude.ts",
        [
            "profile_display_name",
            "default_profile_name",
            "next_profile_name",
            "escape_profile_name",
            "create_profile_button_html",
            "create_profile_list_buttons_html",
        ],
        "",
        { i18n_message: () => "", ...globals },
    );
}

test("localized defaults avoid collisions without renaming user profiles", () => {
    const { next_profile_name, profile_display_name } = names({
        i18n_message: (key, values) => `配置 ${values[0]}`,
    });
    const profiles = [{ name: "配置 1" }, { name: "Work" }];
    assert.equal(next_profile_name(profiles), "配置 2");
    assert.equal(profile_display_name(profiles[1], 1), "Work");
});

test("default profile names choose the first unused number", () => {
    const { next_profile_name } = names();
    assert.equal(next_profile_name([]), "Profile 1");
    assert.equal(
        next_profile_name([{ name: "Profile 1" }, { name: "Work" }]),
        "Profile 2",
    );
    assert.equal(
        next_profile_name([{ name: "Profile 1" }, { name: "Profile 3" }]),
        "Profile 2",
    );
    assert.equal(
        next_profile_name([{ name: "Profile 1" }, { name: "Profile 2" }]),
        "Profile 3",
    );
});

test("profile buttons show escaped names and a single Unicode initial", () => {
    const { create_profile_button_html } = names();
    const html = create_profile_button_html(0, 0, {
        name: '<Work & "friends">',
    });
    assert.match(html, /dsp_btn_profile_selected/);
    assert.match(html, /dsp_btn_change_profile_btn">&lt;<\/div>/);
    assert.match(html, /&lt;Work &amp; &quot;friends&quot;&gt;/);
    assert.doesNotMatch(html, /<Work/);
    assert.match(
        create_profile_button_html(1, 0, { name: "🌟 Stars" }),
        /dsp_btn_change_profile_btn">🌟<\/div>/,
    );
    assert.match(create_profile_button_html(1, 0, {}), /Profile 2/);
    assert.match(
        create_profile_button_html(1, 0, { name: "default" }),
        /dsp_btn_label">default/,
    );
});

test("profile creation prompts, trims names, supports defaults and cancellation", async () => {
    for (const input of [null, "  Work  ", "   "]) {
        const h = profileHarness(true);
        let prompt;
        h.globals.opd_prompt = async (message, defaultName) => {
            prompt = { message, defaultName };
            return input;
        };
        const { profile_save_button_handler: save } = loadFunctions(
            "../src/content/run.ts",
            ["profile_save_button_handler"],
            "",
            h.globals,
        );
        await save();
        assert.equal(prompt.defaultName, "Profile 1");
        assert.equal(h.writes.length, input === null ? 0 : 1);
        if (input !== null)
            assert.equal(h.store.at(-1).name, input.trim() || "Profile 1");
    }
});

test("column changes preserve the selected profile's name", () => {
    const h = profileHarness(true, 0);
    h.store[0].name = "Work";
    h.globals.document.querySelectorAll = () => [];
    h.globals.manifest = { version: "1" };
    const { column_settings_save } = loadFunctions(
        "../src/content/run.ts",
        ["column_settings_save"],
        "",
        h.globals,
    );
    column_settings_save();
    assert.equal(h.store[0].name, "Work");
    assert.equal(JSON.parse(h.writes[0].opd_profile_store)[0].name, "Work");
});
