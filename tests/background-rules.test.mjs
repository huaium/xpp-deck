import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

function harness() {
    const updates = [];
    let message, updated, removed;
    const runtime = {
        onMessage: {
            addListener: (listener) => {
                message = listener;
            },
        },
    };
    const { start_background: start } = loadFunctions(
        "../src/background.ts",
        ["start_background"],
        "",
        {
            chrome: {
                runtime,
                declarativeNetRequest: {
                    updateSessionRules: (rules, done) => {
                        updates.push(rules);
                        done?.();
                    },
                },
                tabs: {
                    onUpdated: {
                        addListener: (listener) => {
                            updated = listener;
                        },
                    },
                    onRemoved: {
                        addListener: (listener) => {
                            removed = listener;
                        },
                    },
                },
                storage: { local: { get: (_key, done) => done({}) } },
                webRequest: { onHeadersReceived: { addListener() {} } },
            },
        },
    );
    start();
    return { updates, runtime, message, updated, removed };
}

test("header removal is limited to explicit embedded X documents in each deck tab", () => {
    const h = harness();
    assert.deepEqual(Array.from(h.updates[0].removeRuleIds), [1]);
    for (const id of [7, 8]) {
        let response;
        assert.equal(
            h.message(
                { message: "dnr_upd" },
                {
                    frameId: 0,
                    url: "https://x.com/run-xppdeck",
                    tab: { id, url: "https://x.com/run-xppdeck" },
                },
                (value) => {
                    response = value;
                },
            ),
            true,
        );
        assert.equal(response, true);
        const rule = h.updates.at(-1).addRules[0];
        assert.equal(rule.id, id + 2);
        assert.deepEqual(Array.from(rule.condition.tabIds), [id]);
        assert.deepEqual(Array.from(rule.condition.resourceTypes), [
            "sub_frame",
        ]);
        assert.deepEqual(Array.from(rule.condition.requestDomains), [
            "x.com",
            "twitter.com",
        ]);
        const pattern = new RegExp(rule.condition.regexFilter);
        assert.equal(pattern.test("https://x.com/home"), true);
        assert.equal(pattern.test("https://twitter.com/notifications"), true);
        assert.equal(pattern.test("https://example.com/?x.com"), false);
        assert.equal(pattern.test("https://x.com.evil.test/home"), false);
    }
});

test("ordinary pages and embedded senders cannot enable header removal", () => {
    const h = harness();
    for (const sender of [
        {
            frameId: 0,
            url: "https://x.com/home",
            tab: { id: 7, url: "https://x.com/home" },
        },
        {
            frameId: 1,
            url: "https://x.com/run-xppdeck",
            tab: { id: 7, url: "https://x.com/run-xppdeck" },
        },
        {
            frameId: 0,
            url: "https://x.com/run-xppdeck",
            tab: { id: 7, url: "https://x.com/home" },
        },
        {},
    ]) {
        let response;
        assert.equal(
            h.message({ message: "dnr_upd" }, sender, (value) => {
                response = value;
            }),
            false,
        );
        assert.equal(response, false);
    }
    assert.equal(h.updates.length, 1);
});

test("leaving or closing a deck tab removes only that tab's rule", () => {
    const h = harness();
    h.updated(7, { url: "https://x.com/run-xppdeck?test=1" });
    assert.equal(h.updates.length, 1);
    h.updated(7, { url: "https://x.com/home" });
    assert.deepEqual(Array.from(h.updates.at(-1).removeRuleIds), [9]);
    h.removed(8);
    assert.deepEqual(Array.from(h.updates.at(-1).removeRuleIds), [10]);
});

test("rule installation reports API errors", () => {
    const h = harness();
    h.runtime.lastError = { message: "Failed" };
    let response;
    h.message(
        { message: "dnr_upd" },
        {
            frameId: 0,
            url: "https://x.com/run-xppdeck",
            tab: { id: 7, url: "https://x.com/run-xppdeck" },
        },
        (value) => {
            response = value;
        },
    );
    assert.equal(response, false);
});
