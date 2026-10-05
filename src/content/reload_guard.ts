export function start_reload_guard(development = false) {
    const bypassKey = "opd_beforeunload_bypass_once";
    const rootThemeAttribute = "data-opd-theme";
    const preloadStyleId = "opd_preload_theme_style";
    const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const bootstrap: NonNullable<Window["__opdBootstrap"]> =
        (window.__opdBootstrap = window.__opdBootstrap || {});

    function getCookieColorMode() {
        const cookie = document.cookie
            .split(/;\s*/)
            .find((c) => c.startsWith("opd_theme="));

        if (!cookie) {
            return "system";
        }

        const mode = cookie.split("=")[1];
        return mode === "light" || mode === "dark" ? mode : "system";
    }

    function applyRootThemeMarker() {
        const colorMode = getCookieColorMode();
        const resolvedTheme =
            colorMode === "system"
                ? systemDarkQuery.matches
                    ? "dark"
                    : "light"
                : colorMode;

        document.documentElement.setAttribute(
            rootThemeAttribute,
            resolvedTheme,
        );
    }
    function ensurePreloadThemeStyle() {
        if (document.getElementById(preloadStyleId) != null) {
            return;
        }
        const style = document.createElement("style");
        style.id = preloadStyleId;
        style.textContent = `
html[data-opd-deck] #react-root { visibility: hidden !important; }
html[data-opd-theme="dark"],
html[data-opd-theme="dark"] body {
    background: #101215 !important;
    color: #e5ebf3 !important;
}
html[data-opd-theme="light"],
html[data-opd-theme="light"] body {
    background: #ffffff !important;
    color: #111827 !important;
}
`;
        document.documentElement.appendChild(style);
    }

    if (
        window.location?.pathname === "/run-opdeck" &&
        ["x.com", "twitter.com"].includes(window.location.hostname)
    ) {
        document.documentElement.setAttribute("data-opd-deck", "");
    }
    ensurePreloadThemeStyle();
    applyRootThemeMarker();
    bootstrap.beforeunloadBypassKey = bypassKey;
    bootstrap.rootThemeAttribute = rootThemeAttribute;
    bootstrap.getCookieColorMode = getCookieColorMode;
    bootstrap.applyRootThemeMarker = applyRootThemeMarker;

    if (getCookieColorMode() === "system") {
        systemDarkQuery.addEventListener("change", applyRootThemeMarker);
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
        try {
            if (sessionStorage.getItem(bypassKey) === "1") {
                sessionStorage.removeItem(bypassKey);
                return;
            }
        } catch {
            // no-op: treat missing sessionStorage as prompt-required
        }

        event.preventDefault();
        event.returnValue = "";
    };
    if (!development) window.addEventListener("beforeunload", beforeUnload);
    return () => {
        systemDarkQuery.removeEventListener("change", applyRootThemeMarker);
        window.removeEventListener("beforeunload", beforeUnload);
    };
}
