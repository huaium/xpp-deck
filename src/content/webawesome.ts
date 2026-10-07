// Compatibility setup must run before any component registration.
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
            ".dsp_column_settings_panel wa-input, .dsp_column_settings_panel wa-select, .dsp_column_settings_panel wa-checkbox",
        )) {
            if (!control.hasAttribute("aria-label")) {
                const label = control
                    .closest(".dsp_column_settings_content_div")
                    ?.firstElementChild?.textContent?.trim();
                if (label) control.setAttribute("aria-label", label);
            }
        }
        for (const control of document.querySelectorAll<HTMLElement>(
            "#xpd_main_element wa-button[title], #xpd_main_element wa-checkbox[title]",
        )) {
            if (!control.hasAttribute("aria-label"))
                control.setAttribute("aria-label", control.title);
        }
        for (const overlay of document.querySelectorAll<HTMLElement>(
            ".xpd_dialog_overlay",
        )) {
            const content = overlay.querySelector<HTMLElement>(
                ":scope > .xpd_dialog",
            );
            if (!content) continue;
            const modal = document.createElement("wa-dialog");
            modal.className = "xpd_wa_dialog";
            modal.withoutHeader = true;
            modal.label =
                content.querySelector(".xpd_dialog_message, .xpd_about_title")
                    ?.textContent ?? "XPP-Deck";
            // Existing controllers own queue resolution and exit animations.
            modal.addEventListener("wa-hide", (event) => {
                if (event.target === modal) event.preventDefault();
            });
            modal.appendChild(content);
            overlay.appendChild(modal);
            modal.open = true;
        }
        for (const root of document.querySelectorAll<HTMLElement>(
            "#xpd_main_element, .xpd_dialog_overlay, #xpd_welcome",
        )) {
            const dark =
                root.getAttribute("xpd-dsp-theme") === "dark" ||
                root.classList.contains("xpd_dialog_theme_dark") ||
                (root.id === "xpd_welcome" &&
                    document.documentElement.getAttribute("data-xpd-theme") ===
                        "dark");
            root.classList.toggle("wa-dark", dark);
            root.classList.toggle("wa-light", !dark);
        }
    };
    const scope = "#xpd_main_element, .xpd_dialog_overlay, #xpd_welcome";
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
        attributeFilter: ["xpd-dsp-theme", "class", "disabled"],
        characterData: true,
    });
    upgrade();
    return () => observer.disconnect();
}
