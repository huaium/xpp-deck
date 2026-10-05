import {
    open_api_limits_dialog,
    api_refresh_paused,
    animate_ui_entrance,
    animate_sidebar_change,
    create_api_sidebar_html,
    update_api_sidebar,
    beforeunload_bypass_key,
    create_language_select_html,
    create_profile_list_buttons_html,
    create_profile_list_html,
    create_sidebar_button_html,
    i18n_message,
    i18n_message_or_fallback,
    is_shift_pressed,
    last_load_profile,
    manifest,
    next_profile_name,
    media_viewer_token,
    opd_alert,
    opd_confirm,
    opd_i18n_language,
    opd_prompt,
    opd_root_theme_attribute,
    opd_sidebar_width_collapsed,
    opd_sidebar_width_expanded,
    open_about_page_modal,
    open_opd_dialog,
    profile_store,
    profile_display_name,
    request_page_reload,
    set_last_load_profile,
    ui_icon_define,
} from "./prelude";
import { create_column_load_scheduler } from "./loading";
import {
    apply_theme_for_main_element,
    stop_system_theme_listener,
} from "./settings";
import { OpdExtAutoReload } from "../extensions/auto_reload";
import { OpdExtMediaViewer } from "../extensions/media_viewer";
import { OpdMediaViewerBlocker } from "../extensions/media_viewer_block";
let opd_column_load_scheduler:
    ReturnType<typeof create_column_load_scheduler> | undefined;
let is_removed_default_style = false;
export function run(settings) {
    opd_column_load_scheduler?.dispose();
    const load_scheduler = create_column_load_scheduler();
    opd_column_load_scheduler = load_scheduler;
    const banner_observers = new WeakMap<HTMLIFrameElement, MutationObserver>();
    const settings_animations = new WeakMap<HTMLElement, Animation>();

    function column_load_priority(frame: HTMLIFrameElement) {
        const bounds = frame.getBoundingClientRect();
        return bounds.right > 0 &&
            bounds.left < window.innerWidth &&
            bounds.bottom > 0 &&
            bounds.top < window.innerHeight
            ? 0
            : 1;
    }
    function queue_column_navigation(
        frame: HTMLIFrameElement,
        navigate: () => void,
        eligible: () => boolean = () => frame.isConnected,
    ) {
        if (!frame.isConnected || load_scheduler.has(frame)) return;
        const root = frame.closest<HTMLElement>("div[opd_column_type]");
        root?.setAttribute(
            "opd_load_status",
            i18n_message_or_fallback("ui_column_waiting", "Waiting to load"),
        );
        frame.setAttribute("aria-busy", "true");
        load_scheduler.enqueue({
            key: frame,
            valid: eligible,
            priority: () => column_load_priority(frame),
            start: (done) => {
                root?.setAttribute(
                    "opd_load_status",
                    i18n_message_or_fallback("ui_column_loading", "Loading..."),
                );
                const loaded = () => {
                    try {
                        if (
                            frame.contentWindow?.location.href === "about:blank"
                        )
                            return;
                    } catch {
                        /* Cross-origin load completion is still a completion. */
                    }
                    done();
                };
                frame.addEventListener("load", loaded);
                const cleanup = () => {
                    frame.removeEventListener("load", loaded);
                    root?.removeAttribute("opd_load_status");
                    frame.removeAttribute("aria-busy");
                };
                try {
                    navigate();
                } catch (error) {
                    cleanup();
                    throw error;
                }
                return cleanup;
            },
        });
    }
    function queue_column_frames() {
        document
            .querySelectorAll<HTMLIFrameElement>(
                "#opd_main_element iframe[data-opd-src]",
            )
            .forEach((frame) => {
                queue_column_navigation(frame, () => {
                    const source = frame.getAttribute("data-opd-src");
                    frame.removeAttribute("data-opd-src");
                    const pinned = frame
                        .closest("div[opd_column_type]")
                        ?.getAttribute("opd_pinned_path");
                    if (pinned) frame.src = `https://x.com${pinned}`;
                    else if (source) frame.src = source;
                });
            });
    }
    function column_set_interval(callback: () => void, interval: number) {
        const timer = setInterval(callback, interval);
        load_scheduler.onDispose(() => clearInterval(timer));
        return timer;
    }
    function queue_column_auto_refresh(
        frame: HTMLIFrameElement,
        reload: OpdExtAutoReload | null,
    ) {
        const eligible = () => {
            if (!frame.isConnected || !frame.contentWindow) return false;
            if (
                document.hidden ||
                api_refresh_paused() ||
                column_load_priority(frame) !== 0
            )
                return false;
            const enabled = frame
                .closest("div[opd_column_type]")
                ?.querySelector<HTMLInputElement>(".opd_a_reload_bar")?.checked;
            return (
                enabled === true &&
                frame.getAttribute("auto_reload_mouse_hover") !== "true"
            );
        };
        if (!eligible()) return;
        const path = frame.contentWindow!.location.pathname;
        if (
            !reload ||
            !(
                ["/home", "/search"].includes(path) ||
                path.startsWith("/i/lists")
            )
        ) {
            queue_column_navigation(
                frame,
                () => {
                    if (eligible()) frame.contentWindow!.location.reload();
                },
                eligible,
            );
            return;
        }
        load_scheduler.enqueue({
            key: frame,
            valid: eligible,
            priority: () => column_load_priority(frame),
            start: (done) => {
                if (!eligible()) {
                    done();
                    return;
                }
                reload.Reload(frame.contentWindow!);
                frame.contentWindow!.scrollTo({ top: 0, behavior: "auto" });
                // X's refresh hook exposes no request-completion event.
                const timer = setTimeout(done, 1000);
                return () => clearTimeout(timer);
            },
        });
    }

    //console.log(settings)
    let profile_list_html;
    profile_list_html = create_profile_list_html(
        profile_store.length,
        last_load_profile,
    );
    //console.log(profile_list_btn_html)
    // Media preview panel.
    const media_viewer = new OpdExtMediaViewer();
    document.addEventListener("opd_send_media_info", (e) => {
        const detail = JSON.parse(String(e.detail));
        for (let index = 0; index < media_viewer_token.length; index++) {
            const token = media_viewer_token[index];
            if (detail.token === token) {
                media_viewer.Preview(detail.media_info, detail.selected_index);
                break;
            }
        }
    });
    // Insert CSS tags.
    const document_head = document.head;
    if (!document_head) return;
    document_head.insertAdjacentHTML(
        "afterbegin",
        `<style second_column_css></style>
    <style opd_default_css>
    html{
        overflow-y:hidden !important;
    }
    #opd_main_element{
        --opd-bg: #e6e9ee;
        --opd-surface: #ffffff;
        --opd-surface-alt: #f5f7fa;
        --opd-border: #c6ced8;
        --opd-border-strong: #a8b2bf;
        --opd-text: #1f2937;
        --opd-muted: #5f6b7a;
        --opd-hover: #e7edf4;
        --opd-focus: #3b82f6;
        --opd-profile-selected-bg: linear-gradient(180deg, #eef5ff 0%, #e4eefc 100%);
        --opd-profile-selected-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
        --opd-sidebar-width: ${opd_sidebar_width_expanded};
        --opd-sidebar-label-opacity: 1;
        --opd-sidebar-label-width: auto;
    }
    #opd_main_element.opd_sidebar_collapsed{
        --opd-sidebar-width: ${opd_sidebar_width_collapsed};
        --opd-sidebar-label-opacity: 0;
        --opd-sidebar-label-width: 0;
    }
    #opd_main_element *{
        box-sizing: border-box;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .main_bar_functions{
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.4rem;
        margin-top: 0.4rem;
        color: var(--opd-text);
        font-weight: 700;
        width: var(--opd-sidebar-width);
        padding: 0 0.5rem 0.5rem;
        overflow: hidden;
        transition: width 0.18s ease;
    }
    .main_bar_functions hr{
        width: 100%;
        margin: 0.15rem 0;
        border: 0;
        border-top: 1px solid var(--opd-border);
    }
    .opd_version_span{
        cursor: pointer;
        color: var(--opd-muted);
        font-size: 0.72rem;
        white-space: nowrap;
    }
    .opd_debug_menu{
        display: none;
        width: 100%;
        padding: 0;
        color: var(--opd-text);
        font-size: 0.72rem;
        text-align: left;
    }
    .opd_debug_menu input{
        width: 100%;
        margin-top: 0.2rem;
        min-height: 24px;
        border-radius: 6px;
        border: 1px solid var(--opd-border);
        background: var(--opd-surface);
        font-size: 0.7rem;
        cursor: pointer;
    }
    .opd_debug_menu input:hover{
        background: var(--opd-hover);
    }
    #opd_main_element{
        background: var(--opd-bg) !important;
    }
    div[opd_column_type="dsp_column"]{
        overflow-x: scroll;
        scrollbar-width: none;
    }
    #main_bar_empty_column{
        background-color: var(--opd-surface);
        border-right: 1px solid var(--opd-border);
        min-width: var(--opd-sidebar-width) !important;
        max-width: var(--opd-sidebar-width) !important;
        transition: min-width 0.18s ease, max-width 0.18s ease;
    }
    #api_limit_status{
        border-radius: 999px;
        width: 48px;
        min-width: 48px;
        min-height: 24px;
        line-height: 24px;
        text-align: center;
        border: 1px solid var(--opd-border);
        background: var(--opd-surface-alt);
        color: var(--opd-muted);
        font-size: 0.72rem;
    }
    #api_limit_status:hover{
        background-color: var(--opd-hover);
        cursor: help;
    }
    .opd_ui_logo_parent{
        overflow: hidden;
        display: flex;
        width: 100%;
        align-content: center;
        justify-content: center;
        align-items: center;
        flex-direction: row;
        gap: 0.75rem;
        min-height: 52px;
        padding: 0.1rem 0;
    }
    .opd_language_select_wrap{
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        gap: 0.25rem;
        margin-top: auto;
    }
    .opd_language_separator{
        width: 100%;
        margin: 0.15rem 0 0.2rem;
        border: 0;
        border-top: 1px solid var(--opd-border);
    }
    .opd_language_select_label{
        color: var(--opd-muted);
        font-size: 0.72rem;
        text-align: left;
        line-height: 1;
        padding: 0 0.15rem;
    }
    .opd_language_select{
        width: 100%;
        min-height: 30px;
        border: 1px solid var(--opd-border);
        border-radius: 8px;
        background: var(--opd-surface);
        color: var(--opd-text);
        font-size: 0.8rem;
        padding: 0 0.45rem;
        cursor: pointer;
    }
    .opd_language_select:hover{
        background: var(--opd-hover);
    }
    .opd_ui_logo{
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL("public/icons/logo_icon.svg")});
        height: 50px;
        width: 50px;
        cursor: pointer;
    }
    #main_rack_element{
        position: fixed;
        left: var(--opd-sidebar-width);
        height:100vh;
        max-width:calc(100vw - var(--opd-sidebar-width));
        width:calc(100vw - var(--opd-sidebar-width));
        overflow:scroll hidden;
        transition: left 0.18s ease, width 0.18s ease, max-width 0.18s ease;
    }
    #first_rack_element{
        /*overflow: hidden;*/
    }
    #second_rack_element{
        /*overflow: hidden;*/
    }
    .dsp_column_emptycolumn p{
        text-align: center;
        color: var(--opd-text);
    }
    .dsp_column_second_emptycolumn p{
        text-align: center;
        color: var(--opd-text);
    }
    .dsp_btn_parent{
        overflow: hidden;
        border-radius: 10px;
        display: flex;
        width: 100%;
        height: 44px;
        align-content: center;
        justify-content: flex-start;
        align-items: center;
        border: 1px solid transparent;
        gap: 0.75rem;
        padding: 0 0.7rem;
    }
    .dsp_btn_parent:hover{
        background: var(--opd-hover);
        border-color: var(--opd-border);
        cursor: pointer;
    }
    .dsp_btn_icon_wrap{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        min-width: 24px;
        height: 24px;
    }
    .dsp_btn_label{
        overflow: hidden;
        max-width: 100%;
        color: var(--opd-text);
        font-size: 0.9rem;
        line-height: 1.2;
        white-space: nowrap;
        text-overflow: ellipsis;
        opacity: var(--opd-sidebar-label-opacity);
        width: var(--opd-sidebar-label-width);
        transition: opacity 120ms ease-out;
    }
    .dsp_btn_sidebar_fold_img{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.banner_hide)});
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        width: 22px;
        height: 22px;
        transform: scaleX(1);
    }
    #sidebar_fold_toggle.opd_sidebar_toggle_is_collapsed .dsp_btn_sidebar_fold_img{
        transform: scaleX(-1);
    }
    #api_limit_status_button .dsp_btn_icon_wrap{
        width: auto;
        min-width: 48px;
    }
    .opd_api_sidebar{padding:12px 8px;margin:4px 0;border-block:1px solid var(--opd-border);}
    .opd_api_sidebar_heading{display:flex;align-items:center;justify-content:flex-start;text-align:left;height:24px;font-size:0.72rem;font-weight:400;line-height:1;color:var(--opd-muted);padding:0 0.15rem;margin:0 0 8px;}
    .opd_api_sidebar_row{display:flex;align-items:center;gap:8px;width:100%;height:48px;min-height:48px;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--opd-text);cursor:pointer;font:inherit;}
    .opd_api_sidebar_row:hover{background:var(--opd-hover);}
    .opd_api_sidebar_row:focus-visible{outline:2px solid var(--opd-muted);outline-offset:1px;}
    .opd_api_sidebar_icon{width:18px;height:18px;flex-shrink:0;}
    .opd_api_sidebar_label{font-size:12px;flex:1;text-align:left;}
    .opd_api_sidebar_value{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;}
    .opd_api_sidebar_row[data-level="green"] .opd_api_sidebar_value{color:#16834a;}
    .opd_api_sidebar_row[data-level="amber"] .opd_api_sidebar_value{color:#b77909;}
    .opd_api_sidebar_row[data-level="red"] .opd_api_sidebar_value{color:#d33b36;}
    #opd_main_element.opd_sidebar_collapsed .opd_api_sidebar{padding:12px 0;}
    #opd_main_element.opd_sidebar_collapsed .opd_api_sidebar_heading{justify-content:center;text-align:center;font-size:9px;line-height:1.3;margin:0 2px 8px;overflow-wrap:anywhere;}
    #opd_main_element.opd_sidebar_collapsed .opd_api_sidebar_label{display:none;}
    #opd_main_element.opd_sidebar_collapsed .opd_api_sidebar_row{flex-direction:column;gap:3px;padding:7px 0;min-height:48px;}
    #api_limit_status_button .dsp_btn_label{
        text-align: center;
    }
    #opd_main_element.opd_sidebar_collapsed .dsp_btn_parent{
        justify-content: center;
        padding: 0;
        gap: 0;
    }
    #opd_main_element.opd_sidebar_collapsed .dsp_btn_label{opacity:0;pointer-events:none;}
    @media(prefers-reduced-motion:reduce){
        #opd_main_element .dsp_btn_label,
        #opd_main_element .dsp_column_draggable_false,
        #opd_main_element{transition:none !important;}
    }
    #opd_main_element.opd_sidebar_collapsed .dsp_profile_section{
        align-items: center;
    }
    #opd_main_element.opd_sidebar_collapsed .main_bar_functions{
        align-items: center;
        padding-left: 0.2rem;
        padding-right: 0.2rem;
    }
    #opd_main_element.opd_sidebar_collapsed .opd_ui_logo_parent{
        justify-content: center;
        padding: 0;
        min-height: 52px;
    }
    #opd_main_element.opd_sidebar_collapsed .opd_language_select_wrap{
        visibility: hidden;
        pointer-events: none;
    }
    #opd_main_element.opd_sidebar_collapsed .opd_debug_menu{
        display: none !important;
    }
    #opd_main_element.opd_sidebar_collapsed .opd_version_span{
        display: none;
    }
    #opd_main_element.opd_sidebar_collapsed .opd_ui_logo{
        width: 42px;
        height: 42px;
    }
    #opd_main_element.opd_sidebar_collapsed #api_limit_status_button .dsp_btn_icon_wrap{
        min-width: 48px;
    }
    .dsp_btn_add_post_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_post_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_add_tl_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_timeline_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_add_ntfc_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_notification_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_add_explr_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_explore_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_add_custom_url_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_custom_url_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_add_lists_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.add_lists_column)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_second_rack_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_second_rack)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_profile_add_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.profile_save)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_profile_delete_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.profile_delete)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_switch_theme_img{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
        background-size: cover;
        background-repeat: no-repeat;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.switch_theme)});
        height: 100%;
        width: 100%;
    }
    .dsp_btn_change_profile_btn{
        display: flex;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--opd-muted);
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
    }
    .dsp_btn_profile_selected{
        border: 1px solid var(--opd-focus);
        color: var(--opd-text);
        background: var(--opd-profile-selected-bg);
        box-shadow: var(--opd-profile-selected-shadow);
    }
    .dsp_btn_profile_selected:hover{
        background: var(--opd-profile-selected-bg);
        border-color: var(--opd-focus);
    }
    .dsp_btn_profile_selected .dsp_btn_change_profile_btn,
    .dsp_btn_profile_selected .dsp_btn_label{
        color: var(--opd-text);
    }
    .dsp_profile_section{
        display: flex;
        flex-direction: column;
        width: 100%;
    }
    .dsp_profile_list{
        width: 100%;
        max-height: 1000px;
        overflow-y: scroll;
        scrollbar-width: none;
    }
    #profile_btn_list{
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        width: 100%;
    }
    .dsp_column_draggable_true{
        border: 1px solid var(--opd-border);
        /*overflow: hidden;*/
        background-color: var(--opd-surface);
        border-radius: 8px;
        margin: 0 0.15rem;
    }
    .dsp_column_draggable_true div[opd_column_type]{
        display: flex;
        flex-direction: column;
    }
    .dsp_column iframe{
        border: 0;
    }
    .dsp_column_btn{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        min-width: 28px;
        height: 28px;
        line-height: 0;
        border-radius: 6px;
        overflow: visible;
        margin-right: 4px;
        border: 1px solid transparent;
    }
    .dsp_column_btn:hover{
        background: var(--opd-hover);
        border-color: var(--opd-border);
        cursor: pointer;
    }
    .column_bar{
        display: flex;
        flex-direction: row;
        width: 100%;
        min-height: 34px;
        align-items: center;
        padding: 3px 6px;
        gap: 2px;
        overflow: visible;
        border-top: solid var(--opd-border) 1px !important;
        border-bottom: solid var(--opd-border) 1px !important;
        border-radius: 8px 8px 0 0;
        background: var(--opd-surface-alt);
    }
    .dsp_column_title{
        width: auto;
        color: var(--opd-text);
        font-size: 0.85rem;
        font-weight: 600;
        margin-right: 2px;
    }
    .dsp_column_move_icon_parent{
        max-height: 24px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
    }
    .dsp_column_move_icon{
        display: block;
        filter: brightness(0) saturate(100%) invert(61%) sepia(13%) saturate(13%) hue-rotate(335deg) brightness(89%) contrast(79%);
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_move)});
        background-size: cover;
        width: 14px;
        height: 14px;   
    }
    .dsp_column_settings_btn{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_settings)});
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        width: 22px;
        height: 22px;    
    }
    .dsp_column_settings_btn:hover{
        cursor: pointer;
    }
    .dsp_column_settings_btn input{
        display: none;
    }
    .dsp_column_refresh_btn{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.refresh)});
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        width: 22px;
        height: 22px;
    }
    .dsp_column_refresh_btn:hover{
        cursor: pointer;
    }
    .dsp_column_refresh_btn input{
        display: none;
    }
    .dsp_column_empty_area {
    	width: 100%;
    }
    .dsp_column_close_btn{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_close)});
        background-size: 15px;
        background-repeat: no-repeat;
        background-position: center;
        width: 22px;
        height: 22px;
    }
    .dsp_column_close_btn:hover{
        cursor: pointer;
    }
    .dsp_column_close_btn input{
        display: none;
    }

    .dsp_column_banner_btn{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.banner_hide)});
        transform: rotate(180deg);
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        width: 22px;
        height: 22px;
    }
    input:checked + .dsp_column_banner_btn{
        transform: rotate(0deg);
    }
    .dsp_column_btn input{
        opacity: 0;
        position: absolute;
        z-index: 10;
        margin: 0;
        width: 24px;
        height: 24px;
        cursor: pointer;
    }
    .dsp_column_close_btn_wrap{
        display: flex;
        justify-content: flex-end;
    }
    .dsp_column_close_btn input{
        display: none;
    }

    .dsp_column_pin_btn{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_pin)});
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        width: 18px;
        height: 18px;    
    }
    input:checked + .dsp_column_pin_btn{
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_pinned)});
    }
    .dsp_column_pin_btn input{
        opacity: 0;
        position: absolute;
        z-index: 10;
        margin: 0;
        width: 24px;
        height: 24px;
    }

    .dsp_column_settings_panel{
        display: none;
        position: relative;
        width: inherit;
        height: auto;
        background: var(--opd-surface-alt);
        border: 1px solid var(--opd-border-strong);
        border-radius: 0 0 8px 8px;
        border-top: 0;
        flex-direction: column;
    }
    .dsp_column_settings_panel h2{
        /*margin: 0 0 0.2rem;*/
        margin: 0;
    }
    .dsp_column_settings_panel_content{
        margin: 0.4rem 0.5rem 0 0.5rem;
    }
    .dsp_column_settings_panel_content h2{
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--opd-text);
        margin-bottom: 0.35rem;
    }
    .opd_column_settings_input_text{
        width: 4.5rem;
        margin-right: 0.2rem;
    }
    .dsp_column_settings_list{
        background: var(--opd-surface);
        border-radius: 6px;
        border: 1px solid var(--opd-border);
        margin: 0;
        padding: 0.45rem;
    }
    .dsp_column_settings_content_div{
        margin-bottom: 0.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: var(--opd-text);
    }
    .dsp_column_settings_panel_close_btn_wrap{
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin: 0.4rem 0.5rem 0.5rem 0.5rem;
    }
    .dsp_column_settings_panel_close_btn{
        border: 1px solid var(--opd-border-strong);
        background: var(--opd-surface);
        color: var(--opd-text);
        border-radius: 999px;
        font-size: 0.75rem;
        line-height: 1;
        min-height: 28px;
        padding: 0.3rem 0.9rem;
        cursor: pointer;
    }
    .dsp_column_settings_panel_close_btn:hover{
        background: var(--opd-hover);
    }
    .dsp_column_settings_panel select,
    .dsp_column_settings_panel input[type="number"]{
        border: 1px solid var(--opd-border);
        border-radius: 6px;
        min-height: 24px;
        padding: 0 0.35rem;
        font-size: 0.76rem;
        color: var(--opd-text);
        background: var(--opd-surface);
    }
    .column_width_btn{
        border: 1px solid var(--opd-border);
        border-radius: 6px;
        background: var(--opd-surface);
        min-height: 24px;
        padding: 0 0.45rem;
        cursor: pointer;
        font-size: 0.75rem;
    }
    .column_width_btn:hover{
        background: var(--opd-hover);
    }
    #opd_main_element button:focus-visible,
    #opd_main_element input:focus-visible,
    #opd_main_element select:focus-visible,
    #opd_main_element .dsp_btn_parent:focus-visible,
    #opd_main_element .dsp_column_btn:focus-within{
        outline: 2px solid var(--opd-focus);
        outline-offset: 1px;
    }
    .opd_ui_icon_color{
        filter: brightness(0) saturate(100%) invert(11%) sepia(16%) saturate(13%) hue-rotate(322deg) brightness(107%) contrast(80%);
    }
    /*#main_rack_element section:first-child{
        margin-left:110px
    }*/
    /*:root {color-scheme: light;}*/
    /*#opd_main_element[opd-dsp-theme="dark"] {
        color-scheme: dark;
    }*/
    #opd_main_element[opd-dsp-theme="light"] {
        color-scheme: light;
    }
    /* When dark mode is detected. */
    #opd_main_element[opd-dsp-theme="dark"] {
        color-scheme: dark;
        --opd-bg: #101215;
        --opd-surface: #181d24;
        --opd-surface-alt: #262e3a;
        --opd-border: #3f4a5a;
        --opd-border-strong: #5a677c;
        --opd-text: #e5ebf3;
        --opd-muted: #aab5c4;
        --opd-hover: #3b4554;
        --opd-focus: #66a4ff;
        --opd-profile-selected-bg: linear-gradient(180deg, #34455f 0%, #2c3a50 100%);
        --opd-profile-selected-shadow: inset 0 0 0 1px rgba(122, 154, 195, 0.3);

        & #main_rack_element {
            background-color: #101215 !important;
            scrollbar-color: auto;
        }

        & .dsp_column_draggable_false,
        & #first_rack_element,
        & #second_rack_element,
        & #main_bar_empty_column {
            background-color: black !important;
            color: white;
        }

        & .dsp_column_draggable_true {
            background-color: #2a2f36 !important;
        }

        & .dsp_column_title {
            background-color: transparent !important;
        }

        & .dsp_btn_add_post_img,
        & .dsp_btn_add_tl_img,
        & .dsp_btn_add_ntfc_img,
        & .dsp_btn_add_explr_img,
        & .dsp_btn_add_lists_img,
        & .dsp_btn_add_custom_url_img,
        & .opd_ui_logo,
        & .dsp_btn_sidebar_fold_img,
        & .dsp_btn_second_rack_img,
        & .dsp_btn_profile_add_img,
        & .dsp_btn_profile_delete_img,
        & .dsp_btn_switch_theme_img,
        & .dsp_column_move_icon,
        & .opd_ui_icon_color {
            filter: brightness(0) saturate(100%) invert(98%);
        }

        & #api_limit_status:hover,
        & .dsp_btn_parent:hover,
        & .dsp_column_btn:hover {
            background: #3f4752;
        }

        & .dsp_column_settings_panel {
            background: var(--opd-surface);
            border: 1px solid #4f5a68;
        }

        & .dsp_column_settings_list {
            background: transparent;
            border-color: #4f5a68;
        }

        & .dsp_column_settings_panel select,
        & .dsp_column_settings_panel input[type="number"],
        & .opd_debug_menu input,
        & .column_width_btn,
        & .dsp_column_settings_panel_close_btn {
            background: #242b33;
            color: #d6dce5;
            border-color: #4f5a68;
        }
    }

    /* Media viewer. */
    ::backdrop {
        background: rgba(0, 0, 0, 0.9);
    }
    #opd_media_viewer:focus {
        outline: none;
    }
    .opd_media_viewer_func_btn{
        border: 0;
        background: #00000000;
        cursor: pointer;
        outline: none;
    }
    .opd_media_viewer_func_btn.media_switch_btn{
        width: 80px;
        height: 80px;
        margin: 10px;
        border-radius: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .opd_media_viewer_func_btn_circle button{
        border: 0;
        background: #00000000;
        cursor: pointer;
        outline: none;
        border-radius: 10px;
    }
    button[disabled].opd_media_viewer_func_btn{
        visibility: hidden;
    }
    .opd_media_viewer_func_btn_icon_color{
        filter: brightness(0) saturate(100%) invert(96%) sepia(6%) saturate(0%) hue-rotate(285deg) brightness(115%) contrast(100%);
    }
    .opd_media_viewer_func_btn:hover{
        background: #2f2f2fa3;
    }
    .opd_media_viewer_func_btn_circle button:hover{
        background: #2f2f2fa3;
    }
    .media_viewer_icon_close{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.column_close)});
        background-size: 20px;
        background-repeat: no-repeat;
        background-position: center;
        width: 40px;
        height: 40px;
        padding: 5px;
    }
    .media_viewer_icon_forward{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.forward)});
        background-size: 20px;
        background-repeat: no-repeat;
        background-position: center;
        width: 30px;
        height: 30px;
        padding: 5px;
    }
    .media_viewer_icon_next{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.next)});
        background-size: 20px;
        background-repeat: no-repeat;
        background-position: center;
        width: 30px;
        height: 30px;
        padding: 5px;
    }
    .media_viewer_icon_download{
        display: block;
        background-image: url(${chrome.runtime.getURL(ui_icon_define.download)});
        background-size: 20px;
        background-repeat: no-repeat;
        background-position: center;
        width: 30px;
        height: 30px;
        padding: 5px;
    }
    /* Shared workspace chrome: keep embedded timelines untouched. */
    #opd_main_element{
        --opd-bg: #f4f5f7;
        --opd-surface: #ffffff;
        --opd-surface-alt: #f8f9fb;
        --opd-border: #e3e6eb;
        --opd-border-strong: #cbd1da;
        --opd-text: #20242c;
        --opd-muted: #687180;
        --opd-hover: #edf0f5;
        --opd-focus: #2563eb;
        --opd-profile-selected-bg: #f0f1f2;
        --opd-profile-selected-shadow: none;
    }
    #opd_main_element[opd-dsp-theme="dark"]{
        --opd-bg: #101216;
        --opd-surface: #181b21;
        --opd-surface-alt: #20242c;
        --opd-border: #303641;
        --opd-border-strong: #485160;
        --opd-text: #eef0f4;
        --opd-muted: #a4adbc;
        --opd-hover: #282e38;
        --opd-focus: #78a6ff;
        --opd-profile-selected-bg: #25292f;
        --opd-profile-selected-shadow: none;
    }
    #opd_main_element *{
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    #opd_main_element .main_bar_functions{
        gap: 4px;
        padding: 8px;
        font-weight: 500;
    }
    #opd_main_element .main_bar_functions hr{
        border: 0;
        border-top: 1px solid var(--opd-border);
        width: 100%;
        flex-shrink: 0;
        margin: 6px 0;
    }
    #opd_main_element .main_bar_functions > .opd_api_sidebar,
    #opd_main_element .main_bar_functions > hr{
        width: 100%;
        align-self: stretch;
    }
    #opd_main_element .dsp_btn_parent{
        height: 40px;
        border-radius: 8px;
        gap: 12px;
        transition: background-color 140ms ease;
    }
    #opd_main_element .dsp_btn_parent:hover{
        border-color: transparent;
    }
    #opd_main_element .dsp_btn_label{
        font-size: 13px;
        font-weight: 500;
    }
    #opd_main_element .dsp_btn_profile_selected{
        border-color: transparent;
        border-radius: 8px;
        box-shadow: var(--opd-profile-selected-shadow);
    }
    #opd_main_element .dsp_profile_list .dsp_btn_parent{
        border-radius: 8px;
    }
    #opd_main_element .dsp_btn_profile_selected .dsp_btn_label{
        font-weight: 600;
    }
    #opd_main_element .dsp_column_draggable_true{
        margin: 0;
        border-radius: 0;
        border: 0;
        border-right: 1px solid var(--opd-border);
    }
    #opd_main_element .column_bar{
        min-height: 44px;
        padding: 6px 12px;
        gap: 4px;
        border-top: 0 !important;
        border-radius: 0;
        background: var(--opd-surface);
        flex-shrink: 0;
    }
    #opd_main_element .dsp_column_title{
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
    }
    #opd_main_element .dsp_column_btn{
        width: 30px;
        min-width: 30px;
        height: 30px;
        margin-right: 0;
        border-radius: 8px;
    }
    #opd_main_element .dsp_column_settings_panel{
        background: var(--opd-surface);
        width: 100%;
        max-height: min(480px, 60dvh);
        overflow-y: auto;
        flex-shrink: 0;
        border: 0;
        border-bottom: 1px solid var(--opd-border);
        border-radius: 0;
    }
    #opd_main_element .dsp_column_settings_panel_content{
        margin: 16px;
    }
    #opd_main_element .dsp_column_settings_panel_content h2{
        font-size: 14px;
        margin-bottom: 12px;
    }
    #opd_main_element .dsp_column_settings_list{
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
    }
    #opd_main_element .dsp_column_settings_content_div{
        min-height: 44px;
        gap: 12px;
        margin: 0;
        font-size: 13px;
        border-bottom: 1px solid var(--opd-border);
    }
    #opd_main_element .dsp_column_settings_content_div > span:last-child{
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }
    #opd_main_element .dsp_column_settings_panel select,
    #opd_main_element .dsp_column_settings_panel input[type="number"],
    #opd_main_element .column_width_btn,
    #opd_main_element .dsp_column_settings_panel_close_btn{
        min-height: 32px;
        border-radius: 8px;
        font-size: 12px;
        color: var(--opd-text);
    }
    #opd_main_element input[type="checkbox"]{
        accent-color: var(--opd-focus);
    }
    @media (prefers-reduced-motion: reduce){
        #opd_main_element *, #opd_main_element *::before, #opd_main_element *::after{
            transition: none !important;
            animation: none !important;
            scroll-behavior: auto !important;
        }
    }
    div[opd_load_status] { position: relative; }
    div[opd_load_status]::after {
        content: attr(opd_load_status);
        position: absolute;
        inset: 48px 0 0;
        display: grid;
        place-items: center;
        color: var(--opd-muted);
        background: var(--opd-surface);
        pointer-events: none;
    }
    .opd_column_drag_active .dsp_column iframe { pointer-events: none; }
    .opd_column_dragging { opacity: 0.55; }
    .dsp_column.opd_drop_before, .dsp_column.opd_drop_after { position: relative; }
    .dsp_column.opd_drop_before::after, .dsp_column.opd_drop_after::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 4px;
        border-radius: 2px;
        background: #38bdf8;
        z-index: 10;
        pointer-events: none;
    }
    .dsp_column.opd_drop_before::after { left: 0; }
    .dsp_column.opd_drop_after::after { right: 0; }
    .dsp_column_move_icon { cursor: grab; }
    .opd_column_drag_active .dsp_column_move_icon { cursor: grabbing; }
    </style>`,
    );
    // Create and insert column elements.
    let default_element_bar = `<span class="dsp_column_btn"><label class="dsp_column_settings_btn opd_ui_icon_color" title="${i18n_message("ui_column_settings_title")}"><input class="opd_settings_btn" type="button" value="S"></label></span><span class="dsp_column_btn"><input class="opd_banner" type="checkbox" title="${i18n_message("ui_column_banner_toggle_title")}" %column_banner_ch%><label class="dsp_column_banner_btn opd_ui_icon_color"></label></span>`;
    let refresh_element_bar = `<span class="dsp_column_btn"><label class="dsp_column_refresh_btn opd_ui_icon_color" title="${i18n_message("ui_column_refresh_title")}"><input class="column_refresh_btn" type="button" value="R"></label></span>`;
    let column_settings_panel = `<div class="dsp_column_settings_panel"><div class="dsp_column_settings_panel_content"><h2>${i18n_message("ui_settings_header")}</h2><div class="dsp_column_settings_list"><div class="dsp_column_settings_content_div"><span>${i18n_message("ui_settings_view_mode_label")}</span><span><select class="opd_tw_view_mode" column_tw_view_mode_val="%column_tw_view_mode%"><option value="0">${i18n_message("ui_settings_view_mode_all")}</option><option value="1">${i18n_message("ui_settings_view_mode_text_only")}</option><option value="2">${i18n_message("ui_settings_view_mode_media_only")}</option></select></span></div><div class="dsp_column_settings_content_div"><span>${i18n_message("ui_settings_column_width_label")}</span><span><select class="opd_column_size_preset"><option value="0">${i18n_message("ui_settings_column_width_small")}</option><option value="1">${i18n_message("ui_settings_column_width_medium")}</option><option value="2">${i18n_message("ui_settings_column_width_large")}</option><option value="3">${i18n_message("ui_settings_column_width_custom")}</option></select></span></div><div class="dsp_column_settings_content_div"><span>${i18n_message("ui_settings_column_width_custom_label")}</span><span><input type="button" class="column_width_btn" value="${i18n_message("ui_settings_column_width_custom_button")}"/></span></div><div class="dsp_column_settings_content_div"><span>${i18n_message("ui_settings_auto_reload_label")}</span><span><input class="opd_a_reload_bar" type="checkbox" %column_auto_reload_ch%></span></div><div class="dsp_column_settings_content_div"><span>${i18n_message("ui_settings_auto_reload_interval_label")}</span><span><input class="opd_column_settings_input_text opd_a_reload_time_setting" type="number" value="%column_auto_reload_time%">${i18n_message("ui_settings_seconds_suffix")}</span></div></div><div class="dsp_column_settings_panel_close_btn_wrap"><input type="button" class="dsp_column_settings_panel_close_btn" value="${i18n_message("ui_settings_close_button")}"/></div></div></div>`;
    let default_element = {
        /*main_bar_empty_column:{html:`<!--<section draggable="false" class="dsp_column"><div opd_column_type="main_bar_empty_column" opd_column_width="%column_width_num%" id="main_bar_empty_column" style="height:100%;min-width: 70px;"></div></section>-->`},*/
        empty_column: {
            html: `<section draggable="false" id="column_%column_num%" class="dsp_column_draggable_false dsp_column dsp_column_emptycolumn"><div opd_column_type="empty_column" opd_column_width="%column_width_num%" style="height: 100%;min-width: 30rem;display: flex;align-items: center;justify-content: center;"><div><img src="${chrome.runtime.getURL(ui_icon_define.column_add_1)}" style="filter: brightness(0) saturate(100%) invert(61%) sepia(13%) saturate(13%) hue-rotate(335deg) brightness(89%) contrast(79%);"><p>${i18n_message("ui_empty_column_message")}</p></div></div></section>`,
        },
        post: {
            html: `<section draggable="true" id="column_%column_num%" class="dsp_column_draggable_true dsp_column"><div opd_column_type="post" opd_column_width="%column_width_num%" style="height: 100%;width: %column_width_num%rem;min-width: 1rem;"><div class="column_bar" style="height: max-content;"><span class="dsp_column_title"><div class="dsp_column_move_icon_parent"><span class="dsp_column_move_icon"></span><span>${i18n_message("ui_column_post_title")}</span></div></span>${default_element_bar}${refresh_element_bar}<div class="dsp_column_empty_area opd_column_scroll_to_top"></div><div class="dsp_column_close_btn_wrap"><span class="dsp_column_btn"><label class="dsp_column_close_btn opd_ui_icon_color" title="${i18n_message("ui_column_close_title")}"><input type="button" class="column_close_btn" value="X"/></label></span></div></div>${column_settings_panel}<iframe auto_reload_mouse_hover="false" allow="fullscreen" data-opd-src="https://x.com/compose/post" type="text/html" style="width: 100%;height: 100%;" opd_init_webview></iframe></div></section>`,
        },
        second_empty_column: {
            html: `<section draggable="false" id="column_%column_num%" class="dsp_column_draggable_false dsp_column dsp_column_second_emptycolumn"><div opd_column_type="second_empty_column" opd_column_width="%column_width_num%" style="height:100%;min-width: 30rem;overflow: hidden;display: flex;align-items: center;justify-content: center;"><div><img src="${chrome.runtime.getURL(ui_icon_define.column_add_2)}" style="filter: brightness(0) saturate(100%) invert(61%) sepia(13%) saturate(13%) hue-rotate(335deg) brightness(89%) contrast(79%);"><p>${i18n_message("ui_second_empty_column_message")}</p></div></div></section>`,
        },
        home: {
            html: `<section draggable="true" id="column_%column_num%" class="dsp_column_draggable_true dsp_column"><div opd_column_type="home" opd_column_width="%column_width_num%" style="height: 100%;width: %column_width_num%rem;min-width: 1rem;"><div class="column_bar" style="height: max-content;"><span class="dsp_column_title"><div class="dsp_column_move_icon_parent"><span class="dsp_column_move_icon"></span><span>${i18n_message("ui_column_timeline_title")}</span></div></span>${default_element_bar}${refresh_element_bar}<div class="dsp_column_empty_area opd_column_scroll_to_top"></div><div class="dsp_column_close_btn_wrap"><span class="dsp_column_btn"><label class="dsp_column_close_btn opd_ui_icon_color" title="${i18n_message("ui_column_close_title")}"><input type="button" class="column_close_btn" value="X"/></label></span></div></div>${column_settings_panel}<iframe auto_reload_mouse_hover="false" allow="fullscreen" data-opd-src="https://x.com/home" type="text/html" style="width: 100%;height: 100%;" opd_init_webview></iframe></div></section>`,
        },
        notification: {
            html: `<section draggable="true" id="column_%column_num%" class="dsp_column_draggable_true dsp_column"><div opd_column_type="notification" opd_column_width="%column_width_num%" style="height: 100%;width: %column_width_num%rem;min-width: 1rem;"><div class="column_bar" style="height: max-content;"><span class="dsp_column_title"><div class="dsp_column_move_icon_parent"><span class="dsp_column_move_icon"></span><span>${i18n_message("ui_column_notifications_title")}</span></div></span>${default_element_bar}${refresh_element_bar}<div class="dsp_column_empty_area opd_column_scroll_to_top"></div><div class="dsp_column_close_btn_wrap"><span class="dsp_column_btn"><label class="dsp_column_close_btn opd_ui_icon_color" title="${i18n_message("ui_column_close_title")}"><input type="button" class="column_close_btn" value="X"/></label></span></div></div>${column_settings_panel}<iframe allow="fullscreen" data-opd-src="https://x.com/notifications" type="text/html" style="width: 100%;height: 100%;" opd_init_webview></iframe></div></section>`,
        },
        explore: {
            html: `<section draggable="true" id="column_%column_num%" class="dsp_column_draggable_true dsp_column"><div opd_column_type="explore" opd_column_width="%column_width_num%" opd_explore_path="%column_save_path%" opd_explore_title="Explore" opd_pinned_path="%column_pinned_save_path%" style="height: 100%;width: %column_width_num%rem;min-width: 1rem;"><div class="column_bar" style="height: max-content;"><span class="dsp_column_title"><div class="dsp_column_move_icon_parent"><span class="dsp_column_move_icon"></span><span>${i18n_message("ui_column_explore_title")}</span></div></span>${default_element_bar}<span class="dsp_column_btn"><input class="opd_pinned_btn" type="checkbox" title="${i18n_message("ui_column_pin_toggle_title")}" %column_pinned_ch%><label class="dsp_column_pin_btn opd_ui_icon_color"></label></span>${refresh_element_bar}<div class="dsp_column_empty_area opd_column_scroll_to_top"></div><div class="dsp_column_close_btn_wrap"><span class="dsp_column_btn"><label class="dsp_column_close_btn opd_ui_icon_color" title="${i18n_message("ui_column_close_title")}"><input type="button" class="column_close_btn" value="X"/></label></span></div></div>${column_settings_panel}<iframe auto_reload_mouse_hover="false" allow="fullscreen" data-opd-src="https://x.com%column_save_path%" type="text/html" style="width: 100%;height: 100%;" opd_init_webview></iframe></div></section>`,
        },
    };
    let ins_html = document.createElement("div");
    ins_html.id = "opd_main_element";
    ins_html.setAttribute(
        "style",
        "position: fixed;z-index: 999999;top:0;width: 100%;height: 100%;background: white;display: flex;flex-direction: row;overflow: hidden;",
    );
    let side_bar = `<section class="dsp_column" style="position:fixed;z-index:999;height:98%;"><div draggable="false" class="dsp_column_draggable_false" opd_column_type="dsp_column" opd_column_width="%column_width_num%" style="height:100%;min-width: var(--opd-sidebar-width);max-width: var(--opd-sidebar-width);text-align: center;background-color: white;transition:min-width 0.18s ease,max-width 0.18s ease;"><div class="main_bar_functions"><div class="opd_ui_logo_parent" title="${i18n_message("ui_sidebar_logo_title", [manifest.version])}"><div class="opd_ui_logo"></div><span class="opd_version_span">${manifest.version}</span></div>${create_api_sidebar_html()}${create_sidebar_button_html("sidebar_fold_toggle", i18n_message("ui_sidebar_collapse_title"), "dsp_btn_sidebar_fold_img", i18n_message("ui_sidebar_collapse_label"))}${create_sidebar_button_html("switch_theme", i18n_message_or_fallback("ui_theme_switch_title", "Toggle Theme"), "dsp_btn_switch_theme_img", i18n_message_or_fallback("ui_theme_switch_label", "Toggle Theme"))}${create_sidebar_button_html("second_rack", i18n_message("ui_toggle_second_rack_title"), "dsp_btn_second_rack_img", i18n_message("ui_toggle_second_rack_title"))}<div class="opd_debug_menu">${i18n_message("ui_debug_menu_label")}<input type="button" id="init_settings" value="${i18n_message("ui_button_init_settings")}" /><input type="button" id="dnr_reload" value="${i18n_message("ui_button_dnr_reload")}" /><input type="button" id="ext_reload" value="${i18n_message("ui_button_ext_reload")}" /></div><hr>${create_sidebar_button_html("add_post", i18n_message("ui_add_post_column_title"), "dsp_btn_add_post_img", i18n_message("ui_add_post_column_title"))}${create_sidebar_button_html("add_timeline", i18n_message("ui_add_timeline_column_title"), "dsp_btn_add_tl_img", i18n_message("ui_add_timeline_column_title"))}${create_sidebar_button_html("add_notify", i18n_message("ui_add_notification_column_title"), "dsp_btn_add_ntfc_img", i18n_message("ui_add_notification_column_title"))}${create_sidebar_button_html("add_explore", i18n_message("ui_add_explore_column_title"), "dsp_btn_add_explr_img", i18n_message("ui_add_explore_column_title"))}${create_sidebar_button_html("add_lists", i18n_message("ui_add_lists_column_title"), "dsp_btn_add_lists_img", i18n_message("ui_add_lists_column_title"))}${create_sidebar_button_html("add_custom_url", i18n_message("ui_add_custom_url_column_title"), "dsp_btn_add_custom_url_img", i18n_message("ui_add_custom_url_column_title"))}<hr>${create_sidebar_button_html("profile_save", i18n_message("ui_profile_save_title"), "dsp_btn_profile_add_img", i18n_message("ui_profile_save_title"))}${create_sidebar_button_html("profile_delete", i18n_message("ui_profile_delete_title"), "dsp_btn_profile_delete_img", i18n_message("ui_profile_delete_title"))}<hr>${profile_list_html}${create_language_select_html()}</div></div></section><section draggable="false" class="dsp_column_draggable_false dsp_column"><div opd_column_type="main_bar_empty_column" id="main_bar_empty_column" style="height:100%;min-width: var(--opd-sidebar-width);max-width: var(--opd-sidebar-width);"></div></section>`;
    //let side_bar = `<section class="dsp_column" style="position:fixed;z-index:999;height:98%;"><div draggable="false" opd_column_type="dsp_column" opd_column_width="%column_width_num%" style="height:100%;min-width: 100px;text-align: center;background-color: white;"><div><p style="margin-top:0;padding-top:1em;">XPP-Deck<br>Prototype<br>v${manifest.version}</p><hr><p>Debug<br><input type="button" id="init_settings" value="init settings"/><br><br><input type="button" id="dnr_reload" value="dNR_Reload"/><br><input type="button" id="ext_reload" value="Ext_Reload"/></p><hr><p><input type="button" id="add_timeline" value="Add TimeLine"/> <div class="dsp_btn_parent"><div class="dsp_btn_add_tl_img"></div></div><div class="dsp_btn_parent"><div class="dsp_btn_add_ntfc_img"></div></div><div class="dsp_btn_parent"><div class="dsp_btn_add_explr_img"></div></div> </p><p><input type="button" id="add_notify" value="Add Notification"/></p><p><input type="button" id="add_explore" value="Add Explore"/><hr><input type="button" id="second_rack" value="Second Rack"/><hr><input type="button" id="profile_save" value="Profile_Save"/><br><input type="button" id="profile_delete" value="Profile_Delete"/><br>${profile_list_html}</p></div></div></section><section draggable="false" class="dsp_column"><div opd_column_type="main_bar_empty_column" id="main_bar_empty_column" style="height:100%;min-width: 110px;"></div></section>`;
    let main_column_html = ``;
    let second_column_html = ``;
    // Two-row layout settings.
    let first_column_end = false;
    let second_column_end = false;
    let second_rack_mode = false;
    // Column width.
    let column_width_init = "30";
    //console.log(settings.column_settings.length)
    for (let index = 0; index < settings.column_settings.length; index++) {
        //console.log(default_element)
        for (
            let default_index = 0;
            default_index < Object.keys(default_element).length;
            default_index++
        ) {
            //console.log(settings.column_settings[index].type+"-"+Object.keys(default_element))
            if (
                settings.column_settings[index].type ==
                Object.keys(default_element)[default_index]
            ) {
                //console.log(default_element[Object.keys(default_element)[default_index]]["html"])
                let banner_checked = "";
                let init_pinned_checked = "";
                let init_pinned_path = "";
                let init_auto_reload_checked = "";
                let init_column_save_path =
                    settings.column_settings[index].column_save_path;
                let tw_view_type = settings.column_settings[index].tw_view_mode;
                let auto_reload_time =
                    settings.column_settings[index].auto_reload_time / 1000;
                if (settings.column_settings[index].banner == true) {
                    banner_checked = "checked";
                }
                // Top search area and related UI.
                // Column width.
                if (settings.column_settings[index].column_width != null) {
                    column_width_init =
                        settings.column_settings[index].column_width;
                }
                // Explore pin state.
                if (settings.column_settings[index].type == "explore") {
                    if (
                        settings.column_settings[index].column_pinned_path != ""
                    ) {
                        init_pinned_checked = "checked";
                        init_pinned_path =
                            settings.column_settings[index].column_pinned_path;
                        init_column_save_path =
                            settings.column_settings[index].column_pinned_path;
                        //%column_pinned_ch%
                    } else {
                        init_column_save_path =
                            settings.column_settings[index].column_save_path;
                    }
                }
                // Auto refresh.
                if (settings.column_settings[index].auto_reload) {
                    init_auto_reload_checked = "checked";
                }
                // If first-row end is detected but settings still exist, append to second-row buffer.
                if (first_column_end == true) {
                    second_column_html += default_element[
                        Object.keys(default_element)[default_index]
                    ]["html"]
                        .replaceAll("%column_save_path%", init_column_save_path)
                        .replaceAll("%column_num%", create_random_id())
                        .replace("%column_banner_ch%", banner_checked)
                        .replace("%column_tw_view_mode%", tw_view_type)
                        .replace("%column_pinned_ch%", init_pinned_checked)
                        .replaceAll(
                            "%column_pinned_save_path%",
                            init_pinned_path,
                        )
                        .replaceAll("%column_width_num%", column_width_init)
                        .replaceAll(
                            "%column_auto_reload_ch%",
                            init_auto_reload_checked,
                        )
                        .replaceAll(
                            "%column_auto_reload_time%",
                            auto_reload_time,
                        );
                } else {
                    main_column_html += default_element[
                        Object.keys(default_element)[default_index]
                    ]["html"]
                        .replaceAll("%column_save_path%", init_column_save_path)
                        .replaceAll("%column_num%", create_random_id())
                        .replace("%column_banner_ch%", banner_checked)
                        .replace("%column_tw_view_mode%", tw_view_type)
                        .replace("%column_pinned_ch%", init_pinned_checked)
                        .replaceAll(
                            "%column_pinned_save_path%",
                            init_pinned_path,
                        )
                        .replaceAll("%column_width_num%", column_width_init)
                        .replaceAll(
                            "%column_auto_reload_ch%",
                            init_auto_reload_checked,
                        )
                        .replaceAll(
                            "%column_auto_reload_time%",
                            auto_reload_time,
                        );
                }
                // Detect end of first-row load.
                if (
                    first_column_end == false &&
                    settings.column_settings[index].type == "empty_column"
                ) {
                    first_column_end = true;
                }
                // Detect end of second-row load.
                if (
                    second_column_end == false &&
                    settings.column_settings[index].type ==
                        "second_empty_column"
                ) {
                    second_column_end = true;
                }
            }
        }
    }
    // Build initial HTML to insert.
    ins_html.innerHTML = `${side_bar}<div id="main_rack_element" style=""><div id="first_rack_element" style="height: 100%;display:flex;flex-direction:row;">${main_column_html}</div><div id="second_rack_element" style="display:flex;flex-direction:row;">${second_column_html}</div></div>`;
    // Insert HTML.
    document.body.insertAdjacentElement("afterbegin", ins_html);
    const opd_main_element =
        document.querySelector<HTMLElement>("#opd_main_element");
    const sidebar_toggle_button = document.querySelector<HTMLElement>(
        "#sidebar_fold_toggle",
    );
    if (!opd_main_element || !sidebar_toggle_button) {
        return;
    }
    const switch_theme_button =
        document.querySelector<HTMLElement>("#switch_theme");
    const language_select = document.querySelector<HTMLSelectElement>(
        "#opd_language_select",
    );
    const sidebar_toggle_label =
        sidebar_toggle_button.querySelector<HTMLElement>(".dsp_btn_label");
    if (!sidebar_toggle_label) return;
    const opd_main_root = opd_main_element as HTMLElement;
    const sidebar_toggle_root = sidebar_toggle_button as HTMLElement;
    const sidebar_toggle_text = sidebar_toggle_label as HTMLElement;
    function apply_sidebar_collapsed_state(is_collapsed) {
        opd_main_root.classList.toggle("opd_sidebar_collapsed", is_collapsed);
        sidebar_toggle_root.classList.toggle(
            "opd_sidebar_toggle_is_collapsed",
            is_collapsed,
        );
        sidebar_toggle_root.title = is_collapsed
            ? i18n_message("ui_sidebar_expand_title")
            : i18n_message("ui_sidebar_collapse_title");
        sidebar_toggle_text.textContent = is_collapsed
            ? i18n_message("ui_sidebar_expand_label")
            : i18n_message("ui_sidebar_collapse_label");
    }
    apply_theme_for_main_element(opd_main_element);
    chrome.storage.local.get("opd_sidebar_collapsed", function (value) {
        apply_sidebar_collapsed_state(value.opd_sidebar_collapsed === true);
    });
    sidebar_toggle_button.addEventListener("click", function () {
        const next_sidebar_state = !opd_main_element.classList.contains(
            "opd_sidebar_collapsed",
        );
        chrome.storage.local.set(
            { opd_sidebar_collapsed: next_sidebar_state },
            function () {
                const contents = opd_main_element.querySelector<HTMLElement>(
                    ".main_bar_functions",
                );
                if (contents) {
                    void animate_sidebar_change(contents, () =>
                        apply_sidebar_collapsed_state(next_sidebar_state),
                    );
                } else {
                    apply_sidebar_collapsed_state(next_sidebar_state);
                }
            },
        );
    });
    if (language_select != null) {
        language_select.value = opd_i18n_language;
        language_select.addEventListener("change", function (ev) {
            const language_select_element =
                ev.currentTarget instanceof HTMLSelectElement
                    ? ev.currentTarget
                    : null;
            if (!language_select_element) return;
            const next_language = language_select_element.value;
            if (next_language === opd_i18n_language) {
                return;
            }
            chrome.storage.local.set(
                { opd_language_override: next_language },
                function () {
                    request_page_reload();
                },
            );
        });
    }
    if (switch_theme_button != null) {
        switch_theme_button.addEventListener("click", function () {
            const next_theme_mode =
                opd_main_element.getAttribute("opd-dsp-theme") === "dark"
                    ? "light"
                    : "dark";

            stop_system_theme_listener();

            document.cookie = `night_mode=${next_theme_mode === "dark" ? 1 : 0}; path=/; max-age=31536000`;
            opd_main_element.setAttribute("opd-dsp-theme", next_theme_mode);
            document.documentElement.setAttribute(
                opd_root_theme_attribute,
                next_theme_mode,
            );
        });
    }
    // Restore custom titles and Explore titles safely after DOM insertion.
    const all_columns = document.querySelectorAll(
        "#opd_main_element div[opd_column_type]",
    );
    for (
        let index = 0;
        index < settings.column_settings.length && index < all_columns.length;
        index++
    ) {
        const pinned_path = settings.column_settings[index].column_pinned_path;
        all_columns[index].setAttribute(
            "opd_pinned_path",
            typeof pinned_path === "string" ? pinned_path : "",
        );
        const custom_title = settings.column_settings[index].custom_title;
        if (typeof custom_title === "string" && custom_title.trim() !== "") {
            all_columns[index].setAttribute("opd_custom_title", custom_title);
        } else if (settings.column_settings[index].type !== "explore") {
            continue;
        }
        const safe_title =
            custom_title ||
            (settings.column_settings[index].column_save_title &&
            settings.column_settings[index].column_save_title !== ""
                ? settings.column_settings[index].column_save_title
                : i18n_message("ui_column_explore_title"));
        if (settings.column_settings[index].type === "explore") {
            all_columns[index].setAttribute(
                "opd_explore_title",
                settings.column_settings[index].column_save_title ||
                    i18n_message("ui_column_explore_title"),
            );
        }
        const title_node = all_columns[index].querySelector(
            ".dsp_column_title .dsp_column_move_icon_parent span:last-child",
        );
        if (title_node != null) {
            title_node.textContent = safe_title;
        }
    }
    // Used for API limit display.
    update_api_sidebar();
    async function show_api_limit_status() {
        await open_api_limits_dialog();
    }
    const api_limit_status = document.querySelector("#api_limit_status");
    if (api_limit_status) {
        api_limit_status.addEventListener("click", async function (event) {
            event.stopPropagation();
            await show_api_limit_status();
        });
    }
    const api_limit_status_button = document.querySelector(
        "#api_limit_status_button",
    );
    if (api_limit_status_button) {
        api_limit_status_button.addEventListener(
            "click",
            show_api_limit_status,
        );
    }
    // Open About page.
    const ui_logo = document.querySelector(".opd_ui_logo");
    if (ui_logo) {
        ui_logo.addEventListener("click", async function () {
            await open_about_page_modal();
        });
    }
    // Show debug menu.
    let debug_menu_click_counter = 0;
    const version_span = document.querySelector(".opd_version_span");
    if (version_span) {
        version_span.addEventListener("click", async function () {
            if (debug_menu_click_counter >= 7) {
                await opd_alert(i18n_message("msg_debug_menu_enabled"));
                const debug_menu = document.querySelector(".opd_debug_menu");
                if (debug_menu instanceof HTMLElement) {
                    debug_menu.style.display = "block";
                }
            } else {
                debug_menu_click_counter += 1;
            }
        });
    }
    // Handle case where second row exists.
    if (first_column_end == true && second_column_end == true) {
        second_rack_mode = true;
        const first_rack_element = document.querySelector(
            "#first_rack_element",
        );
        const second_rack_element = document.querySelector(
            "#second_rack_element",
        );
        const second_rack_input =
            document.querySelector<HTMLInputElement>("#second_rack");
        const second_rack_icon = document.querySelector<HTMLElement>(
            ".dsp_btn_second_rack_img",
        );
        if (first_rack_element instanceof HTMLElement) {
            first_rack_element.style.height = "50vh";
        }
        if (second_rack_element instanceof HTMLElement) {
            second_rack_element.style.height = "50vh";
        }
        /*for (let index = 0; index < document.querySelectorAll('.dsp_column[draggable="true"]').length; index++) {
            document.querySelectorAll('.dsp_column[draggable="true"]')[index].style.height = "calc(100% - 25px)";
        }*/

        //document.querySelector("style[second_column_css]")!.textContent = `#second_rack_element .dsp_column[draggable="true"]{height:calc(100% - 25px)}`;

        if (second_rack_input) {
            second_rack_input.value = "Single Rack";
        }
        if (second_rack_icon) {
            second_rack_icon.style.backgroundImage = `url(${chrome.runtime.getURL(ui_icon_define.column_single_rack)})`;
        }
    }
    //
    create_profile_list_btn();
    column_dd();
    column_close();
    append_object_css();
    // Create profile switch event handlers.
    function create_profile_list_btn() {
        // Initialize profile switch events.
        for (let index = 0; index < profile_store.length; index++) {
            const profile_button = document.querySelector(
                `#userProfile-${index}`,
            );
            if (!profile_button) {
                continue;
            }
            profile_button.addEventListener("click", async function () {
                //console.log(profile_store[index].profile)
                const preload_array = profile_store[index].profile;
                let preload_desc_array = new Array();
                let preload_desc_count = 0;
                for (
                    let preload_index = 0;
                    preload_index < preload_array.length;
                    preload_index++
                ) {
                    switch (preload_array[preload_index].type) {
                        case "dsp_column":
                            preload_desc_count = 0;
                            break;
                        case "main_bar_empty_column":
                            preload_desc_count = 0;
                            break;
                        case "empty_column":
                            preload_desc_array.push(
                                i18n_message("msg_profile_desc_first_row_end"),
                            );
                            preload_desc_count = 0;
                            break;
                        case "second_empty_column":
                            preload_desc_array.push(
                                i18n_message("msg_profile_desc_second_row_end"),
                            );
                            preload_desc_count = 0;
                            break;
                        case "post":
                            preload_desc_array.push(
                                i18n_message("msg_profile_desc_post_column", [
                                    String(preload_desc_count),
                                ]),
                            );
                            break;
                        case "home":
                            preload_desc_array.push(
                                i18n_message(
                                    "msg_profile_desc_timeline_column",
                                    [String(preload_desc_count)],
                                ),
                            );
                            break;
                        case "notification":
                            preload_desc_array.push(
                                i18n_message(
                                    "msg_profile_desc_notification_column",
                                    [String(preload_desc_count)],
                                ),
                            );
                            break;
                        case "explore":
                            preload_desc_array.push(
                                i18n_message(
                                    "msg_profile_desc_explore_column",
                                    [
                                        String(preload_desc_count),
                                        preload_array[preload_index]
                                            .column_save_title,
                                    ],
                                ),
                            );
                            break;
                        case "misskey":
                            preload_desc_array.push(
                                i18n_message("msg_profile_desc_misskey_column"),
                            );
                            break;
                        case "bsky":
                            preload_desc_array.push(
                                i18n_message("msg_profile_desc_bluesky_column"),
                            );
                            break;
                        default:
                            preload_desc_count = 0;
                            break;
                    }
                    preload_desc_count += 1;
                }
                //console.log(preload_desc_array)
                if (
                    await opd_confirm(
                        `${i18n_message("msg_profile_load_confirm", [String(index + 1), preload_desc_array.join("\r\n")])}`,
                    )
                ) {
                    const current_main =
                        document.querySelector("#opd_main_element");
                    if (current_main) {
                        current_main.remove();
                    }
                    set_last_load_profile(index);
                    chrome.storage.local.get("opd_settings", function (value) {
                        let load_setting = JSON.parse(
                            String(value.opd_settings),
                        );
                        load_setting.last_load_profile = index;
                        chrome.storage.local.set(
                            {
                                opd_settings: JSON.stringify(load_setting),
                            },
                            function () {},
                        );
                    });
                    const column_settings = {
                        column_settings: profile_store[index].profile,
                    };
                    //console.log(column_settings)
                    run(column_settings);
                }
            });
        }
    }
    // Apply CSS (called on add/update).
    // Keep naming aligned with Desktop implementation for shared logic.
    function set_column_settings_open(panel: HTMLElement, open: boolean) {
        const previous = settings_animations.get(panel);
        const start_height = panel.getBoundingClientRect().height;
        const start_opacity = previous
            ? getComputedStyle(panel).opacity
            : open
              ? "0"
              : "1";
        previous?.cancel();
        settings_animations.delete(panel);
        panel.toggleAttribute("open", open);
        panel.inert = !open;
        panel
            .closest("div[opd_column_type]")
            ?.querySelector(".opd_settings_btn")
            ?.setAttribute("aria-expanded", String(open));
        const finish = () => {
            panel.style.display = open ? "flex" : "none";
            panel.style.height = "";
            panel.style.overflow = "";
            if (!open)
                panel.closest(".dsp_column")?.setAttribute("draggable", "true");
        };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            finish();
            return;
        }
        panel.style.display = "flex";
        panel.style.height = "";
        const end_height = open ? panel.getBoundingClientRect().height : 0;
        panel.style.overflow = "hidden";
        const animation = panel.animate(
            [
                { height: `${start_height}px`, opacity: start_opacity },
                { height: `${end_height}px`, opacity: open ? "1" : "0" },
            ],
            { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        settings_animations.set(panel, animation);
        animation.onfinish = () => {
            if (settings_animations.get(panel) !== animation) return;
            settings_animations.delete(panel);
            finish();
        };
    }
    function observe_column_banner(frame: HTMLIFrameElement) {
        banner_observers.get(frame)?.disconnect();
        banner_observers.delete(frame);
        const control = frame
            .closest("div[opd_column_type]")
            ?.querySelector(".opd_banner")
            ?.closest<HTMLElement>(".dsp_column_btn");
        if (!control) return;
        control.style.display = "none";
        let doc: Document;
        try {
            if (
                !frame.contentWindow ||
                frame.contentWindow.location.href === "about:blank"
            )
                return;
            doc = frame.contentWindow.document;
        } catch {
            return;
        }
        const update = () => {
            control.style.display = doc.querySelector('header[role="banner"]')
                ? ""
                : "none";
        };
        update();
        const observer = new MutationObserver(() => {
            if (!frame.isConnected) {
                observer.disconnect();
                return;
            }
            update();
        });
        observer.observe(doc, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["role"],
        });
        banner_observers.set(frame, observer);
    }
    function apply_column_view_settings(frame: HTMLIFrameElement) {
        if (
            !frame.contentWindow ||
            frame.contentWindow.location.href === "about:blank" ||
            frame.hasAttribute("opd_iframe_width_only")
        )
            return;
        const column = frame.closest("div[opd_column_type]");
        const view =
            column?.querySelector<HTMLSelectElement>(".opd_tw_view_mode");
        if (view && !view.hasAttribute("opd_view_initialized")) {
            view.value = view.getAttribute("column_tw_view_mode_val") ?? "0";
            view.setAttribute("opd_view_initialized", "");
        }
        const head = frame.contentWindow.document.querySelector("head");
        if (!head) return;
        const styles: Record<string, string> = {
            opd_main_css: "html{scrollbar-width:thin;}",
            opd_banner_css: column?.querySelector<HTMLInputElement>(
                ".opd_banner",
            )?.checked
                ? ""
                : 'header[role="banner"]{display:none;}',
            opd_tw_view_mode_css:
                view?.value === "1"
                    ? 'div[data-testid="cellInnerDiv"]:has(div[aria-labelledby]){visibility:hidden;height:0;}'
                    : view?.value === "2"
                      ? 'div[data-testid="cellInnerDiv"]:not(:has(div[aria-labelledby])){visibility:hidden;height:0;}'
                      : "",
        };
        for (const [attribute, css] of Object.entries(styles)) {
            let style = head.querySelector<HTMLStyleElement>(
                `style[${attribute}]`,
            );
            if (!style) {
                style = frame.contentWindow.document.createElement("style");
                style.setAttribute(attribute, "");
                head.appendChild(style);
            }
            style.textContent = css;
        }
    }
    function append_object_css(
        mode?: string,
        session_webview_obj?: NodeListOf<Element>,
    ) {
        let column_object: NodeListOf<Element>;
        if (mode == "session_set" || mode == "add_column") {
            column_object =
                session_webview_obj ?? document.querySelectorAll("");
        } else {
            column_object = document.querySelectorAll(
                '.dsp_column:not([opd_column_type="dsp_column"], [opd_column_type="empty_column"], [opd_column_type="main_bar_empty_column"]) iframe',
            );
        }
        for (let index = 0; index < column_object.length; index++) {
            const pin_column = column_object[index].closest<HTMLElement>(
                "div[opd_column_type]",
            );
            if (pin_column) bind_column_pin(pin_column);
            if (column_object[index].hasAttribute("opd_load_bound")) continue;
            column_object[index].setAttribute("opd_load_bound", "");
            const banner_control = column_object[index]
                .closest("div[opd_column_type]")
                ?.querySelector(".opd_banner")
                ?.closest<HTMLElement>(".dsp_column_btn");
            if (banner_control) banner_control.style.display = "none";
            const banner_frame = column_object[index] as HTMLIFrameElement;
            load_scheduler.onDispose(() =>
                banner_observers.get(banner_frame)?.disconnect(),
            );
            column_object[index].removeAttribute("opd_init_webview");
            // Document styles must be reapplied after every navigation.
            column_object[index].addEventListener("load", (event) => {
                const frame = event.currentTarget;
                if (frame instanceof HTMLIFrameElement) {
                    observe_column_banner(frame);
                    apply_column_view_settings(frame);
                }
            });
            // Post-load initialization for each column.
            column_object[index].addEventListener(
                "load",
                function (ev) {
                    const iframe_elem =
                        ev.currentTarget instanceof HTMLIFrameElement
                            ? ev.currentTarget
                            : null;
                    if (
                        !iframe_elem ||
                        iframe_elem.contentWindow?.location.href ===
                            "about:blank"
                    )
                        return;
                    if (iframe_elem.hasAttribute("opd_controls_initialized"))
                        return;
                    iframe_elem.setAttribute("opd_controls_initialized", "");
                    //console.log(this)
                    const opd_column_div = iframe_elem.closest(
                        "div[opd_column_type]",
                    ) as HTMLElement;
                    const opd_column_width_btn =
                        opd_column_div.querySelector<HTMLInputElement>(
                            ".column_width_btn",
                        );
                    const opd_column_width_select =
                        opd_column_div.querySelector<HTMLSelectElement>(
                            ".opd_column_size_preset",
                        );
                    const opd_column_banner_checkbox =
                        opd_column_div.querySelector<HTMLInputElement>(
                            ".opd_banner",
                        );

                    const opd_column_tw_view_mode_opt =
                        opd_column_div.querySelector<HTMLSelectElement>(
                            ".opd_tw_view_mode",
                        );
                    const opd_column_scroll_to_top =
                        opd_column_div.querySelector<HTMLElement>(
                            ".opd_column_scroll_to_top",
                        );
                    const opd_column_refresh_btn =
                        opd_column_div.querySelector<HTMLInputElement>(
                            ".column_refresh_btn",
                        );
                    let column_content_reload: OpdExtAutoReload | null = null;
                    // Load column extensions.
                    if (mode != "session_set") {
                        const column_type = iframe_elem
                            .closest("div[opd_column_type]")!
                            .getAttribute("opd_column_type");
                        if (
                            column_type === "home" ||
                            column_type === "explore"
                        ) {
                            const target_column = iframe_elem
                                .closest("div[opd_column_type]")!
                                ?.querySelector("iframe")?.contentWindow;
                            if (target_column == null) {
                                return;
                            }
                            // Set up auto-refresh hooks.
                            column_content_reload = new OpdExtAutoReload();
                            column_content_reload.Init(target_column);
                            // Set up media-viewer hooks.
                            const column_media_viewer_blocker =
                                new OpdMediaViewerBlocker();
                            column_media_viewer_blocker.Init(target_column);
                            const media_info_token =
                                column_media_viewer_blocker.opd_send_media_info_token;
                            if (media_info_token != null) {
                                media_viewer_token.push(media_info_token);
                            }
                        }
                    }
                    bind_column_auto_reload(iframe_elem, column_content_reload);
                    // Settings panel events.
                    if (mode != "session_set") {
                        opd_column_div
                            .querySelector(".opd_settings_btn")!
                            .addEventListener("click", function (ev) {
                                const settings_button =
                                    ev.currentTarget instanceof HTMLElement
                                        ? ev.currentTarget
                                        : null;
                                if (!settings_button) return;
                                const settings_panel = settings_button
                                    .closest("div[opd_column_type]")!
                                    .querySelector(
                                        ".dsp_column_settings_panel",
                                    );
                                if (!(settings_panel instanceof HTMLElement)) {
                                    return;
                                }
                                set_column_settings_open(
                                    settings_panel,
                                    !settings_panel.hasAttribute("open"),
                                );
                            });
                    }
                    if (mode != "session_set") {
                        opd_column_div
                            .querySelector(
                                ".dsp_column_settings_panel_close_btn",
                            )!
                            .addEventListener("click", function (ev) {
                                const close_button =
                                    ev.currentTarget instanceof HTMLElement
                                        ? ev.currentTarget
                                        : null;
                                if (!close_button) return;
                                const settings_panel = close_button
                                    .closest("div[opd_column_type]")!
                                    .querySelector(
                                        ".dsp_column_settings_panel",
                                    );
                                if (!(settings_panel instanceof HTMLElement)) {
                                    return;
                                }
                                set_column_settings_open(settings_panel, false);
                            });
                        // Settings panel and hover interactions.
                        opd_column_div
                            .querySelector(".dsp_column_settings_panel")!
                            .addEventListener("mouseover", function () {
                                opd_column_div
                                    .closest(".dsp_column")!
                                    .setAttribute("draggable", "false");
                            });
                        opd_column_div
                            .querySelector(".dsp_column_settings_panel")!
                            .addEventListener("mouseleave", function () {
                                opd_column_div
                                    .closest(".dsp_column")!
                                    .setAttribute("draggable", "true");
                            });
                    }
                    // Settings panel column-width control.
                    if (opd_column_width_select != null) {
                        switch (
                            opd_column_div.getAttribute("opd_column_width")
                        ) {
                            case "15":
                                opd_column_width_select.value = "0";
                                break;
                            case "20":
                                opd_column_width_select.value = "1";
                                break;
                            case "30":
                                opd_column_width_select.value = "2";
                                break;
                            default:
                                opd_column_width_select.value = "3";
                                break;
                        }
                        if (mode != "session_set") {
                            opd_column_width_select.addEventListener(
                                "change",
                                function (ev) {
                                    const width_select =
                                        ev.currentTarget instanceof
                                        HTMLSelectElement
                                            ? ev.currentTarget
                                            : null;
                                    if (!width_select) return;
                                    let preset_rem;
                                    switch (width_select.value) {
                                        case "0":
                                            preset_rem = 15;
                                            break;
                                        case "1":
                                            preset_rem = 20;
                                            break;
                                        case "2":
                                            preset_rem = 30;
                                            break;
                                        default:
                                            preset_rem = 30;
                                            break;
                                    }
                                    const width_select_column =
                                        width_select.closest(
                                            "div[opd_column_type]",
                                        );
                                    if (!width_select_column) return;
                                    width_select_column.setAttribute(
                                        "opd_column_width",
                                        String(preset_rem),
                                    );
                                    width_select_column.style.width = `${preset_rem}rem`;
                                    column_settings_save("", last_load_profile);
                                },
                            );
                        }
                    }
                    if (mode != "session_set") {
                        // Column width setting events.
                        if (opd_column_width_btn != null) {
                            opd_column_width_btn.addEventListener(
                                "click",
                                async function (ev) {
                                    const width_button =
                                        ev.currentTarget instanceof HTMLElement
                                            ? ev.currentTarget
                                            : null;
                                    if (!width_button) return;
                                    const width_button_column =
                                        width_button.closest(
                                            "div[opd_column_type]",
                                        );
                                    if (!width_button_column) return;
                                    const now_width =
                                        width_button_column.getAttribute(
                                            "opd_column_width",
                                        );
                                    const column_width_preset =
                                        width_button_column.querySelector(
                                            ".opd_column_size_preset",
                                        );
                                    const column_width_preset_select =
                                        column_width_preset as HTMLSelectElement | null;
                                    let setting_width = await opd_prompt(
                                        i18n_message("msg_column_width_prompt"),
                                        now_width ?? undefined,
                                    );
                                    //console.log(setting_width);
                                    if (setting_width != null) {
                                        const setting_width_num =
                                            Number(setting_width);
                                        if (
                                            !Number.isNaN(setting_width_num) &&
                                            setting_width_num > 11
                                        ) {
                                            width_button_column.setAttribute(
                                                "opd_column_width",
                                                String(setting_width_num),
                                            );
                                            width_button_column.style.width = `${setting_width_num}rem`;
                                            column_settings_save(
                                                "",
                                                last_load_profile,
                                            );
                                            if (
                                                column_width_preset_select !=
                                                null
                                            ) {
                                                switch (setting_width_num) {
                                                    case 15:
                                                        column_width_preset_select.value =
                                                            "0";
                                                        break;
                                                    case 20:
                                                        column_width_preset_select.value =
                                                            "1";
                                                        break;
                                                    case 30:
                                                        column_width_preset_select.value =
                                                            "2";
                                                        break;
                                                    default:
                                                        column_width_preset_select.value =
                                                            "3";
                                                        break;
                                                }
                                            }
                                        } else {
                                            await opd_alert(
                                                i18n_message(
                                                    "msg_invalid_value_alert",
                                                ),
                                            );
                                        }
                                    }
                                },
                            );
                        }
                    }

                    // Support for non-X columns.
                    if (
                        iframe_elem.getAttribute("opd_iframe_width_only") != ""
                    ) {
                        // Load and apply banner visibility settings.
                        /*if(opd_column_banner_checkbox.checked == true){
                        this.contentWindow.document.querySelector("head")!.insertAdjacentHTML("beforeend", `<style opd_banner_css></style>`);
                    }else{
                        this.contentWindow.document.querySelector("head")!.insertAdjacentHTML("beforeend", `<style opd_banner_css>header[role="banner"]{content-visibility:hidden; }</style>`);
                    }*/
                        if (
                            iframe_elem.contentWindow!.document.querySelector(
                                "head style[opd_banner_css]",
                            ) == null
                        ) {
                            iframe_elem
                                .contentWindow!.document.querySelector("head")!
                                .insertAdjacentHTML(
                                    "beforeend",
                                    `<style opd_banner_css></style>`,
                                );
                        }
                        if (opd_column_banner_checkbox?.checked != true) {
                            //console.log(this)
                            iframe_elem.contentWindow!.document.querySelector(
                                "head style[opd_banner_css]",
                            )!.textContent =
                                `header[role="banner"]{display:none};`;
                        } else {
                            //console.log("else")
                            iframe_elem.contentWindow!.document.querySelector(
                                "head style[opd_banner_css]",
                            )!.textContent = ``;
                        }

                        // Load and apply tweet view mode settings.
                        if (
                            iframe_elem.contentWindow!.document.querySelector(
                                "head style[opd_tw_view_mode_css]",
                            ) == null
                        ) {
                            iframe_elem
                                .contentWindow!.document.querySelector("head")!
                                .insertAdjacentHTML(
                                    "beforeend",
                                    `<style opd_tw_view_mode_css></style>`,
                                );
                        }
                        if (opd_column_tw_view_mode_opt != null) {
                            const tw_view_mode_value =
                                opd_column_tw_view_mode_opt.value;

                            switch (tw_view_mode_value) {
                                case "0":
                                    iframe_elem.contentWindow!.document.querySelector(
                                        "head style[opd_tw_view_mode_css]",
                                    )!.textContent = ``;
                                    break;
                                case "1":
                                    iframe_elem.contentWindow!.document.querySelector(
                                        "head style[opd_tw_view_mode_css]",
                                    )!.textContent =
                                        `div[data-testid="cellInnerDiv"]:has(div[aria-labelledby]){visibility: hidden; height: 0;}`;
                                    break;
                                case "2":
                                    iframe_elem.contentWindow!.document.querySelector(
                                        "head style[opd_tw_view_mode_css]",
                                    )!.textContent =
                                        `div[data-testid="cellInnerDiv"]:not(:has(div[aria-labelledby])){visibility: hidden; height: 0;}`;
                                    break;
                                default:
                                    iframe_elem.contentWindow!.document.querySelector(
                                        "head style[opd_tw_view_mode_css]",
                                    )!.textContent = ``;
                                    break;
                            }
                        }
                        //console.log(opd_column_div.querySelector(".opd_banner").checked)
                        if (mode != "session_set") {
                            // Banner toggle event.
                            opd_column_banner_checkbox?.addEventListener(
                                "change",
                                function (ev) {
                                    const banner_checkbox =
                                        ev.currentTarget instanceof
                                        HTMLInputElement
                                            ? ev.currentTarget
                                            : null;
                                    if (!banner_checkbox) return;
                                    column_settings_save("", last_load_profile);
                                    //console.log(this.closest("div[opd_column_type]")!.querySelector("iframe"))
                                    const banner_column =
                                        banner_checkbox.closest(
                                            "div[opd_column_type]",
                                        );
                                    if (!banner_column) return;
                                    const banner_mode_target_object =
                                        banner_column.querySelector("iframe");
                                    if (
                                        !(
                                            banner_mode_target_object instanceof
                                            HTMLIFrameElement
                                        ) ||
                                        !banner_mode_target_object.contentWindow
                                    ) {
                                        return;
                                    }
                                    const banner_doc =
                                        banner_mode_target_object.contentWindow
                                            .document;
                                    const banner_head =
                                        banner_doc.querySelector("head")!;
                                    if (!banner_head) return;
                                    //console.log(banner_mode_target_object.contentWindow.document.querySelector('head style[opd_banner_css]'))
                                    if (
                                        banner_doc.querySelector(
                                            "head style[opd_banner_css]",
                                        ) == null
                                    ) {
                                        banner_head.insertAdjacentHTML(
                                            "beforeend",
                                            `<style opd_banner_css></style>`,
                                        );
                                    }
                                    const banner_style =
                                        banner_doc.querySelector(
                                            "head style[opd_banner_css]",
                                        );
                                    if (!banner_style) return;
                                    if (banner_checkbox.checked != true) {
                                        //console.log(this)
                                        banner_style.textContent = `header[role="banner"]{visibility: hidden; width: 0;};`;
                                    } else {
                                        //console.log("else")
                                        banner_style.textContent = ``;
                                    }
                                },
                            );
                        }

                        /*if(this.closest("div[opd_column_type]")!.getAttribute("opd_column_type") == "explore" || this.closest("div[opd_column_type]")!.getAttribute("opd_column_type") == "home"){
                    
                    }*/
                        if (
                            mode != "session_set" &&
                            opd_column_tw_view_mode_opt != null
                        ) {
                            // Tweet view mode events.
                            opd_column_tw_view_mode_opt.addEventListener(
                                "change",
                                function (ev) {
                                    const tw_view_mode_select =
                                        ev.currentTarget instanceof
                                        HTMLSelectElement
                                            ? ev.currentTarget
                                            : null;
                                    if (!tw_view_mode_select) return;
                                    column_settings_save("", last_load_profile);
                                    //console.log(this.closest("div[opd_column_type]")!.querySelector("iframe"))
                                    const tw_view_mode_column =
                                        tw_view_mode_select.closest(
                                            "div[opd_column_type]",
                                        );
                                    if (!tw_view_mode_column) return;
                                    const tw_view_mode_target_object =
                                        tw_view_mode_column.querySelector(
                                            "iframe",
                                        );
                                    if (
                                        !(
                                            tw_view_mode_target_object instanceof
                                            HTMLIFrameElement
                                        ) ||
                                        !tw_view_mode_target_object.contentWindow
                                    ) {
                                        return;
                                    }
                                    const tw_view_doc =
                                        tw_view_mode_target_object.contentWindow
                                            .document;
                                    const tw_view_head =
                                        tw_view_doc.querySelector("head")!;
                                    if (!tw_view_head) return;
                                    //console.log(this.value)
                                    if (
                                        tw_view_doc.querySelector(
                                            "head style[opd_tw_view_mode_css]",
                                        ) == null
                                    ) {
                                        tw_view_head.insertAdjacentHTML(
                                            "beforeend",
                                            `<style opd_tw_view_mode_css></style>`,
                                        );
                                    }
                                    const tw_view_mode_style =
                                        tw_view_doc.querySelector(
                                            "head style[opd_tw_view_mode_css]",
                                        );
                                    if (!tw_view_mode_style) return;
                                    switch (tw_view_mode_select.value) {
                                        case "0":
                                            tw_view_mode_style.textContent = ``;
                                            break;
                                        case "1":
                                            tw_view_mode_style.textContent = `div[data-testid="cellInnerDiv"]:has(div[aria-labelledby]){visibility: hidden; height: 0;}`;
                                            break;
                                        case "2":
                                            tw_view_mode_style.textContent = `div[data-testid="cellInnerDiv"]:not(:has(div[aria-labelledby])){visibility: hidden; height: 0;}`;
                                            break;
                                        default:
                                            tw_view_mode_style.textContent = ``;
                                            break;
                                    }
                                },
                            );
                        }
                    }

                    // Clicking column bar empty area scrolls to top.
                    if (opd_column_scroll_to_top != null) {
                        opd_column_scroll_to_top.addEventListener(
                            "click",
                            () => {
                                iframe_elem.contentWindow!.scrollTo({
                                    top: 0,
                                    behavior: "auto",
                                });
                            },
                        );
                    }
                    // Manual refresh button reloads only this column.
                    if (opd_column_refresh_btn != null) {
                        opd_column_refresh_btn.addEventListener("click", () => {
                            const target_iframe = opd_column_refresh_btn
                                .closest("div[opd_column_type]")
                                ?.querySelector("iframe");
                            if (!(target_iframe instanceof HTMLIFrameElement)) {
                                return;
                            }
                            queue_column_navigation(target_iframe, () => {
                                if (target_iframe.contentWindow)
                                    target_iframe.contentWindow.location.reload();
                                else target_iframe.src = target_iframe.src;
                            });
                        });
                    }
                },
                { once: false },
            );
            // Explore URL detection logic.
            const opd_column_mutate = column_object[index].closest(
                "div[opd_column_type]",
            );
            if (!opd_column_mutate) {
                continue;
            }
            if (
                opd_column_mutate.getAttribute("opd_column_type") == "explore"
            ) {
                mutate_url(opd_column_mutate);
            }
        }
        queue_column_frames();
    }
    // Track navigation without changing the user-facing column title.
    function mutate_url(element) {
        let exp_object = element.querySelector("iframe");
        exp_object.addEventListener("load", function () {
            if (exp_object.contentWindow.location.href === "about:blank")
                return;
            let exp_old_url = exp_object.contentWindow.location.href;
            let exp_observer = new MutationObserver(function () {
                if (exp_old_url != exp_object.contentWindow.location.href) {
                    let exp_url = new URL(
                        exp_object.contentWindow.location.href,
                    );
                    //console.log(`${exp_url.pathname}${exp_url.search}`);
                    element.setAttribute(
                        "opd_explore_path",
                        `${exp_url.pathname}${exp_url.search}`,
                    );
                    exp_old_url = exp_object.contentWindow.location.href;
                    column_settings_save("", last_load_profile);
                }
            });
            exp_observer.observe(exp_object.contentWindow.document, {
                childList: true,
                subtree: true,
            });
        });
    }
    // Main bar events.
    const init_settings_btn = document.getElementById("init_settings");
    if (init_settings_btn) {
        init_settings_btn.addEventListener("click", async function () {
            chrome.storage.local.remove("opd_settings", async function () {
                await opd_alert(i18n_message("msg_settings_reset_completed"));
            });
        });
    }
    // Prevent auto-scroll when opening media posts.
    const main_rack_element =
        document.querySelector<HTMLElement>("#main_rack_element");
    if (main_rack_element) {
        main_rack_element.addEventListener("scrollend", function () {
            main_rack_element.scrollTop = 0;
        });
    }
    // Two-row view.
    const second_rack_button = document.getElementById("second_rack");
    if (second_rack_button) {
        second_rack_button.addEventListener("click", async function () {
            const first_rack_element = document.querySelector<HTMLElement>(
                "#first_rack_element",
            );
            const second_rack_element = document.querySelector<HTMLElement>(
                "#second_rack_element",
            );
            const second_rack_icon = document.querySelector<HTMLElement>(
                ".dsp_btn_second_rack_img",
            );
            if (second_rack_mode == false) {
                //document.querySelector("#main_rack_element").style.height = "50vh";
                if (first_rack_element)
                    first_rack_element.style.height = "50vh";
                if (second_rack_element)
                    second_rack_element.style.height = "50vh";
                //console.log(default_element.second_empty_column)
                // Legacy second-row empty-column template (currently unused).
                const second_rack_default_html =
                    default_element.second_empty_column.html
                        .replaceAll("%column_num%", create_random_id())
                        .replace("%column_banner_ch%", "")
                        .replace("%column_tw_view_mode%", "0");
                second_rack_element?.insertAdjacentHTML(
                    "beforeend",
                    second_rack_default_html,
                );
                /*for (let index = 0; index < document.querySelectorAll('.dsp_column[draggable="true"]').length; index++) {
                document.querySelectorAll('.dsp_column[draggable="true"]')[index].style.height = "calc(100% - 25px)";
            }*/
                //document.querySelector("style[second_column_css]")!.textContent = `.dsp_column[draggable="true"]{height:calc(100% - 25px)}`;
                //document.querySelector(".dsp_column_second_emptycolumn").scrollIntoView({behavior: "smooth",inline: "end"});
                //append_object_css();
                column_dd();
                column_close();
                column_settings_save("", last_load_profile);
                second_rack_mode = true;
                second_rack_button.value = "Single Rack";
                if (second_rack_icon) {
                    second_rack_icon.style.backgroundImage = `url(${chrome.runtime.getURL(ui_icon_define.column_single_rack)})`;
                }
            } else {
                if (
                    await opd_confirm(
                        i18n_message("msg_second_rack_to_single_confirm"),
                    )
                ) {
                    if (second_rack_element)
                        second_rack_element.textContent = "";
                    const second_column_style = document.querySelector(
                        "style[second_column_css]",
                    );
                    if (second_column_style)
                        second_column_style.textContent = ``;
                    if (first_rack_element)
                        first_rack_element.style.height = "100vh";
                    if (second_rack_element)
                        second_rack_element.style.height = "0";
                    if (second_rack_element)
                        second_rack_element.style.height = "0";
                    //append_object_css();
                    //column_dd();
                    column_settings_save("", last_load_profile);
                    second_rack_mode = false;
                    second_rack_button.value = "Second Rack";
                    if (second_rack_icon) {
                        second_rack_icon.style.backgroundImage = `url(${chrome.runtime.getURL(ui_icon_define.column_second_rack)})`;
                    }
                }
            }
        });
    }
    const dnr_reload_btn = document.getElementById("dnr_reload");
    if (dnr_reload_btn) {
        dnr_reload_btn.addEventListener("click", async function () {
            if (await opd_confirm(i18n_message("msg_dnr_reload_confirm"))) {
                chrome.runtime
                    .sendMessage({ message: "dnr_upd" })
                    .then((value) => {
                        if ((value as boolean) == true) {
                            request_page_reload();
                        }
                    });
            }
        });
    }
    const ext_reload_btn = document.getElementById("ext_reload");
    if (ext_reload_btn) {
        ext_reload_btn.addEventListener("click", async function () {
            if (
                await opd_confirm(i18n_message("msg_extension_reload_confirm"))
            ) {
                try {
                    sessionStorage.setItem(beforeunload_bypass_key, "1");
                } catch {
                    // no-op: fallback to guarded beforeunload prompt
                }
                chrome.runtime.sendMessage({ message: "ext_reload" });
            }
        });
    }
    // Add Post column.
    // TODO: Simplify the column-addition flow.
    const add_post_btn = document.getElementById("add_post");
    if (add_post_btn) {
        add_post_btn.addEventListener("click", function () {
            const empty_column = document.querySelector(
                ".dsp_column_emptycolumn",
            );
            const first_column = empty_column
                ?.closest("div")
                ?.querySelector('section[draggable="true"]');
            const add_target_column =
                is_shift_pressed && first_column ? first_column : empty_column;

            const new_column = default_element["post"]["html"]
                .replaceAll("%column_num%", create_random_id())
                .replace("%column_banner_ch%", "")
                .replace("%column_tw_view_mode%", "0")
                .replaceAll("%column_width_num%", "30")
                .replaceAll("%column_auto_reload_ch%", "")
                .replaceAll("%column_auto_reload_time%", "10");
            if (!add_target_column) return;
            add_target_column.insertAdjacentHTML("beforebegin", new_column);
            animate_ui_entrance(
                add_target_column.previousElementSibling?.querySelector<HTMLElement>(
                    ".column_bar",
                ) ?? null,
            );
            add_target_column.scrollIntoView({
                behavior: "smooth",
                inline: "end",
            });
            const all_webview = document.querySelectorAll(
                "#main_rack_element iframe[opd_init_webview]",
            );
            append_object_css("add_column", all_webview);
            column_dd();
            column_close();
            column_settings_save("", last_load_profile);
        });
    }
    // Add Timeline column.
    const add_timeline_btn = document.getElementById("add_timeline");
    if (add_timeline_btn) {
        add_timeline_btn.addEventListener("click", function () {
            const empty_column = document.querySelector(
                ".dsp_column_emptycolumn",
            );
            const first_column = empty_column
                ?.closest("div")
                ?.querySelector('section[draggable="true"]');
            const add_target_column =
                is_shift_pressed && first_column ? first_column : empty_column;

            const new_column = default_element["home"]["html"]
                .replaceAll("%column_num%", create_random_id())
                .replace("%column_banner_ch%", "")
                .replace("%column_tw_view_mode%", "0")
                .replaceAll("%column_width_num%", "30")
                .replaceAll("%column_auto_reload_ch%", "")
                .replaceAll("%column_auto_reload_time%", "10");
            if (!add_target_column) return;
            add_target_column.insertAdjacentHTML("beforebegin", new_column);
            animate_ui_entrance(
                add_target_column.previousElementSibling?.querySelector<HTMLElement>(
                    ".column_bar",
                ) ?? null,
            );
            add_target_column.scrollIntoView({
                behavior: "smooth",
                inline: "end",
            });
            const all_webview = document.querySelectorAll(
                "#main_rack_element iframe[opd_init_webview]",
            );
            append_object_css("add_column", all_webview);
            column_dd();
            column_close();
            column_settings_save("", last_load_profile);
        });
    }
    // Add Notification column.
    const add_notify_btn = document.getElementById("add_notify");
    if (add_notify_btn) {
        add_notify_btn.addEventListener("click", function () {
            const empty_column = document.querySelector(
                ".dsp_column_emptycolumn",
            );
            const first_column = empty_column
                ?.closest("div")
                ?.querySelector('section[draggable="true"]');
            const add_target_column =
                is_shift_pressed && first_column ? first_column : empty_column;

            const new_column = default_element["notification"]["html"]
                .replaceAll("%column_num%", create_random_id())
                .replace("%column_banner_ch%", "")
                .replace("%column_tw_view_mode%", "0")
                .replaceAll("%column_width_num%", "30")
                .replaceAll("%column_auto_reload_ch%", "")
                .replaceAll("%column_auto_reload_time%", "10");
            if (!add_target_column) return;
            add_target_column.insertAdjacentHTML("beforebegin", new_column);
            animate_ui_entrance(
                add_target_column.previousElementSibling?.querySelector<HTMLElement>(
                    ".column_bar",
                ) ?? null,
            );
            add_target_column.scrollIntoView({
                behavior: "smooth",
                inline: "end",
            });
            const all_webview = document.querySelectorAll(
                "#main_rack_element iframe[opd_init_webview]",
            );
            append_object_css("add_column", all_webview);
            column_dd();
            column_close();
            column_settings_save("", last_load_profile);
        });
    }
    function normalize_custom_x_path(input_value) {
        const trimmed_value = input_value?.trim();
        if (!trimmed_value) {
            return null;
        }
        if (
            /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?$/i.test(
                trimmed_value,
            )
        ) {
            return "/home";
        }
        let normalized_url;
        try {
            if (trimmed_value.startsWith("/")) {
                normalized_url = new URL(`https://x.com${trimmed_value}`);
            } else if (
                /^https?:\/\//i.test(trimmed_value) ||
                /^(x\.com|twitter\.com|www\.x\.com|www\.twitter\.com)\//i.test(
                    trimmed_value,
                )
            ) {
                normalized_url = new URL(
                    /^https?:\/\//i.test(trimmed_value)
                        ? trimmed_value
                        : `https://${trimmed_value}`,
                );
            } else {
                normalized_url = new URL(`https://x.com/${trimmed_value}`);
            }
        } catch {
            return null;
        }
        const host = normalized_url.hostname.toLowerCase();
        const allowed_hosts = [
            "x.com",
            "twitter.com",
            "www.x.com",
            "www.twitter.com",
        ];
        if (!allowed_hosts.includes(host)) {
            return null;
        }
        const normalized_path = `${normalized_url.pathname}${normalized_url.search}`;
        return normalized_path === "" ? "/home" : normalized_path;
    }
    function get_current_x_username() {
        const profile_link = document.querySelector(
            'a[data-testid="AppTabBar_Profile_Link"]',
        );
        const profile_href = profile_link?.getAttribute("href");
        const username_pattern = /^\/([A-Za-z0-9_]{1,15})(?:\/|$)/;
        const reserved_paths = new Set([
            "home",
            "explore",
            "notifications",
            "messages",
            "search",
            "settings",
            "i",
            "compose",
        ]);
        if (profile_href != null) {
            const profile_match = profile_href.match(username_pattern);
            if (
                profile_match != null &&
                !reserved_paths.has(profile_match[1].toLowerCase())
            ) {
                return profile_match[1];
            }
        }
        const path_match = location.pathname.match(username_pattern);
        if (
            path_match != null &&
            !reserved_paths.has(path_match[1].toLowerCase())
        ) {
            return path_match[1];
        }
        return null;
    }
    function add_explore_column_with_path(
        column_path,
        column_title = i18n_message("ui_column_explore_title"),
    ) {
        const empty_column = document.querySelector(".dsp_column_emptycolumn");
        const first_column = empty_column
            ?.closest("div")
            ?.querySelector('section[draggable="true"]');
        const add_target_column =
            is_shift_pressed && first_column ? first_column : empty_column;
        if (!add_target_column) {
            return;
        }
        const column_id = create_random_id();
        const new_column = default_element["explore"]["html"]
            .replaceAll("%column_save_path%", column_path)
            .replaceAll("%column_num%", column_id)
            .replace("%column_banner_ch%", "")
            .replace("%column_tw_view_mode%", "0")
            .replaceAll("%column_pinned_save_path%", "")
            .replaceAll("%column_width_num%", "30")
            .replaceAll("%column_auto_reload_ch%", "")
            .replaceAll("%column_auto_reload_time%", "10");
        add_target_column.insertAdjacentHTML("beforebegin", new_column);
        animate_ui_entrance(
            add_target_column.previousElementSibling?.querySelector<HTMLElement>(
                ".column_bar",
            ) ?? null,
        );
        const inserted_column = document.querySelector(`#column_${column_id}`);
        const inserted_column_root = inserted_column?.querySelector(
            "div[opd_column_type='explore']",
        );
        const title_text = inserted_column?.querySelector(
            ".dsp_column_title .dsp_column_move_icon_parent span:last-child",
        );
        if (inserted_column_root != null) {
            inserted_column_root.setAttribute("opd_custom_title", column_title);
            inserted_column_root.setAttribute(
                "opd_explore_title",
                column_title,
            );
        }
        if (title_text != null) {
            title_text.textContent = column_title;
        }
        add_target_column.scrollIntoView({
            behavior: "smooth",
            inline: "end",
        });
        const all_webview = document.querySelectorAll(
            "#main_rack_element iframe[opd_init_webview]",
        );
        append_object_css("add_column", all_webview);
        column_dd();
        column_close();
        column_settings_save("", last_load_profile);
    }
    // Add Explore (universal) column.
    const add_explore_button = document.getElementById("add_explore");
    if (add_explore_button) {
        add_explore_button.addEventListener("click", function () {
            add_explore_column_with_path("/explore");
        });
    }
    // Add custom URL under x.com/twitter.com.
    const add_custom_url_button = document.getElementById("add_custom_url");
    if (add_custom_url_button) {
        add_custom_url_button.addEventListener("click", async function () {
            const input_value = await opd_prompt(
                i18n_message("msg_custom_x_url_prompt"),
            );
            if (input_value == null) {
                return;
            }
            const custom_path = normalize_custom_x_path(input_value);
            if (custom_path == null) {
                await opd_alert(i18n_message("msg_invalid_value_alert"));
                return;
            }
            const requested_title = await opd_prompt(
                i18n_message("msg_custom_column_title_prompt"),
                i18n_message("ui_column_custom_title"),
            );
            if (requested_title == null) return;
            const column_title = requested_title.trim();
            if (!column_title) {
                await opd_alert(i18n_message("msg_invalid_value_alert"));
                return;
            }
            add_explore_column_with_path(custom_path, column_title);
        });
    }
    // Add your Lists column.
    const add_lists_button = document.getElementById("add_lists");
    if (add_lists_button) {
        add_lists_button.addEventListener("click", async function () {
            const username = get_current_x_username();
            if (username == null) {
                await opd_alert(i18n_message("msg_username_not_found_alert"));
                return;
            }
            add_explore_column_with_path(
                `/${username}/lists`,
                i18n_message("ui_column_lists_title"),
            );
        });
    }
    // Profile save button.
    const profile_save_button = document.getElementById("profile_save");
    if (profile_save_button) {
        profile_save_button.addEventListener("click", async function () {
            const default_name = next_profile_name(profile_store);
            const requested_name = await opd_prompt(
                i18n_message_or_fallback(
                    "msg_profile_name_prompt",
                    "Name this profile:",
                ),
                default_name,
            );
            if (requested_name !== null) {
                const profile = column_settings_save("profile_out");
                if (profile == null) {
                    return;
                }
                const save_object = {
                    name: requested_name.trim() || default_name,
                    profile: profile.column_settings,
                };
                //console.log(profile)
                profile_store.push(save_object);
                //console.log(profile_store)
                chrome.storage.local.set(
                    { opd_profile_store: JSON.stringify(profile_store) },
                    function () {
                        const profile_button_list =
                            document.querySelector("#profile_btn_list");
                        if (profile_button_list instanceof HTMLElement) {
                            profile_button_list.innerHTML =
                                create_profile_list_buttons_html(
                                    profile_store.length,
                                    last_load_profile,
                                );
                        }
                        create_profile_list_btn();
                    },
                );
            }
        });
    }
    // Profile delete button.
    const profile_delete_button = document.getElementById("profile_delete");
    if (profile_delete_button) {
        profile_delete_button.addEventListener("click", async function () {
            if (profile_store.length <= 1) {
                await opd_alert(
                    i18n_message("msg_profile_delete_current_alert"),
                );
                return;
            }

            const available_profiles = profile_store.slice();
            const selected_profile = await open_opd_dialog({
                type: "select",
                message: i18n_message("ui_profile_delete_title"),
                defaultValue: String(last_load_profile),
                choices: available_profiles.map((profile, index) => ({
                    value: String(index),
                    label: profile_display_name(profile, index),
                })),
            });
            if (typeof selected_profile !== "string") {
                return;
            }
            const selected_index = Number(selected_profile);
            if (
                !Number.isInteger(selected_index) ||
                selected_index < 0 ||
                selected_index >= available_profiles.length
            ) {
                return;
            }
            const selected_entry = available_profiles[selected_index];
            let delete_num = profile_store.indexOf(selected_entry);
            if (delete_num < 0) return;
            if (profile_store.length <= 1) {
                await opd_alert(
                    i18n_message("msg_profile_delete_current_alert"),
                );
                return;
            }
            if (
                await opd_confirm(
                    i18n_message("msg_profile_delete_confirm", [
                        profile_display_name(selected_entry, delete_num),
                    ]),
                )
            ) {
                delete_num = profile_store.indexOf(selected_entry);
                if (profile_store.length <= 1 || delete_num < 0) {
                    return;
                }
                const after_profile_num =
                    delete_num <= last_load_profile
                        ? Math.max(0, last_load_profile - 1)
                        : last_load_profile;
                profile_store.splice(delete_num, 1);
                chrome.storage.local.set(
                    { opd_profile_store: JSON.stringify(profile_store) },
                    function () {
                        chrome.storage.local.get(
                            "opd_settings",
                            function (load_value) {
                                set_last_load_profile(after_profile_num);
                                let load_setting = JSON.parse(
                                    String(load_value.opd_settings),
                                );
                                load_setting.last_load_profile =
                                    after_profile_num;
                                chrome.storage.local.set(
                                    {
                                        opd_settings:
                                            JSON.stringify(load_setting),
                                    },
                                    function () {
                                        const profile_button_list =
                                            document.querySelector(
                                                "#profile_btn_list",
                                            );
                                        if (
                                            profile_button_list instanceof
                                            HTMLElement
                                        ) {
                                            profile_button_list.innerHTML =
                                                create_profile_list_buttons_html(
                                                    profile_store.length,
                                                    after_profile_num,
                                                );
                                        }
                                        create_profile_list_btn();
                                    },
                                );
                            },
                        );
                    },
                );
            }
        });
    }
    // Column move handling.
    function bind_column_auto_reload(
        frame: HTMLIFrameElement,
        reload: OpdExtAutoReload | null,
    ) {
        const column = frame.closest("div[opd_column_type]");
        const enabled =
            column?.querySelector<HTMLInputElement>(".opd_a_reload_bar");
        const interval = column?.querySelector<HTMLInputElement>(
            ".opd_a_reload_time_setting",
        );
        if (
            !enabled ||
            !interval ||
            enabled.hasAttribute("opd_auto_reload_bound")
        )
            return;
        enabled.setAttribute("opd_auto_reload_bound", "");
        frame.setAttribute("auto_reload_mouse_hover", "false");
        frame.addEventListener("mouseover", () =>
            frame.setAttribute("auto_reload_mouse_hover", "true"),
        );
        frame.addEventListener("mouseleave", () =>
            frame.setAttribute("auto_reload_mouse_hover", "false"),
        );
        if (reload) {
            frame.addEventListener("load", () => {
                if (
                    frame.contentWindow &&
                    frame.contentWindow.location.href !== "about:blank"
                ) {
                    reload.Init(frame.contentWindow);
                }
            });
        }
        let timer: ReturnType<typeof setInterval> | undefined;
        const update = () => {
            if (timer !== undefined) clearInterval(timer);
            timer = undefined;
            interval.disabled = enabled.checked;
            const value = Number(interval.value);
            const seconds = Number.isFinite(value) && value >= 1 ? value : 10;
            interval.value = String(seconds);
            if (enabled.checked) {
                timer = column_set_interval(() => {
                    if (!frame.isConnected) {
                        if (timer !== undefined) clearInterval(timer);
                        return;
                    }
                    queue_column_auto_refresh(frame, reload);
                }, seconds * 1000);
            }
        };
        enabled.addEventListener("change", () => {
            update();
            column_settings_save("", last_load_profile);
        });
        interval.addEventListener("change", () => {
            update();
            column_settings_save("", last_load_profile);
        });
        update();
    }
    function bind_column_pin(column: HTMLElement) {
        let checkbox =
            column.querySelector<HTMLInputElement>(".opd_pinned_btn");
        if (!checkbox) {
            const bar = column.querySelector(".column_bar");
            if (!bar) return;
            const wrapper = document.createElement("span");
            wrapper.className = "dsp_column_btn";
            checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "opd_pinned_btn";
            checkbox.title = i18n_message("ui_column_pin_toggle_title");
            const label = document.createElement("label");
            label.className = "dsp_column_pin_btn opd_ui_icon_color";
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            bar.insertBefore(
                wrapper,
                bar
                    .querySelector(".column_refresh_btn")
                    ?.closest(".dsp_column_btn") ??
                    bar.querySelector(".dsp_column_close_btn_wrap"),
            );
        }
        checkbox.checked = Boolean(column.getAttribute("opd_pinned_path"));
        if (checkbox.hasAttribute("opd_pin_bound")) return;
        checkbox.setAttribute("opd_pin_bound", "");
        const control = checkbox;
        control.addEventListener("click", async () => {
            control.disabled = true;
            try {
                let path = "";
                if (control.checked) {
                    const frame =
                        column.querySelector<HTMLIFrameElement>("iframe");
                    const current_url =
                        frame?.contentWindow?.location.href ?? "";
                    path =
                        (current_url.startsWith("https://")
                            ? normalize_custom_x_path(current_url)
                            : null) ??
                        normalize_custom_x_path(
                            frame?.getAttribute("data-opd-src") ?? "",
                        ) ??
                        "";
                    if (!path) {
                        await opd_alert(
                            i18n_message("msg_invalid_value_alert"),
                        );
                        return;
                    }
                }
                if (
                    await opd_confirm(
                        i18n_message(
                            control.checked
                                ? "msg_explore_pin_confirm"
                                : "msg_explore_unpin_confirm",
                        ),
                    )
                ) {
                    if (!column.isConnected) return;
                    column.setAttribute("opd_pinned_path", path);
                    column_settings_save("", last_load_profile);
                }
            } finally {
                control.checked = Boolean(
                    column.getAttribute("opd_pinned_path"),
                );
                control.disabled = false;
            }
        });
    }
    function column_rename() {
        const titles = document.querySelectorAll<HTMLElement>(
            '#opd_main_element .dsp_column[draggable="true"] .dsp_column_title .dsp_column_move_icon_parent span:last-child',
        );
        for (const title of Array.from(titles)) {
            if (title.hasAttribute("opd_rename_bound")) continue;
            title.setAttribute("opd_rename_bound", "");
            title.setAttribute("role", "button");
            title.setAttribute("tabindex", "0");
            title.setAttribute("draggable", "false");
            title.title = i18n_message_or_fallback(
                "ui_column_rename",
                "Rename column",
            );
            title.style.cursor = "pointer";
            const rename = async () => {
                const column = title.closest("div[opd_column_type]");
                if (!column) return;
                const value = await opd_prompt(
                    i18n_message_or_fallback(
                        "ui_column_rename",
                        "Rename column",
                    ),
                    title.textContent ?? "",
                );
                if (value == null || value.trim() === "" || !title.isConnected)
                    return;
                const custom_title = value.trim();
                if (custom_title === title.textContent) return;
                column.setAttribute("opd_custom_title", custom_title);
                title.textContent = custom_title;
                column_settings_save("", last_load_profile);
            };
            title.addEventListener("click", (event) => {
                event.stopPropagation();
                void rename();
            });
            title.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    void rename();
                }
            });
        }
    }
    function column_dd() {
        column_rename();
        const columns = document.querySelectorAll<HTMLElement>(".dsp_column");
        const clear_indicators = () => {
            document
                .querySelectorAll(".opd_drop_before, .opd_drop_after")
                .forEach((column) => {
                    column.classList.remove(
                        "opd_drop_before",
                        "opd_drop_after",
                    );
                });
        };
        const finish_drag = () => {
            clear_indicators();
            document
                .querySelector(".opd_column_dragging")
                ?.classList.remove("opd_column_dragging");
            document.body.classList.remove("opd_column_drag_active");
        };
        const insertion_point = (column: HTMLElement, client_x: number) => {
            const bounds = column.getBoundingClientRect();
            const after =
                column.matches('[draggable="true"]') &&
                client_x >= bounds.left + bounds.width / 2;
            return {
                after,
                reference: after ? column.nextElementSibling : column,
            };
        };
        for (const column of Array.from(columns)) {
            if (column.hasAttribute("opd_drag_bound")) continue;
            column.setAttribute("opd_drag_bound", "");
            column.addEventListener("dragstart", (event) => {
                if (
                    !event.dataTransfer ||
                    !column.matches('[draggable="true"]')
                ) {
                    event.preventDefault();
                    return;
                }
                event.stopPropagation();
                finish_drag();
                event.dataTransfer.setData("text/plain", column.id);
                event.dataTransfer.effectAllowed = "move";
                column.classList.add("opd_column_dragging");
                document.body.classList.add("opd_column_drag_active");
            });
            column.addEventListener("dragover", (event) => {
                const dragged = document.querySelector(".opd_column_dragging");
                if (
                    !dragged ||
                    (!column.matches('[draggable="true"]') &&
                        !column.classList.contains("dsp_column_emptycolumn"))
                )
                    return;
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                clear_indicators();
                const { after, reference } = insertion_point(
                    column,
                    event.clientX,
                );
                if (
                    dragged === column ||
                    dragged === reference ||
                    dragged.nextElementSibling === reference
                )
                    return;
                column.classList.add(
                    after ? "opd_drop_after" : "opd_drop_before",
                );
            });
            column.addEventListener("dragleave", (event) => {
                if (
                    event.relatedTarget instanceof Node &&
                    column.contains(event.relatedTarget)
                )
                    return;
                column.classList.remove("opd_drop_before", "opd_drop_after");
            });
            column.addEventListener("dragend", finish_drag);
            column.addEventListener("drop", (event) => {
                const dragged = document.querySelector(".opd_column_dragging");
                if (
                    !dragged ||
                    (!column.matches('[draggable="true"]') &&
                        !column.classList.contains("dsp_column_emptycolumn"))
                )
                    return;
                event.preventDefault();
                event.stopPropagation();
                const parent = column.parentElement;
                const { reference } = insertion_point(column, event.clientX);
                finish_drag();
                if (
                    !parent ||
                    dragged === column ||
                    dragged === reference ||
                    dragged.nextElementSibling === reference
                )
                    return;
                // Atomic moves preserve the iframe document and its current state.
                if (typeof parent.moveBefore !== "function") {
                    void opd_alert(
                        i18n_message_or_fallback(
                            "msg_column_move_browser_update",
                            "Please update your browser to move columns without refreshing them.",
                        ),
                    );
                    return;
                }
                parent.moveBefore(dragged, reference);
                column_settings_save("", last_load_profile);
            });
        }
    }
    // Close column.
    function column_close() {
        const close_buttons = document.querySelectorAll(".column_close_btn");
        for (let index = 0; index < close_buttons.length; index++) {
            if (close_buttons[index].hasAttribute("opd_close_bound")) continue;
            close_buttons[index].setAttribute("opd_close_bound", "");
            let confirmation_pending = false;
            close_buttons[index].addEventListener("click", async function (ev) {
                const close_button =
                    ev.currentTarget instanceof HTMLElement
                        ? ev.currentTarget
                        : null;
                if (!close_button || confirmation_pending) return;
                const column_element = close_button.closest(".dsp_column")!;
                if (!column_element) return;
                const pin_checkbox_element =
                    column_element.querySelector(".opd_pinned_btn");
                const pin_checkbox =
                    pin_checkbox_element instanceof HTMLInputElement
                        ? pin_checkbox_element.checked
                        : undefined;
                confirmation_pending = true;
                try {
                    if (
                        (await opd_confirm(
                            i18n_message(
                                pin_checkbox
                                    ? "msg_pinned_column_close_confirm"
                                    : "msg_column_close_confirm",
                            ),
                        )) &&
                        column_element.isConnected
                    ) {
                        column_element.remove();
                        append_object_css();
                        column_settings_save("", last_load_profile);
                    }
                } finally {
                    confirmation_pending = false;
                }
            });
        }
    }
    // Save column layout.
    type SavedColumnSettings = {
        type: string;
        banner: boolean;
        tw_view_mode: string;
        column_save_path: string;
        column_save_title: string | null;
        column_pinned_path: string;
        auto_reload: boolean | null;
        auto_reload_time: number;
        column_width: string | null;
        custom_title?: string;
    };
    function column_settings_save(mode = "", profile_num = last_load_profile) {
        const milliseconds_per_second = 1000;
        const default_reload_seconds = 10;
        const default_reload_time =
            default_reload_seconds * milliseconds_per_second;
        const settings_array: {
            column_settings: SavedColumnSettings[];
            version: string;
        } = {
            column_settings: [],
            version: manifest.version,
        };
        const columns = document.querySelectorAll(
            "#opd_main_element div[opd_column_type]",
        );
        for (let index = 0; index < columns.length; index++) {
            const column = columns[index];
            const column_type = column.getAttribute("opd_column_type") ?? "";
            const is_explore = column_type == "explore";
            const supports_reload =
                column.querySelector(".opd_a_reload_bar") != null;
            const column_width = column.getAttribute("opd_column_width");
            const reload_time = supports_reload
                ? Number(
                      column.querySelector<HTMLInputElement>(
                          ".opd_a_reload_time_setting",
                      )?.value ?? String(default_reload_seconds),
                  ) * milliseconds_per_second
                : default_reload_time;

            settings_array.column_settings.push({
                ...(column.getAttribute("opd_custom_title") != null
                    ? { custom_title: column.getAttribute("opd_custom_title")! }
                    : {}),
                type: column_type,
                banner:
                    column.querySelector<HTMLInputElement>(".opd_banner")
                        ?.checked == true,
                tw_view_mode:
                    column.querySelector<HTMLSelectElement>(".opd_tw_view_mode")
                        ?.value ?? "0",
                column_save_path: is_explore
                    ? (column.getAttribute("opd_explore_path") ?? "")
                    : "",
                column_save_title: is_explore
                    ? column.getAttribute("opd_explore_title")
                    : null,
                column_pinned_path:
                    column.getAttribute("opd_pinned_path") ?? "",
                auto_reload: supports_reload
                    ? column.querySelector<HTMLInputElement>(
                          ".opd_a_reload_bar",
                      )?.checked == true
                    : null,
                auto_reload_time:
                    reload_time >= milliseconds_per_second
                        ? reload_time
                        : default_reload_time,
                column_width: column_width == "null" ? null : column_width,
            });
        }
        if (mode == "profile_out") {
            return settings_array;
        }
        Object.assign(profile_store[profile_num], {
            profile: settings_array.column_settings,
        });
        chrome.storage.local.set(
            { opd_profile_store: JSON.stringify(profile_store) },
            function () {},
        );
        return null;
    }
    // Create random ID.
    function create_random_id() {
        return Math.random().toString(32).substring(2);
    }
    // Mask default X UI behaviors.
    function main_dsp() {
        const react_root = document.getElementById("react-root");
        if (!react_root) return;
        react_root.style.visibility = "hidden";
        react_root.style.overflow = "hidden";
    }
    const target_elem = document.getElementById("react-root");
    if (!target_elem) return;
    const observer = new MutationObserver(main_dsp);
    observer.observe(target_elem, {
        childList: true,
        characterData: true,
        subtree: false,
    });
    // Watch title changes.
    const observe_head_observer = new MutationObserver(function () {
        document.title = "XPP-Deck";
        const shortcut_icon = document.querySelector<HTMLLinkElement>(
            'link[rel="shortcut icon"]',
        );
        if (shortcut_icon) {
            shortcut_icon.href = chrome.runtime.getURL(
                "public/icons/logo_icon.svg",
            );
        }
        // Remove default CSS so it does not affect UI.
        if (!is_removed_default_style) {
            document.head.querySelectorAll("style").forEach((style) => {
                if (style.textContent.includes("*, ::before, ::after")) {
                    style.remove();
                    is_removed_default_style = true;
                }
            });
        }

        // Detect and apply dark mode settings.
        const main_element = document.getElementById("opd_main_element");
        if (!main_element) return;

        apply_theme_for_main_element(main_element);
    });
    const observe_head = document.querySelector("head")!;
    if (observe_head) {
        observe_head_observer.observe(observe_head, {
            childList: true,
            characterData: true,
            subtree: false,
        });
    }
}
