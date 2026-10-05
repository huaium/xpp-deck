import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions, transpile } from "./helpers/source.mjs";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import vm from "node:vm";

function bootstrap(cookie, dark = false, storageThrows = false) {
    const listeners = {};
    const attributes = {};
    const storage = new Map();
    let themeListener;
    let cleanup;
    const context = {
        document: {
            cookie,
            getElementById: () => null,
            createElement: () => ({}),
            documentElement: {
                setAttribute: (key, value) => {
                    attributes[key] = value;
                },
                appendChild: () => {},
            },
        },
        window: {
            matchMedia: () => ({
                matches: dark,
                addEventListener: (_name, fn) => {
                    themeListener = fn;
                },
                removeEventListener: () => {
                    themeListener = undefined;
                },
            }),
            addEventListener: (name, fn) => {
                listeners[name] = fn;
            },
            removeEventListener: (name) => {
                delete listeners[name];
            },
        },
        sessionStorage: {
            getItem: (key) => {
                if (storageThrows) throw new Error("unavailable");
                return storage.get(key);
            },
            removeItem: (key) => storage.delete(key),
        },
    };
    const source = readFileSync(
        new URL("../src/content/reload_guard.ts", import.meta.url),
        "utf8",
    );
    cleanup = vm.runInNewContext(
        transpile(source) + "\nstart_reload_guard();",
        context,
    );
    return { listeners, attributes, storage, themeListener, cleanup };
}

test("bootstrap respects explicit cookie themes and falls back to system theme", () => {
    for (const [cookie, dark, expected] of [
        ["night_mode=0", true, "light"],
        ["other=1; night_mode=1", false, "dark"],
        ["night_mode=2", false, "dark"],
        ["", true, "dark"],
        ["night_mode=invalid", false, "light"],
    ]) {
        assert.equal(
            bootstrap(cookie, dark).attributes["data-opd-theme"],
            expected,
        );
    }
    assert.equal(typeof bootstrap("").themeListener, "function");
    assert.equal(bootstrap("night_mode=1").themeListener, undefined);
});

test("intentional reload bypass is consumed once; later navigation warns", () => {
    const { listeners, storage } = bootstrap("");
    storage.set("opd_beforeunload_bypass_once", "1");
    let prevented = 0;
    const event = {
        preventDefault: () => {
            prevented++;
        },
    };
    listeners.beforeunload(event);
    assert.equal(prevented, 0);
    assert.equal(storage.size, 0);
    listeners.beforeunload(event);
    assert.equal(prevented, 1);
    assert.equal(event.returnValue, "");
});

test("reload guard still warns when session storage is unavailable", () => {
    const { listeners } = bootstrap("", false, true);
    let prevented = false;
    listeners.beforeunload({
        preventDefault: () => {
            prevented = true;
        },
    });
    assert.equal(prevented, true);
});

test("theme follows system changes and removes the listener when an explicit theme is chosen", () => {
    let mode = "system";
    const listeners = new Set();
    const root = new Map();
    const main = new Map();
    const query = {
        matches: false,
        addEventListener: (_event, fn) => listeners.add(fn),
        removeEventListener: (_event, fn) => listeners.delete(fn),
    };
    const { apply_theme_for_main_element: apply } = loadFunctions(
        "../src/content/settings.ts",
        ["apply_theme_for_main_element"],
        "let apply_ui_color = null; let is_added_system_color_mode = false;",
        {
            get_cookie_color_mode: () => mode,
            system_dark_query: query,
            opd_root_theme_attribute: "data-opd-theme",
            document: {
                documentElement: {
                    setAttribute: (key, value) => root.set(key, value),
                },
            },
        },
    );
    const element = { setAttribute: (key, value) => main.set(key, value) };
    apply(element);
    assert.equal(main.get("opd-dsp-theme"), "light");
    assert.equal(listeners.size, 1);
    query.matches = true;
    for (const listener of listeners) listener();
    assert.equal(main.get("opd-dsp-theme"), "dark");
    assert.equal(root.get("data-opd-theme"), "dark");
    mode = "light";
    apply(element);
    assert.equal(listeners.size, 0);
    assert.equal(main.get("opd-dsp-theme"), "light");
    mode = "dark";
    apply(element);
    assert.equal(root.get("data-opd-theme"), "dark");
    apply(null);
});

test("reload guard releases listeners when its WXT context is invalidated", () => {
    const guard = bootstrap("");
    assert.equal(typeof guard.listeners.beforeunload, "function");
    guard.cleanup();
    assert.equal(guard.listeners.beforeunload, undefined);
});
