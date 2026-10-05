import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("settings animate both directions and cancel interrupted transitions", () => {
    const animations = [];
    let reduced = false;
    const attrs = new Set();
    const panel = {
        style: { display: "none" },
        getBoundingClientRect: () => ({
            height: panel.style.display === "none" ? 0 : 240,
        }),
        toggleAttribute: (name, enabled) =>
            enabled ? attrs.add(name) : attrs.delete(name),
        closest: () => ({
            querySelector: () => ({ setAttribute() {} }),
            setAttribute() {},
        }),
        animate: (frames, options) => {
            const animation = {
                frames,
                options,
                cancel() {
                    this.cancelled = true;
                },
            };
            animations.push(animation);
            return animation;
        },
    };
    const { set_column_settings_open } = loadFunctions(
        "../src/content/run.ts",
        ["set_column_settings_open"],
        "",
        {
            settings_animations: new WeakMap(),
            window: { matchMedia: () => ({ matches: reduced }) },
            getComputedStyle: () => ({ opacity: "0.5" }),
        },
    );
    set_column_settings_open(panel, true);
    assert.equal(animations[0].frames[0].height, "0px");
    assert.equal(animations[0].frames[1].height, "240px");
    assert.equal(panel.inert, false);
    set_column_settings_open(panel, false);
    assert.equal(animations[0].cancelled, true);
    animations[0].onfinish();
    assert.equal(panel.style.display, "flex");
    assert.equal(animations[1].frames[1].height, "0px");
    assert.equal(panel.inert, true);
    animations[1].onfinish();
    assert.equal(panel.style.display, "none");
    reduced = true;
    set_column_settings_open(panel, true);
    assert.equal(panel.style.display, "flex");
    set_column_settings_open(panel, false);
    assert.equal(panel.style.display, "none");
    assert.equal(animations.length, 2);
});
