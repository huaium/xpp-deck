import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { dialogHarness } from "./helpers/dialog.mjs";

test("prompt selects its default input, submits edits, and restores focus", async () => {
    const h = dialogHarness();
    const result = h.open({
        type: "prompt",
        message: "Width",
        defaultValue: "30",
    });
    await Promise.resolve();
    const [input] = h.controls();
    assert.equal(h.document.activeElement, input);
    assert.equal(input.value, "30");
    assert.equal(input.selected, true);
    input.value = "45";
    h.key("Enter");
    assert.equal(await result, "45");
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.document.body.children.length, 0);
    assert.equal(h.listeners.size, 0);
});

test("confirm supports OK clicks and Enter on focused Cancel", async () => {
    for (const cancel of [false, true]) {
        const h = dialogHarness();
        const result = h.open({ type: "confirm", message: "Delete?" });
        await Promise.resolve();
        const [cancelButton, okButton] = h.controls();
        if (cancel) {
            cancelButton.focus();
            h.key("Enter");
        } else okButton.click();
        assert.equal(await result, !cancel);
    }
});

test("Escape cancels prompts and confirmations with their respective values", async () => {
    for (const [type, expected] of [
        ["prompt", null],
        ["confirm", false],
    ]) {
        const h = dialogHarness();
        const result = h.open({ type, message: "Question" });
        await Promise.resolve();
        h.key("Escape");
        assert.equal(await result, expected);
    }
});

test("IME Enter and Escape do not dismiss the dialog", async () => {
    const h = dialogHarness();
    const result = h.open({ type: "prompt", message: "Input" });
    await Promise.resolve();
    for (const options of [{ isComposing: true }, { keyCode: 229 }]) {
        h.key("Enter", options);
        h.key("Escape", options);
        assert.equal(h.document.body.children.length, 1);
    }
    h.key("Escape");
    assert.equal(await result, null);
});

test("Tab wraps at dialog boundaries and recovers escaped focus", async () => {
    const h = dialogHarness();
    const result = h.open({ type: "prompt", message: "Input" });
    await Promise.resolve();
    const [input, , ok] = h.controls();
    assert.equal(h.key("Tab", { shiftKey: true }).prevented, true);
    assert.equal(h.document.activeElement, ok);
    assert.equal(h.key("Tab").prevented, true);
    assert.equal(h.document.activeElement, input);
    h.trigger.focus();
    h.key("Tab");
    assert.equal(h.document.activeElement, input);
    h.key("Escape");
    await result;
});

test("alert remains open on Escape and closes on acknowledgement", async () => {
    const h = dialogHarness();
    const result = h.open({ type: "alert", message: "Saved" });
    await Promise.resolve();
    assert.equal(h.controls().length, 1);
    h.key("Escape");
    assert.equal(h.document.body.children.length, 1);
    h.controls()[0].click();
    assert.equal(await result, undefined);
});

test("dialog queue waits for dismissal before opening the next dialog", async () => {
    const { enqueue_opd_dialog: enqueue } = loadFunctions(
        "../src/content/prelude.ts",
        ["enqueue_opd_dialog"],
        "let opd_dialog_queue = Promise.resolve();",
    );
    const opened = [];
    let dismiss;
    const first = enqueue(() => {
        opened.push("first");
        return new Promise((resolve) => {
            dismiss = resolve;
        });
    });
    const second = enqueue(() => {
        opened.push("second");
        return Promise.resolve(false);
    });
    await Promise.resolve();
    assert.deepEqual(opened, ["first"]);
    dismiss("value");
    assert.equal(await first, "value");
    assert.equal(await second, false);
    assert.deepEqual(opened, ["first", "second"]);
});

test("a failed dialog does not block subsequent dialogs", async () => {
    const { enqueue_opd_dialog: enqueue } = loadFunctions(
        "../src/content/prelude.ts",
        ["enqueue_opd_dialog"],
        "let opd_dialog_queue = Promise.resolve();",
    );
    await assert.rejects(
        enqueue(() => Promise.reject(new Error("failed"))),
        /failed/,
    );
    assert.equal(await enqueue(() => Promise.resolve("next")), "next");
});
