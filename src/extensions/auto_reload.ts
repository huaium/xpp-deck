// Used by the auto-refresh feature.
export class XpdExtAutoReload {
    xpd_reload_token: string | null;
    Init: (column_window: Window) => void;
    Reload: (column_window: Window) => boolean;

    constructor() {
        this.xpd_reload_token = null;
        this.Init = (column_window) => {
            // Inject helper script.
            const helper_script =
                column_window.document.createElement("script");
            helper_script.src = chrome.runtime.getURL("auto_reload_helper.js");
            const token = crypto.randomUUID();
            this.xpd_reload_token = token;
            helper_script.addEventListener(
                "load",
                () => {
                    column_window.document.dispatchEvent(
                        new CustomEvent("xpd_column_reload_init", {
                            detail: JSON.stringify({
                                token,
                            }),
                        }),
                    );
                },
                { once: true },
            );
            column_window.document.head.appendChild(helper_script);
        };
        this.Reload = (column_window) => {
            if (!this.xpd_reload_token) return false;
            const doc = column_window.document;
            let refreshed = false;
            const on_result = (event: Event) => {
                try {
                    const detail = JSON.parse(
                        String((event as CustomEvent).detail),
                    );
                    if (detail.token === this.xpd_reload_token)
                        refreshed = detail.refreshed === true;
                } catch {
                    // Ignore malformed page events.
                }
            };
            doc.addEventListener("xpd_column_reload_result", on_result);
            try {
                doc.dispatchEvent(
                    new CustomEvent("xpd_column_reload", {
                        bubbles: true,
                        composed: true,
                        detail: JSON.stringify({
                            token: this.xpd_reload_token,
                        }),
                    }),
                );
            } finally {
                doc.removeEventListener("xpd_column_reload_result", on_result);
            }
            return refreshed;
        };
    }
}
