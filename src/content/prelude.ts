export const manifest = chrome.runtime.getManifest();
// Print welcome messages to console
console.log("Welcome to XPP-Deck!");
console.log(`Version: ${manifest.version}`);
//
const url_path = new URL(location.href);
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
export let opd_i18n_language = "browser";
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
    return chrome.i18n.getMessage(message_name, substitutions);
}
function get_storage_local_async(
    key: string,
): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (value) => resolve(value));
    });
}
async function initialize_i18n_override() {
    const language_setting = await get_storage_local_async(
        "opd_language_override",
    );
    const language_setting_record = language_setting as Record<string, unknown>;
    const selected_language =
        typeof language_setting_record.opd_language_override === "string"
            ? language_setting_record.opd_language_override
            : "browser";
    opd_i18n_language = selected_language;
    if (selected_language === "browser") {
        opd_i18n_override_messages = null;
        return;
    }
    try {
        const response = await fetch(
            chrome.runtime.getURL(
                `_locales/${selected_language}/messages.json`,
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
    return name || `Profile ${index + 1}`;
}
export function next_profile_name(profiles): string {
    const names = new Set(profiles.map(profile_display_name));
    let number = 1;
    while (names.has(`Profile ${number}`)) number++;
    return `Profile ${number}`;
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
    return `<div class="opd_language_select_wrap" title="${i18n_message_or_fallback("ui_language_selector_title", "Language")}"><hr class="opd_language_separator"><div class="opd_language_select_label">${i18n_message_or_fallback("ui_language_selector_label", "Language")}</div><select id="opd_language_select" class="opd_language_select"><option value="browser" ${opd_i18n_language === "browser" ? "selected" : ""}>${i18n_message_or_fallback("ui_language_option_system", "System")}</option><option value="en" ${opd_i18n_language === "en" ? "selected" : ""}>${i18n_message_or_fallback("ui_language_option_english", "English")}</option><option value="ja" ${opd_i18n_language === "ja" ? "selected" : ""}>${i18n_message_or_fallback("ui_language_option_japanese", "Japanese")}</option></select></div>`;
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
    .opd_dialog_message{
        margin: 0 0 12px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.5;
    }
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
}: {
    message: string;
    type: "alert" | "confirm" | "prompt" | "select";
    defaultValue?: string;
    choices?: { value: string; label: string }[];
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

                const finish = (result: void | boolean | string | null) => {
                    document.removeEventListener("keydown", key_listener, true);
                    overlay.remove();
                    if (previous_active_element instanceof HTMLElement) {
                        previous_active_element.focus();
                    }
                    resolve(result);
                };
                const key_listener = (event: KeyboardEvent) => {
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

                const finish = () => {
                    document.removeEventListener("keydown", key_listener, true);
                    overlay.remove();
                    if (previous_active_element instanceof HTMLElement) {
                        previous_active_element.focus();
                    }
                    resolve(undefined);
                };
                const key_listener = (event: KeyboardEvent) => {
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
    return date.toLocaleTimeString();
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
    if (changes.api_access_limit != undefined) {
        //console.log(changes)
        api_limit_obj = (changes.api_access_limit.newValue ??
            null) as ApiAccessLimit | null;
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
export function initialize_content(
    run: typeof import("./run").run,
    settings_init: typeof import("./settings").settings_init,
) {
    if (
        location.href == "https://twitter.com/run-opdeck" ||
        location.href == "https://x.com/run-opdeck"
    ) {
        //testmode
        if (url_path.pathname == "/run-opdeck_test.html") {
            //init();
            console.log("testmode");
            chrome.runtime
                .sendMessage({ message: "dnr_upd_internal_dsp" })
                .then(() => {
                    init();
                });
        } else {
            if (navigator.brave != undefined) {
                chrome.runtime.sendMessage({ message: "dnr_upd" }).then(() => {
                    init();
                });
                //init();
            } else {
                chrome.runtime.sendMessage({ message: "dnr_upd" }).then(() => {
                    init();
                });
            }
        }
        //chrome.runtime.sendMessage({message: "dnr_upd"});
        function init() {
            //console.log("Welcome to XPP-Deck!");
            chrome.storage.local.get("opd_settings", async function (value) {
                await initialize_i18n_override();
                if (value.opd_settings == undefined) {
                    last_load_profile = 0;
                    settings_init();
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
