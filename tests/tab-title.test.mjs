import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("deck favicon is created and restored after X changes or removes it", () => {
    let icons = [];
    let callback;
    const document = {
        title: "XPP-Deck",
        head: {
            querySelectorAll: () => icons,
            appendChild: (icon) => icons.push(icon),
        },
        createElement: () => ({
            href: "", type: "", sizes: { length: 0 },
            removeAttribute(name) {
                if (name === "type") this.type = "";
                if (name === "sizes") this.sizes.length = 0;
            },
        }),
    };
    const { keep_deck_tab_title } = loadFunctions(
        "../src/content/tab-title.ts", ["keep_deck_tab_title"], "",
        {
            document,
            MutationObserver: class {
                constructor(fn) { callback = fn; }
                observe() {}
                disconnect() {}
            },
        },
    );
    keep_deck_tab_title("chrome-extension://deck/icon.png");
    assert.equal(icons.length, 1);
    assert.equal(icons[0].href, "chrome-extension://deck/icon.png");
    icons[0].href = "https://x.com/favicon.svg";
    icons[0].type = "image/svg+xml";
    icons[0].sizes.length = 1;
    callback();
    assert.equal(icons[0].href, "chrome-extension://deck/icon.png");
    assert.equal(icons[0].type, "");
    assert.equal(icons[0].sizes.length, 0);
    icons = [];
    callback();
    assert.equal(icons.length, 1);
    assert.equal(icons[0].href, "chrome-extension://deck/icon.png");
});

test("deck title survives X updates without redundant writes and releases its observer", () => {
    let title = "User Profile Not Found - X";
    let writes = 0;
    let callback;
    let disconnected = false;
    const document = {
        head: {},
        get title() { return title; },
        set title(value) { title = value; writes++; },
    };
    const { keep_deck_tab_title } = loadFunctions(
        "../src/content/tab-title.ts",
        ["keep_deck_tab_title"],
        "",
        {
            document,
            MutationObserver: class {
                constructor(fn) { callback = fn; }
                observe(target, options) {
                    assert.equal(target, document.head);
                    assert.deepEqual(JSON.parse(JSON.stringify(options)), {
                        childList: true, subtree: true, characterData: true,
                        attributes: true,
                        attributeFilter: ["rel", "href", "type", "sizes"],
                    });
                }
                disconnect() { disconnected = true; }
            },
        },
    );
    const dispose = keep_deck_tab_title();
    assert.equal(title, "XPP-Deck");
    assert.equal(writes, 1);
    callback();
    assert.equal(writes, 1);
    title = "User Profile Not Found - X";
    callback();
    assert.equal(title, "XPP-Deck");
    assert.equal(writes, 2);
    dispose();
    assert.equal(disconnected, true);
});
