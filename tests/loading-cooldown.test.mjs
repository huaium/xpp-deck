import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("cooldown holds initial and manual jobs and resumes without dropping them", () => {
    let now = 0;
    let until = 5000;
    let paused = false;
    let next = 0;
    const timers = new Map();
    const { create_column_load_scheduler } = loadFunctions(
        "../src/content/loading.ts",
        ["create_column_load_scheduler"],
        "",
        {
            Date: { now: () => now },
            Math: { random: () => 0, floor: Math.floor, min: Math.min },
            setTimeout: (fn, delay) => {
                timers.set(++next, { fn, at: now + delay });
                return next;
            },
            clearTimeout: (id) => timers.delete(id),
        },
    );
    const scheduler = create_column_load_scheduler({
        concurrency: 1,
        minGapMs: 2000,
        maxGapMs: 3000,
        blockedUntil: () => until,
        paused: () => paused,
    });
    const starts = [];
    let done;
    for (const key of ["initial", "manual"])
        scheduler.enqueue({
            key: {},
            valid: () => true,
            priority: () => 0,
            start: (finish) => {
                starts.push(key);
                done = finish;
            },
        });
    assert.deepEqual(starts, []);
    now = 5000;
    paused = true;
    scheduler.resume();
    assert.deepEqual(starts, []);
    paused = false;
    until = 0;
    scheduler.resume();
    assert.deepEqual(starts, ["initial"]);
    now = 6000;
    done();
    assert.deepEqual(starts, ["initial"]);
    now = 7000;
    scheduler.resume();
    assert.deepEqual(starts, ["initial", "manual"]);
    scheduler.dispose();
    assert.equal(timers.size, 0);
});

test("initial loads defer offscreen and hidden documents without losing their URLs", () => {
    const frames = [
        { src: "", visible: false },
        { src: "", visible: true },
    ];
    for (const frame of frames) {
        frame.getAttribute = () => "https://x.com/home";
        frame.removeAttribute = () => {};
        frame.closest = () => ({ getAttribute: () => null });
    }
    const visible = new WeakMap(frames.map((frame) => [frame, frame.visible]));
    const doc = { hidden: false, querySelectorAll: () => frames };
    const { queue_column_frames } = loadFunctions(
        "../src/content/run.ts",
        ["queue_column_frames"],
        "",
        {
            document: doc,
            visible_initial_frames: visible,
            observed_frames: new WeakSet(),
            pending_frame_observer: { observe() {}, unobserve() {} },
            column_load_priority: (frame) => (frame.visible ? 0 : 1),
            queue_column_navigation: (_frame, start) => start(),
            column_navigation_url: (url) => url,
        },
    );
    queue_column_frames();
    assert.equal(frames[0].src, "");
    assert.equal(frames[1].src, "https://x.com/home");
    frames[0].visible = true;
    visible.set(frames[0], true);
    doc.hidden = true;
    queue_column_frames();
    assert.equal(frames[0].src, "");
    doc.hidden = false;
    queue_column_frames();
    assert.equal(frames[0].src, "https://x.com/home");
});
