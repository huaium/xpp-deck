import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("cooldown notice counts down, extends, expires and cleans up", () => {
    let until = 0;
    let tick;
    let listener;
    let cleared = 0;
    let selection = null;
    const elements = [];
    const { mount_cooldown_notice } = loadFunctions(
        "../src/content/cooldown-notice.ts",
        ["mount_cooldown_notice"],
        "",
        {
            document: {
                getSelection: () => selection,
                createElement: () => {
                    const element = {
                        setAttribute() {},
                        append() {},
                        contains: (node) => elements.includes(node),
                        remove() {
                            this.removed = true;
                        },
                    };
                    elements.push(element);
                    return element;
                },
            },
            chrome: {
                storage: {
                    onChanged: {
                        addListener: (fn) => {
                            listener = fn;
                        },
                        removeListener: (fn) => {
                            assert.equal(fn, listener);
                            listener = null;
                        },
                    },
                },
            },
            setTimeout: (fn) => {
                tick = fn;
                return 1;
            },
            clearTimeout: () => {
                cleared++;
            },
        },
    );
    const stop = mount_cooldown_notice(
        { appendChild() {} },
        () => until,
        (key) => key,
    );
    assert.equal(elements[0].hidden, true);
    until = Date.now() + 61000;
    listener({ xpd_rate_limit_until: {} });
    assert.equal(elements[0].hidden, false);
    assert.match(elements[2].textContent, /1:01/);
    selection = {
        isCollapsed: false,
        anchorNode: elements[1],
        focusNode: elements[2],
    };
    const selected_text = elements[2].textContent;
    until = Date.now() + 120000;
    tick();
    assert.equal(elements[2].textContent, selected_text);
    until = 0;
    tick();
    assert.equal(elements[0].hidden, false);
    selection = null;
    until = Date.now() + 120000;
    tick();
    assert.match(elements[2].textContent, /2:00/);
    until = 0;
    tick();
    assert.equal(elements[0].hidden, true);
    stop();
    assert.equal(listener, null);
    assert.equal(elements[0].removed, true);
    assert.ok(cleared > 0);
});
