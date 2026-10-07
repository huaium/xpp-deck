import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("Firefox requests the custom-element fallback before loading components", async () => {
    for (const [origin, expected] of [
        ["moz-extension://test/", true],
        ["chrome-extension://test/", undefined],
    ]) {
        const registry = {};
        const { prepare_custom_element_registry: prepare } = loadFunctions(
            "../src/content/custom-element-registry.ts",
            ["prepare_custom_element_registry"],
            "",
            {
                customElements: registry,
                chrome: { runtime: { getURL: () => origin } },
            },
        );
        let completed = false;
        await prepare(async () => {
            assert.equal(registry.forcePolyfill, expected);
            completed = true;
        });
        assert.equal(completed, true);
    }
});

test("Firefox polyfill accepts valid prototypes from another realm", async () => {
    const { default: config } = await import("../wxt.config.mjs");
    const vm = await import("node:vm");
    const foreign = vm.runInNewContext("({})");
    const code =
        'if (!(c instanceof Object)) throw new TypeError("invalid prototype");';
    assert.throws(
        () => vm.runInNewContext(code, { c: foreign }),
        /invalid prototype/,
    );
    const plugin = config.vite({ browser: "firefox" }).plugins[0];
    const transformed = plugin.transform(
        code,
        "/node_modules/@webcomponents/custom-elements/custom-elements.min.js",
    );
    assert.doesNotThrow(() => vm.runInNewContext(transformed, { c: foreign }));
    for (const c of [null, 1, "not a prototype"])
        assert.throws(
            () => vm.runInNewContext(transformed, { c }),
            /invalid prototype/,
        );
    assert.deepEqual(config.vite({ browser: "chrome" }).plugins, []);
});
