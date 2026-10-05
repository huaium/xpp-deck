import { defineContentScript } from "wxt/utils/define-content-script";
import { start_reload_guard } from "../src/content/reload_guard";
export default defineContentScript({
    matches: ["https://*.twitter.com/*", "https://*.x.com/*"],
    runAt: "document_start",
    main(ctx) {
        ctx.onInvalidated(start_reload_guard());
    },
});
