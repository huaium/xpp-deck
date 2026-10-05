import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("shared Web Awesome styling covers deck and dialog controls without duplicate styles", () => {
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
        /#opd_main_element wa-select,\.opd_dialog_overlay wa-select/,
    );
    assert.match(styles[0].textContent, /wa-select::part\(combobox\)/);
    assert.doesNotMatch(
        styles[0].textContent,
        /data:image\/svg|appearance:none/,
    );
});
