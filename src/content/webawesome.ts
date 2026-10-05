// Compatibility setup must run before any component registration.
import "./webawesome-polyfills";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";

// Components are created directly by their controllers; only shared modal and
// theme lifecycle wiring belongs here.
export function mount_webawesome_controls() {
    const upgrade = () => {
        for (const control of document.querySelectorAll<HTMLElement>(
            "#opd_main_element wa-button[title], #opd_main_element wa-checkbox[title]",
        )) {
            if (!control.hasAttribute("aria-label"))
                control.setAttribute("aria-label", control.title);
        }
        for (const overlay of document.querySelectorAll<HTMLElement>(
            ".opd_dialog_overlay",
        )) {
            const content = overlay.querySelector<HTMLElement>(
                ":scope > .opd_dialog",
            );
            if (!content) continue;
            const modal = document.createElement("wa-dialog");
            modal.className = "opd_wa_dialog";
            modal.withoutHeader = true;
            modal.label =
                content.querySelector(".opd_dialog_message, .opd_about_title")
                    ?.textContent ?? "XPP-Deck";
            // Existing controllers own queue resolution and exit animations.
            modal.addEventListener("wa-hide", (event) =>
                event.preventDefault(),
            );
            modal.appendChild(content);
            overlay.appendChild(modal);
            modal.open = true;
        }
        for (const root of document.querySelectorAll<HTMLElement>(
            "#opd_main_element, .opd_dialog_overlay, #opd_welcome",
        )) {
            const dark =
                root.getAttribute("opd-dsp-theme") === "dark" ||
                root.classList.contains("opd_dialog_theme_dark") ||
                (root.id === "opd_welcome" &&
                    document.documentElement.getAttribute("data-opd-theme") ===
                        "dark");
            root.classList.toggle("wa-dark", dark);
            root.classList.toggle("wa-light", !dark);
        }
    };
    const scope = "#opd_main_element, .opd_dialog_overlay, #opd_welcome";
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
        attributeFilter: ["opd-dsp-theme", "class", "disabled"],
        characterData: true,
    });
    upgrade();
    return () => observer.disconnect();
}
