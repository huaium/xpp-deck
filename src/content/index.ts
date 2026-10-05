import {
    initialize_content,
    initialize_i18n_override,
    i18n_message_or_fallback,
    request_page_reload,
} from "./prelude";
import { run } from "./run";
import { settings_init } from "./settings";
import { is_deck_location, mount_session_gate } from "./session";
import { keep_deck_tab_title } from "./tab-title";
import { ensure_dropdown_style } from "./dropdown-style";
import { mount_webawesome_controls } from "./webawesome";

export function start_content() {
    if (!is_deck_location(location.href)) return () => {};
    ensure_dropdown_style();
    const stop_controls = mount_webawesome_controls();
    const stop_title = keep_deck_tab_title(chrome.runtime.getURL("icon.png"));
    const gate = mount_session_gate({
        message: i18n_message_or_fallback,
        start: () => initialize_content(run, settings_init),
        reload: request_page_reload,
    });
    void initialize_i18n_override().then(() => gate.check());
    return () => {
        gate.dispose();
        stop_title();
        stop_controls();
    };
}
