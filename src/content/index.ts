import {
    initialize_content,
    initialize_i18n_override,
    i18n_message_or_fallback,
    request_page_reload,
} from "./prelude";
import { run } from "./run";
import { settings_init } from "./settings";
import { is_deck_location, mount_session_gate } from "./session";

export function start_content() {
    if (!is_deck_location(location.href)) return () => {};
    const gate = mount_session_gate({
        message: i18n_message_or_fallback,
        start: () => initialize_content(run, settings_init),
        reload: request_page_reload,
    });
    void initialize_i18n_override().then(() => gate.check());
    return () => gate.dispose();
}
