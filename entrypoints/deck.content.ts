import { defineContentScript } from "wxt/utils/define-content-script";
import { prepare_custom_element_registry } from "../src/content/custom-element-registry";
import { is_deck_location } from "../src/content/session";
export default defineContentScript({
    matches: ["https://*.twitter.com/*", "https://*.x.com/*"],
    runAt: "document_idle",
    async main(ctx) {
        if (window !== window.top || !is_deck_location(location.href)) return;
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
        await prepare_custom_element_registry();
        if (ctx.signal.aborted) return;
        const { start_content } = await import("../src/content/index");
        if (ctx.signal.aborted) return;
        ctx.onInvalidated(start_content());
    },
});
