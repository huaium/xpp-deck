import { defineContentScript } from "wxt/utils/define-content-script";
import { start_reload_guard } from "../src/content/reload_guard";
import { injectScript } from "wxt/utils/inject-script";
export default defineContentScript({
    matches: ["https://*.twitter.com/*", "https://*.x.com/*"],
    runAt: "document_start",
    allFrames: true,
    main(ctx) {
        ctx.onInvalidated(start_reload_guard(import.meta.env.DEV));
        if (import.meta.env.BROWSER !== "firefox") return;
        try {
            if (
                window !== window.top &&
                window.parent.location.pathname === "/run-xppdeck" &&
                window.frameElement?.closest("div[xpd_column_type]")
            ) {
                void injectScript("/column-navigation-main.js").catch((error) =>
                    console.error("Column navigation guard failed", error),
                );
            }
        } catch {
            // Unrelated cross-origin frames are not deck columns.
        }
    },
});
