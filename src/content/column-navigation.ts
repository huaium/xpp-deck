// X's worker excludes navigations containing `lang` from its document cache.
// An empty value leaves language selection to X instead of forcing a locale.
export function column_navigation_url(href: string, base = "https://x.com/") {
    const url = new URL(href, base);
    if (
        url.protocol === "https:" &&
        ["x.com", "twitter.com"].includes(url.hostname) &&
        !url.searchParams.has("lang")
    ) {
        url.search += `${url.search ? "&" : "?"}lang=`;
    }
    return url.href;
}

export function guard_column_navigation() {
    try {
        if (
            window === window.top ||
            window.parent.location.pathname !== "/run-xppdeck" ||
            !window.frameElement?.closest("div[opd_column_type]")
        )
            return () => {};
    } catch {
        return () => {};
    }
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const rewrite = (url?: string | URL | null) =>
        url == null ? url : column_navigation_url(String(url), location.href);
    history.pushState = function (state, unused, url) {
        return originalPush.call(this, state, unused, rewrite(url));
    };
    history.replaceState = function (state, unused, url) {
        return originalReplace.call(this, state, unused, rewrite(url));
    };
    // MV2 injection can run after X's initial replaceState.
    originalReplace.call(history, history.state, "", rewrite(location.href));
    const onClick = (event: MouseEvent) => {
        if (
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        )
            return;
        const link = (event.target as Element | null)?.closest?.("a[href]");
        if (!(link instanceof HTMLAnchorElement)) return;
        if (link.target && link.target !== "_self") return;
        const url = new URL(link.href);
        if (url.origin === location.origin && !link.hasAttribute("download"))
            link.href = column_navigation_url(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => {
        history.pushState = originalPush;
        history.replaceState = originalReplace;
        document.removeEventListener("click", onClick, true);
    };
}
