import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("shared dropdown arrows cover deck and dialog controls without duplicate styles", () => {
    const styles = [];
    const { ensure_dropdown_style } = loadFunctions(
        "../src/content/dropdown-style.ts",
        ["ensure_dropdown_style"],
        "",
        {
            document: {
                getElementById: (id) => styles.find((style) => style.id === id),
                createElement: () => ({}),
                head: { appendChild: (style) => styles.push(style) },
            },
        },
    );
    ensure_dropdown_style();
    ensure_dropdown_style();
    assert.equal(styles.length, 1);
    assert.match(
        styles[0].textContent,
        /#opd_main_element select, \.opd_dialog_overlay select/,
    );
    assert.match(styles[0].textContent, /right 12px center/);
    assert.match(styles[0].textContent, /padding-right:40px/);
    assert.match(styles[0].textContent, /\.opd_dialog_theme_dark select/);
});
