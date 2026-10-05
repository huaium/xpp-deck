import { defineContentScript } from "wxt/utils/define-content-script";
export default defineContentScript({
    matches: ["https://*.twitter.com/*", "https://*.x.com/*"],
    runAt: "document_idle",
    async main(ctx) {
        // The legacy deck owns many page resources; reload rather than duplicate them.
        if (import.meta.env.DEV) {
            if (document.documentElement.hasAttribute("data-opd-dev-mounted")) {
                sessionStorage.setItem("opd_beforeunload_bypass_once", "1");
                location.reload();
                return;
            }
            document.documentElement.setAttribute("data-opd-dev-mounted", "");
            ctx.onInvalidated(() => {
                sessionStorage.setItem("opd_beforeunload_bypass_once", "1");
                location.reload();
            });
        }
        await import("../src/content/index");
    },
});
