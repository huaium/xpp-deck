// Compatibility setup must run before any component registration.
import "./webawesome-polyfills";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import type WaSelect from "@awesome.me/webawesome/dist/components/select/select.js";
import type WaButton from "@awesome.me/webawesome/dist/components/button/button.js";
import type WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import type WaCheckbox from "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";

// Preserve the existing controllers while replacing their visible controls.
export function mount_webawesome_controls() {
    const enhanced = new WeakSet<Element>();
    const upgrade = () => {
        for (const native of document.querySelectorAll<HTMLInputElement>(
            '#opd_main_element input[type="checkbox"], #opd_main_element input[type="number"], .opd_dialog_overlay input',
        )) {
            if (enhanced.has(native)) continue;
            enhanced.add(native);
            const checkbox = native.type === "checkbox";
            const control = document.createElement(
                checkbox ? "wa-checkbox" : "wa-input",
            ) as WaCheckbox | WaInput;
            control.className = "opd_wa_input";
            control.dataset.nativeClass = native.className;
            control.setAttribute(
                "aria-label",
                native.getAttribute("aria-label") ??
                    native.closest("label")?.textContent?.trim() ??
                    native.previousElementSibling?.textContent ??
                    "Input",
            );
            control.disabled = native.disabled;
            if (checkbox) (control as WaCheckbox).checked = native.checked;
            else {
                const input = control as WaInput;
                input.type = native.type === "number" ? "number" : "text";
                input.value = native.value;
                input.placeholder = native.placeholder;
                for (const name of ["min", "max", "step", "maxlength"]) {
                    const value = native.getAttribute(name);
                    if (value !== null) input.setAttribute(name, value);
                }
            }
            for (const name of ["input", "change"])
                control.addEventListener(name, (event) => {
                    event.stopPropagation();
                    if (checkbox)
                        native.checked = (control as WaCheckbox).checked;
                    else native.value = (control as WaInput).value ?? "";
                    native.dispatchEvent(new Event(name, { bubbles: true }));
                });
            native.hidden = true;
            native.after(control);
            native.focus = (options) => control.focus(options);
        }
        for (const native of document.querySelectorAll<HTMLSelectElement>(
            "#opd_main_element select, .opd_dialog_overlay select",
        )) {
            if (enhanced.has(native)) continue;
            enhanced.add(native);
            const select = document.createElement("wa-select") as WaSelect;
            select.className = "opd_wa_select";
            select.dataset.nativeId = native.id;
            select.dataset.nativeClass = native.className;
            select.setAttribute(
                "aria-label",
                native.getAttribute("aria-label") ??
                    native.previousElementSibling?.textContent?.trim() ??
                    native.closest("label")?.querySelector("span")
                        ?.textContent ??
                    "Select",
            );
            const sync = () => {
                select.replaceChildren();
                for (const source of native.options) {
                    const option = document.createElement("wa-option");
                    option.setAttribute("value", source.value);
                    option.textContent = source.textContent;
                    option.toggleAttribute("disabled", source.disabled);
                    option.toggleAttribute("selected", source.selected);
                    select.appendChild(option);
                }
                select.value = native.value;
                select.disabled = native.disabled;
            };
            sync();
            select.addEventListener("change", (event) => {
                event.stopPropagation();
                native.value = String(select.value ?? "");
                native.dispatchEvent(new Event("change", { bubbles: true }));
            });
            native.addEventListener("change", () => {
                select.value = native.value;
            });
            native.hidden = true;
            native.after(select);
            native.focus = (options) => select.focus(options);
        }
        for (const native of document.querySelectorAll<HTMLButtonElement>(
            ".opd_dialog_actions button, .opd_global_settings_button",
        )) {
            if (enhanced.has(native)) continue;
            enhanced.add(native);
            const button = document.createElement("wa-button") as WaButton;
            button.className = "opd_wa_button";
            button.dataset.nativeClass = native.className;
            button.variant = native.classList.contains("opd_dialog_primary")
                ? "brand"
                : "neutral";
            button.appearance = native.classList.contains(
                "opd_global_settings_button",
            )
                ? "plain"
                : "outlined";
            button.setAttribute(
                "aria-label",
                native.getAttribute("aria-label") ?? native.textContent ?? "",
            );
            button.append(
                ...Array.from(native.childNodes).map((node) =>
                    node.cloneNode(true),
                ),
            );
            button.addEventListener("click", () => native.click());
            native.hidden = true;
            native.after(button);
            native.focus = (options) => button.focus(options);
        }
        for (const root of document.querySelectorAll<HTMLElement>(
            "#opd_main_element, .opd_dialog_overlay",
        )) {
            const dark =
                root.getAttribute("opd-dsp-theme") === "dark" ||
                root.classList.contains("opd_dialog_theme_dark");
            root.classList.toggle("wa-dark", dark);
            root.classList.toggle("wa-light", !dark);
        }
    };
    const scope = "#opd_main_element, .opd_dialog_overlay";
    const observer = new MutationObserver((records) => {
        if (
            records.some(
                (record) =>
                    (record.target instanceof Element &&
                        record.target.closest(scope)) ||
                    Array.from(record.addedNodes).some(
                        (node) =>
                            node instanceof Element &&
                            (node.matches(scope) || node.querySelector(scope)),
                    ),
            )
        )
            upgrade();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["opd-dsp-theme", "class"],
    });
    upgrade();
    return () => observer.disconnect();
}
