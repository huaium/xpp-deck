// Disable native media viewer behavior.
export class OpdMediaViewerBlocker {
    opd_send_media_info_token: string | null;
    Init: (column_window: Window) => void;

    constructor() {
        this.opd_send_media_info_token = null;
        this.Init = (column_window) => {
            // Inject helper script.
            const helper_script =
                column_window.document.createElement("script");
            helper_script.src = chrome.runtime.getURL(
                "media_viewer_block_helper.js",
            );

            this.opd_send_media_info_token = crypto.randomUUID();
            helper_script.addEventListener("load", () => {
                column_window.document.dispatchEvent(
                    new CustomEvent("opd_send_media_info_init", {
                        bubbles: true,
                        composed: true,
                        detail: JSON.stringify({
                            token: this.opd_send_media_info_token,
                        }),
                    }),
                );

                /* Handle Alt/Option as shortcut modifier. */
                document.addEventListener("keydown", (event) => {
                    if (event.key === "Alt") {
                        column_window.document.dispatchEvent(
                            new CustomEvent("opd_media_viewer_shotcut", {
                                bubbles: true,
                                composed: true,
                                detail: JSON.stringify({
                                    token: this.opd_send_media_info_token,
                                    keys: { alt: true },
                                }),
                            }),
                        );
                    }
                });
                document.addEventListener("keyup", (event) => {
                    if (event.key === "Alt") {
                        column_window.document.dispatchEvent(
                            new CustomEvent("opd_media_viewer_shotcut", {
                                bubbles: true,
                                composed: true,
                                detail: JSON.stringify({
                                    token: this.opd_send_media_info_token,
                                    keys: { alt: false },
                                }),
                            }),
                        );
                    }
                });
            });

            column_window.document.head.appendChild(helper_script);
        };
    }
}
