import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { loadFunctions } from "./helpers/source.mjs";
import { profileHarness } from "./helpers/profile.mjs";
const { AbortController } = globalThis;

function action(h, name) {
    const names =
        name === "switch"
            ? ["create_profile_list_btn"]
            : [`profile_${name}_button_handler`];
    const functions = loadFunctions(
        "../src/content/run.ts",
        names,
        "function set_last_load_profile(value) { last_load_profile = value; }",
        h.globals,
    );
    if (name !== "switch") return functions[names[0]];
    h.globals.document.querySelector = (selector) => ({
        addEventListener: (_event, handler) => h.buttons.set(selector, handler),
        remove: () => assert.fail("dead deck must not remove another root"),
    });
    // Globals passed to the VM retain their document object.
    functions.create_profile_list_btn();
    return h.buttons.get("#userProfile-2");
}

for (const name of ["switch", "save", "delete"]) {
    for (const failed of [false, true]) {
        test(`late ${name} ${failed ? "error" : "response"} is ignored after teardown`, async () => {
            const h = profileHarness(true);
            h.globals.deck_lifetime = new AbortController();
            let finish;
            let calls = 0;
            h.globals.profile_storage_request = () => {
                calls++;
                return new Promise((resolve, reject) => {
                    finish = failed ? reject : resolve;
                });
            };
            h.globals.run = () => assert.fail("dead deck must not rebuild");
            h.globals.request_page_reload = () =>
                assert.fail("dead deck must not reload");
            const before = JSON.stringify(h.store);
            const handler = action(h, name);
            const pending = handler();
            await setImmediate();
            assert.equal(calls, 1);
            h.globals.deck_lifetime.abort();
            finish(
                failed
                    ? new Error("Failed")
                    : { profiles: h.store.slice(0, 1) },
            );
            await pending;
            assert.equal(JSON.stringify(h.store), before);
            assert.deepEqual(h.alerts, []);
            assert.equal(calls, 1);
        });
    }
}

for (const stage of [
    "switch confirmation",
    "save name",
    "delete selection",
    "delete confirmation",
]) {
    test(`teardown during ${stage} prevents a subsequent storage request`, async () => {
        const h = profileHarness(true);
        let finish;
        const deferred = () =>
            new Promise((resolve) => {
                finish = resolve;
            });
        if (stage === "save name") h.globals.opd_prompt = deferred;
        else if (stage === "delete selection")
            h.globals.open_opd_dialog = deferred;
        else h.globals.opd_confirm = deferred;
        h.globals.profile_storage_request = () =>
            assert.fail("dead action must not submit a request");
        const handler = action(
            h,
            stage.startsWith("switch")
                ? "switch"
                : stage.startsWith("save")
                  ? "save"
                  : "delete",
        );
        const pending = handler();
        await setImmediate();
        h.globals.deck_lifetime.abort();
        finish(
            stage === "save name"
                ? "Named"
                : stage === "delete selection"
                  ? "1"
                  : true,
        );
        await pending;
        assert.deepEqual(h.alerts, []);
    });
}

test("teardown during replacement selection leaves the old client snapshot untouched", async () => {
    const h = profileHarness(true);
    const profiles = h.store.filter((profile) => profile.id !== h.store[1].id);
    const before = JSON.stringify(h.store);
    let finish;
    h.globals.profile_storage_request = (operation) =>
        operation.op === "delete"
            ? Promise.resolve({ profiles })
            : new Promise((resolve) => {
                  finish = resolve;
              });
    h.globals.run = () => assert.fail("dead deck must not rebuild");
    const pending = action(h, "delete")();
    await setImmediate();
    h.globals.deck_lifetime.abort();
    finish({ profiles });
    await pending;
    assert.equal(JSON.stringify(h.store), before);
    assert.deepEqual(h.alerts, []);
});

test("late column-save failures do not show dialogs in a replacement deck", async () => {
    const h = profileHarness(true);
    let reject;
    h.globals.profile_storage_request = () =>
        new Promise((_resolve, fail) => {
            reject = fail;
        });
    h.globals.document.querySelectorAll = () => [];
    h.globals.manifest = { version: "1" };
    const { column_settings_save } = loadFunctions(
        "../src/content/run.ts",
        ["column_settings_save"],
        "",
        h.globals,
    );
    column_settings_save();
    h.globals.deck_lifetime.abort();
    reject(new Error("Failed"));
    await setImmediate();
    assert.deepEqual(h.alerts, []);
});

test("actual rebuild and disposal abort each deck's lifetime independently", () => {
    const controllers = [];
    class Controller extends AbortController {
        constructor() {
            super();
            controllers.push(this);
        }
    }
    const { run, dispose_deck } = loadFunctions(
        "../src/content/run.ts",
        ["run", "dispose_deck"],
        "let opd_column_load_scheduler;",
        {
            AbortController: Controller,
            api_loading_paused_until: () => 0,
            IntersectionObserver: class {
                disconnect() {}
            },
            create_column_load_scheduler: () => {
                const callbacks = [];
                return {
                    onDispose: (callback) => callbacks.push(callback),
                    dispose: () =>
                        callbacks.splice(0).forEach((callback) => callback()),
                };
            },
            stop_system_theme_listener() {},
            profile_store: [],
            last_load_profile: 0,
            create_profile_list_html: () => "",
            document: { head: null },
        },
    );
    run({});
    assert.equal(controllers[0].signal.aborted, false);
    run({});
    assert.equal(controllers[0].signal.aborted, true);
    assert.equal(controllers[1].signal.aborted, false);
    dispose_deck();
    assert.equal(controllers[1].signal.aborted, true);
});
