import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

for (const button of [
    "add_post_btn",
    "add_timeline_btn",
    "add_notify_btn",
    "add_explore_button",
    "add_lists_button",
]) {
    test(`${button} cancellation stops column creation and prompts`, async () => {
        let confirmations = 0;
        const handlerName = `${button}_handler`;
        const functions = loadFunctions(
            "../src/content/run.ts",
            [handlerName],
            "",
            {
                i18n_message: (key) => key,
                xpd_confirm: async () => {
                    confirmations++;
                    return false;
                },
                xpd_prompt: () =>
                    assert.fail("must not prompt after cancellation"),
                add_explore_column_with_path: () =>
                    assert.fail("must not add after cancellation"),
            },
        );
        await functions[handlerName]();
        assert.equal(confirmations, 1);
    });
}
