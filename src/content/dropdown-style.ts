export function ensure_dropdown_style() {
    if (document.getElementById("xpd_dropdown_style")) return;
    const style = document.createElement("style");
    style.id = "xpd_dropdown_style";
    style.textContent = `
    #xpd_main_element [hidden], .xpd_dialog_overlay [hidden], #xpd_welcome [hidden]{display:none!important;}
    #xpd_main_element, .xpd_dialog_overlay{
        --wa-font-family-body:"Segoe UI","Helvetica Neue",Arial,sans-serif;
        --wa-border-radius-m:8px;--wa-form-control-height:40px;
    }
    #xpd_main_element wa-select,.xpd_dialog_overlay wa-select{min-width:0;}
    .dsp_column_settings_panel wa-input{width:100px;}
    .dsp_column_settings_panel wa-select{max-width:100%;}
    wa-select::part(combobox){border-radius:8px;min-height:40px;}
    .xpd_global_setting_row wa-select{width:100%;}
    wa-button.dsp_btn_parent::part(base),wa-button.xpd_api_sidebar_row::part(base){display:flex;flex-direction:inherit;align-items:inherit;width:100%;height:100%;padding:0;border:0;background:transparent;color:inherit;font:inherit;gap:inherit;justify-content:inherit;text-align:inherit;}
    wa-button.dsp_btn_parent::part(label),wa-button.xpd_api_sidebar_row::part(label){display:contents;}
    wa-input.xpd_dialog_input,wa-select.xpd_dialog_input{padding:0;border:0;background:transparent;color:inherit;}
    .xpd_dialog_actions wa-button{background:transparent!important;border:0!important;padding:0!important;}
    .column_bar wa-button::part(base){min-height:0;width:100%;height:100%;padding:0;border:0;background:transparent;}
    .xpd_global_settings_button{margin-left:auto;}
    .xpd_global_settings_button::part(base),.xpd_about_close::part(base){padding:0;border:0;background:transparent;}
    .xpd_global_settings_button img{width:24px;height:24px;}
    .wa-dark .xpd_global_settings_button img{filter:invert(1);}
    #xpd_main_element.xpd_sidebar_collapsed .xpd_global_settings_button{display:none;}
    .xpd_wa_dialog{--width: min(560px, calc(100vw - 32px));--spacing:0;--show-duration:120ms;}
    .xpd_wa_dialog:has(.xpd_about_dialog){--width:min(760px,calc(100vw - 32px));}
    .xpd_wa_dialog::part(dialog){background:transparent;border:0;box-shadow:none;padding:0;}
    .xpd_wa_dialog::part(body){padding:0;overflow:visible;}
    .xpd_wa_dialog .xpd_dialog{box-sizing:border-box;width:100%;max-width:100%;animation:none;}
    `;
    document.head.appendChild(style);
}
