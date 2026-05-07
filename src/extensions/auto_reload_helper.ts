// Auto-refresh helper.
(() => {
    let path_old: string | null = null;
    let opd_reload_token: string | null = null;
    let reload_func = () => {};
    function read_path(source: unknown, path: (string | number)[]): unknown {
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
            current = (current as Record<string, unknown>)[key];
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
        reload_func = refresh as () => void;
        path_old = path_search;
    }).observe(document, { childList: true, subtree: true });
    // Helper to get React props.
    function get_props(elem: Element, type: "Props" | "Fiber") {
        const prop_type = type === "Props" ? type : "Fiber";
        const propsKey = Object.getOwnPropertyNames(elem).find((k) =>
            k.includes(`__react${prop_type}$`),
        );
        if (!propsKey) return null;
        return (elem as unknown as Record<string, unknown>)[propsKey];
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
