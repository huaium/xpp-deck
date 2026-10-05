import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { productionDeclarations, transpile } from "./helpers/source.mjs";

test("native AST extraction preserves nested functions and event callbacks", () => {
    const declarations = productionDeclarations(`
        // function fake() {} must not become a declaration.
        function outer(value: string) {
            function inner(count: number) { return count + 1; }
            return value;
        }
        button.addEventListener("click", (event: MouseEvent) => event.type);
    `);
    assert.deepEqual(
        [...declarations.keys()],
        ["outer", "inner", "button_handler"],
    );
    const functions = vm.runInNewContext(
        transpile(`
        ${declarations.get("inner")}
        ${declarations.get("button_handler")}
        ({ inner, button_handler })
    `),
    );
    assert.equal(functions.inner(3), 4);
    assert.equal(functions.button_handler({ type: "click" }), "click");
});

test("type stripping preserves JavaScript text and generic function behavior", () => {
    const script = transpile(`
        type Value = { text: string };
        function identity<T>(value: T): T { return value; }
        const value: Value = {text: "number: string"};
        identity<Value>(value).text
    `);
    assert.equal(vm.runInNewContext(script), "number: string");
});
