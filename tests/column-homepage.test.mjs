import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("homepage editing, current-page capture, and navigation stay independent", async () => {
    class Element {
        children = [];
        handlers = new Map();
        appendChild(child) {
            this.children.push(child);
        }
        append(...children) {
            this.children.push(...children);
        }
        prepend(child) {
            this.children.unshift(child);
        }
        insertBefore(child) {
            this.children.push(child);
        }
        setAttribute() {}
        addEventListener(name, handler) {
            this.handlers.set(name, handler);
        }
        querySelector() {
            return null;
        }
    }
    const bar = new Element();
    const panel = new Element();
    const attributes = new Map();
    const frame = {
        src: "",
        getAttribute: () => "https://x.com/home",
        contentWindow: { location: { href: "https://x.com/search?q=test" } },
    };
    const column = {
        hasAttribute: (name) => attributes.has(name),
        getAttribute: (name) => attributes.get(name),
        setAttribute: (name, value) => attributes.set(name, value),
        querySelector: (selector) =>
            selector === ".column_bar"
                ? bar
                : selector === "iframe"
                  ? frame
                  : panel,
    };
    let saves = 0;
    let alerts = 0;
    const { bind_column_homepage: bind } = loadFunctions(
        "../src/content/run.ts",
        ["bind_column_homepage", "normalize_custom_x_path"],
        "",
        {
            document: { createElement: () => new Element() },
            i18n_message: (key) => key,
            queue_column_navigation: (_frame, navigate) => navigate(),
            column_settings_save: () => saves++,
            last_load_profile: 0,
            opd_alert: async () => alerts++,
        },
    );
    bind(column);
    bind(column);
    assert.equal(bar.children.length, 1);
    const [, input, current] = panel.children[0].children;
    input.value = "/i/bookmarks";
    input.handlers.get("keydown")({ key: "Enter", preventDefault() {} });
    assert.equal(attributes.get("opd_homepage_path"), "/i/bookmarks");
    assert.equal(frame.src, "");
    input.value = "https://example.com";
    input.handlers.get("blur")();
    assert.equal(input.value, "https://x.com/i/bookmarks");
    assert.equal(alerts, 1);
    await current.handlers.get("click")();
    assert.equal(attributes.get("opd_homepage_path"), "/search?q=test");
    assert.equal(saves, 2);
    bar.children[0].children[0].handlers.get("click")();
    assert.equal(frame.src, "https://x.com/search?q=test");
});

test("homepage migration prefers explicit homepage, then legacy pin, then original URL", () => {
    const { resolve_column_homepage: resolve } = loadFunctions(
        "../src/content/run.ts",
        ["resolve_column_homepage", "normalize_custom_x_path"],
    );
    assert.equal(
        resolve(
            {
                column_homepage_path: "/search?q=test",
                column_pinned_path: "/i/bookmarks",
            },
            "https://x.com/home",
        ),
        "/search?q=test",
    );
    assert.equal(
        resolve({ column_pinned_path: "/i/bookmarks" }, "https://x.com/home"),
        "/i/bookmarks",
    );
    assert.equal(resolve({}, "https://x.com/notifications"), "/notifications");
    assert.equal(
        resolve(
            { column_homepage_path: "https://example.com" },
            "https://x.com/home",
        ),
        "/home",
    );
});

test("all content column types persist their homepage location", () => {
    for (const type of ["home", "notification", "post", "explore"]) {
        const attributes = {
            opd_column_type: type,
            opd_homepage_path: "/i/bookmarks",
        };
        const { column_settings_save } = loadFunctions(
            "../src/content/run.ts",
            ["column_settings_save"],
            "",
            {
                document: {
                    querySelectorAll: () => [
                        {
                            getAttribute: (key) => attributes[key] ?? null,
                            querySelector: () => null,
                        },
                    ],
                },
                manifest: { version: "1" },
                last_load_profile: 0,
            },
        );
        assert.equal(
            column_settings_save("profile_out").column_settings[0]
                .column_homepage_path,
            "/i/bookmarks",
        );
    }
});

test("queued navigation starts at the homepage URL rather than the column default", () => {
    for (const type of ["home", "notification", "post", "explore"]) {
        const frame = {
            src: "",
            closest: () => ({ getAttribute: () => "/i/bookmarks" }),
            getAttribute: () => "https://x.com/home",
            removeAttribute() {},
        };
        const { queue_column_frames } = loadFunctions(
            "../src/content/run.ts",
            ["queue_column_frames"],
            "",
            {
                document: { querySelectorAll: () => [frame] },
                queue_column_navigation: (_frame, navigate) => navigate(),
            },
        );
        queue_column_frames();
        assert.equal(frame.src, "https://x.com/i/bookmarks", type);
    }
});
