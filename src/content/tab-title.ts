export function keep_deck_tab_title(iconUrl?: string) {
    const restore = () => {
        if (document.title !== "XPP-Deck") document.title = "XPP-Deck";
        if (!iconUrl) return;
        const icons = document.head.querySelectorAll<HTMLLinkElement>(
            'link[rel~="icon"]',
        );
        if (icons.length === 0) {
            const icon = document.createElement("link");
            icon.rel = "icon";
            icon.href = iconUrl;
            document.head.appendChild(icon);
        } else {
            for (const icon of icons) {
                if (icon.href !== iconUrl) icon.href = iconUrl;
                if (icon.type) icon.removeAttribute("type");
                if (icon.sizes.length) icon.removeAttribute("sizes");
            }
        }
    };
    restore();
    const observer = new MutationObserver(restore);
    observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["rel", "href", "type", "sizes"],
    });
    return () => observer.disconnect();
}
