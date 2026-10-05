import {
    i18n_message,
    manifest,
    opd_alert,
    opd_bootstrap,
    opd_root_theme_attribute,
    request_page_reload,
    system_dark_query,
} from "./prelude";
let is_added_system_color_mode = false;
let apply_ui_color: (() => void) | null = null;
export function apply_theme_for_main_element(main_element) {
    if (!main_element) {
        return;
    }

    const color_mode = get_cookie_color_mode();

    switch (color_mode) {
        case "system": {
            apply_ui_color = () => {
                const currentScheme = system_dark_query.matches
                    ? "dark"
                    : "light";
                main_element.setAttribute("opd-dsp-theme", currentScheme);
                document.documentElement.setAttribute(
                    opd_root_theme_attribute,
                    currentScheme,
                );
            };

            apply_ui_color();

            if (!is_added_system_color_mode) {
                system_dark_query.addEventListener("change", apply_ui_color);
                is_added_system_color_mode = true;
            }
            break;
        }
        case "light":
            if (is_added_system_color_mode && apply_ui_color) {
                system_dark_query.removeEventListener("change", apply_ui_color);
                is_added_system_color_mode = false;
            }
            main_element.setAttribute("opd-dsp-theme", "light");
            document.documentElement.setAttribute(
                opd_root_theme_attribute,
                "light",
            );
            break;

        case "dark":
            if (is_added_system_color_mode && apply_ui_color) {
                system_dark_query.removeEventListener("change", apply_ui_color);
                is_added_system_color_mode = false;
            }
            main_element.setAttribute("opd-dsp-theme", "dark");
            document.documentElement.setAttribute(
                opd_root_theme_attribute,
                "dark",
            );
            break;

        default:
            break;
    }
}
// Get color mode from cookie.
export function get_cookie_color_mode() {
    if (typeof opd_bootstrap.getCookieColorMode === "function") {
        try {
            return opd_bootstrap.getCookieColorMode();
        } catch {
            // no-op: fallback to local cookie parsing
        }
    }
    const cookie = document.cookie
        .split(/;\s*/)
        .find((c) => c.startsWith("night_mode="));

    if (!cookie) return "system";

    const color_mode_number = Number(cookie.split("=")[1]);
    if (!Number.isInteger(color_mode_number)) return "system";
    if (color_mode_number <= 0) return "light";
    return "dark";
}
// Initialize settings.
export function settings_init() {
    const profile_store_default = [
        {
            type: "main_bar_empty_column",
            banner: false,
            tw_view_mode: "0",
            column_save_path: "",
            column_save_title: "",
            column_pinned_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_width: null,
        },
        {
            type: "home",
            banner: true,
            tw_view_mode: "0",
            column_save_path: "",
            column_save_title: "",
            column_pinned_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_width: null,
        },
        {
            type: "notification",
            banner: false,
            tw_view_mode: "0",
            column_save_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_pinned_path: "",
            column_save_title: "",
            column_width: null,
        },
        {
            type: "explore",
            banner: false,
            tw_view_mode: "0",
            exp_type: "",
            column_save_path: "/explore",
            column_save_title: "",
            column_pinned_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_width: null,
        },
        {
            type: "empty_column",
            banner: false,
            tw_view_mode: "0",
            column_save_path: "",
            column_save_title: "",
            column_pinned_path: "",
            auto_reload: false,
            auto_reload_time: 10000,
            column_width: null,
        },
    ];
    const settings = {
        last_load_profile: 0,
        //column_settings:[{type:"main_bar_empty_column", banner:false, top_visible:true, tw_view_mode:"0", column_save_path:"", column_pinned_path:"", column_width:null}, {type:"home", banner:true, top_visible:true, tw_view_mode:"0", column_save_path:"", column_pinned_path:"", column_width:null}, {type:"notification", banner:false, top_visible:true, tw_view_mode:"0", column_save_path:"", column_pinned_path:"", column_width:null}, {type:"explore", banner:false, top_visible:true, tw_view_mode:"0", exp_type:"", column_save_path:"/explore", column_pinned_path:"", column_width:null}, {type:"empty_column", banner:false, top_visible:true, tw_view_mode:"0", column_save_path:"", column_pinned_path:"", column_width:null}],
        version: manifest.version,
    };
    let profile = [{ name: i18n_message("ui_profile_switch_label", ["1"]), profile: profile_store_default }];
    //console.log(profile);
    chrome.storage.local.set(
        { opd_profile_store: JSON.stringify(profile) },
        function () {
            chrome.storage.local.set(
                { opd_settings: JSON.stringify(settings) },
                async function () {
                    await opd_alert(
                        i18n_message("msg_initial_setup_completed"),
                    );

                    request_page_reload();
                },
            );
        },
    );
}

export function stop_system_theme_listener() {
    if (is_added_system_color_mode && apply_ui_color) {
        system_dark_query.removeEventListener("change", apply_ui_color);
        is_added_system_color_mode = false;
    }
}
