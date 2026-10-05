import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { loadFunctions } from "./helpers/source.mjs";

test("view settings survive replacement iframe documents", () => {
    const attrs = new Set();
    const view = {
        value: "0",
        hasAttribute: (name) => attrs.has(name),
        setAttribute: (name) => attrs.add(name),
        getAttribute: () => "2",
    };
    const banner = { checked: false };
    let styles;
    const newDocument = () => {
        styles = new Map();
        return {
            querySelector: () => ({
                querySelector: (selector) => styles.get(selector),
                appendChild: (style) =>
                    styles.set(`style[${style.attribute}]`, style),
            }),
            createElement: () => ({
                setAttribute(name) {
                    this.attribute = name;
                },
            }),
        };
    };
    const frame = {
        hasAttribute: () => false,
        contentWindow: {
            location: { href: "https://x.com/home" },
            document: newDocument(),
        },
        closest: () => ({
            querySelector: (selector) =>
                selector === ".opd_banner" ? banner : view,
        }),
    };
    const { apply_column_view_settings } = loadFunctions(
        "../src/content/run.ts",
        ["apply_column_view_settings"],
    );
    apply_column_view_settings(frame);
    assert.equal(view.value, "2");
    view.value = "1";
    banner.checked = true;
    frame.contentWindow.document = newDocument();
    apply_column_view_settings(frame);
    assert.equal(view.value, "1");
    assert.equal(styles.get("style[opd_banner_css]").textContent, "");
    assert.match(styles.get("style[opd_tw_view_mode_css]").textContent, /:has/);
    assert.doesNotMatch(
        styles.get("style[opd_tw_view_mode_css]").textContent,
        /:not/,
    );
    apply_column_view_settings(frame);
    assert.equal(styles.size, 3);
});

test("all content templates share the same toolbar and settings panel", () => {
    const source = readFileSync(
        new URL("../src/content/run.ts", import.meta.url),
        "utf8",
    );
    for (const type of ["post", "home", "notification", "explore"]) {
        const template = source.match(
            new RegExp(`${type}: \\{\\s*html: (.*)`),
        )[1];
        assert.ok(template.includes("${default_element_bar}"));
        assert.ok(template.includes("${column_settings_panel}"));
    }
});

test("reapplying column setup does not duplicate load listeners", () => {
    const attrs = new Set();
    let listeners = 0;
    const frame = {
        closest: () => null,
        hasAttribute: (name) => attrs.has(name),
        setAttribute: (name) => attrs.add(name),
        removeAttribute: (name) => attrs.delete(name),
        addEventListener: () => listeners++,
    };
    const { append_object_css } = loadFunctions(
        "../src/content/run.ts",
        ["append_object_css"],
        "",
        {
            document: { querySelectorAll: () => [frame] },
            queue_column_frames() {},
            load_scheduler: { onDispose() {} },
            banner_observers: new WeakMap(),
        },
    );
    append_object_css();
    append_object_css();
    assert.equal(listeners, 2);
});

test("banner availability follows DOM changes and replaces observers on reload", () => {
    let present = false;
    const control = { style: {} };
    const observers = [];
    class Observer {
        constructor(callback) {
            this.callback = callback;
            observers.push(this);
        }
        observe() {}
        disconnect() {
            this.disconnected = true;
        }
    }
    const frame = {
        isConnected: true,
        closest: () => ({ querySelector: () => ({ closest: () => control }) }),
        contentWindow: {
            location: { href: "https://x.com/compose/post" },
            document: { querySelector: () => (present ? {} : null) },
        },
    };
    const { observe_column_banner } = loadFunctions(
        "../src/content/run.ts",
        ["observe_column_banner"],
        "",
        {
            MutationObserver: Observer,
            banner_observers: new WeakMap(),
        },
    );
    observe_column_banner(frame);
    assert.equal(control.style.display, "none");
    present = true;
    observers[0].callback();
    assert.equal(control.style.display, "");
    present = false;
    observers[0].callback();
    assert.equal(control.style.display, "none");
    observe_column_banner(frame);
    assert.equal(observers[0].disconnected, true);
    frame.isConnected = false;
    observers[1].callback();
    assert.equal(observers[1].disconnected, true);
});
