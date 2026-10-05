// Used by the auto-refresh feature.
export class OpdExtAutoReload {
    opd_reload_token: string | null;
    Init: (column_window: Window) => void;
    Reload: (column_window: Window) => boolean;

    constructor() {
        this.opd_reload_token = null;
        this.Init = (column_window) => {
            // Inject helper script.
            const helper_script =
                column_window.document.createElement("script");
            helper_script.src = chrome.runtime.getURL(
                "auto_reload_helper.js",
            );
            column_window.document.head.appendChild(helper_script);

            this.opd_reload_token = crypto.randomUUID();
            setTimeout(() => {
                column_window.document.dispatchEvent(
                    new CustomEvent("opd_column_reload_init", {
                        detail: JSON.stringify({
                            token: this.opd_reload_token,
                        }),
                    }),
                );
            }, 10);
        };
        this.Reload = (column_window) => {
            if (!this.opd_reload_token) return false;
            column_window.document.dispatchEvent(
                new CustomEvent("opd_column_reload", {
                    bubbles: true,
                    composed: true,
                    detail: JSON.stringify({ token: this.opd_reload_token }),
                }),
            );
            return true;
        };
    }
}
