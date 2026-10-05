import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";
import { loadFunctions } from "./helpers/source.mjs";
const { AbortController } = globalThis;

test("current X onboarding URLs identify login, not signup or external links", () => {
    let href = "/i/jf/onboarding/web?mode=login&redirect_after_login=%2Frun-opdeck";
    let ownLink = false;
    const querySelectorAll = (selector) =>
        selector.includes("/i/jf/onboarding/web")
            ? [{ closest: () => ownLink ? {} : null, getAttribute: () => href }]
            : [];
    const { read_x_session } = loadFunctions(
        "../src/content/session.ts",
        ["read_x_session"],
        "",
        {
            URL,
            document: {
                getElementById: () => null,
                querySelectorAll,
            },
        },
    );
    assert.equal(read_x_session(), "signed-out");
    ownLink = true;
    assert.equal(read_x_session(), "unknown");
    ownLink = false;
    href = "https://x.com/i/jf/onboarding/web?redirect_after_login=%2Fhome&mode=login";
    assert.equal(read_x_session(), "signed-out");
    for (const other of [
        "/i/jf/onboarding/web?mode=signup",
        "/i/jf/onboarding/web?mode=login-other",
        "https://example.com/i/jf/onboarding/web?mode=login",
    ]) {
        href = other;
        assert.equal(read_x_session(), "unknown");
    }
});

function detector(initial = "unknown") {
    let state = initial;
    let callback;
    let timer;
    let disconnected = 0;
    let observed = 0;
    let hidden = false;
    const page = {
        querySelectorAll(selector) {
            const authenticated = selector.includes("SideNav_AccountSwitcher");
            const match =
                state === "both" ||
                (authenticated
                    ? state === "signed-in"
                    : state === "signed-out");
            return match ? [{ closest: () => (hidden ? {} : null) }] : [];
        },
    };
    const document = {
        documentElement: {},
        querySelectorAll: () => [],
        getElementById: (id) =>
            id === "react-root" && state !== "missing" ? page : null,
    };
    const functions = loadFunctions(
        "../src/content/session.ts",
        ["read_x_session", "check_x_session"],
        "",
        {
            document,
            MutationObserver: class {
                constructor(fn) {
                    callback = fn;
                }
                observe() {
                    observed++;
                }
                disconnect() {
                    disconnected++;
                }
            },
            setTimeout(fn) {
                timer = fn;
                return 1;
            },
            clearTimeout() {},
        },
    );
    return {
        ...functions,
        state(value) {
            state = value;
        },
        hidden(value) {
            hidden = value;
        },
        mutate() {
            callback();
        },
        timeout() {
            timer();
        },
        counts: () => ({ disconnected, observed }),
    };
}
test("structural account markers take precedence over login controls", () => {
    const h = detector("signed-in");
    assert.equal(h.read_x_session(), "signed-in");
    h.state("both");
    assert.equal(h.read_x_session(), "signed-in");
    h.state("signed-out");
    assert.equal(h.read_x_session(), "signed-out");
});
test("missing, inconclusive and explicitly hidden controls are unknown", () => {
    const h = detector();
    assert.equal(h.read_x_session(), "unknown");
    h.state("missing");
    assert.equal(h.read_x_session(), "unknown");
    h.state("signed-out");
    h.hidden(true);
    assert.equal(h.read_x_session(), "unknown");
});
test("known states do not start an observer", async () => {
    const h = detector("signed-in");
    assert.equal(await h.check_x_session(), "signed-in");
    assert.equal(h.counts().observed, 0);
});
test("late navigation is detected and the observer is disconnected", async () => {
    const h = detector();
    const pending = h.check_x_session();
    h.state("signed-in");
    h.mutate();
    assert.equal(await pending, "signed-in");
    assert.equal(h.counts().disconnected, 1);
});
test("inconclusive rendering times out without claiming logout", async () => {
    const h = detector();
    const pending = h.check_x_session();
    h.timeout();
    assert.equal(await pending, "unknown");
    assert.equal(h.counts().disconnected, 1);
});
test("aborted checks release observers and pre-aborted checks do not observe", async () => {
    const h = detector();
    const controller = new AbortController();
    const pending = h.check_x_session(controller.signal);
    controller.abort();
    assert.equal(await pending, "unknown");
    assert.equal(h.counts().disconnected, 1);
    assert.equal(await h.check_x_session(controller.signal), "unknown");
    assert.equal(h.counts().observed, 1);
});
