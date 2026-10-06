import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
const { AbortController } = globalThis;
import { loadFunctions } from "./helpers/source.mjs";

function harness(
    status = "signed-out",
    startImpl = async () => {},
    resetOptions = {},
) {
    class Element {
        children = [];
        listeners = new Map();
        appendChild(child) {
            child.parent = this;
            this.children.push(child);
        }
        append(...children) {
            children.forEach((child) => this.appendChild(child));
        }
        setAttribute(key, value) {
            this[key] = value;
        }
        addEventListener(key, fn) {
            this.listeners.set(key, fn);
        }
        removeEventListener(key) {
            this.listeners.delete(key);
        }
        remove() {
            this.parent.children = this.parent.children.filter(
                (child) => child !== this,
            );
        }
        click() {
            this.listeners.get("click")?.();
        }
    }
    const windowListeners = new Map();
    const documentListeners = new Map();
    const document = {
        hidden: false,
        documentElement: new Element(),
        head: new Element(),
        body: new Element(),
        createElement: () => new Element(),
        addEventListener: (key, fn) => documentListeners.set(key, fn),
        removeEventListener: (key) => documentListeners.delete(key),
    };
    const window = {
        addEventListener: (key, fn) => windowListeners.set(key, fn),
        removeEventListener: (key) => windowListeners.delete(key),
    };
    let starts = 0,
        reloads = 0,
        checks = 0;
    let checkImpl = async () => status;
    const { mount_session_gate: mount, is_deck_location: route } =
        loadFunctions(
            "../src/content/session.ts",
            ["mount_session_gate", "is_deck_location"],
            "",
            { document, window, AbortController },
        );
    const gate = mount({
        ...resetOptions,
        message: (_key, fallback) => fallback,
        start: async () => {
            starts++;
            await startImpl();
        },
        reload: () => {
            reloads++;
        },
        check: async () => {
            checks++;
            return checkImpl();
        },
    });
    const view = document.body.children[0];
    const content = view.children[0];
    const [signIn, retry, reset] = content.children[3].children;
    return {
        gate,
        route,
        document,
        windowListeners,
        documentListeners,
        view,
        signIn,
        retry,
        reset,
        status: (value) => {
            status = value;
        },
        checker: (value) => {
            checkImpl = value;
        },
        counts: () => ({ starts, reloads, checks }),
    };
}

test("initialization errors keep a visible retry screen and allow recovery", async () => {
    let corrupt = true;
    const h = harness("signed-in", async () => {
        if (corrupt) throw new Error("Invalid saved deck profiles");
    });
    await h.gate.check();
    assert.equal(h.document.body.children.includes(h.view), true);
    assert.equal(h.retry.hidden, false);
    assert.equal(h.retry.disabled, false);
    corrupt = false;
    await h.gate.check();
    assert.equal(h.document.body.children.includes(h.view), false);
    assert.equal(h.counts().starts, 2);
    h.gate.dispose();
});

test("startup reset requires confirmation and leaves Retry available", async () => {
    let confirmed = false;
    let confirmations = 0;
    let resets = 0;
    const h = harness(
        "signed-in",
        async () => {
            throw new Error("Corrupt profiles");
        },
        {
            confirmReset: async () => {
                confirmations++;
                return confirmed;
            },
            reset: async () => {
                resets++;
            },
        },
    );
    assert.equal(h.reset.hidden, true);
    await h.gate.check();
    assert.equal(h.reset.hidden, false);
    h.reset.click();
    await setImmediate();
    assert.equal(confirmations, 1);
    assert.equal(resets, 0);
    assert.equal(h.retry.disabled, false);
    confirmed = true;
    h.reset.click();
    await setImmediate();
    assert.equal(resets, 1);
    h.gate.dispose();
});

test("session detection errors never offer profile reset", async () => {
    const h = harness("unknown", async () => {}, {
        confirmReset: async () => true,
        reset: async () =>
            assert.fail("session errors must not reset profiles"),
    });
    await h.gate.check();
    assert.equal(h.reset.hidden, true);
    h.gate.dispose();
});

test("signed-out welcome blocks initialization and opens only X's official login", async () => {
    const h = harness();
    await h.gate.check();
    assert.equal(h.counts().starts, 0);
    assert.equal(h.signIn.hidden, false);
    assert.equal(h.signIn.href, "https://x.com/i/flow/login");
    assert.equal(h.signIn.target, "_blank");
    assert.equal(h.signIn.rel, "noopener noreferrer");
    assert.equal(h.retry.hidden, true);
    h.signIn.click();
    assert.equal(h.retry.hidden, false);
    assert.equal(h.retry.textContent, "I've signed in");
    assert.equal(h.document.body.children.length, 1);
    h.gate.dispose();
});
test("unknown session shows a retry state without claiming the user is signed out", async () => {
    const h = harness("unknown");
    await h.gate.check();
    assert.equal(h.signIn.hidden, true);
    assert.equal(h.retry.hidden, false);
    assert.equal(h.retry.textContent, "Try again");
    assert.equal(h.counts().starts, 0);
    h.gate.dispose();
});
test("successful sign-in initializes once; logout requests a reload without changing profiles", async () => {
    const h = harness();
    await h.gate.check();
    h.status("signed-in");
    await h.gate.check();
    await h.gate.check();
    assert.equal(h.counts().starts, 1);
    assert.equal(h.document.body.children.length, 0);
    h.status("unknown");
    await h.gate.check();
    assert.equal(h.counts().reloads, 0);
    h.status("signed-out");
    await h.gate.check();
    assert.equal(h.counts().reloads, 1);
    h.gate.dispose();
});
test("session checks coalesce and disposal blocks late initialization", async () => {
    const h = harness();
    let resolve;
    h.checker(
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    const pending = h.gate.check();
    await h.gate.check();
    assert.equal(h.counts().checks, 1);
    h.gate.dispose();
    resolve("signed-in");
    await pending;
    assert.equal(h.counts().starts, 0);
    assert.equal(h.windowListeners.size, 0);
    assert.equal(h.documentListeners.size, 0);
});
test("returning to a visible tab checks the session, hidden tabs do not", async () => {
    const h = harness();
    h.document.hidden = true;
    h.documentListeners.get("visibilitychange")();
    assert.equal(h.counts().checks, 0);
    h.document.hidden = false;
    h.documentListeners.get("visibilitychange")();
    await Promise.resolve();
    assert.equal(h.counts().checks, 1);
    h.gate.dispose();
});
test("only supported deck routes trigger the welcome flow", () => {
    const h = harness();
    for (const url of [
        "https://x.com/run-xppdeck",
        "https://twitter.com/run-xppdeck?test=1",
    ])
        assert.equal(h.route(url), true);
    for (const url of [
        "https://x.com/home",
        "https://example.com/run-xppdeck",
        "http://x.com/run-xppdeck",
    ])
        assert.equal(h.route(url), false);
    h.gate.dispose();
});

test("first-time profile setup does not read an unsaved profile", async () => {
    const reads = [];
    let initialized = 0;
    let runs = 0;
    const { initialize_content: initialize } = loadFunctions(
        "../src/content/prelude.ts",
        ["initialize_content"],
        "let last_load_profile = 0;",
        {
            is_deck_location: () => true,
            location: { href: "https://x.com/run-xppdeck" },
            chrome: {
                runtime: { sendMessage: async () => ({}) },
                storage: {
                    local: {
                        get(key, callback) {
                            reads.push(key);
                            callback({});
                        },
                    },
                },
            },
        },
    );
    await initialize(
        () => {
            runs++;
        },
        () => {
            initialized++;
        },
    );
    assert.equal(initialized, 1);
    assert.equal(runs, 0);
    assert.deepEqual(Array.from(reads[0]), [
        "opd_settings",
        "opd_profile_store",
    ]);
});

test("explicit sign-in retry refreshes stale X markup, while focus checks do not", async () => {
    const h = harness();
    await h.gate.check();
    h.signIn.click();
    await h.gate.check();
    assert.equal(h.counts().reloads, 0);
    await h.gate.check(true);
    assert.equal(h.counts().reloads, 1);
    assert.equal(h.counts().starts, 0);
    h.gate.dispose();
});
