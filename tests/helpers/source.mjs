import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// Execute production declarations without moving extension code for testing.
export function loadFunctions(file, names, preamble = "", globals = {}) {
    const source = readFileSync(
        new URL(file, new URL("../", import.meta.url)),
        "utf8",
    );
    const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
    );
    const declarations = new Map();
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name) {
            declarations.set(node.name.text, node.getText(tree));
        }
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "addEventListener" &&
            node.arguments[1]
        ) {
            const name = `${node.expression.expression.getText(tree)}_handler`;
            declarations.set(
                name,
                `const ${name} = ${node.arguments[1].getText(tree)};`,
            );
        }
        ts.forEachChild(node, visit);
    }
    visit(tree);
    const selected = names.map((name) => {
        assert.ok(
            declarations.has(name),
            `Missing production function ${name}`,
        );
        return declarations.get(name);
    });
    const javascript = ts.transpileModule(
        `${preamble}\n${selected.join("\n")}\n({${names.join(",")}})`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    return vm.runInNewContext(javascript, { URL, ...globals });
}
