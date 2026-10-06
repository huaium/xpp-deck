import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { loadFunctions } from "./helpers/source.mjs";

const { AbortController } = globalThis;

function harness(stored, deferVersion = false) {
    const callbacks = [];
    const writes = [];
    const runtime = { sendMessage: async () => true };
    const { initialize_content: initialize } = loadFunctions(
        "../src/content/prelude.ts",
        ["initialize_content"],
        "let last_load_profile = 0; let profile_store;",
        {
            profile_storage_request: (operation) => {
                if (operation.op === "read")
                    return new Promise((resolve, reject) =>
                        callbacks.push(() => {
                            if (runtime.lastError)
                                reject(new Error(runtime.lastError.message));
                            else resolve(stored);
                        }),
                    );
                writes.push({
                    opd_settings: JSON.stringify({
                        ...JSON.parse(stored.opd_settings),
                        version: operation.version,
                    }),
                });
                if (deferVersion)
                    return new Promise((resolve) =>
                        callbacks.push(() => resolve({})),
                    );
                return Promise.resolve({});
            },
            is_deck_location: () => true,
            location: { href: "https://x.com/run-xppdeck" },
            manifest: { version: "1" },
            opd_confirm: async () => false,
            i18n_message: (key) => key,
            chrome: {
                runtime,
                storage: {
                    local: {
                        get: (_keys, done) =>
                            callbacks.push(() => done(stored)),
                        set: (value, done) => {
                            writes.push(value);
                            done();
                        },
                    },
                },
            },
        },
    );
    return { initialize, callbacks, writes, runtime };
}
const valid = {
    opd_settings: JSON.stringify({ last_load_profile: 0, version: "1" }),
    opd_profile_store: JSON.stringify([
        { name: "Saved", profile: [{ type: "home" }] },
    ]),
};

test("pre-aborted startup makes no background requests", async () => {
    const h = harness(valid);
    h.runtime.sendMessage = () => assert.fail("must not initialize rules");
    const controller = new AbortController();
    controller.abort();
    await h.initialize(
        () => assert.fail("must not mount"),
        () => assert.fail("must not reset"),
        controller.signal,
    );
});

test("cancellation during rule initialization prevents the subsequent profile read", async () => {
    const h = harness(valid);
    let finishRules;
    h.runtime.sendMessage = () =>
        new Promise((resolve) => {
            finishRules = resolve;
        });
    const controller = new AbortController();
    const pending = h.initialize(
        () => assert.fail("must not mount"),
        () => assert.fail("must not reset"),
        controller.signal,
    );
    controller.abort();
    finishRules(true);
    await pending;
    assert.equal(h.callbacks.length, 0);
});

test("cancellation during version persistence prevents mounting", async () => {
    const h = harness(
        {
            ...valid,
            opd_settings: JSON.stringify({
                version: "old",
                last_load_profile: 0,
            }),
        },
        true,
    );
    const controller = new AbortController();
    const pending = h.initialize(
        () => assert.fail("must not mount"),
        () => assert.fail("must not reset"),
        controller.signal,
    );
    await setImmediate();
    h.callbacks.shift()();
    await setImmediate();
    assert.equal(h.writes.length, 1);
    controller.abort();
    h.callbacks.shift()();
    await pending;
});

test("content teardown cancels startup while the profile read is pending", async () => {
    for (const stored of [valid, {}]) {
        const h = harness(stored);
        let pending;
        let mounts = 0;
        let resets = 0;
        const { start_content } = loadFunctions(
            "../src/content/index.ts",
            ["start_content"],
            "",
            {
                AbortController,
                location: { href: "https://x.com/run-xppdeck" },
                is_deck_location: () => true,
                ensure_dropdown_style() {},
                mount_webawesome_controls: () => () => {},
                keep_deck_tab_title: () => () => {},
                chrome: { runtime: { getURL: (url) => url } },
                mount_session_gate: (options) => ({
                    check: () => {
                        pending = options.start();
                    },
                    dispose() {},
                }),
                i18n_message_or_fallback() {},
                request_page_reload() {},
                initialize_i18n_override: async () => {},
                initialize_content: h.initialize,
                run: () => mounts++,
                settings_init: () => resets++,
                dispose_deck() {},
            },
        );
        const stop = start_content();
        await setImmediate();
        assert.equal(h.callbacks.length, 1);
        stop();
        h.callbacks.shift()();
        await pending;
        assert.equal(mounts, 0);
        assert.equal(resets, 0);
    }
});

test("startup waits for storage and deck initialization", async () => {
    const h = harness(valid);
    let completed = false;
    let finishRun;
    const pending = h
        .initialize(
            () =>
                new Promise((resolve) => {
                    finishRun = resolve;
                }),
            () => assert.fail("unexpected reset"),
        )
        .then(() => {
            completed = true;
        });
    await setImmediate();
    assert.equal(completed, false);
    h.callbacks.shift()();
    await setImmediate();
    assert.equal(completed, false);
    finishRun();
    await pending;
    assert.equal(completed, true);
});

for (const stored of [
    { ...valid, opd_settings: "invalid JSON" },
    { ...valid, opd_profile_store: "invalid JSON" },
    { opd_settings: valid.opd_settings },
    { opd_profile_store: valid.opd_profile_store },
    { ...valid, opd_settings: '{"last_load_profile":99}' },
    { ...valid, opd_profile_store: "[]" },
    { ...valid, opd_profile_store: '[{"profile":[null]}]' },
    { ...valid, opd_profile_store: '[{"profile":{}}]' },
]) {
    test(`corrupt startup rejects without resetting saved data: ${JSON.stringify(stored)}`, async () => {
        const h = harness(stored);
        const pending = h.initialize(
            () => assert.fail("must not run"),
            () => assert.fail("must not reset"),
        );
        const rejected = assert.rejects(pending);
        await setImmediate();
        h.callbacks.shift()();
        await rejected;
        assert.equal(h.writes.length, 0);
    });
}

test("storage API errors reject startup", async () => {
    const h = harness(valid);
    h.runtime.lastError = { message: "Storage unavailable" };
    const pending = h.initialize(
        () => assert.fail("must not run"),
        () => assert.fail("must not reset"),
    );
    const rejected = assert.rejects(pending, /Storage unavailable/);
    await setImmediate();
    h.callbacks.shift()();
    await rejected;
});
