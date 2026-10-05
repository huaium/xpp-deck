import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("localization substitutes numbered values and preserves escaped dollars", () => {
    const { apply_i18n_substitutions: apply } = loadFunctions(
        "../src/content/prelude.ts",
        ["normalize_i18n_substitutions", "apply_i18n_substitutions"],
    );
    assert.equal(apply("Profile $1: $2", ["3", "Home"]), "Profile 3: Home");
    assert.equal(apply("$1 / $2", "hello"), "hello / ");
    assert.equal(apply("$$1 costs $$5; $1", ["item"]), "$1 costs $5; item");
    assert.equal(apply("$1", null), "");
});

test("language override loads translations and falls back to browser messages on errors", async () => {
    for (const scenario of [
        "browser",
        "translated",
        "http-error",
        "network-error",
    ]) {
        let fetched = 0;
        const { initialize_i18n_override: initialize, i18n_message: message } =
            loadFunctions(
                "../src/content/prelude.ts",
                [
                    "initialize_i18n_override",
                    "get_storage_local_async",
                    "i18n_message",
                    "apply_i18n_substitutions",
                    "normalize_i18n_substitutions",
                ],
                'let opd_i18n_override_messages = null; let opd_i18n_language = "browser";',
                {
                    chrome: {
                        storage: {
                            local: {
                                get(_key, done) {
                                    done({
                                        opd_language_override:
                                            scenario === "browser"
                                                ? "browser"
                                                : "ja",
                                    });
                                },
                            },
                        },
                        runtime: { getURL: (path) => path },
                        i18n: { getMessage: () => "browser fallback" },
                    },
                    fetch: async (url) => {
                        fetched++;
                        assert.equal(url, "_locales/ja/messages.json");
                        if (scenario === "network-error")
                            throw new Error("offline");
                        return {
                            ok: scenario !== "http-error",
                            json: async () => ({
                                greeting: { message: "Hello $1" },
                            }),
                        };
                    },
                },
            );
        await initialize();
        assert.equal(
            message("greeting", ["World"]),
            scenario === "translated" ? "Hello World" : "browser fallback",
        );
        assert.equal(message("missing"), "browser fallback");
        assert.equal(fetched, scenario === "browser" ? 0 : 1);
    }
});
