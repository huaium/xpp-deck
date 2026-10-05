import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { API } from "typescript/unstable/sync";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import * as ts from "typescript/unstable/ast";

// TypeScript 7 parses through a native process; always release it after use.
export function productionDeclarations(source) {
    const api = new API({
        fs: createVirtualFileSystem({
            "/tsconfig.json": JSON.stringify({ files: ["/input.ts"] }),
            "/input.ts": source,
        }),
    });
    try {
        const tree = api
            .updateSnapshot({ openProject: "/tsconfig.json" })
            .getProject("/tsconfig.json")
            .program.getSourceFile("/input.ts");
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
            node.forEachChild(visit);
        }
        visit(tree);
        return declarations;
    } finally {
        api.close();
    }
}

export function transpile(source) {
    return stripTypeScriptTypes(source, { mode: "strip" });
}

// Execute production declarations without moving extension code for testing.
export function loadFunctions(file, names, preamble = "", globals = {}) {
    const source = readFileSync(
        new URL(file, new URL("../", import.meta.url)),
        "utf8",
    );
    const declarations = productionDeclarations(source);
    const selected = names.map((name) => {
        assert.ok(
            declarations.has(name),
            `Missing production function ${name}`,
        );
        return declarations.get(name);
    });
    const javascript = transpile(
        `${preamble}\n${selected.join("\n")}\n({${names.join(",")}})`,
    );
    return vm.runInNewContext(javascript, { URL, ...globals });
}
