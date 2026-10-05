export function ensure_dropdown_style() {
    if (document.getElementById("opd_dropdown_style")) return;
    const style = document.createElement("style");
    style.id = "opd_dropdown_style";
    style.textContent = `
    #opd_main_element select, .opd_dialog_overlay select{
        appearance:none!important;
        box-sizing:border-box;
        padding-left:12px!important;padding-right:40px!important;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%235f6b7a' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")!important;
        background-repeat:no-repeat!important;
        background-position:right 12px center!important;background-size:16px!important;
        color-scheme:light;
    }
    #opd_main_element[opd-dsp-theme="dark"] select,
    .opd_dialog_theme_dark select{
        color-scheme:dark;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23e5ebf3' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")!important;
    }
    `;
    document.head.appendChild(style);
}
