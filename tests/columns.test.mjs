import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

function harness(supported = true) {
    let saves = 0;
    let alerts = 0;
    class Element {
        handlers = new Map();
        attributes = new Map();
        classes = new Set();
        classList = {
            add: (...names) => names.forEach((name) => this.classes.add(name)),
            remove: (...names) =>
                names.forEach((name) => this.classes.delete(name)),
            contains: (name) => this.classes.has(name),
        };
        addEventListener(name, handler) {
            assert.equal(
                this.handlers.has(name),
                false,
                "Handlers must only bind once",
            );
            this.handlers.set(name, handler);
        }
        hasAttribute(key) {
            return this.attributes.has(key);
        }
        setAttribute(key, value) {
            this.attributes.set(key, value);
        }
        matches() {
            return this !== empty;
        }
        contains(node) {
            return node === this;
        }
        getBoundingClientRect() {
            return { left: 100, width: 200 };
        }
        get nextElementSibling() {
            return order[order.indexOf(this) + 1] ?? null;
        }
        querySelector() {
            assert.fail("Must not touch iframe URLs");
        }
    }
    const a = new Element();
    a.id = "a";
    const b = new Element();
    b.id = "b";
    const c = new Element();
    c.id = "c";
    const empty = new Element();
    empty.classes.add("dsp_column_emptycolumn");
    const order = [a, b, c, empty];
    const parent = supported
        ? {
              moveBefore(node, reference) {
                  order.splice(order.indexOf(node), 1);
                  order.splice(
                      reference ? order.indexOf(reference) : order.length,
                      0,
                      node,
                  );
              },
          }
        : {};
    order.forEach((column) => (column.parentElement = parent));
    const body = new Element();
    const { column_dd } = loadFunctions(
        "../src/content/run.ts",
        ["column_dd"],
        "",
        {
            document: {
                body,
                querySelectorAll: (selector) =>
                    selector === ".dsp_column"
                        ? order
                        : order.filter(
                              (column) =>
                                  column.classes.has("xpd_drop_before") ||
                                  column.classes.has("xpd_drop_after"),
                          ),
                querySelector: () =>
                    order.find((column) =>
                        column.classes.has("xpd_column_dragging"),
                    ) ?? null,
            },
            Node: Element,
            column_rename() {},
            last_load_profile: 0,
            column_settings_save: () => saves++,
            xpd_alert: () => alerts++,
            i18n_message_or_fallback: (_key, fallback) => fallback,
        },
    );
    column_dd();
    column_dd();
    const dataTransfer = { setData() {}, effectAllowed: "", dropEffect: "" };
    const event = (clientX = 110) => ({
        clientX,
        dataTransfer,
        preventDefault() {},
        stopPropagation() {},
    });
    return {
        a,
        b,
        c,
        empty,
        order,
        body,
        dataTransfer,
        event,
        saves: () => saves,
        alerts: () => alerts,
    };
}

test("dragging uses midpoint insertion, cleans feedback, and saves once", () => {
    for (const after of [false, true]) {
        const h = harness();
        h.a.handlers.get("dragstart")(h.event());
        assert.equal(h.dataTransfer.effectAllowed, "move");
        h.c.handlers.get("dragover")(h.event(after ? 290 : 110));
        assert.ok(
            h.c.classes.has(after ? "xpd_drop_after" : "xpd_drop_before"),
        );
        assert.equal(h.dataTransfer.dropEffect, "move");
        h.c.handlers.get("drop")(h.event(after ? 290 : 110));
        assert.deepEqual(
            h.order.map((node) => node.id).slice(0, 3),
            after ? ["b", "c", "a"] : ["b", "a", "c"],
        );
        assert.equal(h.saves(), 1);
        assert.equal(h.body.classes.size, 0);
        assert.ok(
            h.order.every(
                (node) => node.classes.size === (node === h.empty ? 1 : 0),
            ),
        );
    }
});

test("cancelled, external and no-op drags do not save", () => {
    const h = harness();
    h.c.handlers.get("drop")(h.event());
    h.a.handlers.get("dragstart")(h.event());
    h.b.handlers.get("drop")(h.event());
    h.a.handlers.get("dragstart")(h.event());
    h.c.handlers.get("dragover")(h.event());
    h.c.handlers.get("dragleave")({ relatedTarget: h.c });
    assert.ok(h.c.classes.has("xpd_drop_before"));
    h.a.handlers.get("dragend")();
    assert.equal(h.saves(), 0);
    assert.equal(h.body.classes.size, 0);
    assert.equal(h.c.classes.size, 0);
});

test("empty slots accept end placement and unsupported browsers never disconnect frames", () => {
    for (const supported of [true, false]) {
        const h = harness(supported);
        h.a.handlers.get("dragstart")(h.event());
        h.empty.handlers.get("drop")(h.event(290));
        assert.equal(h.order[2].id, supported ? "a" : "c");
        assert.equal(h.saves(), supported ? 1 : 0);
        assert.equal(h.alerts(), supported ? 0 : 1);
    }
});
