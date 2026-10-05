import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { URL } from "node:url";
/* global window, document */

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");
const directory = "build/web-ext-chromium-src/";
const browser = await playwright.chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
});
try {
    const page = await browser.newPage({
        viewport: { width: 1800, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error(error.message);
    });
    await page.route("https://x.com/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/__extension__/")) {
            const file = url.pathname.slice("/__extension__/".length);
            await route.fulfill({
                body: await readFile(directory + file),
                contentType: file.endsWith(".js")
                    ? "text/javascript"
                    : "image/svg+xml",
            });
        } else {
            await route.fulfill({
                contentType: "text/html",
                body: `<html><head><title>Fixture</title></head><body><div id="react-root"></div>${url.pathname === "/home" ? '<header role="banner">Banner</header>' : ""}</body></html>`,
            });
        }
    });
    await page.goto("https://x.com/run-opdeck");
    await page.evaluate(() => {
        const columns = [
            "home",
            "notification",
            "post",
            "explore",
            "empty_column",
        ].map((type) => ({
            type,
            banner: false,
            tw_view_mode: "0",
            column_save_path: "/explore",
            column_save_title: "",
            column_pinned_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_width: "30",
        }));
        const store = {
            opd_settings: JSON.stringify({
                version: "0.1.0",
                last_load_profile: 0,
            }),
            opd_profile_store: JSON.stringify([
                { name: "smoke", profile: columns },
            ]),
        };
        window.chrome = {
            runtime: {
                getManifest: () => ({ version: "0.1.0" }),
                getURL: (file) => `https://x.com/__extension__/${file}`,
                sendMessage: async () => ({}),
            },
            i18n: { getMessage: (key) => key },
            storage: {
                local: {
                    get: (key, callback) => callback({ [key]: store[key] }),
                    set: (value, callback) => {
                        Object.assign(store, value);
                        callback?.();
                    },
                },
                onChanged: { addListener() {} },
            },
        };
    });
    await page.addScriptTag({
        content: await readFile(
            directory + "src/content/reload_guard.js",
            "utf8",
        ),
    });
    await page.addScriptTag({
        content: await readFile(directory + "src/content/index.js", "utf8"),
    });
    await page.waitForFunction(
        () =>
            [...document.querySelectorAll("#opd_main_element iframe")]
                .length === 4 &&
            [...document.querySelectorAll("#opd_main_element iframe")].every(
                (frame) => frame.hasAttribute("opd_controls_initialized"),
            ),
    );
    const home = page.locator('[opd_column_type="home"]');
    const post = page.locator('[opd_column_type="post"]');
    assert.equal(await home.locator(".opd_banner").isVisible(), true);
    assert.equal(await post.locator(".opd_banner").isVisible(), false);
    await post.locator("iframe").evaluate((frame) => {
        const header = frame.contentDocument.createElement("header");
        header.setAttribute("role", "banner");
        frame.contentDocument.body.appendChild(header);
    });
    await page.waitForFunction(
        () =>
            document
                .querySelector('[opd_column_type="post"] .opd_banner')
                .closest(".dsp_column_btn").style.display !== "none",
    );
    await home.locator(".dsp_column_settings_btn").click();
    await home.locator(".opd_tw_view_mode").selectOption("2");
    await home.locator(".dsp_column_settings_panel_close_btn").click();
    await page.waitForFunction(
        () =>
            document.querySelector(
                '[opd_column_type="home"] .dsp_column_settings_panel',
            ).style.display === "none",
    );
    await Promise.all([
        page.waitForEvent(
            "framenavigated",
            (frame) => frame.url() === "https://x.com/home",
        ),
        home.locator(".dsp_column_refresh_btn").click(),
    ]);
    await page.waitForFunction(() =>
        document
            .querySelector('[opd_column_type="home"] iframe')
            .contentDocument.querySelector("style[opd_tw_view_mode_css]")
            ?.textContent.includes(":not"),
    );
    await home.locator(".dsp_column_settings_btn").click();
    assert.equal(await home.locator(".opd_tw_view_mode").inputValue(), "2");
    assert.deepEqual(errors, []);
    console.log(
        "Built extension Chromium smoke test passed: initialization, iframe helpers, dynamic banner controls, settings animation and refresh persistence.",
    );
} finally {
    await browser.close();
}
