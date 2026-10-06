import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions, transpile } from "./helpers/source.mjs";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import vm from "node:vm";

function bootstrap(
    cookie,
    dark = false,
    storageThrows = false,
    development = false,
    { href = "https://x.com/run-xppdeck", embedded = false } = {},
) {
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
            location: new URL(href),
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
    context.window.top = embedded ? {} : context.window;
    const source = readFileSync(
        new URL("../src/content/reload_guard.ts", import.meta.url),
        "utf8",
    );
    cleanup = vm.runInNewContext(
        transpile(source) + `\nstart_reload_guard(${development});`,
        context,
    );
    return {
        listeners,
        attributes,
        storage,
        themeListener,
        cleanup,
        window: context.window,
    };
}

test("leave-page warnings are limited to top-level HTTPS deck routes", () => {
    for (const href of [
        "https://x.com/home",
        "https://x.com/notifications",
        "https://twitter.com/home",
        "https://x.com/run-xppdeck/other",
        "http://x.com/run-xppdeck",
        "https://example.com/run-xppdeck",
    ]) {
        assert.equal(
            bootstrap("", false, false, false, { href }).listeners.beforeunload,
            undefined,
        );
    }
    for (const href of [
        "https://x.com/run-xppdeck",
        "https://twitter.com/run-xppdeck?test=1",
    ]) {
        assert.equal(
            typeof bootstrap("", false, false, false, { href }).listeners
                .beforeunload,
            "function",
        );
        assert.equal(
            bootstrap("", false, false, false, { href, embedded: true })
                .listeners.beforeunload,
            undefined,
        );
    }
});

test("the deck warning does not follow SPA navigation to an ordinary X page", () => {
    const h = bootstrap("");
    h.window.location.pathname = "/home";
    h.listeners.beforeunload({
        preventDefault: () => assert.fail("ordinary pages must not warn"),
    });
});

test("development skips leave-page confirmation but retains theme initialization", () => {
    const h = bootstrap("", true, false, true);
    assert.equal(h.listeners.beforeunload, undefined);
    assert.equal(h.attributes["data-opd-theme"], "dark");
    assert.equal(typeof h.themeListener, "function");
    h.cleanup();
    assert.equal(typeof bootstrap("").listeners.beforeunload, "function");
});

test("bootstrap respects explicit cookie themes and falls back to system theme", () => {
    for (const [cookie, dark, expected] of [
        ["opd_theme=light", true, "light"],
        ["other=1; opd_theme=dark", false, "dark"],
        ["opd_theme=dark", false, "dark"],
        ["", true, "dark"],
        ["opd_theme=invalid", false, "light"],
    ]) {
        assert.equal(
            bootstrap(cookie, dark).attributes["data-opd-theme"],
            expected,
        );
    }
    assert.equal(typeof bootstrap("").themeListener, "function");
    assert.equal(bootstrap("opd_theme=dark").themeListener, undefined);
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
    apply(element);
    apply(element);
    assert.equal(listeners.size, 1);
    mode = "light";
    apply(element);
    assert.equal(listeners.size, 0);
    assert.equal(main.get("opd-dsp-theme"), "light");
    query.matches = true;
    for (const listener of listeners) listener();
    assert.equal(main.get("opd-dsp-theme"), "light");
    assert.equal(root.get("data-opd-theme"), "light");
    mode = "system";
    apply(element);
    apply(element);
    mode = "dark";
    apply(element);
    assert.equal(listeners.size, 0);
    query.matches = false;
    for (const listener of listeners) listener();
    assert.equal(main.get("opd-dsp-theme"), "dark");
    assert.equal(root.get("data-opd-theme"), "dark");
    apply(null);
});

test("reload guard releases listeners when its WXT context is invalidated", () => {
    const guard = bootstrap("");
    assert.equal(typeof guard.listeners.beforeunload, "function");
    guard.cleanup();
    assert.equal(guard.listeners.beforeunload, undefined);
});
