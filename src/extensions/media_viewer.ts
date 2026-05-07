// Media viewer.
type MediaVariant = { url: string };
type MediaInfo = {
    type: "photo" | "animated_gif" | "video";
    media_url_https?: string;
    id_str?: string;
    video_info?: { variants: MediaVariant[] };
};
class OpdExtMediaViewer {
    Preview: (media_info: MediaInfo[], pre_index: number) => void;
    SkipBtnDisabled: (
        dialog_elem: HTMLDialogElement,
        media_info: MediaInfo[],
        current_media_idx: number,
    ) => void;
    DownloadMedia: (media: MediaInfo | undefined) => Promise<void>;

    constructor() {
        this.Preview = (media_info: MediaInfo[], pre_index: number) => {
            let current_media_idx = pre_index;
            const media_viewer_div = document.createElement("div");
            const media_viewer_dialog = document.createElement("dialog");
            const mediaHTMLAt = (idx: number) => {
                const info = media_info[idx];
                if (!info) return "";

                if (
                    ["animated_gif", "video"].includes(info.type) &&
                    info.video_info?.variants?.length
                ) {
                    const media_variant = info.video_info.variants.at(-1);
                    if (!media_variant) return "";
                    return `
                    <video data-media
                        style="width:auto;height:auto;max-width:calc(100% - 160px);max-height:100%;object-fit:contain;"
                        src="${media_variant.url}"
                        controls
                        autoplay
                        playsinline
                    ></video>`;
                }

                if (info.type === "photo") {
                    return `
                        <img data-media
                            style="width:auto;height:auto;max-width:calc(100% - 160px);max-height:100%;object-fit:contain;"
                            src="${info.media_url_https + "?name=orig"}"
                        />`;
                }

                return "";
            };

            const stopVideo = (elem: Element | null) => {
                if (!elem || elem.tagName !== "VIDEO") return;
                const video = elem as HTMLVideoElement;
                try {
                    video.pause();
                    video.removeAttribute("src");
                    video.load();
                } catch {
                    // no-op: media may already be detached
                }
            };

            const setMedia = (idx: number) => {
                const current =
                    media_viewer_dialog.querySelector("[data-media]");
                const nextInfo = media_info[idx];
                if (!current || !nextInfo) return;

                stopVideo(current);

                if (
                    ["animated_gif", "video"].includes(nextInfo.type) &&
                    current.tagName === "VIDEO" &&
                    nextInfo.video_info?.variants?.length
                ) {
                    const next_variant = nextInfo.video_info.variants.at(-1);
                    if (!next_variant) return;
                    const video = current as HTMLVideoElement;
                    video.src = next_variant.url;
                    video.load();
                    video.play();
                    return;
                }
                if (
                    nextInfo.type === "photo" &&
                    current.tagName === "IMG" &&
                    nextInfo.media_url_https
                ) {
                    const image = current as HTMLImageElement;
                    image.src = nextInfo.media_url_https + "?name=orig";
                    return;
                }

                const wrapper = document.createElement("div");
                wrapper.innerHTML = mediaHTMLAt(idx);
                const next_elment = wrapper.firstElementChild;
                if (!next_elment) return;

                current.replaceWith(next_elment);
                if (next_elment.tagName === "VIDEO") {
                    const next_video = next_elment as HTMLVideoElement;
                    next_elment.addEventListener(
                        "loadedmetadata",
                        () => {
                            next_video.volume = 0.2;
                        },
                        { once: true },
                    );
                }
            };

            Object.assign(media_viewer_dialog, {
                id: "opd_media_viewer",
                style: "z-index:999999;border:none;background:none;padding:0;display:flex;flex-direction:column;align-items:center;gap:12px;width:85vw;height:85vh;overflow:hidden;",
            });
            media_viewer_dialog.closedBy = "any";
            media_viewer_dialog.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;align-items:center;">
                <div class="opd_media_viewer_func_btn_circle" style="display:flex;width:100%;justify-content:flex-end;">
                    <button type="button" data-close><span class="media_viewer_icon_close opd_media_viewer_func_btn_icon_color"></span></button>
                </div>

                <div style="display:flex;flex-direction:row;flex:1;min-height:0;overflow:hidden;align-items:center;width:fit-content;">
                    <button type="button" class="opd_media_viewer_func_btn media_switch_btn" data-media-forward><span class="media_viewer_icon_forward opd_media_viewer_func_btn_icon_color"></span></button>
                    ${mediaHTMLAt(current_media_idx)}
                    <button type="button" class="opd_media_viewer_func_btn media_switch_btn" data-media-next><span class="media_viewer_icon_next opd_media_viewer_func_btn_icon_color"></span></button>
                </div>

                <div class="opd_media_viewer_func_btn_circle" style="width:100%;margin-top:10px;display:flex;justify-content:center;">
                    <button type="button" data-media-download><span class="media_viewer_icon_download opd_media_viewer_func_btn_icon_color"></span></button>
                </div>
            </div>
            `;
            media_viewer_div.appendChild(media_viewer_dialog);
            const append_viewer_element =
                document.body.appendChild(media_viewer_div);

            // Set video volume.
            let video_element =
                append_viewer_element.getElementsByTagName("video")[0];
            if (video_element) {
                // Lower default video volume to avoid sudden loud playback.
                video_element.volume = 0.2;
            }

            function media_viewer_close() {
                video_element =
                    append_viewer_element.getElementsByTagName("video")[0];
                if (video_element) {
                    // Stop and remove video on close to avoid rare lingering playback.
                    video_element.pause();
                    video_element.remove();
                }
                media_viewer_div.remove();
            }

            media_viewer_dialog.addEventListener("close", () =>
                media_viewer_close(),
            );
            media_viewer_dialog
                .querySelector("[data-close]")
                ?.addEventListener("click", () => media_viewer_close());

            // Allow closing by clicking background.
            media_viewer_dialog.addEventListener("click", (event) => {
                const target =
                    event.target instanceof Element ? event.target : null;
                const tag_name = target?.tagName ?? "";
                const allowed_tag = ["IMG", "VIDEO", "SPAN", "BUTTON"];
                if (!allowed_tag.includes(tag_name)) {
                    media_viewer_close();
                }
            });

            this.SkipBtnDisabled(
                media_viewer_dialog,
                media_info,
                current_media_idx,
            );

            const forward_button =
                media_viewer_dialog.querySelector<HTMLButtonElement>(
                    "[data-media-forward]",
                );
            const next_button =
                media_viewer_dialog.querySelector<HTMLButtonElement>(
                    "[data-media-next]",
                );
            const download_button =
                media_viewer_dialog.querySelector<HTMLButtonElement>(
                    "[data-media-download]",
                );
            if (forward_button) {
                forward_button.addEventListener("click", () => {
                    this.SkipBtnDisabled(
                        media_viewer_dialog,
                        media_info,
                        current_media_idx,
                    );

                    if (current_media_idx === 0) return;

                    const current_media_elem =
                        media_viewer_dialog.querySelector("[data-media]");
                    if (
                        !current_media_elem ||
                        !(
                            current_media_elem instanceof HTMLImageElement ||
                            current_media_elem instanceof HTMLVideoElement
                        )
                    ) {
                        return;
                    }
                    const forward_idx = current_media_idx - 1;
                    const forward_media = media_info[forward_idx];
                    if (!forward_media) return;

                    if (
                        ["animated_gif", "video"].includes(forward_media.type)
                    ) {
                        const video_url =
                            forward_media.video_info?.variants?.at(-1)?.url;
                        if (video_url) {
                            current_media_elem.src = video_url;
                        }
                    }
                    if (
                        forward_media.type === "photo" &&
                        forward_media.media_url_https
                    ) {
                        current_media_elem.src =
                            forward_media.media_url_https + "?name=orig";
                    }
                    current_media_idx -= 1;

                    setMedia(current_media_idx);

                    this.SkipBtnDisabled(
                        media_viewer_dialog,
                        media_info,
                        current_media_idx,
                    );
                });
            }

            if (next_button) {
                next_button.addEventListener("click", () => {
                    const next_idx = current_media_idx + 1;

                    if (media_info.length === next_idx) return;

                    const current_media_elem =
                        media_viewer_dialog.querySelector("[data-media]");
                    if (
                        !current_media_elem ||
                        !(
                            current_media_elem instanceof HTMLImageElement ||
                            current_media_elem instanceof HTMLVideoElement
                        )
                    ) {
                        return;
                    }
                    const next_media = media_info[next_idx];
                    if (!next_media) return;
                    if (["animated_gif", "video"].includes(next_media.type)) {
                        const video_url =
                            next_media.video_info?.variants?.at(-1)?.url;
                        if (video_url) {
                            current_media_elem.src = video_url;
                        }
                    }
                    if (
                        next_media.type === "photo" &&
                        next_media.media_url_https
                    ) {
                        current_media_elem.src =
                            next_media.media_url_https + "?name=orig";
                    }
                    current_media_idx += 1;

                    setMedia(current_media_idx);

                    this.SkipBtnDisabled(
                        media_viewer_dialog,
                        media_info,
                        current_media_idx,
                    );
                });
            }

            if (download_button) {
                download_button.addEventListener("click", () => {
                    this.DownloadMedia(media_info[current_media_idx]);
                });
            }

            media_viewer_dialog.showModal();
        };

        this.SkipBtnDisabled = (
            dialog_elem: HTMLDialogElement,
            media_info: MediaInfo[],
            current_media_idx: number,
        ) => {
            const next_btn = dialog_elem.querySelector("[data-media-next]");
            const prev_btn = dialog_elem.querySelector("[data-media-forward]");
            if (!next_btn || !prev_btn) return;

            if (media_info.length === 1) {
                prev_btn.setAttribute("disabled", "");
                next_btn.setAttribute("disabled", "");
                return;
            }

            prev_btn.removeAttribute("disabled");
            next_btn.removeAttribute("disabled");

            switch (current_media_idx) {
                case 0:
                    prev_btn.setAttribute("disabled", "");
                    break;

                case media_info.length - 1:
                    next_btn.setAttribute("disabled", "");
                    break;
            }
        };
        this.DownloadMedia = async (media: MediaInfo | undefined) => {
            let media_src: string | null = null;
            if (
                media &&
                ["animated_gif", "video"].includes(media.type) &&
                media.video_info?.variants?.length
            ) {
                const media_variant = media.video_info.variants.at(-1);
                media_src = media_variant?.url ?? null;
            }
            if (media?.type === "photo" && media.media_url_https) {
                media_src = media.media_url_https + "?name=orig";
            }
            if (!media_src) return;
            const res = await fetch(media_src);
            const blob = await res.blob();

            const a = document.createElement("a");
            const objectUrl = URL.createObjectURL(blob);

            a.href = objectUrl;
            a.download = media?.id_str ?? "";
            document.body.appendChild(a);
            a.click();

            URL.revokeObjectURL(objectUrl);
            document.body.removeChild(a);
        };
    }
}
window.OpdExtMediaViewer = OpdExtMediaViewer;
