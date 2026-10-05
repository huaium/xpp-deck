import { is_deck_location } from "./session";

export const manifest = chrome.runtime.getManifest();
// Print welcome messages to console
console.log("Welcome to XPP-Deck!");
console.log(`Version: ${manifest.version}`);
//
export const system_dark_query = window.matchMedia(
    "(prefers-color-scheme: dark)",
);
export const opd_bootstrap: NonNullable<Window["__opdBootstrap"]> =
    window.__opdBootstrap || {};
export const beforeunload_bypass_key =
    opd_bootstrap.beforeunloadBypassKey || "opd_beforeunload_bypass_once";
export const opd_root_theme_attribute =
    opd_bootstrap.rootThemeAttribute || "data-opd-theme";
type I18nOverrideMessages = Record<string, { message?: string }>;
let opd_i18n_override_messages: I18nOverrideMessages | null = null;
let opd_english_messages: I18nOverrideMessages = {};
export let opd_i18n_language = "browser";
export const supported_languages = { en: "English", ja: "日本語", zh_CN: "简体中文", zh_TW: "繁體中文", ko: "한국어", es: "Español", fr: "Français", de: "Deutsch", pt_BR: "Português (Brasil)" };
export function resolve_language(language: string) {
    const tag = language.replaceAll("_", "-").toLowerCase();
    if (tag.startsWith("zh")) return /(?:tw|hk|mo|hant)/.test(tag) ? "zh_TW" : "zh_CN";
    if (tag.startsWith("pt")) return "pt_BR";
    const base = tag.split("-")[0];
    return Object.hasOwn(supported_languages, base) ? base : "en";
}
export function formatting_locale() {
    return opd_i18n_language === "browser" ? navigator.language : opd_i18n_language.replaceAll("_", "-");
}
function normalize_i18n_substitutions(
    substitutions?: string | string[] | null,
) {
    if (substitutions == null) {
        return [];
    }
    if (Array.isArray(substitutions)) {
        return substitutions.map((value) => String(value));
    }
    return [String(substitutions)];
}
function apply_i18n_substitutions(
    message: string,
    substitutions?: string | string[] | null,
) {
    const normalized_substitutions =
        normalize_i18n_substitutions(substitutions);
    return message
        .replace(/\$\$/g, "__OPD_DOLLAR__")
        .replace(/\$(\d+)/g, (match, index_text) => {
            const index = Number(index_text) - 1;
            return normalized_substitutions[index] ?? "";
        })
        .replace(/__OPD_DOLLAR__/g, "$");
}
export function i18n_message(
    message_name: string,
    substitutions?: string | string[],
) {
    const override_message =
        opd_i18n_override_messages?.[message_name]?.message;
    if (typeof override_message === "string") {
        return apply_i18n_substitutions(override_message, substitutions);
    }
    const fallback = opd_english_messages[message_name]?.message;
    return typeof fallback === "string" ? apply_i18n_substitutions(fallback, substitutions) : chrome.i18n.getMessage(message_name, substitutions);
}
function get_storage_local_async(
    key: string,
): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (value) => resolve(value));
    });
}
export async function initialize_i18n_override() {
    const language_setting = await get_storage_local_async(
        "opd_language_override",
    );
    const language_setting_record = language_setting as Record<string, unknown>;
    const selected_language =
        typeof language_setting_record.opd_language_override === "string"
            ? language_setting_record.opd_language_override
            : "browser";
    opd_i18n_language = selected_language === "browser" ? "browser" : resolve_language(selected_language);
    const locale = resolve_language(selected_language === "browser" ? navigator.language : selected_language);
    try {
        const english = await fetch(chrome.runtime.getURL("_locales/en/messages.json"));
        if (english.ok) opd_english_messages = await english.json();
        const response = await fetch(
            chrome.runtime.getURL(
                `_locales/${locale}/messages.json`,
            ),
        );
        if (!response.ok) {
            opd_i18n_override_messages = null;
            return;
        }
        opd_i18n_override_messages = await response.json();
    } catch {
        opd_i18n_override_messages = null;
    }
}
export let is_shift_pressed = false;
export let profile_store;
export let last_load_profile = 0;
export let media_viewer_token: string[] = [];
export const opd_sidebar_width_expanded = "208px";
export const opd_sidebar_width_collapsed = "64px";
const ui_animations = new WeakMap<HTMLElement, Animation>();
export async function animate_sidebar_change(element: HTMLElement, apply: () => void) {
    const opacity = window.getComputedStyle(element).opacity;
    ui_animations.get(element)?.cancel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !element.animate) {
        element.style.opacity = "";
        apply();
        return;
    }
    const fade = element.animate([{ opacity }, { opacity: 0 }], { duration: 70, fill: "forwards" });
    ui_animations.set(element, fade);
    try { await fade.finished; } catch { return; }
    if (ui_animations.get(element) !== fade) return;
    element.style.opacity = "0";
    fade.cancel();
    apply();
    // Keep layout changes invisible until the existing width transition settles.
    const reveal = element.animate([{ opacity: 0 }, { opacity: 1 }], { delay: 180, duration: 100, easing: "ease-out", fill: "forwards" });
    ui_animations.set(element, reveal);
    try { await reveal.finished; } catch { return; }
    if (ui_animations.get(element) !== reveal) return;
    element.style.opacity = "";
    reveal.cancel();
    ui_animations.delete(element);
}
export async function animate_dialog_exit(overlay: HTMLElement, dialog: HTMLElement) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !overlay.animate || !dialog.animate) return;
    overlay.style.animation = "none";
    dialog.style.animation = "none";
    const options: KeyframeAnimationOptions = { duration: 160, easing: "ease-in", fill: "forwards" };
    const animations = [
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], options),
        dialog.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(6px)" }], options),
    ];
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}
export function animate_ui_entrance(element: HTMLElement | null, duration = 180, distance = 8) {
    if (!element) return;
    ui_animations.get(element)?.cancel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !element.animate) return;
    const animation = element.animate([
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: "translateY(0)" },
    ], { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    ui_animations.set(element, animation);
    const cleanup = () => {
        if (ui_animations.get(element) === animation) ui_animations.delete(element);
    };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
}
export function request_page_reload() {
    try {
        sessionStorage.setItem(beforeunload_bypass_key, "1");
    } catch {
        // no-op: fallback to normal reload when storage is unavailable
    }
    location.reload();
}
export const ui_icon_define = {
    banner_hide: "public/icons/banner_hide.svg",
    column_move: "public/icons/column_move.svg",
    column_close: "public/icons/column_close.svg",
    column_settings: "public/icons/settings.svg",
    column_pin: "public/icons/pin.svg",
    column_pinned: "public/icons/pinned.svg",
    column_widesize: "public/icons/column_w_size.svg",
    column_add_1: "public/icons/column_add_1st.svg",
    column_add_2: "public/icons/column_add_2nd.svg",
    add_post_column: "public/icons/post.svg",
    add_timeline_column: "public/icons/tl_column.svg",
    add_notification_column: "public/icons/notice_column.svg",
    add_explore_column: "public/icons/exp_column.svg",
    add_lists_column: "public/icons/lists_column.svg",
    add_custom_url_column: "public/icons/custom_url_column.svg",
    column_single_rack: "public/icons/single_view.svg",
    column_second_rack: "public/icons/second_view.svg",
    profile_save: "public/icons/profile_save.svg",
    profile_delete: "public/icons/profile_delete.svg",
    refresh: "public/icons/refresh.svg",
    forward: "public/icons/forward.svg",
    next: "public/icons/next.svg",
    download: "public/icons/download.svg",
    switch_theme: "public/icons/switch_theme.svg",
};
export function create_sidebar_button_html(id, title, icon_class, label) {
    return `<div class="dsp_btn_parent" id="${id}" title="${title}"><div class="dsp_btn_icon_wrap"><div class="${icon_class}"></div></div><span class="dsp_btn_label">${label}</span></div>`;
}
export function profile_display_name(profile, index: number): string {
    const name = typeof profile?.name === "string" ? profile.name.trim() : "";
    return name || default_profile_name(index + 1);
}
function default_profile_name(number: number) {
    return i18n_message("ui_profile_switch_label", [String(number)]) || `Profile ${number}`;
}
export function next_profile_name(profiles): string {
    const names = new Set(profiles.map(profile_display_name));
    let number = 1;
    while (names.has(default_profile_name(number))) number++;
    return default_profile_name(number);
}
function escape_profile_name(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character]!,
    );
}
function create_profile_button_html(index, current_profile_index, profile) {
    const selected_profile_class =
        index === current_profile_index ? " dsp_btn_profile_selected" : "";
    const name = profile_display_name(profile, index);
    const initial = Array.from(name)[0];
    return `<div class="dsp_btn_parent${selected_profile_class}" title="${escape_profile_name(name)}" id="userProfile-${index}"><div class="dsp_btn_icon_wrap"><div class="dsp_btn_change_profile_btn">${escape_profile_name(initial)}</div></div><span class="dsp_btn_label">${escape_profile_name(name)}</span></div>`;
}
export function create_profile_list_buttons_html(
    profile_length,
    current_profile_index,
) {
    let profile_list_btn_html = "";
    for (let index = 0; index < profile_length; index++) {
        profile_list_btn_html += create_profile_button_html(
            index,
            current_profile_index,
            profile_store[index],
        );
    }
    return profile_list_btn_html;
}
export function create_profile_list_html(
    profile_length,
    current_profile_index,
) {
    return `<div class="dsp_profile_section"><div class="dsp_profile_list"><div id="profile_btn_list">${create_profile_list_buttons_html(profile_length, current_profile_index)}</div></div></div>`;
}
export function create_language_select_html() {
    const options = Object.entries(supported_languages).map(([code, name]) => `<option value="${code}" ${opd_i18n_language === code ? "selected" : ""}>${name}</option>`).join("");
    return `<div class="opd_language_select_wrap" title="${i18n_message("ui_language_selector_title")}"><hr class="opd_language_separator"><div class="opd_language_select_label">${i18n_message("ui_language_selector_label")}</div><select id="opd_language_select" class="opd_language_select"><option value="browser" ${opd_i18n_language === "browser" ? "selected" : ""}>${i18n_message("ui_language_option_system")}</option>${options}</select></div>`;
}
export function i18n_message_or_fallback(
    message_id: string,
    fallback_text: string,
) {
    const translated = i18n_message(message_id);
    return translated == "" ? fallback_text : translated;
}
let opd_dialog_queue: Promise<unknown> = Promise.resolve();
function ensure_opd_dialog_style() {
    if (document.querySelector("style[opd_dialog_css]") != null) {
        return;
    }
    const style = document.createElement("style");
    style.setAttribute("opd_dialog_css", "");
    style.textContent = `
    .opd_dialog_overlay{
        animation: opd_overlay_enter 160ms ease-out;
        box-sizing: border-box;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
    }
    .opd_dialog{
        animation: opd_dialog_enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
        box-sizing: border-box;
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        width: min(420px, 100%);
        background: #ffffff;
        color: #111827;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.28);
        padding: 24px;
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    @keyframes opd_overlay_enter{from{opacity:0;}to{opacity:1;}}
    @keyframes opd_dialog_enter{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    @media(prefers-reduced-motion:reduce){.opd_dialog_overlay,.opd_dialog{animation:none;}}
    .opd_dialog_message{
        margin: 0 0 12px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.5;
    }
    .opd_api_cards{display:grid;gap:12px;margin:16px 0;}
    .opd_api_card{border:1px solid #cbd5e1;border-radius:10px;padding:14px;background:linear-gradient(135deg,#f8fafc,#fff);}
    .opd_api_heading{display:flex;justify-content:space-between;gap:12px;font-weight:700;}
    .opd_api_name{display:flex;align-items:center;gap:8px;}
    .opd_api_icon{width:18px;height:18px;flex-shrink:0;}
    .opd_api_detail{margin:8px 0 0;font-size:13px;opacity:.8;}
    .opd_api_track{height:8px;margin-top:12px;border-radius:8px;background:#e2e8f0;overflow:hidden;}
    .opd_api_fill{height:100%;background:#16834a;}
    .opd_api_fill[data-level="amber"]{background:#b77909;}
    .opd_api_fill[data-level="red"]{background:#d33b36;}
    .opd_dialog_theme_dark .opd_api_card{border-color:#475569;background:linear-gradient(135deg,#243044,#1e293b);}
    .opd_dialog_theme_dark .opd_api_track{background:#475569;}
    .opd_dialog_input{
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 14px;
        color: #111827;
        margin-bottom: 12px;
    }
    .opd_dialog_input:focus{
        outline: 2px solid #60a5fa;
        outline-offset: 1px;
        border-color: #60a5fa;
    }
    .opd_dialog_actions{
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
    .opd_dialog_actions button{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #111827;
        border-radius: 8px;
        min-width: 72px;
        min-height: 36px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 13px;
        text-align: center;
        line-height: 1;
        white-space: nowrap;
        font-weight: 600;
    }
    .opd_dialog_actions button:hover{
        background: #eef2f7;
    }
    .opd_dialog_actions .opd_dialog_primary{
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
    }
    .opd_dialog_actions .opd_dialog_primary:hover{
        background: #1d4ed8;
    }
    .opd_about_dialog{
        width: min(760px, 100%);
        max-height: min(92vh, 700px);
        overflow: auto;
    }
    .opd_about_header{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.6rem;
    }
    .opd_about_title{
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: #111827;
    }
    .opd_about_close{
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        color: #111827;
        min-width: 34px;
        height: 34px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .opd_about_close:hover{
        background: #eef2f7;
    }
    .opd_about_close_icon{
        width: 14px;
        height: 14px;
        display: block;
        background-repeat: no-repeat;
        background-size: contain;
        background-position: center;
    }
    .opd_about_area1{
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.75rem;
    }
    .opd_about_logo{
        background-repeat: no-repeat;
        background-size: contain;
        background-position: center;
        width: 200px;
        min-width: 120px;
        min-height: 60px;
        height: 200px;
        cursor: default;
    }
    .opd_about_wordmark{
        width: 100%;
        max-width: 460px;
        margin-bottom: 0.5rem;
        font-size: clamp(2rem, 5vw, 3.8rem);
        line-height: 1.05;
        letter-spacing: 0.02em;
        font-weight: 900;
        color: #111827;
    }
    .opd_about_value{
        font-size: 1rem;
        color: #111827;
        margin-bottom: 0.25rem;
    }
    .opd_about_value span{
        margin-left: 0.5rem;
        font-weight: 700;
    }
    .opd_about_area2{
        margin-top: 0.9rem;
        display: flex;
        flex-wrap: wrap;
        row-gap: 0.8rem;
        column-gap: 1rem;
        justify-content: space-between;
    }
    .opd_about_area2 div{
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 170px;
        font-size: 1rem;
        color: #111827;
    }
    .opd_about_area2 a{
        color: #2563eb;
        text-decoration: underline;
    }
    .opd_about_area2 a:hover{
        color: #1d4ed8;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark{
        background: rgba(2, 6, 23, 0.68);
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog{
        background: #1b2330;
        color: #e5ebf3;
        border-color: #4a576b;
        box-shadow: 0 18px 44px rgba(2, 6, 23, 0.55);
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog_input{
        background: #111827;
        color: #e5ebf3;
        border-color: #4a576b;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog_actions button{
        background: #283140;
        color: #e5ebf3;
        border-color: #4a576b;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog_actions button:hover{
        background: #313c4d;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog_actions .opd_dialog_primary{
        background: #3b82f6;
        border-color: #3b82f6;
        color: #ffffff;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_dialog_actions .opd_dialog_primary:hover{
        background: #2563eb;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_title,
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_wordmark,
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_value,
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_area2 div{
        color: #e5ebf3;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_close{
        background: #283140;
        color: #e5ebf3;
        border-color: #4a576b;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_close:hover{
        background: #313c4d;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_close_icon{
        filter: brightness(0) saturate(100%) invert(98%);
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_logo{
        filter: brightness(0) saturate(100%) invert(98%);
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_area2 a{
        color: #7cb1ff;
    }
    .opd_dialog_overlay.opd_dialog_theme_dark .opd_about_area2 a:hover{
        color: #9dc2ff;
    }
    @media (max-width: 680px){
        .opd_about_area1{
            flex-direction: column;
            align-items: flex-start;
        }
        .opd_about_logo{
            width: 150px;
            height: 150px;
        }
        .opd_about_wordmark{
            max-width: 320px;
            font-size: clamp(1.8rem, 10vw, 3rem);
        }
        .opd_about_area2{
            justify-content: flex-start;
        }
    }`;
    document.head.appendChild(style);
}
function enqueue_opd_dialog<T>(task: () => Promise<T>): Promise<T> {
    const dialog_task = opd_dialog_queue.then(task, task);
    opd_dialog_queue = dialog_task.catch(() => {});
    return dialog_task;
}
function is_opd_dark_theme_enabled() {
    const main_element = document.getElementById("opd_main_element");
    return main_element?.getAttribute("opd-dsp-theme") === "dark";
}
export function open_opd_dialog({
    message,
    type,
    defaultValue,
    choices,
    mount,
}: {
    message: string;
    type: "alert" | "confirm" | "prompt" | "select";
    defaultValue?: string;
    choices?: { value: string; label: string }[];
    mount?: (dialog: HTMLDivElement) => (() => void);
}) {
    return enqueue_opd_dialog(
        () =>
            new Promise((resolve) => {
                ensure_opd_dialog_style();
                const overlay = document.createElement("div");
                overlay.className = "opd_dialog_overlay";
                if (is_opd_dark_theme_enabled()) {
                    overlay.classList.add("opd_dialog_theme_dark");
                }
                const dialog = document.createElement("div");
                dialog.className = "opd_dialog";
                dialog.setAttribute("role", "dialog");
                dialog.setAttribute("aria-modal", "true");
                const message_elem = document.createElement("p");
                message_elem.className = "opd_dialog_message";
                message_elem.textContent = `${message}`;
                dialog.appendChild(message_elem);
                const cleanup_content = mount?.(dialog);
                let prompt_input: HTMLInputElement | HTMLSelectElement | null =
                    null;
                if (type == "prompt") {
                    prompt_input = document.createElement("input");
                    prompt_input.className = "opd_dialog_input";
                    prompt_input.type = "text";
                    prompt_input.value = defaultValue ?? "";
                    dialog.appendChild(prompt_input);
                }
                if (type == "select") {
                    const select = document.createElement("select");
                    select.className = "opd_dialog_input";
                    select.setAttribute("aria-label", message);
                    for (const choice of choices ?? []) {
                        const option = document.createElement("option");
                        option.value = choice.value;
                        option.textContent = choice.label;
                        select.appendChild(option);
                    }
                    select.value = defaultValue ?? choices?.[0]?.value ?? "";
                    prompt_input = select;
                    dialog.appendChild(select);
                }
                const action_row = document.createElement("div");
                action_row.className = "opd_dialog_actions";
                const ok_button = document.createElement("button");
                ok_button.type = "button";
                ok_button.textContent = i18n_message_or_fallback(
                    "ui_dialog_ok_button",
                    "OK",
                );
                ok_button.className = "opd_dialog_primary";
                let cancel_button: HTMLButtonElement | null = null;
                if (type != "alert") {
                    cancel_button = document.createElement("button");
                    cancel_button.type = "button";
                    cancel_button.textContent = i18n_message_or_fallback(
                        "ui_dialog_cancel_button",
                        "Cancel",
                    );
                    action_row.appendChild(cancel_button);
                }
                action_row.appendChild(ok_button);
                dialog.appendChild(action_row);
                overlay.appendChild(dialog);
                const previous_active_element = document.activeElement;
                document.body.appendChild(overlay);
                const get_focusable_elements = (): HTMLElement[] =>
                    Array.from(
                        dialog.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                        ),
                    ).filter(
                        (elem): elem is HTMLElement =>
                            elem instanceof HTMLElement &&
                            !elem.hasAttribute("disabled"),
                    );

                let closing = false;
                const finish = async (result: void | boolean | string | null) => {
                    if (closing) return;
                    closing = true;
                    cleanup_content?.();
                    await animate_dialog_exit(overlay, dialog);
                    document.removeEventListener("keydown", key_listener, true);
                    overlay.remove();
                    if (previous_active_element instanceof HTMLElement) {
                        previous_active_element.focus();
                    }
                    resolve(result);
                };
                const key_listener = (event: KeyboardEvent) => {
                    if (closing) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    if (event.isComposing || event.keyCode == 229) {
                        return;
                    }
                    if (event.key == "Tab") {
                        const focusable_elements = get_focusable_elements();
                        if (focusable_elements.length == 0) {
                            event.preventDefault();
                            return;
                        }
                        const first_elem = focusable_elements[0] as HTMLElement;
                        const last_elem = focusable_elements[
                            focusable_elements.length - 1
                        ] as HTMLElement;
                        const active_elem = document.activeElement;
                        if (event.shiftKey) {
                            if (
                                active_elem == first_elem ||
                                !dialog.contains(active_elem)
                            ) {
                                event.preventDefault();
                                last_elem.focus();
                            }
                        } else {
                            if (
                                active_elem == last_elem ||
                                !dialog.contains(active_elem)
                            ) {
                                event.preventDefault();
                                first_elem.focus();
                            }
                        }
                        return;
                    }
                    if (event.key == "Escape" && type != "alert") {
                        event.preventDefault();
                        event.stopPropagation();
                        finish(type == "confirm" ? false : null);
                    } else if (event.key == "Enter") {
                        if (
                            type == "select" &&
                            document.activeElement == prompt_input
                        ) {
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (
                            cancel_button != null &&
                            document.activeElement == cancel_button
                        ) {
                            finish(type == "confirm" ? false : null);
                        } else if (type == "confirm") {
                            finish(true);
                        } else if (type == "prompt" || type == "select") {
                            finish(prompt_input?.value ?? "");
                        } else {
                            finish(undefined);
                        }
                    }
                };

                document.addEventListener("keydown", key_listener, true);

                ok_button.addEventListener("click", () => {
                    if (type == "confirm") {
                        finish(true);
                    } else if (type == "prompt" || type == "select") {
                        finish(prompt_input?.value ?? "");
                    } else {
                        finish(undefined);
                    }
                });
                if (cancel_button != null) {
                    cancel_button.addEventListener("click", () => {
                        finish(type == "confirm" ? false : null);
                    });
                }
                if (prompt_input != null) {
                    prompt_input.focus();
                    if (type == "prompt") {
                        (prompt_input as HTMLInputElement).select();
                    }
                } else {
                    ok_button.focus();
                }
            }),
    );
}
export async function opd_alert(message: string): Promise<void> {
    await open_opd_dialog({ message, type: "alert" });
}
export async function opd_confirm(message: string): Promise<boolean> {
    const result = await open_opd_dialog({ message, type: "confirm" });
    return result === true;
}
export async function opd_prompt(
    message: string,
    defaultValue = "",
): Promise<string | null> {
    const result = await open_opd_dialog({
        message,
        type: "prompt",
        defaultValue,
    });
    return typeof result === "string" ? result : null;
}
export async function open_about_page_modal() {
    return enqueue_opd_dialog(
        () =>
            new Promise<void>((resolve) => {
                ensure_opd_dialog_style();
                const overlay = document.createElement("div");
                overlay.className = "opd_dialog_overlay";
                if (is_opd_dark_theme_enabled()) {
                    overlay.classList.add("opd_dialog_theme_dark");
                }
                const dialog = document.createElement("div");
                dialog.className = "opd_dialog opd_about_dialog";
                dialog.setAttribute("role", "dialog");
                dialog.setAttribute("aria-modal", "true");
                const header = document.createElement("div");
                header.className = "opd_about_header";
                const title = document.createElement("h2");
                title.className = "opd_about_title";
                title.textContent = i18n_message_or_fallback(
                    "ui_about_title",
                    "About",
                );
                const close_button = document.createElement("button");
                close_button.type = "button";
                close_button.className = "opd_about_close";
                close_button.setAttribute(
                    "aria-label",
                    i18n_message_or_fallback(
                        "ui_dialog_cancel_button",
                        "Close",
                    ),
                );
                const close_icon = document.createElement("span");
                close_icon.className = "opd_about_close_icon";
                close_icon.style.backgroundImage = `url(${chrome.runtime.getURL(ui_icon_define.column_close)})`;
                close_button.appendChild(close_icon);
                header.appendChild(title);
                header.appendChild(close_button);

                const body_top = document.createElement("section");
                body_top.className = "opd_about_area1";
                const logo = document.createElement("div");
                logo.className = "opd_about_logo";
                logo.style.backgroundImage = `url(${chrome.runtime.getURL("public/icons/logo_icon.svg")})`;
                const body_top_right = document.createElement("div");
                const wordmark = document.createElement("div");
                wordmark.className = "opd_about_wordmark";
                wordmark.textContent = "XPP-Deck";
                const version = document.createElement("div");
                version.className = "opd_about_value";
                version.innerHTML = `${i18n_message_or_fallback("ui_about_version_label", "Version")}:<span>${chrome.runtime.getManifest().version}</span>`;
                body_top_right.appendChild(wordmark);
                body_top_right.appendChild(version);
                body_top.appendChild(logo);
                body_top.appendChild(body_top_right);

                const body_links = document.createElement("section");
                body_links.className = "opd_about_area2";
                body_links.innerHTML = `
                    <div>${i18n_message_or_fallback("ui_about_original_dev_label", "Original Dev")}<br /><a href="https://twitter.com/kw_nobu2" target="_blank" rel="noopener noreferrer">kawa-nobu</a></div>
                    <div>${i18n_message_or_fallback("ui_about_github_label", "GitHub")}<br /><a href="https://github.com/kawa-nobu/Open-Deck" target="_blank" rel="noopener noreferrer">XPP-Deck</a></div>
                    <div>${i18n_message_or_fallback("ui_about_changelog_label", "Change Log")}<br /><a href="https://github.com/kawa-nobu/Open-Deck/releases" target="_blank" rel="noopener noreferrer">${i18n_message_or_fallback("ui_about_releases_label", "Releases")}</a></div>
                `;

                dialog.appendChild(header);
                dialog.appendChild(body_top);
                dialog.appendChild(body_links);
                overlay.appendChild(dialog);
                const previous_active_element = document.activeElement;
                document.body.appendChild(overlay);

                const get_focusable_elements = (): HTMLElement[] =>
                    Array.from(
                        dialog.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                        ),
                    ).filter(
                        (elem): elem is HTMLElement =>
                            elem instanceof HTMLElement &&
                            !elem.hasAttribute("disabled"),
                    );

                let closing = false;
                const finish = async () => {
                    if (closing) return;
                    closing = true;
                    await animate_dialog_exit(overlay, dialog);
                    document.removeEventListener("keydown", key_listener, true);
                    overlay.remove();
                    if (previous_active_element instanceof HTMLElement) {
                        previous_active_element.focus();
                    }
                    resolve(undefined);
                };
                const key_listener = (event: KeyboardEvent) => {
                    if (closing) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    if (event.isComposing || event.keyCode == 229) {
                        return;
                    }
                    if (event.key == "Tab") {
                        const focusable_elements = get_focusable_elements();
                        if (focusable_elements.length == 0) {
                            event.preventDefault();
                            return;
                        }
                        const first_elem = focusable_elements[0] as HTMLElement;
                        const last_elem = focusable_elements[
                            focusable_elements.length - 1
                        ] as HTMLElement;
                        const active_elem = document.activeElement;
                        if (event.shiftKey) {
                            if (
                                active_elem == first_elem ||
                                !dialog.contains(active_elem)
                            ) {
                                event.preventDefault();
                                last_elem.focus();
                            }
                        } else {
                            if (
                                active_elem == last_elem ||
                                !dialog.contains(active_elem)
                            ) {
                                event.preventDefault();
                                first_elem.focus();
                            }
                        }
                        return;
                    }
                    if (event.key == "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        finish();
                    }
                };
                document.addEventListener("keydown", key_listener, true);
                close_button.addEventListener("click", finish);
                overlay.addEventListener("click", (event) => {
                    if (event.target == overlay) {
                        finish();
                    }
                });
                close_button.focus();
            }),
    );
}
// Convert UNIX timestamp to local time string.
function unix_time_mmss(input) {
    const date = new Date(input * 1000);
    return date.toLocaleTimeString(formatting_locale());
}
// Track whether the Shift key is pressed for shortcuts.
document.addEventListener("keydown", (event) => {
    if (event.key === "Shift") is_shift_pressed = true;
});
document.addEventListener("keyup", (event) => {
    if (event.key === "Shift") is_shift_pressed = false;
});
// Watch storage updates (mainly for API rate-limit status).
export let api_limit_obj: ApiAccessLimit | null = null;
let rate_limit_until = 0;
chrome.storage.local.get("opd_rate_limit_until", (value) => {
    rate_limit_until = Math.max(rate_limit_until, Number(value.opd_rate_limit_until) || 0);
});
export function api_refresh_paused() {
    return Date.now() < rate_limit_until;
}
function api_icon_path(index: number) {
    const paths = [
        "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
        "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z",
        "M21 21l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0",
    ];
    return paths[index];
}
export function create_api_sidebar_html() {
    return `<div id="api_limit_status_button" class="opd_api_sidebar"><span class="opd_api_sidebar_heading">${escape_profile_name(i18n_message_or_fallback("ui_button_api_usage_label", "API Usage"))}</span>${(["time_line", "recommend_timeline", "search"] as const).map((key, index) => `<button type="button" class="opd_api_sidebar_row" data-api-key="${key}"><svg class="opd_api_sidebar_icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${api_icon_path(index)}"/></svg><span class="opd_api_sidebar_label"></span><span class="opd_api_sidebar_value"></span></button>`).join("")}</div>`;
}
export function update_api_sidebar() {
    for (const [key, label] of [["time_line", "ui_api_following"], ["recommend_timeline", "ui_api_for_you"], ["search", "ui_api_search"]] as const) {
        const row = document.querySelector<HTMLElement>(`[data-api-key="${key}"]`);
        if (!row) continue;
        const name = i18n_message(label);
        const quota = api_quota_state(api_limit_obj?.[key]);
        const status = quota ? i18n_message("ui_api_percent_left", [String(Math.floor(quota.percentage))]) : i18n_message("ui_api_no_data");
        row.querySelector(".opd_api_sidebar_label")!.textContent = name;
        row.querySelector(".opd_api_sidebar_value")!.textContent = quota ? `${Math.floor(quota.percentage)}%` : "—";
        row.dataset.level = quota?.level ?? "unknown";
        row.title = `${name}: ${status}`;
        row.setAttribute("aria-label", row.title);
    }
}
export function api_quota_state(value: ApiAccessLimit["search"] | undefined) {
    if (value?.limit == null || value.remaining == null) return null;
    const limit = Number(value.limit);
    const remaining = Number(value.remaining);
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining) || remaining < 0) return null;
    const percentage = Math.min(100, Math.max(0, remaining / limit * 100));
    return { limit, remaining, percentage, level: percentage > 50 ? "green" : percentage >= 20 ? "amber" : "red" };
}
export async function open_api_limits_dialog() {
    await open_opd_dialog({
        type: "alert",
        message: i18n_message("ui_api_limits_title"),
        mount: (dialog) => {
            const description = document.createElement("p");
            description.className = "opd_api_detail";
            description.style.whiteSpace = "pre-line";
            description.textContent = i18n_message("ui_api_limits_description");
            dialog.appendChild(description);
            const cards = document.createElement("div");
            cards.className = "opd_api_cards";
            dialog.appendChild(cards);
            const render = () => {
                cards.replaceChildren();
                for (const [key, label] of [["time_line", "ui_api_following"], ["recommend_timeline", "ui_api_for_you"], ["search", "ui_api_search"]] as const) {
                    const card = document.createElement("section");
                    card.className = "opd_api_card";
                    const heading = document.createElement("div");
                    heading.className = "opd_api_heading";
                    const name = document.createElement("span");
                    name.className = "opd_api_name";
                    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    for (const [attribute, value] of Object.entries({class: "opd_api_icon", viewBox: "0 0 24 24", "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round"})) {
                        icon.setAttribute(attribute, value);
                    }
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", api_icon_path(["time_line", "recommend_timeline", "search"].indexOf(key)));
                    icon.appendChild(path);
                    name.textContent = i18n_message(label);
                    name.prepend(icon);
                    const status = document.createElement("span");
                    const value = api_limit_obj?.[key];
                    const quota = api_quota_state(value);
                    status.textContent = quota ? i18n_message("ui_api_percent_left", [String(Math.floor(quota.percentage))]) : i18n_message("ui_api_no_data");
                    heading.append(name, status);
                    card.appendChild(heading);
                    if (quota) {
                        const track = document.createElement("div");
                        track.className = "opd_api_track";
                        track.setAttribute("role", "progressbar");
                        track.setAttribute("aria-label", i18n_message(label));
                        track.setAttribute("aria-valuemin", "0");
                        track.setAttribute("aria-valuemax", String(quota.limit));
                        track.setAttribute("aria-valuenow", String(Math.min(quota.remaining, quota.limit)));
                        const fill = document.createElement("div");
                        fill.className = "opd_api_fill";
                        fill.dataset.level = quota.level;
                        fill.style.width = `${quota.percentage}%`;
                        track.appendChild(fill);
                        const detail = document.createElement("p");
                        detail.className = "opd_api_detail";
                        detail.textContent = i18n_message("ui_api_remaining", [quota.remaining.toLocaleString(formatting_locale()), quota.limit.toLocaleString(formatting_locale())]);
                        card.append(track, detail);
                        const reset = value?.reset_unix_time;
                        const date = new Date(Number(reset) * 1000);
                        if (reset != null && Number.isFinite(date.getTime())) {
                            const time = document.createElement("p");
                            time.className = "opd_api_detail";
                            time.textContent = i18n_message("ui_api_reset", [date.toLocaleTimeString(formatting_locale(), { hour: "numeric", minute: "2-digit" })]);
                            card.appendChild(time);
                        }
                    }
                    cards.appendChild(card);
                }
            };
            const listener = (changes: ChromeStorageChanges) => {
                if (changes.api_access_limit) {
                    api_limit_obj = (changes.api_access_limit.newValue ?? null) as ApiAccessLimit | null;
                    render();
                }
            };
            render();
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        },
    });
}
export let api_limit_dsc_obj = {
    time_line: "",
    recommend_timeline: "",
    search: "",
};
type ApiAccessLimit = {
    search: {
        limit: number | string | null;
        remaining: number | string | null;
        reset_unix_time: number | string | null;
    };
    time_line: {
        limit: number | string | null;
        remaining: number | string | null;
        reset_unix_time: number | string | null;
    };
    recommend_timeline: {
        limit: number | string | null;
        remaining: number | string | null;
        reset_unix_time: number | string | null;
    };
};
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.opd_rate_limit_until) {
        rate_limit_until = Math.max(rate_limit_until, Number(changes.opd_rate_limit_until.newValue) || 0);
    }
    if (changes.api_access_limit != undefined) {
        //console.log(changes)
        api_limit_obj = (changes.api_access_limit.newValue ??
            null) as ApiAccessLimit | null;
        update_api_sidebar();
        const api_linit_status_btn =
            document.querySelector("#api_limit_status");
        if (api_limit_obj == null) {
            return;
        }
        if (api_linit_status_btn instanceof HTMLElement) {
            const api_limit_status_element = api_linit_status_btn;
            let timeline_limit_percentage = 99999;
            let recommend_timeline_limit_percentage = 99999;
            let search_limit_percentage = 99999;
            if (api_limit_obj.time_line.remaining != null) {
                timeline_limit_percentage =
                    (Number(api_limit_obj.time_line.remaining) /
                        Number(api_limit_obj.time_line.limit)) *
                    100;
                api_limit_dsc_obj.time_line = `${i18n_message("label_api_timeline")}${api_limit_obj.time_line.remaining}/${api_limit_obj.time_line.limit}-${unix_time_mmss(api_limit_obj.time_line.reset_unix_time)}\r\n`;
            } else {
                // Initial state.
            }
            if (api_limit_obj.recommend_timeline.remaining != null) {
                recommend_timeline_limit_percentage =
                    (Number(api_limit_obj.recommend_timeline.remaining) /
                        Number(api_limit_obj.recommend_timeline.limit)) *
                    100;
                api_limit_dsc_obj.recommend_timeline = `${i18n_message("label_api_recommend_timeline")}${api_limit_obj.recommend_timeline.remaining}/${api_limit_obj.recommend_timeline.limit}-${unix_time_mmss(api_limit_obj.recommend_timeline.reset_unix_time)}\r\n`;
            } else {
                // Initial state.
            }
            if (api_limit_obj.search.remaining != null) {
                search_limit_percentage =
                    (Number(api_limit_obj.search.remaining) /
                        Number(api_limit_obj.search.limit)) *
                    100;
                api_limit_dsc_obj.search = `${i18n_message("label_api_search")}${api_limit_obj.search.remaining}/${api_limit_obj.search.limit}-${unix_time_mmss(api_limit_obj.search.reset_unix_time)}`;
            } else {
                // Initial state.
            }
            api_limit_status_element.textContent = `${Math.floor(Math.min(timeline_limit_percentage, recommend_timeline_limit_percentage, search_limit_percentage))}%`;
            api_limit_status_element.title = `${i18n_message("msg_api_limit_status_title", [`${api_limit_dsc_obj.time_line}${api_limit_dsc_obj.recommend_timeline}${api_limit_dsc_obj.search}`])}`;
        }
    }
});
//
export async function initialize_content(
    run: typeof import("./run").run,
    settings_init: typeof import("./settings").settings_init,
) {
    if (is_deck_location(location.href)) {
        await chrome.runtime.sendMessage({ message: "dnr_upd" });
        init();
        function init() {
            //console.log("Welcome to XPP-Deck!");
            chrome.storage.local.get("opd_settings", async function (value) {
                if (value.opd_settings == undefined) {
                    last_load_profile = 0;
                    settings_init();
                    return;
                } else {
                    const opd_settings_raw = String(value.opd_settings);
                    if (
                        JSON.parse(opd_settings_raw).last_load_profile ==
                        undefined
                    ) {
                        if (
                            await opd_confirm(
                                i18n_message("msg_profile_data_broken_confirm"),
                            )
                        ) {
                            chrome.storage.local.remove(
                                "opd_settings",
                                async function () {
                                    await opd_alert(
                                        i18n_message(
                                            "msg_profile_init_completed",
                                        ),
                                    );
                                },
                            );
                        } else {
                            last_load_profile = 0;
                        }
                    } else {
                        last_load_profile =
                            JSON.parse(opd_settings_raw).last_load_profile;
                    }
                    //console.log(last_load_profile);
                }

                chrome.storage.local.get(
                    "opd_profile_store",
                    async function (store_value) {
                        //console.log(store_value)
                        //console.log(JSON.parse(store_value.opd_profile_store))
                        profile_store = JSON.parse(
                            String(store_value.opd_profile_store),
                        );
                        //RUN
                        let ext_update_flag: boolean | null = null;
                        let ext_settings;
                        if (value.opd_settings != undefined) {
                            if (
                                JSON.parse(String(value.opd_settings))
                                    .version != manifest.version
                            ) {
                                ext_update_flag = true;
                            } else {
                                ext_update_flag = false;
                            }
                        }
                        if (
                            value.opd_settings == undefined ||
                            ext_update_flag == true
                        ) {
                            //settings_init();
                            //ext_settings = JSON.parse(value.opd_settings);
                            if (
                                profile_store[last_load_profile]?.profile ==
                                undefined
                            ) {
                                let recovery_setting = JSON.parse(
                                    String(value.opd_settings),
                                );
                                recovery_setting.last_load_profile = 0;
                                chrome.storage.local.set(
                                    {
                                        opd_settings:
                                            JSON.stringify(recovery_setting),
                                    },
                                    async function () {
                                        await opd_alert(
                                            i18n_message(
                                                "msg_settings_auto_repair",
                                            ),
                                        );
                                        last_load_profile = 0;
                                        request_page_reload();
                                    },
                                );
                            }

                            // Bump settings version when the extension is updated.
                            if (ext_update_flag) {
                                const setting = JSON.parse(
                                    String(value.opd_settings),
                                );
                                setting.version = manifest.version;
                                chrome.storage.local.set(
                                    { opd_settings: JSON.stringify(setting) },
                                    async function () {
                                        if (
                                            await opd_confirm(
                                                i18n_message("app_update"),
                                            )
                                        ) {
                                            open(
                                                `https://github.com/kawa-nobu/Open-Deck/releases/tag/v${manifest.version}`,
                                                "_blank",
                                                "popup",
                                            );
                                        }
                                    },
                                );
                            }
                            ext_settings = {
                                column_settings:
                                    profile_store[last_load_profile].profile,
                            };
                        } else {
                            //ext_settings = JSON.parse(value.opd_settings);
                            if (
                                profile_store[last_load_profile]?.profile ==
                                undefined
                            ) {
                                let recovery_setting = JSON.parse(
                                    String(value.opd_settings),
                                );
                                recovery_setting.last_load_profile = 0;
                                chrome.storage.local.set(
                                    {
                                        opd_settings:
                                            JSON.stringify(recovery_setting),
                                    },
                                    async function () {
                                        await opd_alert(
                                            i18n_message(
                                                "msg_settings_auto_repair",
                                            ),
                                        );
                                        last_load_profile = 0;
                                        request_page_reload();
                                    },
                                );
                            }
                            ext_settings = {
                                column_settings:
                                    profile_store[last_load_profile].profile,
                            };
                        }
                        //console.log(ext_settings);
                        run(ext_settings);
                    },
                );
            });
        }
    }
}
export function set_last_load_profile(value: number) {
    last_load_profile = value;
}
