import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("every content column can pin and unpin its current URL", async () => {
    for (const [type, path, waiting] of [
        ["home", "/home", false],
        ["notification", "/notifications", false],
        ["post", "/compose/post", false],
        ["explore", "/explore", false],
        ["explore", "/i/lists/42", false],
        ["explore", "/i/bookmarks?test=1", false],
        ["explore", "/search?q=test", false],
        ["home", "/home", true],
        ["notification", "/notifications", true],
        ["post", "/compose/post", true],
        ["explore", "/i/lists/42", true],
    ]) {
        const attributes = new Map([["opd_column_type", type]]);
        class Element {
            attributes = new Map();
            children = [];
            handlers = new Map();
            appendChild(child) {
                this.children.push(child);
            }
            insertBefore(child) {
                this.children.push(child);
            }
            querySelector() {
                return null;
            }
            hasAttribute(key) {
                return this.attributes.has(key);
            }
            setAttribute(key, value) {
                this.attributes.set(key, value);
            }
            addEventListener(name, handler) {
                this.handlers.set(name, handler);
            }
        }
        const bar = new Element();
        const frame = {
            contentWindow: {
                location: {
                    href: waiting ? "about:blank" : `https://x.com${path}`,
                },
            },
            getAttribute: () => (waiting ? `https://x.com${path}` : null),
        };
        const column = {
            isConnected: true,
            getAttribute: (key) => attributes.get(key) ?? null,
            setAttribute: (key, value) => attributes.set(key, value),
            querySelector: (selector) =>
                selector === ".column_bar"
                    ? bar
                    : selector === "iframe"
                      ? frame
                      : (bar.children[0]?.children[0] ?? null),
        };
        let confirmed = true;
        let saves = 0;
        const { bind_column_pin } = loadFunctions(
            "../src/content/run.ts",
            ["bind_column_pin", "normalize_custom_x_path"],
            "",
            {
                document: { createElement: () => new Element() },
                i18n_message: (key) => key,
                opd_confirm: async () => confirmed,
                opd_alert: async () => assert.fail("Unexpected alert"),
                last_load_profile: 0,
                column_settings_save: () => saves++,
            },
        );
        bind_column_pin(column);
        bind_column_pin(column);
        assert.equal(bar.children.length, 1);
        const checkbox = bar.children[0].children[0];
        checkbox.checked = true;
        await checkbox.handlers.get("click")();
        assert.equal(attributes.get("opd_pinned_path"), path);
        assert.equal(checkbox.checked, true);
        confirmed = false;
        checkbox.checked = false;
        await checkbox.handlers.get("click")();
        assert.equal(checkbox.checked, true);
        assert.equal(saves, 1);
        confirmed = true;
        checkbox.checked = false;
        await checkbox.handlers.get("click")();
        assert.equal(attributes.get("opd_pinned_path"), "");
        assert.equal(checkbox.checked, false);
        assert.equal(checkbox.disabled, false);
        assert.equal(saves, 2);
    }
});

test("all content column types persist their pinned location", () => {
    for (const type of ["home", "notification", "post", "explore"]) {
        const attributes = {
            opd_column_type: type,
            opd_pinned_path: "/i/bookmarks",
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
                .column_pinned_path,
            "/i/bookmarks",
        );
    }
});

test("queued navigation starts at the pinned URL rather than the column default", () => {
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
