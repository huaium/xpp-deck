export function ensure_dropdown_style() {
    if (document.getElementById("opd_dropdown_style")) return;
    const style = document.createElement("style");
    style.id = "opd_dropdown_style";
    style.textContent = `
    #opd_main_element [hidden], .opd_dialog_overlay [hidden], #opd_welcome [hidden]{display:none!important;}
    #opd_main_element, .opd_dialog_overlay{
        --wa-font-family-body:"Segoe UI","Helvetica Neue",Arial,sans-serif;
        --wa-border-radius-m:8px;--wa-form-control-height:40px;
    }
    #opd_main_element wa-select,.opd_dialog_overlay wa-select{min-width:0;}
    .dsp_column_settings_panel wa-input{width:100px;}
    .dsp_column_settings_panel wa-select{max-width:100%;}
    wa-select::part(combobox){border-radius:8px;min-height:40px;}
    .opd_global_setting_row wa-select{width:100%;}
    wa-button.dsp_btn_parent::part(base),wa-button.opd_api_sidebar_row::part(base){display:flex;flex-direction:inherit;align-items:inherit;width:100%;height:100%;padding:0;border:0;background:transparent;color:inherit;font:inherit;gap:inherit;justify-content:inherit;text-align:inherit;}
    wa-button.dsp_btn_parent::part(label),wa-button.opd_api_sidebar_row::part(label){display:contents;}
    wa-input.opd_dialog_input,wa-select.opd_dialog_input{padding:0;border:0;background:transparent;color:inherit;}
    .opd_dialog_actions wa-button{background:transparent!important;border:0!important;padding:0!important;}
    .column_bar wa-button::part(base){min-height:0;width:100%;height:100%;padding:0;border:0;background:transparent;}
    .opd_global_settings_button{margin-left:auto;}
    .opd_global_settings_button::part(base),.opd_about_close::part(base){padding:0;border:0;background:transparent;}
    .opd_global_settings_button img{width:24px;height:24px;}
    .wa-dark .opd_global_settings_button img{filter:invert(1);}
    #opd_main_element.opd_sidebar_collapsed .opd_global_settings_button{display:none;}
    .opd_wa_dialog{--width: min(560px, calc(100vw - 32px));--spacing:0;--show-duration:120ms;}
    .opd_wa_dialog:has(.opd_about_dialog){--width:min(760px,calc(100vw - 32px));}
    .opd_wa_dialog::part(dialog){background:transparent;border:0;box-shadow:none;padding:0;}
    .opd_wa_dialog::part(body){padding:0;overflow:visible;}
    .opd_wa_dialog .opd_dialog{box-sizing:border-box;width:100%;max-width:100%;animation:none;}
    `;
    document.head.appendChild(style);
}
