// Disable native media viewer behavior.
(() => {
    let opd_send_media_info_token = null;
    let is_alt_pressed = false;
    // Stop column-side media open and pass media info back to OPD.
    /*
    TODO:ツイートページのツイートに画像や動画付きの引用が付いていて、引用のメディアをクリックした際に元のメディアが表示される問題を修正する。
    ※引用を開いた際の判定と引用のメディア情報を抽出する方法を調査する
    */
    document.addEventListener(
        "click",
        (e) => {
            // Disable media viewer while Alt/Option is pressed.
            if (is_alt_pressed) return;

            // Set when content is a quoted post.
            const quoted = e.target.closest('div[tabindex="0"][role="link"]');
            // Regular media tweet.
            const img = e.target.closest(
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
            const current_video_source =
                video_wrapper_props?.children?.props?.playerState;

            // Get media source list.
            let media_details =
                root_props?.children[0]?.props?.children[0]?.props
                    ?.mediaDetails;

            // Get media source list for quoted posts.
            let media_details_quoted =
                root_props?.children[2]?.props?.tweet?.extended_entities?.media;
            if (quoted) {
                media_details_quoted =
                    root_props?.children[0]?.[0]?.props?.children[1]?.props
                        ?.children[4]?.props?.children?.props?.mediaDetails;
            }

            // Exclude TwitterCard and similar cases for now.
            if (!media_details && !media_details_quoted) return;

            media_details ??= media_details_quoted;

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
            for (let index = 0; index < media_details.length; index++) {
                const media = media_details[index];
                if (
                    img?.src?.match(
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
    function get_props(elem, type) {
        if (!elem) return;
        const prop_type = type === "Props" ? type : "Fiber";
        const propsKey = Object.getOwnPropertyNames(elem).find((k) =>
            k.includes(`__react${prop_type}$`),
        );
        return propsKey ? elem[propsKey] : null;
    }
    // Set token for feature events.
    document.addEventListener(
        "opd_send_media_info_init",
        (e) => {
            const detail = JSON.parse(e.detail);
            opd_send_media_info_token = detail.token;
        },
        true,
    );
    /* Handle Alt/Option as shortcut modifier. */
    document.addEventListener(
        "opd_media_viewer_shotcut",
        (e) => {
            // When column is inactive.
            const detail = JSON.parse(e.detail);

            if (detail.token !== opd_send_media_info_token) return;

            is_alt_pressed = detail.keys.alt;
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
