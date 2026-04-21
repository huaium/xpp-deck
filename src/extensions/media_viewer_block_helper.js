// Disable native media viewer behavior.
(() => {
    /**
     * @typedef {{
     *   token: string | null;
     *   media_info: unknown[];
     *   selected_index: number;
     * }} SendMediaInfoDetail
     */
    let opd_send_media_info_token = null;
    let is_alt_pressed = false;
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
    // Stop column-side media open and pass media info back to OPD.
    /*
    TODO: Fix an issue where clicking quoted media on a post page sometimes opens the original post media.
    Investigate reliable quote detection and how to extract media metadata from quoted posts.
    */
    document.addEventListener(
        "click",
        (e) => {
            const target = e.target instanceof Element ? e.target : null;
            if (!target) return;
            // Disable media viewer while Alt/Option is pressed.
            if (is_alt_pressed) return;

            // Set when content is a quoted post.
            const quoted = target.closest('div[tabindex="0"][role="link"]');
            // Regular media tweet.
            const img = target.closest(
                'img, div[data-testid="videoComponent"]',
            );
            if (!img) return;

            // Get props when video player is active.
            let video_wrapper_props = null;
            if (img.getAttribute("data-testid") === "videoComponent") {
                video_wrapper_props = get_props(
                    img.querySelector('div[tabindex="0"]'),
                    "Props",
                );
            }

            // Get root props.
            let root_props = get_props(
                img.closest("div[aria-labelledby][id]"),
                "Props",
            ); //:not([data-testid="card.wrapper"])
            if (quoted) {
                root_props = get_props(quoted, "Props");
            }

            // Get current source when player exists.
            const current_video_source = /** @type {{
                posterImage?: string;
            } | undefined} */ (
                read_path(video_wrapper_props, [
                    "children",
                    "props",
                    "playerState",
                ])
            );

            // Get media source list.
            let media_details = /** @type {Array<{
                media_url_https?: string;
            }> | undefined} */ (
                read_path(root_props, [
                    "children",
                    0,
                    "props",
                    "children",
                    0,
                    "props",
                    "mediaDetails",
                ])
            );

            // Get media source list for quoted posts.
            let media_details_quoted = /** @type {Array<{
                media_url_https?: string;
            }> | undefined} */ (
                read_path(root_props, [
                    "children",
                    2,
                    "props",
                    "tweet",
                    "extended_entities",
                    "media",
                ])
            );
            if (quoted) {
                media_details_quoted = /** @type {Array<{
                    media_url_https?: string;
                }> | undefined} */ (
                    read_path(root_props, [
                        "children",
                        0,
                        0,
                        "props",
                        "children",
                        1,
                        "props",
                        "children",
                        4,
                        "props",
                        "children",
                        "props",
                        "mediaDetails",
                    ])
                );
            }

            // Exclude TwitterCard and similar cases for now.
            if (!media_details && !media_details_quoted) return;

            const resolved_media_details =
                media_details ?? media_details_quoted;
            if (!Array.isArray(resolved_media_details)) return;
            media_details = resolved_media_details;

            // Stop native viewer behavior.
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Mute video.
            const video_elem = img.querySelector("video");
            if (video_elem) {
                video_elem.pause();
                video_elem.muted = true;
            }

            // Send current media index and media metadata.
            let is_send = false;
            const image_src =
                img instanceof HTMLImageElement ? img.src : undefined;
            for (let index = 0; index < media_details.length; index++) {
                const media = media_details[index];
                if (
                    image_src?.match(
                        media.media_url_https?.replaceAll(/.jpg|.png/g, ""),
                    )
                ) {
                    window.parent.document.dispatchEvent(
                        new CustomEvent("opd_send_media_info", {
                            bubbles: true,
                            composed: true,
                            detail: JSON.stringify({
                                token: opd_send_media_info_token,
                                media_info: media_details,
                                selected_index: index,
                            }),
                        }),
                    );
                    is_send = true;
                    break;
                } else if (
                    current_video_source?.posterImage === media?.media_url_https
                ) {
                    window.parent.document.dispatchEvent(
                        new CustomEvent("opd_send_media_info", {
                            bubbles: true,
                            composed: true,
                            detail: JSON.stringify({
                                token: opd_send_media_info_token,
                                media_info: media_details,
                                selected_index: index,
                            }),
                        }),
                    );
                    is_send = true;
                    break;
                }
            }
            // If current index cannot be determined, send 0.
            if (!is_send) {
                window.parent.document.dispatchEvent(
                    new CustomEvent("opd_send_media_info", {
                        bubbles: true,
                        composed: true,
                        detail: JSON.stringify({
                            token: opd_send_media_info_token,
                            media_info: media_details,
                            selected_index: 0,
                        }),
                    }),
                );
            }
        },
        true,
    );
    // Helper to get React props.
    /** @param {Element | null} elem @param {"Props" | "Fiber"} type @returns {unknown} */
    function get_props(elem, type) {
        if (!elem) return null;
        const prop_type = type === "Props" ? type : "Fiber";
        const propsKey = Object.getOwnPropertyNames(elem).find((k) =>
            k.includes(`__react${prop_type}$`),
        );
        if (!propsKey) return null;
        return /** @type {Record<string, unknown>} */ (
            /** @type {unknown} */ (elem)
        )[propsKey];
    }
    // Set token for feature events.
    document.addEventListener(
        "opd_send_media_info_init",
        (e) => {
            const detail = /** @type {{ token?: string }} */ (
                JSON.parse(String(e.detail))
            );
            opd_send_media_info_token = detail.token;
        },
        true,
    );
    /* Handle Alt/Option as shortcut modifier. */
    document.addEventListener(
        "opd_media_viewer_shotcut",
        (e) => {
            // When column is inactive.
            const detail =
                /** @type {{ token?: string; keys?: { alt?: boolean } }} */ (
                    JSON.parse(String(e.detail))
                );

            if (detail.token !== opd_send_media_info_token) return;

            is_alt_pressed = Boolean(detail.keys?.alt);
        },
        true,
    );
    // When column is active.
    document.addEventListener("keydown", (event) => {
        console.log("shift_down");
        if (event.key === "Alt") is_alt_pressed = true;
    });
    document.addEventListener("keyup", (event) => {
        console.log("shift_up");
        if (event.key === "Alt") is_alt_pressed = false;
    });
})();
