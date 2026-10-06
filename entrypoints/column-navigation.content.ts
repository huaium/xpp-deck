import { defineContentScript } from "wxt/utils/define-content-script";
import { guard_column_navigation } from "../src/content/column-navigation";

export default defineContentScript({
    exclude: ["firefox"],
    matches: ["https://x.com/*", "https://twitter.com/*"],
    allFrames: true,
    world: "MAIN",
    runAt: "document_start",
    main() {
        guard_column_navigation();
    },
});
