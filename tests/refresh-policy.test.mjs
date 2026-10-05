import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("automatic refresh checks visibility and cooldown again before starting", () => {
    const document = { hidden: false };
    let offscreen = false;
    let paused = false;
    let job;
    let reloaded = 0;
    const frame = {
        isConnected: true,
        contentWindow: { location: { pathname: "/notifications", reload: () => reloaded++ } },
        closest: () => ({ querySelector: () => ({ checked: true }) }),
        getAttribute: () => "false",
    };
    const { queue_column_auto_refresh } = loadFunctions("../src/content/run.ts", ["queue_column_auto_refresh"], "", {
        document,
        api_refresh_paused: () => paused,
        column_load_priority: () => offscreen ? 1 : 0,
        queue_column_navigation: (frame, start, valid) => { job = { start, valid }; },
    });
    document.hidden = true;
    queue_column_auto_refresh(frame, null);
    assert.equal(job, undefined);
    document.hidden = false;
    offscreen = true;
    queue_column_auto_refresh(frame, null);
    assert.equal(job, undefined);
    offscreen = false;
    paused = true;
    queue_column_auto_refresh(frame, null);
    assert.equal(job, undefined);
    paused = false;
    queue_column_auto_refresh(frame, null);
    assert.equal(job.valid(), true);
    paused = true;
    assert.equal(job.valid(), false);
    job.start();
    assert.equal(reloaded, 0);
    paused = false;
    document.hidden = true;
    assert.equal(job.valid(), false);
    document.hidden = false;
    job.start();
    assert.equal(reloaded, 1);
});

test("rate-limit cooldown expires at its deadline", () => {
    let now = 999;
    const { api_refresh_paused } = loadFunctions("../src/content/prelude.ts", ["api_refresh_paused"], "const rate_limit_until = 1000;", {
        Date: { now: () => now },
    });
    assert.equal(api_refresh_paused(), true);
    now = 1000;
    assert.equal(api_refresh_paused(), false);
});
