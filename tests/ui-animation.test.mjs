import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { loadFunctions } from "./helpers/source.mjs";

test("sidebar hides reflow until width settles and restores opacity", async () => {
    const calls = [];
    const pending = [];
    let applied = false;
    const element = {
        style: {},
        animate: (frames, options) => {
            calls.push({ frames, options });
            return {
                cancel() {},
                finished: new Promise((resolve) => pending.push(resolve)),
            };
        },
    };
    const { animate_sidebar_change } = loadFunctions(
        "../src/content/prelude.ts",
        ["animate_sidebar_change"],
        "const ui_animations = new WeakMap();",
        {
            window: {
                getComputedStyle: () => ({ opacity: "1" }),
                matchMedia: () => ({ matches: false }),
            },
        },
    );
    const change = animate_sidebar_change(element, () => {
        applied = true;
    });
    assert.equal(applied, false);
    pending[0]();
    await setTimeout(0);
    assert.equal(applied, true);
    assert.equal(element.style.opacity, "0");
    assert.equal(calls[1].options.delay, 180);
    pending[1]();
    await change;
    assert.equal(element.style.opacity, "");
});

test("dialog exit waits for both animations and skips reduced motion", async () => {
    let reduced = false;
    const pending = [];
    const calls = [];
    const element = {
        style: {},
        animate: (frames, options) => {
            calls.push({ frames, options });
            return {
                finished: new Promise((resolve) => pending.push(resolve)),
            };
        },
    };
    const { animate_dialog_exit } = loadFunctions(
        "../src/content/prelude.ts",
        ["animate_dialog_exit"],
        "",
        {
            window: { matchMedia: () => ({ matches: reduced }) },
        },
    );
    let finished = false;
    const exit = animate_dialog_exit(element, element).then(() => {
        finished = true;
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.duration, 160);
    assert.equal(calls[1].frames[1].transform, "translateY(6px)");
    assert.equal(finished, false);
    pending.forEach((resolve) => resolve());
    await exit;
    assert.equal(finished, true);
    reduced = true;
    await animate_dialog_exit(element, element);
    assert.equal(calls.length, 2);
});

test("entrance animations are short, cancellable, and respect reduced motion", () => {
    let reduced = false;
    const calls = [];
    const animations = [];
    const element = {
        animate: (frames, options) => {
            calls.push({ frames, options });
            const animation = {
                cancel() {
                    this.cancelled = true;
                    this.oncancel?.();
                },
            };
            animations.push(animation);
            return animation;
        },
    };
    const { animate_ui_entrance } = loadFunctions(
        "../src/content/prelude.ts",
        ["animate_ui_entrance"],
        "const ui_animations = new WeakMap();",
        {
            window: { matchMedia: () => ({ matches: reduced }) },
        },
    );
    animate_ui_entrance(null);
    animate_ui_entrance(element);
    assert.equal(calls[0].options.duration, 180);
    assert.equal(calls[0].frames[0].transform, "translateY(8px)");
    animate_ui_entrance(element);
    assert.equal(animations[0].cancelled, true);
    animations[1].onfinish();
    reduced = true;
    animate_ui_entrance(element);
    assert.equal(calls.length, 2);
    assert.equal(animations[1].cancelled, undefined);
});
