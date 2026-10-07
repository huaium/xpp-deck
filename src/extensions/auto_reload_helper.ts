export function start_auto_reload_helper() {
    // Auto-refresh helper.
    (() => {
        let xpd_reload_token: string | null = null;
        function read_path(
            source: unknown,
            path: (string | number)[],
        ): unknown {
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
        function refresh_current_page(): boolean {
            // Get section element.
            const section = document.querySelector('section[role="region"]');
            if (!section) return false;
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
                return false;
            }
            refresh();
            return true;
        }
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
            "xpd_column_reload_init",
            (e) => {
                const detail = JSON.parse(String(e.detail));
                xpd_reload_token = detail.token;
            },
            true,
        );
        // Register auto-refresh event.
        window.addEventListener(
            "xpd_column_reload",
            (e) => {
                const detail = JSON.parse(String(e.detail));
                if (!xpd_reload_token || xpd_reload_token !== detail.token)
                    return;
                let refreshed = false;
                try {
                    refreshed = refresh_current_page();
                } catch {
                    // A changed X component tree can make its hook unusable.
                }
                document.dispatchEvent(
                    new CustomEvent("xpd_column_reload_result", {
                        detail: JSON.stringify({
                            token: xpd_reload_token,
                            refreshed,
                        }),
                    }),
                );
            },
            true,
        );
    })();
}
