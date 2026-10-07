import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { URL } from "node:url";
import { loadFunctions } from "./helpers/source.mjs";

const languages = {
    en: "English",
    ja: "日本語",
    zh_CN: "简体中文",
    zh_TW: "繁體中文",
    ko: "한국어",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    pt_BR: "Português (Brasil)",
};
const preamble = `let xpd_i18n_override_messages = null; let xpd_english_messages = {}; let xpd_i18n_language = "browser"; const supported_languages = ${JSON.stringify(languages)};`;
const substitutionFunctions = [
    "normalize_i18n_substitutions",
    "apply_i18n_substitutions",
];

test("localization substitutes numbered values and preserves escaped dollars", () => {
    const { apply_i18n_substitutions: apply } = loadFunctions(
        "../src/content/prelude.ts",
        substitutionFunctions,
    );
    assert.equal(apply("Profile $1: $2", ["3", "Home"]), "Profile 3: Home");
    assert.equal(apply("$1 / $2", "hello"), "hello / ");
    assert.equal(apply("$$1 costs $$5; $1", ["item"]), "$1 costs $5; item");
    assert.equal(apply("$1", null), "");
});

test("all supported locales have complete keys and matching placeholders", () => {
    const root = new URL("../public/_locales/", import.meta.url);
    const english = JSON.parse(
        readFileSync(new URL("en/messages.json", root), "utf8"),
    );
    assert.deepEqual(readdirSync(root).sort(), Object.keys(languages).sort());
    for (const locale of Object.keys(languages)) {
        const messages = JSON.parse(
            readFileSync(new URL(`${locale}/messages.json`, root), "utf8"),
        );
        assert.deepEqual(
            Object.keys(messages).sort(),
            Object.keys(english).sort(),
            locale,
        );
        for (const [key, value] of Object.entries(messages)) {
            assert.ok(value.message.trim(), `${locale}:${key}`);
            assert.deepEqual(
                (value.message.match(/\$\d+/g) ?? []).sort(),
                (english[key].message.match(/\$\d+/g) ?? []).sort(),
                `${locale}:${key}`,
            );
        }
    }
});

test("regional browser languages resolve to supported locales", () => {
    const { resolve_language } = loadFunctions(
        "../src/content/prelude.ts",
        ["resolve_language"],
        preamble,
    );
    for (const [tag, expected] of [
        ["zh-Hant-HK", "zh_TW"],
        ["zh-SG", "zh_CN"],
        ["pt-PT", "pt_BR"],
        ["es-MX", "es"],
        ["fr-CA", "fr"],
        ["de-AT", "de"],
        ["ko-KR", "ko"],
        ["ja-JP", "ja"],
        ["unsupported", "en"],
    ])
        assert.equal(resolve_language(tag), expected);
});

for (const selection of ["browser", ...Object.keys(languages), "invalid"]) {
    test(`language selection ${selection} loads translations with English fallback`, async () => {
        const paths = [];
        const expectedLocale =
            selection === "browser"
                ? "fr"
                : selection === "invalid"
                  ? "en"
                  : selection;
        const {
            initialize_i18n_override: initialize,
            i18n_message: message,
            formatting_locale,
            create_language_select_html,
        } = loadFunctions(
            "../src/content/prelude.ts",
            [
                "initialize_i18n_override",
                "get_storage_local_async",
                "i18n_message",
                "resolve_language",
                "formatting_locale",
                "create_language_select_html",
                ...substitutionFunctions,
            ],
            preamble,
            {
                apply_loading_preferences() {},
                rate_limit_until: 0,
                rate_limit_endpoint: null,
                read_rate_limit_endpoint: () => null,
                navigator: { language: "fr-CA" },
                chrome: {
                    storage: {
                        local: {
                            get: (key, done) =>
                                done({ xpd_language_override: selection }),
                        },
                    },
                    runtime: { getURL: (path) => path },
                    i18n: { getMessage: () => "browser fallback" },
                },
                fetch: async (path) => {
                    paths.push(path);
                    return {
                        ok: true,
                        json: async () =>
                            paths.length === 1
                                ? {
                                      greeting: { message: "Hello $1" },
                                      missing: { message: "English fallback" },
                                  }
                                : { greeting: { message: "Translated $1" } },
                    };
                },
            },
        );
        await initialize();
        assert.deepEqual(paths, [
            "_locales/en/messages.json",
            `_locales/${expectedLocale}/messages.json`,
        ]);
        assert.equal(message("greeting", ["World"]), "Translated World");
        assert.equal(message("missing"), "English fallback");
        assert.equal(
            formatting_locale(),
            selection === "browser"
                ? "fr-CA"
                : expectedLocale.replaceAll("_", "-"),
        );
        const html = create_language_select_html();
        for (const [locale, name] of Object.entries(languages)) {
            assert.ok(html.includes(`value="${locale}"`));
            assert.ok(html.includes(name));
        }
    });
}

test("translation fetch errors retain English messages", async () => {
    const { initialize_i18n_override: initialize, i18n_message: message } =
        loadFunctions(
            "../src/content/prelude.ts",
            [
                "initialize_i18n_override",
                "get_storage_local_async",
                "i18n_message",
                "resolve_language",
                ...substitutionFunctions,
            ],
            preamble,
            {
                apply_loading_preferences() {},
                rate_limit_until: 0,
                rate_limit_endpoint: null,
                read_rate_limit_endpoint: () => null,
                chrome: {
                    storage: {
                        local: {
                            get: (key, done) =>
                                done({ xpd_language_override: "de" }),
                        },
                    },
                    runtime: { getURL: (path) => path },
                    i18n: { getMessage: () => "browser fallback" },
                },
                fetch: async (path) => {
                    if (path.includes("/de/")) throw new Error("offline");
                    return {
                        ok: true,
                        json: async () => ({ greeting: { message: "Hello" } }),
                    };
                },
            },
        );
    await initialize();
    assert.equal(message("greeting"), "Hello");
});
