import { defineContentScript } from "wxt/utils/define-content-script";
export default defineContentScript({
    matches: ["https://*.twitter.com/*", "https://*.x.com/*"],
    runAt: "document_idle",
    async main(ctx) {
        // The legacy deck owns many page resources; reload rather than duplicate them.
        if (import.meta.env.DEV) {
            if (document.documentElement.hasAttribute("data-xpd-dev-mounted")) {
                sessionStorage.setItem("xpd_beforeunload_bypass_once", "1");
                location.reload();
                return;
            }
            document.documentElement.setAttribute("data-xpd-dev-mounted", "");
            ctx.onInvalidated(() => {
                sessionStorage.setItem("xpd_beforeunload_bypass_once", "1");
                location.reload();
            });
        }
        const { start_content } = await import("../src/content/index");
        if (ctx.signal.aborted) return;
        ctx.onInvalidated(start_content());
    },
});
