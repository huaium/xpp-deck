import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

function harness(saved) {
    let listener;
    const reads = [];
    const writes = [];
    const { start_background } = loadFunctions(
        "../src/background.ts",
        ["start_background"],
        "",
        {
            create_profile_storage: () => ({ request: async () => ({}) }),
            chrome: {
                runtime: { onMessage: { addListener() {} } },
                tabs: {
                    onUpdated: { addListener() {} },
                    onRemoved: { addListener() {} },
                },
                declarativeNetRequest: { updateSessionRules() {} },
                storage: {
                    local: {
                        get: (key, done) => reads.push({ key, done }),
                        set: (value, done) => {
                            writes.push(JSON.parse(JSON.stringify(value)));
                            done?.();
                        },
                    },
                },
                webRequest: {
                    onHeadersReceived: {
                        addListener: (fn) => {
                            listener = fn;
                        },
                    },
                },
            },
            console: { log() {} },
        },
    );
    start_background();
    return {
        writes,
        respond: (details) => listener(details),
        response(endpoint, remaining) {
            listener({
                url: `https://x.com/i/api/graphql/id/${endpoint}`,
                statusCode: 200,
                responseHeaders: [
                    { name: "x-rate-limit-limit", value: "500" },
                    { name: "x-rate-limit-remaining", value: remaining },
                    { name: "x-rate-limit-reset", value: "1900000000" },
                ],
            });
        },
        restore() {
            for (const { key, done } of reads) {
                done(
                    key === "opd_rate_limit_until"
                        ? {}
                        : { api_access_limit: saved },
                );
            }
        },
    };
}

test("worker restart preserves unrelated API counters, including responses before restore", () => {
    const saved = {
        search: { limit: "50", remaining: "40", reset_unix_time: "1800000000" },
        time_line: {
            limit: "100",
            remaining: "90",
            reset_unix_time: "1800000001",
        },
        recommend_timeline: {
            limit: "500",
            remaining: "490",
            reset_unix_time: "1800000002",
        },
    };
    const h = harness(saved);
    h.response("HomeTimeline", "480");
    h.response("SearchTimeline", "35");
    h.restore();
    const value = h.writes.at(-1).api_access_limit;
    assert.deepEqual(value.time_line, saved.time_line);
    assert.equal(value.recommend_timeline.remaining, "480");
    assert.equal(value.search.remaining, "35");
    h.response("HomeLatestTimeline", "80");
    assert.equal(
        h.writes.at(-1).api_access_limit.recommend_timeline.remaining,
        "480",
    );
});

test("missing or malformed saved counters do not prevent API updates", () => {
    for (const saved of [
        undefined,
        null,
        "invalid",
        { search: null, time_line: { limit: {} } },
    ]) {
        const h = harness(saved);
        h.restore();
        h.response("SearchTimeline", "20");
        assert.equal(h.writes.at(-1).api_access_limit.search.remaining, "20");
    }
});

test("badge 429 captures only safe attribution and honors response cooldown headers", () => {
    const h = harness();
    h.restore();
    const before = Date.now();
    h.respond({
        url: "https://x.com/i/api/graphql/id/ViewerBadgeCounts?variables=private",
        statusCode: 429,
        tabId: 7,
        frameId: 4,
        responseHeaders: [{ name: "Retry-After", value: "600" }],
    });
    const value = h.writes.at(-1);
    assert.ok(value.opd_rate_limit_until >= before + 600000);
    assert.equal(value.opd_rate_limit_event.endpoint, "ViewerBadgeCounts");
    assert.equal(value.opd_rate_limit_event.tabId, 7);
    assert.equal(value.opd_rate_limit_event.frameId, 4);
    assert.doesNotMatch(JSON.stringify(value), /variables|private|graphql/);
});
