// Auto-refresh helper.
(() => {
    let path_old = null;
    let opd_reload_token = null;
    let reload_func = null;
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
        const refresh =
            props?.children[1]?.props.children[2]?._owner.memoizedProps
                ?.onRefresh;
        if (!refresh) {
            // Fallback to a no-op when function is unavailable.
            reload_func = () => {};
            return;
        }
        reload_func = refresh;
        path_old = path_search;
    }).observe(document, { childList: true, subtree: true });
    // Helper to get React props.
    function get_props(elem, type) {
        const prop_type = type === "Props" ? type : "Fiber";
        const propsKey = Object.getOwnPropertyNames(elem).find((k) =>
            k.includes(`__react${prop_type}$`),
        );
        return propsKey ? elem[propsKey] : null;
    }
    // Set token for feature events.
    window.addEventListener(
        "opd_column_reload_init",
        (e) => {
            const detail = JSON.parse(e.detail);
            opd_reload_token = detail.token;
        },
        true,
    );
    // Register auto-refresh event.
    window.addEventListener(
        "opd_column_reload",
        (e) => {
            const detail = JSON.parse(e.detail);
            if (opd_reload_token && opd_reload_token !== detail.token) return;
            reload_func();
        },
        true,
    );
})();
