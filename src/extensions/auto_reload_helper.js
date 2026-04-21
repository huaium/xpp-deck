// Auto-refresh helper.
(() => {
    let path_old = null;
    let opd_reload_token = null;
    let reload_func = () => {};
    /**
     * Safely read a nested value from unknown objects/arrays.
     * @param {unknown} source
     * @param {(string | number)[]} path
     * @returns {unknown}
     */
    function read_path(source, path) {
        let current = source;
        for (const key of path) {
            if (current == null) {
                return undefined;
            }
            if (typeof key === "number") {
                if (!Array.isArray(current)) {
                    return undefined;
                }
                current = current[key];
                continue;
            }
            if (typeof current !== "object") {
                return undefined;
            }
            current = /** @type {Record<string, unknown>} */ (current)[key];
        }
        return current;
    }
    // Watch route changes by URL.
    new MutationObserver(function () {
        const path_search = `${location.pathname}${location.search}`;
        if (path_old === path_search) {
            return;
        }
        // Get section element.
        const section = document.querySelector('section[role="region"]');
        if (!section) return;
        // Get React props.
        const props = get_props(section, "Props");
        const refresh = read_path(props, [
            "children",
            1,
            "props",
            "children",
            2,
            "_owner",
            "memoizedProps",
            "onRefresh",
        ]);
        if (typeof refresh !== "function") {
            // Fallback to a no-op when function is unavailable.
            reload_func = () => {};
            return;
        }
        reload_func = /** @type {() => void} */ (refresh);
        path_old = path_search;
    }).observe(document, { childList: true, subtree: true });
    // Helper to get React props.
    function get_props(elem, type) {
        const prop_type = type === "Props" ? type : "Fiber";
        const propsKey = Object.getOwnPropertyNames(elem).find((k) =>
            k.includes(`__react${prop_type}$`),
        );
        if (!propsKey) return null;
        return /** @type {Record<string, unknown>} */ (elem)[propsKey];
    }
    // Set token for feature events.
    window.addEventListener(
        "opd_column_reload_init",
        (e) => {
            const detail = JSON.parse(String(e.detail));
            opd_reload_token = detail.token;
        },
        true,
    );
    // Register auto-refresh event.
    window.addEventListener(
        "opd_column_reload",
        (e) => {
            const detail = JSON.parse(String(e.detail));
            if (opd_reload_token && opd_reload_token !== detail.token) return;
            reload_func();
        },
        true,
    );
})();
