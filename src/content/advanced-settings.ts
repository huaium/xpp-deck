import type WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import type WaButton from "@awesome.me/webawesome/dist/components/button/button.js";
import { i18n_message } from "./prelude";
import {
    loading_preferences,
    default_loading_preferences,
    parse_loading_preferences,
    apply_loading_preferences,
    type LoadingPreferences,
} from "./loading-preferences";

export function mount_advanced_settings(
    parent: HTMLElement,
    scheduler: { configure: (value: LoadingPreferences) => void },
    signal: AbortSignal,
) {
    const toggle = document.createElement("wa-button") as WaButton;
    toggle.className = "xpd_advanced_toggle";
    toggle.appearance = "plain";
    toggle.textContent = i18n_message("ui_advanced_settings");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "xpd_advanced_settings");
    const panel = document.createElement("section");
    panel.id = "xpd_advanced_settings";
    panel.className = "xpd_advanced_settings";
    panel.hidden = true;
    const controls: WaInput[] = [];
    for (const [key, id, minimum, maximum, step] of [
        ["concurrency", "ui_advanced_concurrency", 1, 2, 1],
        ["minGapMs", "ui_advanced_min_gap", 0.5, 60, 0.1],
        ["maxGapMs", "ui_advanced_max_gap", 0.5, 60, 0.1],
        ["timeoutMs", "ui_advanced_timeout", 5, 120, 0.1],
    ] as const) {
        const row = document.createElement("label");
        row.className = "xpd_global_setting_row";
        const label = document.createElement("span");
        label.textContent = i18n_message(id);
        const input = document.createElement("wa-input") as WaInput;
        input.type = "number";
        input.id = "xpd_advanced_" + key;
        input.min = minimum;
        input.max = maximum;
        input.step = step;
        input.setAttribute("aria-label", label.textContent);
        row.append(label, input);
        panel.appendChild(row);
        controls.push(input);
    }
    function fill(value: LoadingPreferences) {
        controls[0].value = String(value.concurrency);
        controls[1].value = String(value.minGapMs / 1000);
        controls[2].value = String(value.maxGapMs / 1000);
        controls[3].value = String(value.timeoutMs / 1000);
    }
    fill(loading_preferences);
    const help = document.createElement("p");
    help.className = "xpd_api_detail";
    help.textContent = i18n_message("ui_advanced_help");
    const status = document.createElement("p");
    status.className = "xpd_api_detail";
    status.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "xpd_advanced_actions";
    const save = document.createElement("wa-button") as WaButton;
    save.textContent = i18n_message("ui_advanced_save");
    const defaults = document.createElement("wa-button") as WaButton;
    defaults.appearance = "outlined";
    defaults.textContent = i18n_message("ui_advanced_defaults");
    actions.append(defaults, save);
    panel.append(help, actions, status);
    parent.append(toggle, panel);
    toggle.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });
    defaults.addEventListener("click", () => {
        fill(default_loading_preferences);
        status.textContent = "";
    });
    save.addEventListener("click", async () => {
        if (signal.aborted || save.disabled) return;
        const value = parse_loading_preferences({
            concurrency: Number(controls[0].value),
            minGapMs: Math.round(Number(controls[1].value) * 1000),
            maxGapMs: Math.round(Number(controls[2].value) * 1000),
            timeoutMs: Math.round(Number(controls[3].value) * 1000),
        });
        if (!value) {
            status.textContent = i18n_message("ui_advanced_invalid");
            return;
        }
        save.disabled = true;
        defaults.disabled = true;
        controls.forEach((control) => {
            control.disabled = true;
        });
        try {
            await new Promise<void>((resolve, reject) =>
                chrome.storage.local.set(
                    { xpd_loading_preferences: value },
                    () => {
                        if (chrome.runtime.lastError)
                            reject(new Error(chrome.runtime.lastError.message));
                        else resolve();
                    },
                ),
            );
            if (signal.aborted) return;
            apply_loading_preferences(value);
            scheduler.configure(value);
            status.textContent = i18n_message("ui_advanced_saved");
        } catch {
            if (!signal.aborted)
                status.textContent = i18n_message("ui_advanced_failed");
        } finally {
            save.disabled = false;
            defaults.disabled = false;
            controls.forEach((control) => {
                control.disabled = false;
            });
        }
    });
}
