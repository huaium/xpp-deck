import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

function harness(pinned = false) {
    let resolve;
    const prompts = [];
    let saves = 0;
    let updates = 0;
    class Input {
        checked = pinned;
    }
    const column = {
        isConnected: true,
        querySelector: () => new Input(),
        remove() {
            this.isConnected = false;
        },
    };
    class Button {
        attributes = new Set();
        hasAttribute(name) { return this.attributes.has(name); }
        setAttribute(name) { this.attributes.add(name); }
        closest() { return column; }
        addEventListener(name, handler) {
            assert.equal(this.handler, undefined);
            this.handler = handler;
        }
        click() { return this.handler({ currentTarget: this }); }
    }
    const button = new Button();
    const { column_close } = loadFunctions("../src/content/run.ts", ["column_close"], "", {
        document: { querySelectorAll: () => [button] },
        HTMLElement: Button,
        HTMLInputElement: Input,
        i18n_message: (key) => key,
        opd_confirm: (message) => {
            prompts.push(message);
            return new Promise((done) => { resolve = done; });
        },
        append_object_css: () => { updates++; },
        column_settings_save: () => { saves++; },
        last_load_profile: 0,
    });
    column_close();
    return { button, column, prompts, column_close,
        answer: (value) => resolve(value),
        counts: () => ({ saves, updates }),
    };
}

for (const pinned of [false, true]) {
    test(`closing ${pinned ? "pinned" : "unpinned"} column requires OK`, async () => {
        const h = harness(pinned);
        const pending = h.button.click();
        assert.equal(h.column.isConnected, true);
        assert.deepEqual(h.prompts, [pinned ? "msg_pinned_column_close_confirm" : "msg_column_close_confirm"]);
        h.answer(true);
        await pending;
        assert.equal(h.column.isConnected, false);
        assert.deepEqual(h.counts(), { saves: 1, updates: 1 });
    });
}

test("Cancel preserves column and permits another confirmation", async () => {
    const h = harness();
    const pending = h.button.click();
    h.answer(false);
    await pending;
    assert.equal(h.column.isConnected, true);
    assert.deepEqual(h.counts(), { saves: 0, updates: 0 });
    const retry = h.button.click();
    h.answer(true);
    await retry;
    assert.equal(h.prompts.length, 2);
});

test("rebinding and repeated clicks do not duplicate confirmation", async () => {
    const h = harness();
    h.column_close();
    const pending = h.button.click();
    await h.button.click();
    assert.equal(h.prompts.length, 1);
    h.answer(true);
    await pending;
    assert.equal(h.counts().saves, 1);
});

test("confirmation does not save a column removed while dialog was open", async () => {
    const h = harness();
    const pending = h.button.click();
    h.column.isConnected = false;
    h.answer(true);
    await pending;
    assert.equal(h.counts().saves, 0);
});
