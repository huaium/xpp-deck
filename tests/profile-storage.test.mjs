import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

function harness(
    profiles = [
        { id: "a", name: "A", profile: [{ type: "home", custom_title: "A" }] },
        {
            id: "b",
            name: "B",
            profile: [{ type: "explore", custom_title: "B" }],
        },
    ],
) {
    const stored = {
        opd_profile_store: JSON.stringify(profiles),
        opd_settings: JSON.stringify({ version: "1", last_load_profile: 0 }),
    };
    let id = 0;
    const { create_profile_storage } = loadFunctions(
        "../src/profile-storage.ts",
        ["create_profile_storage"],
        "",
        {
            crypto: { randomUUID: () => `new-${++id}` },
            chrome: {
                runtime: {},
                storage: {
                    local: {
                        get: (_keys, done) => done({ ...stored }),
                        set: (value, done) => {
                            Object.assign(stored, value);
                            done();
                        },
                    },
                },
            },
        },
    );
    return {
        service: create_profile_storage(),
        restart: () => create_profile_storage(),
        stored,
        profiles: () => JSON.parse(stored.opd_profile_store),
    };
}

test("concurrent tabs update only the profile identified by their stable ID", async () => {
    const h = harness();
    await Promise.all([
        h.service.request({
            op: "save",
            id: "b",
            columns: [{ type: "explore", custom_title: "New B" }],
        }),
        h.service.request({
            op: "save",
            id: "a",
            columns: [{ type: "home", custom_title: "New A" }],
        }),
    ]);
    assert.deepEqual(
        h.profiles().map((p) => p.profile[0].custom_title),
        ["New A", "New B"],
    );
});

test("stale saves cannot resurrect deleted profiles or overwrite their replacements", async () => {
    const h = harness();
    await h.service.request({ op: "delete", id: "a" });
    await assert.rejects(
        h.service.request({ op: "save", id: "a", columns: [{ type: "home" }] }),
        /deleted/,
    );
    assert.equal(h.profiles().length, 1);
    assert.equal(h.profiles()[0].id, "b");
    await h.service.request({
        op: "save",
        id: "b",
        columns: [{ type: "home", custom_title: "Updated" }],
    });
    await assert.rejects(h.service.request({ op: "delete", id: "b" }), /final/);
    assert.equal(h.profiles()[0].profile[0].custom_title, "Updated");
});

test("legacy profiles receive persisted IDs only once across concurrent reads and worker restarts", async () => {
    const h = harness([{ name: "Legacy", profile: [{ type: "home" }] }]);
    const [first, second] = await Promise.all([
        h.service.request({ op: "read" }),
        h.service.request({ op: "read" }),
    ]);
    assert.equal(first.opd_profile_store, second.opd_profile_store);
    assert.equal(h.profiles()[0].id, "new-1");
    const restarted = await h.restart().request({ op: "read" });
    assert.equal(restarted.opd_profile_store, first.opd_profile_store);
});

test("late first-time initialization cannot reset profiles created by another tab", async () => {
    const h = harness();
    const before = h.stored.opd_profile_store;
    await h.service.request({
        op: "reset",
        only_if_missing: true,
        profiles: [{ name: "Default", profile: [{ type: "home" }] }],
        settings: { version: "1", last_load_profile: 0 },
    });
    assert.equal(h.stored.opd_profile_store, before);
});

test("create and save requests preserve concurrent changes and selection resolves IDs after deletion", async () => {
    const h = harness();
    await Promise.all([
        h.service.request({
            op: "create",
            name: "C",
            columns: [{ type: "post" }],
        }),
        h.service.request({
            op: "save",
            id: "a",
            columns: [{ type: "home", custom_title: "New" }],
        }),
    ]);
    assert.equal(h.profiles().length, 3);
    await h.service.request({ op: "delete", id: "a" });
    const result = await h.service.request({ op: "select", id: "b" });
    assert.equal(result.settings.last_load_profile, 0);
});
