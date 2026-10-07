import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { setTimeout } from "node:timers";
import { productionDeclarations, transpile } from "./helpers/source.mjs";
/* global document, window, DataTransfer, DragEvent, column_dd, load_scheduler, queue_column_frames, queue_column_navigation */

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");
const schedulerSource = readFileSync(
    new URL("../src/content/loading.ts", import.meta.url),
    "utf8",
);
const declarations = productionDeclarations(
    readFileSync(new URL("../src/content/run.ts", import.meta.url), "utf8"),
);
const navigationSource = readFileSync(
    new URL("../src/content/column-navigation.ts", import.meta.url),
    "utf8",
);
const helpers =
    navigationSource +
    "\n" +
    [
        "column_load_priority",
        "queue_column_navigation",
        "queue_column_frames",
        "column_dd",
    ]
        .map((name) => declarations.get(name))
        .join("\n");
const browser = await playwright.chromium.launch({
    headless: true,
    timeout: 15000,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
});
try {
    const page = await browser.newPage();
    const starts = [];
    let active = 0;
    let maximum = 0;
    await page.route("https://fixture.invalid/**", async (route) => {
        if (route.request().url() === "https://fixture.invalid/") {
            await route.fulfill({
                contentType: "text/html",
                body: "<main id=xpd_main_element></main>",
            });
            return;
        }
        starts.push({ url: route.request().url(), time: Date.now() });
        maximum = Math.max(maximum, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1800));
        active--;
        await route.fulfill({
            contentType: "text/html",
            body: "<input id=state>",
        });
    });
    await page.goto("https://fixture.invalid/");
    await page.addScriptTag({
        content: transpile(`${schedulerSource}
        const load_scheduler = create_column_load_scheduler();
        const observed_frames = new WeakSet();
        const visible_initial_frames = new WeakMap();
        const pending_frame_observer = new IntersectionObserver(entries => {
            for (const entry of entries) visible_initial_frames.set(entry.target, entry.isIntersecting);
            queue_column_frames();
        });
        function i18n_message_or_fallback(key, fallback) {return fallback;}
        function column_rename() {}
        function column_settings_save() {}
        let last_load_profile = 0;
        ${helpers}
    `),
    });
    await page.evaluate(() => {
        document.getElementById("xpd_main_element").innerHTML = Array.from(
            { length: 4 },
            (_, i) =>
                `<section id=c${i} class=dsp_column draggable=true><div xpd_column_type=home><iframe id=f${i} data-xpd-src="https://fixture.invalid/column/${i}"></iframe></div></section>`,
        ).join("");
        queue_column_frames();
        queue_column_frames();
    });
    await page.waitForFunction(
        () => document.querySelectorAll("iframe[aria-busy]").length === 0,
    );
    assert.equal(starts.length, 4);
    assert.ok(maximum <= 2);
    for (let i = 1; i < starts.length; i++)
        assert.ok(starts[i].time - starts[i - 1].time >= 700);
    await page.evaluate(() => {
        column_dd();
        const frame = document.getElementById("f0");
        window.originalFrameDocument = frame.contentDocument;
        frame.contentDocument.getElementById("state").value = "preserved";
        const transfer = new DataTransfer();
        document.getElementById("c0").dispatchEvent(
            new DragEvent("dragstart", {
                dataTransfer: transfer,
                bubbles: true,
            }),
        );
        const target = document.getElementById("c2");
        target.dispatchEvent(
            new DragEvent("drop", {
                dataTransfer: transfer,
                clientX: target.getBoundingClientRect().left,
                bubbles: true,
                cancelable: true,
            }),
        );
    });
    await page.waitForTimeout(200);
    assert.equal(
        await page.evaluate(
            () =>
                document.getElementById("f0").contentDocument ===
                    window.originalFrameDocument &&
                window.originalFrameDocument.getElementById("state").value ===
                    "preserved",
        ),
        true,
    );
    assert.equal(starts.length, 4);
    const before = starts.length;
    await page.evaluate(() => {
        const frame = document.getElementById("f0");
        queue_column_navigation(frame, () =>
            frame.contentWindow.location.reload(),
        );
        queue_column_navigation(frame, () =>
            frame.contentWindow.location.reload(),
        );
    });
    await page.waitForFunction(
        () => !document.getElementById("f0").hasAttribute("aria-busy"),
    );
    assert.equal(starts.length, before + 1);
    await page.evaluate(() => {
        const root = document.getElementById("xpd_main_element");
        // Hold the next column in the pacing gap so disposal tests queued work,
        // rather than racing an already-started navigation.
        const frame = document.getElementById("f0");
        queue_column_navigation(frame, () =>
            frame.contentWindow.location.reload(),
        );
        root.insertAdjacentHTML(
            "beforeend",
            '<div xpd_column_type=home><iframe data-xpd-src="https://fixture.invalid/cancelled"></iframe></div>',
        );
        queue_column_frames();
        load_scheduler.dispose();
        root.remove();
    });
    await page.waitForTimeout(1200);
    assert.equal(
        starts.some((start) => start.url.endsWith("/cancelled")),
        false,
    );
    console.log(
        "Chromium loading: concurrency, spacing, refresh deduplication and profile cancellation passed.",
    );
} finally {
    await browser.close();
}
