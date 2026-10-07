import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { URL } from "node:url";
/* global window, document */

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");
const directory = ".output/chrome-mv3/";
const browser = await playwright.chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
});
try {
    const context = await browser.newContext({
        viewport: { width: 1800, height: 900 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error(error.message);
    });
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    await context.route("https://x.com/**", async (route) => {
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
    await page.goto("https://x.com/run-xppdeck");
    await page.evaluate(() => {
        window.__xpd_column_starts = [];
        const source = Object.getOwnPropertyDescriptor(
            window.HTMLIFrameElement.prototype,
            "src",
        );
        Object.defineProperty(window.HTMLIFrameElement.prototype, "src", {
            ...source,
            set(value) {
                if (this.closest("#xpd_main_element"))
                    window.__xpd_column_starts.push({
                        time: window.performance.now(),
                        frame: this,
                    });
                source.set.call(this, value);
            },
        });
    });
    await page.evaluate(() => {
        const NativeObserver = window.MutationObserver;
        const tracked = new Map();
        window.__xpd_observers = tracked;
        window.MutationObserver = class extends NativeObserver {
            observe(target, options) {
                super.observe(target, options);
                if (target === document.head || target.id === "react-root") {
                    tracked.set(this, target);
                }
            }
            disconnect() {
                tracked.delete(this);
                super.disconnect();
            }
        };
    });
    if (process.env.NULL_CUSTOM_ELEMENTS === "1") {
        await page.evaluate(() => {
            Object.defineProperty(window, "customElements", {
                configurable: true,
                value: null,
            });
        });
    }
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
            xpd_settings: JSON.stringify({
                version: "0.1.0",
                last_load_profile: 0,
            }),
            xpd_profile_store: JSON.stringify([
                { name: "smoke", profile: columns },
            ]),
        };
        document.getElementById("react-root").innerHTML =
            '<a href="/i/jf/onboarding/web?mode=signup">Continue with phone</a><a href="/i/jf/onboarding/web?mode=login&redirect_after_login=%2Frun-xppdeck">Log in with username or email</a>';
        window.__xpd_storage_writes = 0;
        const messageListeners = [];
        const storageListeners = new Set();
        window.chrome = {
            runtime: {
                getManifest: () => ({ version: "0.1.0" }),
                getURL: (file) => `https://x.com/__extension__/${file}`,
                onMessage: {
                    addListener: (listener) => messageListeners.push(listener),
                },
                sendMessage: (request) =>
                    new Promise((resolve) => {
                        for (const listener of messageListeners) {
                            if (
                                listener(
                                    request,
                                    {
                                        frameId: 0,
                                        url: "https://x.com/run-xppdeck",
                                        tab: {
                                            id: 1,
                                            url: "https://x.com/run-xppdeck",
                                        },
                                    },
                                    resolve,
                                )
                            )
                                return;
                        }
                    }),
            },
            i18n: { getMessage: (key) => key },
            tabs: {
                onUpdated: { addListener() {} },
                onRemoved: { addListener() {} },
            },
            declarativeNetRequest: {
                updateSessionRules: (_rules, done) => done?.(),
            },
            webRequest: {
                onHeadersReceived: {
                    addListener: (listener) => {
                        window.__xpd_headers_received = listener;
                    },
                },
            },
            storage: {
                local: {
                    get: (key, callback) =>
                        callback(
                            key === null
                                ? { ...store }
                                : Object.fromEntries(
                                      (Array.isArray(key) ? key : [key]).map(
                                          (name) => [name, store[name]],
                                      ),
                                  ),
                        ),
                    remove: (keys, callback) => {
                        for (const key of keys) delete store[key];
                        callback?.();
                    },
                    set: (value, callback) => {
                        window.__xpd_storage_writes++;
                        const changes = Object.fromEntries(
                            Object.entries(value).map(([key, newValue]) => [
                                key,
                                { oldValue: store[key], newValue },
                            ]),
                        );
                        Object.assign(store, value);
                        for (const listener of Array.from(storageListeners))
                            listener(changes, "local");
                        callback?.();
                    },
                },
                onChanged: {
                    addListener: (listener) => storageListeners.add(listener),
                    removeListener: (listener) =>
                        storageListeners.delete(listener),
                },
            },
        };
    });
    await page.addScriptTag({
        content: await readFile(directory + "background.js", "utf8"),
    });
    await page.addScriptTag({
        content: await readFile(directory + "content-scripts/guard.js", "utf8"),
    });
    await page.addScriptTag({
        content: await readFile(directory + "content-scripts/deck.js", "utf8"),
    });
    await page.locator("#xpd_welcome a").waitFor({ state: "visible" });
    assert.equal(await page.locator("iframe").count(), 0);
    assert.equal(await page.evaluate(() => window.__xpd_storage_writes), 0);
    assert.equal(
        await page
            .locator("#react-root")
            .evaluate((root) => window.getComputedStyle(root).visibility),
        "hidden",
    );
    await page.setViewportSize({ width: 375, height: 667 });
    await page.evaluate(() =>
        document.documentElement.setAttribute("data-xpd-theme", "dark"),
    );
    assert.equal(
        await page
            .locator("#xpd_welcome")
            .evaluate(
                (element) => window.getComputedStyle(element).backgroundColor,
            ),
        "rgb(16, 18, 21)",
    );
    assert.ok(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    );
    const buttonBounds = await page.locator("#xpd_welcome a").boundingBox();
    assert.ok(
        buttonBounds.x >= 0 && buttonBounds.x + buttonBounds.width <= 375,
    );
    if (process.env.WELCOME_SCREENSHOT_PATH)
        await page.screenshot({ path: process.env.WELCOME_SCREENSHOT_PATH });
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.evaluate(() =>
        document.documentElement.setAttribute("data-xpd-theme", "light"),
    );
    const [login] = await Promise.all([
        page.waitForEvent("popup"),
        page.locator("#xpd_welcome a").click(),
    ]);
    await login.waitForLoadState();
    assert.equal(login.url(), "https://x.com/i/flow/login");
    await login.close();
    await page.locator("#xpd_welcome_retry").waitFor({ state: "visible" });
    await page.evaluate(() => {
        document.getElementById("react-root").replaceChildren();
    });
    await page.locator("#xpd_welcome_retry").click();
    await page.waitForFunction(
        () =>
            document.querySelector("#xpd_welcome h1")?.textContent ===
            "Unable to check your session",
    );
    assert.equal(await page.locator("iframe").count(), 0);
    assert.equal(await page.locator("#xpd_welcome a").isVisible(), false);
    await page.evaluate(() => {
        document.getElementById("react-root").innerHTML =
            '<a data-testid="AppTabBar_Profile_Link" href="/account">Profile</a>';
        window.dispatchEvent(new window.Event("focus"));
    });
    await page.locator("#xpd_welcome").waitFor({ state: "detached" });
    await page.waitForFunction(
        () =>
            [...document.querySelectorAll("#xpd_main_element iframe")]
                .length === 4 &&
            [...document.querySelectorAll("#xpd_main_element iframe")].every(
                (frame) => frame.hasAttribute("xpd_controls_initialized"),
            ),
    );
    const home = page.locator('[xpd_column_type="home"]');
    const initialStartTimes = await page.evaluate(() =>
        window.__xpd_column_starts.slice(0, 4).map((entry) => entry.time),
    );
    for (let index = 1; index < initialStartTimes.length; index++)
        assert.ok(
            initialStartTimes[index] - initialStartTimes[index - 1] >= 1990,
        );
    assert.equal(await page.locator("#switch_theme").isVisible(), false);
    assert.equal(await page.locator("#second_rack").isVisible(), false);
    assert.equal(await page.locator("#xpd_language_select").isVisible(), false);
    await page.locator("wa-button.xpd_global_settings_button").click();
    const globalSettings = page.locator(".xpd_global_settings_controls");
    await globalSettings.waitFor({ state: "visible" });
    assert.equal(
        await page
            .locator("wa-dialog.xpd_wa_dialog")
            .evaluate((dialog) => dialog.open),
        true,
    );
    assert.equal(
        await globalSettings.locator("wa-select#xpd_theme_select").isVisible(),
        true,
    );
    assert.equal(
        await globalSettings
            .locator("wa-select#xpd_theme_select")
            .evaluate((control) => control.value),
        "system",
    );
    await globalSettings.locator("wa-select#xpd_theme_select").click();
    await globalSettings
        .locator('wa-select#xpd_theme_select wa-option[value="dark"]')
        .click();
    assert.equal(
        await page.locator("#xpd_main_element").getAttribute("xpd-dsp-theme"),
        "dark",
    );
    await globalSettings
        .locator("wa-select#xpd_theme_select")
        .evaluate((control, value) => {
            control.value = value;
            control.dispatchEvent(
                new window.Event("change", { bubbles: true }),
            );
        }, "light");
    assert.equal(
        await page.locator("#xpd_main_element").getAttribute("xpd-dsp-theme"),
        "light",
    );
    await globalSettings
        .locator("wa-select#xpd_theme_select")
        .evaluate((control, value) => {
            control.value = value;
            control.dispatchEvent(
                new window.Event("change", { bubbles: true }),
            );
        }, "system");
    assert.equal(
        await globalSettings.locator("wa-select#xpd_layout_select").isVisible(),
        true,
    );
    assert.equal(
        await globalSettings
            .locator("wa-select#xpd_language_select")
            .isVisible(),
        true,
    );
    const themeBounds = await globalSettings
        .locator("wa-select#xpd_theme_select")
        .boundingBox();
    const layoutBounds = await globalSettings
        .locator("wa-select#xpd_layout_select")
        .boundingBox();
    const languageBounds = await globalSettings
        .locator("wa-select#xpd_language_select")
        .boundingBox();
    assert.ok(Math.abs(themeBounds.x - layoutBounds.x) < 1);
    assert.ok(Math.abs(themeBounds.width - layoutBounds.width) < 1);
    assert.ok(Math.abs(themeBounds.x - languageBounds.x) < 1);
    assert.ok(Math.abs(themeBounds.width - languageBounds.width) < 1);
    assert.ok(
        Math.abs(
            layoutBounds.y -
                themeBounds.y -
                themeBounds.height -
                (languageBounds.y - layoutBounds.y - layoutBounds.height),
        ) < 1,
    );
    const languageSelect = globalSettings.locator("#xpd_language_select");
    await languageSelect.click();
    await page.waitForFunction(
        () => document.querySelector("#xpd_language_select").open,
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
        () => !document.querySelector("#xpd_language_select").open,
    );
    assert.equal(await globalSettings.isVisible(), true);
    await page.locator("wa-button.xpd_dialog_primary").click();
    await globalSettings.waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_global_settings_button").click();
    await globalSettings.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await globalSettings.waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_global_settings_button").click();
    await globalSettings
        .locator("wa-select#xpd_layout_select")
        .evaluate((control, value) => {
            control.value = value;
            control.dispatchEvent(
                new window.Event("change", { bubbles: true }),
            );
        }, "double");
    await globalSettings.waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_global_settings_button").click();
    assert.equal(
        await globalSettings
            .locator("wa-select#xpd_layout_select")
            .evaluate((control) => control.value),
        "double",
    );
    await globalSettings
        .locator("wa-select#xpd_layout_select")
        .evaluate((control, value) => {
            control.value = value;
            control.dispatchEvent(
                new window.Event("change", { bubbles: true }),
            );
        }, "single");
    await globalSettings.waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_dialog_primary").click();
    await page.locator(".xpd_dialog_overlay").waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_global_settings_button").click();
    assert.equal(
        await globalSettings
            .locator("wa-select#xpd_layout_select")
            .evaluate((control) => control.value),
        "single",
    );
    await page.keyboard.press("Escape");
    await globalSettings.waitFor({ state: "detached" });
    const post = page.locator('[xpd_column_type="post"]');
    assert.ok((await page.locator(".column_bar wa-checkbox").count()) > 0);
    assert.equal(
        await page.evaluate(
            () =>
                document.querySelectorAll(
                    "#xpd_main_element input, #xpd_main_element select, .xpd_dialog_overlay input, .xpd_dialog_overlay select",
                ).length,
        ),
        0,
    );
    assert.equal(await home.locator(".xpd_homepage_btn").isVisible(), true);
    assert.equal(await home.locator(".xpd_pinned_btn").count(), 0);
    assert.equal(await home.getAttribute("xpd_homepage_path"), "/home");

    assert.equal(
        await home.locator(".dsp_column_banner_btn").isVisible(),
        true,
    );
    assert.equal(
        await post.locator(".dsp_column_banner_btn").isVisible(),
        false,
    );
    await post.locator("iframe").evaluate((frame) => {
        const header = frame.contentDocument.createElement("header");
        header.setAttribute("role", "banner");
        frame.contentDocument.body.appendChild(header);
    });
    await page.waitForFunction(
        () =>
            document
                .querySelector('[xpd_column_type="post"] .xpd_banner')
                .closest(".dsp_column_btn").style.display !== "none",
    );
    await home.locator(".dsp_column_settings_btn").click();
    await home.locator("wa-select.xpd_tw_view_mode").evaluate((control) => {
        control.value = "2";
        control.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await home.locator("wa-button.dsp_column_settings_panel_close_btn").click();
    await page.waitForFunction(
        () =>
            document.querySelector(
                '[xpd_column_type="home"] .dsp_column_settings_panel',
            ).style.display === "none",
    );
    await Promise.all([
        page.waitForEvent(
            "framenavigated",
            (frame) => new URL(frame.url()).pathname === "/home",
        ),
        home.locator(".dsp_column_refresh_btn").click(),
    ]);
    await page.waitForFunction(() =>
        document
            .querySelector('[xpd_column_type="home"] iframe')
            .contentDocument.querySelector("style[xpd_tw_view_mode_css]")
            ?.textContent.includes(":not"),
    );
    await home.locator(".dsp_column_settings_btn").click();
    assert.equal(
        await home
            .locator(".xpd_tw_view_mode")
            .evaluate((control) => control.value),
        "2",
    );
    await page.locator("#profile_save").click();
    assert.equal(
        await page
            .locator(".xpd_dialog_input")
            .evaluate((control) => control.value),
        "Profile 1",
    );
    await page.locator(".xpd_dialog wa-input input").fill("Work");
    await page.locator("wa-button.xpd_dialog_primary").click();
    assert.equal(
        await page.locator("#userProfile-1 .dsp_btn_label").textContent(),
        "Work",
    );
    assert.equal(
        await page
            .locator("#userProfile-1 .dsp_btn_change_profile_btn")
            .textContent(),
        "W",
    );
    await page.locator("#sidebar_fold_toggle").click();
    await page.waitForFunction(
        () =>
            document
                .querySelector("#userProfile-1 .dsp_btn_label")
                .getBoundingClientRect().width === 0,
    );
    assert.equal(
        await page
            .locator("#userProfile-1 .dsp_btn_label")
            .evaluate((label) => label.getBoundingClientRect().width),
        0,
    );
    assert.equal(
        await page
            .locator("#userProfile-1 .dsp_btn_change_profile_btn")
            .isVisible(),
        true,
    );
    await page.locator("#sidebar_fold_toggle").click();
    await page.locator("#profile_save").click();
    await page.locator("wa-button.xpd_dialog_primary").click();
    await page.locator("#profile_save").click();
    assert.equal(
        await page
            .locator(".xpd_dialog_input")
            .evaluate((control) => control.value),
        "Profile 2",
    );
    await page
        .locator(".xpd_dialog_actions wa-button:not(.xpd_dialog_primary)")
        .click();
    await page.locator(".xpd_dialog_overlay").waitFor({ state: "detached" });
    const resourceCounts = () =>
        page.evaluate(() => ({
            styles: document.querySelectorAll(
                "style[xpd_default_css], style[second_column_css]",
            ).length,
            observers: window.__xpd_observers.size,
        }));
    const initialResources = await resourceCounts();
    for (const profile of [1, 0, 1]) {
        await page.locator(`#userProfile-${profile}`).click();
        await page.locator("wa-button.xpd_dialog_primary").click();
        await page
            .locator(".xpd_dialog_overlay")
            .waitFor({ state: "detached" });
        assert.deepEqual(await resourceCounts(), initialResources);
        assert.equal(await page.locator("#xpd_main_element").count(), 1);
    }
    await page.locator("#profile_delete").click();
    await page.locator("wa-button.xpd_dialog_primary").click();
    await page
        .locator("wa-select.xpd_dialog_input")
        .waitFor({ state: "detached" });
    await page.locator("wa-button.xpd_dialog_primary").click();
    await page.locator(".xpd_dialog_overlay").waitFor({ state: "detached" });
    assert.deepEqual(await resourceCounts(), initialResources);
    assert.equal(await page.locator("#xpd_main_element").count(), 1);
    await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("#xpd_main_element iframe")).every(
            (frame) => frame.hasAttribute("xpd_controls_initialized"),
        ),
    );
    await page.evaluate(() =>
        window.__xpd_headers_received({
            url: "https://x.com/i/api/graphql/fixture/ViewerBadgeCounts?variables=private",
            statusCode: 429,
            tabId: 1,
            frameId: 1,
            responseHeaders: [{ name: "Retry-After", value: "60" }],
        }),
    );
    const startsBeforeCooldownClick = await page.evaluate(
        () => window.__xpd_column_starts.length,
    );
    await page.locator('[xpd_column_type="home"] .column_refresh_btn').click();
    assert.equal(
        await page.evaluate(() => window.__xpd_column_starts.length),
        startsBeforeCooldownClick,
    );
    await page.locator('[data-api-key="recommend_timeline"]').click();
    await page
        .getByText(/Column loading and refreshes are paused until/)
        .waitFor({ state: "visible" });
    await page.locator("wa-button.xpd_dialog_primary").click();
    await page.evaluate(() => {
        const now = Date.now() + 61000;
        Date.now = () => now;
        document.dispatchEvent(new window.Event("visibilitychange"));
    });
    await page.waitForFunction(
        (previous) => window.__xpd_column_starts.length > previous,
        startsBeforeCooldownClick,
    );
    assert.deepEqual(errors, []);
    console.log(
        "Built extension Chromium smoke test passed: signed-out welcome, official sign-in tab, session retry, initialization, iframe helpers, dynamic banner controls, settings animation and refresh persistence.",
    );
} finally {
    await browser.close();
}
