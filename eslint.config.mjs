import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: [".git/**", "build/**", "node_modules/**"],
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.webextensions,
            },
        },
        rules: {
            "no-constant-condition": ["warn", { checkLoops: false }],
            "no-empty": "warn",
            "no-undef": "off",
            "no-unused-vars": [
                "warn",
                { args: "none", ignoreRestSiblings: true },
            ],
            "no-useless-assignment": "warn",
            "use-isnan": "warn",
        },
    },
    {
        files: ["src/content/*.js"],
        rules: {
            // Content scripts are split into sequential files that share globals.
            "no-unused-vars": "off",
        },
    },
    {
        files: [
            "utils/*.mjs",
            "vite.config.mjs",
            "eslint.config.mjs",
            "web-ext-config.mjs",
        ],
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },
];
