import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { loadFunctions, transpile } from "./helpers/source.mjs";

const { EventTarget, Event, CustomEvent } = globalThis;

function harness() {
    const window = new EventTarget();
    const document = new EventTarget();
    const dispatch = document.dispatchEvent.bind(document);
    document.dispatchEvent = (event) => {
        window.dispatchEvent(event);
        return dispatch(event);
    };
    let section = null;
    let script;
    let refreshes = 0;
    document.querySelector = () => section;
    document.createElement = () => new EventTarget();
    document.head = {
        appendChild: (node) => {
            script = node;
        },
    };
    const { start_auto_reload_helper } = loadFunctions(
        "../src/extensions/auto_reload_helper.ts",
        ["start_auto_reload_helper"],
        "",
        {
            window,
            document,
            CustomEvent,
            location: { pathname: "/home", search: "" },
            MutationObserver: class {
                observe() {}
            },
        },
    );
    const source = readFileSync(
        new URL("../src/extensions/auto_reload.ts", import.meta.url),
        "utf8",
    );
    const reload = vm.runInNewContext(
        transpile(source) + "; new XpdExtAutoReload()",
        {
            CustomEvent,
            crypto: { randomUUID: () => "token" },
            chrome: { runtime: { getURL: (path) => path } },
            setTimeout: (fn) => {
                fn();
            },
        },
    );
    reload.Init({ document });
    return {
        reload: () => reload.Reload({ document }),
        load() {
            start_auto_reload_helper();
            script.dispatchEvent(new Event("load"));
        },
        hook(present) {
            section = present
                ? {
                      __reactProps$test: {
                          children: [
                              null,
                              {
                                  props: {
                                      children: [
                                          null,
                                          null,
                                          {
                                              _owner: {
                                                  memoizedProps: {
                                                      onRefresh: () =>
                                                          refreshes++,
                                                  },
                                              },
                                          },
                                      ],
                                  },
                              },
                          ],
                      },
                  }
                : null;
        },
        refreshes: () => refreshes,
    };
}

test("reload reports failure when the helper or X refresh hook is unavailable", () => {
    const h = harness();
    assert.equal(h.reload(), false);
    h.load();
    assert.equal(h.reload(), false);
    h.hook(true);
    assert.equal(h.reload(), true);
    assert.equal(h.refreshes(), 1);
    h.hook(false);
    assert.equal(h.reload(), false);
    assert.equal(h.refreshes(), 1);
});
