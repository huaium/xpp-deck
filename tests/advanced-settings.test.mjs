import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

const defaults = {
    concurrency: 1,
    minGapMs: 2000,
    maxGapMs: 3000,
    timeoutMs: 30000,
};
function preferences() {
    const state = { ...defaults };
    return {
        state,
        ...loadFunctions(
            "../src/content/loading-preferences.ts",
            ["parse_loading_preferences", "apply_loading_preferences"],
            "",
            {
                loading_preferences: state,
                default_loading_preferences: defaults,
            },
        ),
    };
}
test("loading preferences validate safe bounds and recover defaults", () => {
    const {
        state,
        parse_loading_preferences: parse,
        apply_loading_preferences: apply,
    } = preferences();
    for (const value of [
        null,
        {},
        { ...defaults, concurrency: 3 },
        { ...defaults, concurrency: 1.5 },
        { ...defaults, minGapMs: 499 },
        { ...defaults, minGapMs: 4000 },
        { ...defaults, maxGapMs: 60001 },
        { ...defaults, timeoutMs: 4999 },
        { ...defaults, timeoutMs: 120001 },
    ])
        assert.equal(parse(value), null);
    const valid = {
        concurrency: 2,
        minGapMs: 500,
        maxGapMs: 60000,
        timeoutMs: 120000,
    };
    apply({ ...valid, blockedUntil: 0 });
    assert.deepEqual(state, valid);
    apply(null);
    assert.deepEqual(state, defaults);
});

class Element {
    children = [];
    handlers = new Map();
    attributes = new Map();
    textContent = "";
    value = "";
    disabled = false;
    append(...children) {
        this.children.push(...children);
    }
    appendChild(child) {
        this.append(child);
    }
    setAttribute(key, value) {
        this.attributes.set(key, value);
    }
    addEventListener(name, handler) {
        this.handlers.set(name, handler);
    }
    click() {
        return this.handlers.get("click")();
    }
}
function form() {
    const prefs = preferences();
    const writes = [],
        configurations = [];
    const signal = { aborted: false };
    const runtime = {};
    const { mount_advanced_settings: mount } = loadFunctions(
        "../src/content/advanced-settings.ts",
        ["mount_advanced_settings"],
        "",
        {
            document: { createElement: () => new Element() },
            i18n_message: (key) => key,
            loading_preferences: prefs.state,
            default_loading_preferences: defaults,
            parse_loading_preferences: prefs.parse_loading_preferences,
            apply_loading_preferences: prefs.apply_loading_preferences,
            chrome: {
                runtime,
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
    const parent = new Element();
    mount(parent, { configure: (value) => configurations.push(value) }, signal);
    const [toggle, panel] = parent.children;
    const inputs = panel.children.slice(0, 4).map((row) => row.children[1]);
    const [restore, save] = panel.children[5].children;
    const status = panel.children[6];
    return {
        toggle,
        panel,
        inputs,
        restore,
        save,
        status,
        writes,
        configurations,
        signal,
        runtime,
    };
}
test("advanced settings starts hidden, toggles, validates, saves and restores", async () => {
    const ui = form();
    assert.equal(ui.panel.hidden, true);
    ui.toggle.click();
    assert.equal(ui.panel.hidden, false);
    assert.equal(ui.toggle.attributes.get("aria-expanded"), "true");
    ui.toggle.click();
    assert.equal(ui.panel.hidden, true);
    ui.inputs[1].value = "4";
    await ui.save.click();
    assert.equal(ui.writes.length, 0);
    assert.equal(ui.status.textContent, "ui_advanced_invalid");
    ui.restore.click();
    assert.deepEqual(
        ui.inputs.map((input) => input.value),
        ["1", "2", "3", "30"],
    );
    ui.inputs[3].value = "45";
    await ui.save.click();
    assert.equal(ui.writes[0].xpd_loading_preferences.timeoutMs, 45000);
    assert.equal(ui.configurations.length, 1);
    assert.equal(ui.status.textContent, "ui_advanced_saved");
});
test("save errors are recoverable and disposed dialogs do not apply changes", async () => {
    const ui = form();
    ui.runtime.lastError = { message: "unavailable" };
    await ui.save.click();
    assert.equal(ui.status.textContent, "ui_advanced_failed");
    assert.equal(ui.save.disabled, false);
    delete ui.runtime.lastError;
    ui.signal.aborted = true;
    await ui.save.click();
    assert.equal(ui.configurations.length, 0);
    assert.equal(ui.writes.length, 1);
});
