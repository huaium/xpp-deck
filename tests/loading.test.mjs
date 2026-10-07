import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("completed resource cleanup can unregister and scheduler disposal is idempotent", () => {
    const h = harness();
    let cleaned = 0;
    const unregister = h.scheduler.onDispose(() => cleaned++);
    unregister();
    unregister();
    h.scheduler.onDispose(() => cleaned++);
    h.scheduler.dispose();
    h.scheduler.dispose();
    assert.equal(cleaned, 1);
    h.scheduler.onDispose(() => cleaned++);
    assert.equal(cleaned, 2);
});

function harness(random) {
    let random_calls = 0;
    let now = 0;
    let id = 0;
    const timers = new Map();
    const setTimeout = (fn, delay) => {
        timers.set(++id, { fn, at: now + delay });
        return id;
    };
    const { create_column_load_scheduler } = loadFunctions(
        "../src/content/loading.ts",
        ["create_column_load_scheduler"],
        "",
        {
            Date: { now: () => now },
            Math: {
                floor: Math.floor,
                random: () => {
                    const index = random_calls++;
                    return random
                        ? random(index)
                        : index % 2 === 0
                          ? 0.75
                          : 0.5;
                },
            },
            setTimeout,
            clearTimeout: (key) => timers.delete(key),
            console: { error() {} },
        },
    );
    return {
        scheduler: create_column_load_scheduler(),
        timers,
        setTimeout,
        clearTimeout: (key) => timers.delete(key),
        advance(duration) {
            const end = now + duration;
            while (true) {
                const next = [...timers.entries()]
                    .filter(([, timer]) => timer.at <= end)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                timers.delete(next[0]);
                next[1].fn();
            }
            now = end;
        },
    };
}

test("scheduler limits concurrency, spaces starts, and prioritizes visible queued work", () => {
    const h = harness();
    const started = [];
    const done = new Map();
    for (const [name, priority] of [
        ["first", 0],
        ["hidden", 1],
        ["visible", 0],
        ["last", 1],
    ]) {
        h.scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => priority,
            start: (finish) => {
                started.push(name);
                done.set(name, finish);
            },
        });
    }
    assert.deepEqual(started, ["first"]);
    h.advance(999);
    assert.equal(started.length, 1);
    h.advance(1);
    assert.deepEqual(started, ["first", "visible"]);
    h.advance(5000);
    assert.equal(started.length, 2);
    done.get("first")();
    assert.deepEqual(started, ["first", "visible", "hidden"]);
    done.get("visible")();
    h.advance(999);
    assert.equal(started.length, 3);
    h.advance(1);
    assert.equal(started[3], "last");
});

test("random gaps stay at their sampled bounds even when new jobs are enqueued", () => {
    for (const [sample, gap] of [
        [0, 800],
        [0.999999, 1200],
    ]) {
        const h = harness((index) => (index % 2 === 0 ? 0.75 : sample));
        let starts = 0;
        const enqueue = () =>
            h.scheduler.enqueue({
                key: {},
                valid: () => true,
                priority: () => 0,
                start() {
                    starts++;
                },
            });
        enqueue();
        enqueue();
        h.advance(400);
        enqueue();
        h.advance(gap - 401);
        assert.equal(starts, 1);
        h.advance(1);
        assert.equal(starts, 2);
        h.scheduler.dispose();
    }
});

test("random concurrency switches between one and two without cancelling active loads", () => {
    // Initial target two; after start 1 choose one, after start 2 choose two.
    const samples = [0.75, 0.5, 0.25, 0.5, 0.75, 0.5, 0.25];
    const h = harness((index) => samples[index] ?? 0.75);
    const done = [];
    for (let i = 0; i < 4; i++)
        h.scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => 0,
            start: (finish) => {
                done.push(finish);
            },
        });
    h.advance(1000);
    assert.equal(done.length, 1);
    done[0]();
    assert.equal(done.length, 2);
    h.advance(1000);
    assert.equal(done.length, 3);
    h.advance(5000);
    assert.equal(done.length, 3);
    done[1]();
    assert.equal(done.length, 3);
    done[2]();
    assert.equal(done.length, 4);
    h.scheduler.dispose();
});

test("scheduler deduplicates jobs, times out stalled loads, and skips removed columns", () => {
    const h = harness();
    let starts = 0;
    let cleanup = 0;
    let connected = true;
    const first = {
        key: {},
        valid: () => true,
        priority: () => 0,
        start: () => {
            starts++;
            return () => cleanup++;
        },
    };
    assert.equal(h.scheduler.enqueue(first), true);
    assert.equal(h.scheduler.enqueue(first), false);
    h.scheduler.enqueue({
        key: {},
        valid: () => connected,
        priority: () => 0,
        start: () => {
            assert.fail("Removed column started");
        },
    });
    connected = false;
    h.advance(30000);
    assert.equal(starts, 1);
    assert.equal(cleanup, 1);
    assert.equal(h.scheduler.has(first.key), false);
    assert.equal(h.timers.size, 0);
});

test("disposing a profile cancels pending jobs, active listeners and refresh timers", () => {
    const h = harness();
    let cleanups = 0;
    let starts = 0;
    for (let i = 0; i < 3; i++)
        h.scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => 0,
            start: () => {
                starts++;
                return () => cleanups++;
            },
        });
    h.scheduler.onDispose(() => cleanups++);
    h.scheduler.dispose();
    h.advance(60000);
    assert.equal(starts, 1);
    assert.equal(cleanups, 2);
    assert.equal(h.timers.size, 0);
    assert.equal(
        h.scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => 0,
            start() {
                assert.fail();
            },
        }),
        false,
    );
});

test("a synchronous failure releases its slot without breaking the queue", () => {
    const h = harness();
    h.scheduler.enqueue({
        key: {},
        valid: () => true,
        priority: () => 0,
        start() {
            throw Error("failed");
        },
    });
    let started = false;
    h.scheduler.enqueue({
        key: {},
        valid: () => true,
        priority: () => 0,
        start(done) {
            started = true;
            done();
        },
    });
    h.advance(1000);
    assert.equal(started, true);
    assert.equal(h.timers.size, 0);
});

test("navigation keeps its slot through blank loads and cleans placeholders on completion", () => {
    const h = harness();
    const attributes = new Map();
    const listeners = new Set();
    const root = {
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: (key) => attributes.delete(key),
    };
    const frame = {
        isConnected: true,
        contentWindow: { location: { href: "about:blank" } },
        closest: () => root,
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: (key) => attributes.delete(key),
        addEventListener: (_name, handler) => listeners.add(handler),
        removeEventListener: (_name, handler) => listeners.delete(handler),
    };
    const { queue_column_navigation } = loadFunctions(
        "../src/content/run.ts",
        ["queue_column_navigation"],
        "",
        {
            load_scheduler: h.scheduler,
            column_load_priority: () => 0,
            i18n_message_or_fallback: (_key, fallback) => fallback,
        },
    );
    let navigations = 0;
    queue_column_navigation(frame, () => navigations++);
    queue_column_navigation(frame, () => navigations++);
    assert.equal(navigations, 1);
    assert.equal(attributes.get("xpd_load_status"), "Loading...");
    for (const loaded of listeners) loaded();
    assert.equal(h.scheduler.has(frame), true);
    frame.contentWindow.location.href = "https://x.com/home";
    for (const loaded of [...listeners]) loaded();
    assert.equal(h.scheduler.has(frame), false);
    assert.equal(listeners.size, 0);
    assert.equal(attributes.size, 0);
});

test("auto-refresh rechecks enabled and hover state before a paced dispatch", () => {
    for (const pause of [false, true]) {
        const h = harness();
        h.scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => 0,
            start() {},
        });
        let hovered = false;
        let refreshes = 0;
        const frame = {
            isConnected: true,
            contentWindow: { location: { pathname: "/home" }, scrollTo() {} },
            getAttribute: () => (hovered ? "true" : "false"),
            closest: () => ({ querySelector: () => ({ checked: true }) }),
        };
        const { queue_column_auto_refresh } = loadFunctions(
            "../src/content/run.ts",
            ["queue_column_auto_refresh"],
            "",
            {
                load_scheduler: h.scheduler,
                document: { hidden: false },
                api_refresh_paused: () => false,
                column_load_priority: () => 0,
                setTimeout: h.setTimeout,
                clearTimeout: h.clearTimeout,
            },
        );
        const reload = {
            Reload: () => {
                refreshes++;
                return true;
            },
        };
        queue_column_auto_refresh(frame, reload);
        queue_column_auto_refresh(frame, reload);
        hovered = pause;
        h.advance(1000);
        assert.equal(refreshes, pause ? 0 : 1);
        h.advance(1000);
        assert.equal(h.scheduler.has(frame), false);
        h.scheduler.dispose();
    }
});
