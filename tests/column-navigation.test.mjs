import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";
import { column_navigation_url } from "./helpers/column-navigation.mjs";

test("column URLs bypass worker documents without forcing language or dropping query/hash", () => {
    assert.equal(column_navigation_url("/home"), "https://x.com/home?lang=");
    assert.equal(
        column_navigation_url("https://x.com/search?q=test#latest"),
        "https://x.com/search?q=test&lang=#latest",
    );
    assert.equal(
        column_navigation_url("/home?lang=ja"),
        "https://x.com/home?lang=ja",
    );
    assert.equal(
        column_navigation_url("/home?lang="),
        "https://x.com/home?lang=",
    );
    assert.equal(
        column_navigation_url("/search?q=one%20two&f=live"),
        "https://x.com/search?q=one%20two&f=live&lang=",
    );
    for (const url of [
        "https://example.com/home",
        "https://x.com.evil.test/home",
        "http://x.com/home",
    ])
        assert.equal(column_navigation_url(url), url);
});

test("column clicks preserve external links, new tabs, and explicit language", () => {
    class Anchor {
        constructor(href, target = "") {
            this.href = href;
            this.target = target;
        }
        hasAttribute() {
            return false;
        }
    }
    let click;
    const { guard_column_navigation } = loadFunctions(
        "../src/content/column-navigation.ts",
        ["guard_column_navigation"],
        "",
        {
            column_navigation_url,
            HTMLAnchorElement: Anchor,
            window: {
                top: {},
                parent: { location: { pathname: "/run-xppdeck" } },
                frameElement: { closest: () => ({}) },
            },
            history: { pushState() {}, replaceState() {} },
            location: {
                href: "https://x.com/home?lang=",
                origin: "https://x.com",
            },
            document: {
                addEventListener: (_event, fn) => {
                    click = fn;
                },
            },
        },
    );
    guard_column_navigation();
    for (const [href, target, button, expected] of [
        [
            "https://x.com/search?q=test",
            "",
            0,
            "https://x.com/search?q=test&lang=",
        ],
        ["https://x.com/home?lang=ja", "", 0, "https://x.com/home?lang=ja"],
        ["https://example.com/", "", 0, "https://example.com/"],
        ["https://x.com/home", "_blank", 0, "https://x.com/home"],
        ["https://x.com/home", "", 1, "https://x.com/home"],
    ]) {
        const link = new Anchor(href, target);
        click({ button, target: { closest: () => link } });
        assert.equal(link.href, expected);
    }
});

test("only deck column documents wrap history and cleanup restores originals", () => {
    for (const deck of [false, true]) {
        const calls = [];
        const original = function (...args) {
            calls.push(args);
        };
        const history = { pushState: original, replaceState: original };
        const handlers = new Map();
        const window = {
            top: {},
            parent: { location: { pathname: deck ? "/run-xppdeck" : "/home" } },
            frameElement: { closest: () => ({}) },
        };
        const { guard_column_navigation } = loadFunctions(
            "../src/content/column-navigation.ts",
            ["guard_column_navigation"],
            "",
            {
                window,
                history,
                column_navigation_url,
                location: { href: "https://x.com/home?lang=" },
                document: {
                    addEventListener: (event, fn) => handlers.set(event, fn),
                    removeEventListener: (event) => handlers.delete(event),
                },
            },
        );
        const stop = guard_column_navigation();
        calls.length = 0;
        history.pushState({}, "", "/search?q=test");
        history.replaceState({}, "", "/notifications");
        assert.equal(
            calls[0][2],
            deck ? "https://x.com/search?q=test&lang=" : "/search?q=test",
        );
        assert.equal(
            calls[1][2],
            deck ? "https://x.com/notifications?lang=" : "/notifications",
        );
        assert.equal(handlers.size, deck ? 1 : 0);
        stop();
        assert.equal(history.pushState, original);
        assert.equal(history.replaceState, original);
        assert.equal(handlers.size, 0);
    }
});
