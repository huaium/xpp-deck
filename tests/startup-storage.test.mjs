import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { loadFunctions } from "./helpers/source.mjs";

function harness(stored) {
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
