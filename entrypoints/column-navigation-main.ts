import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { guard_column_navigation } from "../src/content/column-navigation";

export default defineUnlistedScript(() => {
    guard_column_navigation();
});
