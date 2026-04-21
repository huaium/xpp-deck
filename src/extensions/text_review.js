// Used by text review feature.
class OpdExtTextReview {
    constructor() {
        this.opd_text_review_token = null;
        this.opd_use_lang = "ja";
        this.Init = (column_window, icons, ui_lang) => {
            // Initialize.
            let editable_elem = null;
            let is_textarea_empty = true;
            let review_state = false;
            this.opd_use_lang = ui_lang.split("-")[0];
            column_window.document.head.insertAdjacentHTML(
                "beforeend",
                `<style opd_post_textreview_css>
                /* Hide Premium promotion elements. */
                div[aria-live="polite"][role="status"]:has(a[dir="ltr"]){
                    display: none;
                }
                .opd_post_functions{
                    margin-left: -8px;
                }
                .opd_text_review_loader {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #ddd;
                    border-top-color: #3498db;
                    border-radius: 50%;
                    animation: opd_text_review_loader_spin 1s linear infinite;
                    margin: 20px auto;
                }

                @keyframes opd_text_review_loader_spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
                .opd_text_review_btn{
                    width:34px;
                    height:34px;
                    margin:0 4px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer; 
                }
                .opd_text_review_btn_icon{
                    display: block;
                    mask: url(${chrome.runtime.getURL(icons.text_review)}) no-repeat center;
                    width: 18px;
                    height: 18px;
                }
                #opd_post_text_review[opd_text_review_is_empty]{
                opacity: 0.5;
                }
                .opd_text_review_panel{
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    border-radius: 5px;
                }
                .opd_text_review_panel, .opd_text_review_result{
                    width: 100%;
                }
                .opd_text_review_result_preview{
                    white-space: pre-wrap;
                    padding: 5px;
                    max-height: 10rem;
                    overflow: hidden auto;
                    scrollbar-width: thin;
                    background: #c9c9c940;
                }
                .opd_text_review_indication_switcher{
                    max-height: 8rem;
                    overflow: hidden auto;
                    scrollbar-width: thin;
                    padding:5px;
                }
                .opd_text_review_indication_switch{
                    display: flex;
                    flex-direction: row;
                    padding: 5px;
                    border-radius: 5px;
                    margin: 5px;
                    background: #00000012;
                    scrollbar-width: thin;
                }
                span[opd_text_review_indication_hidden]{
                    display: none;
                }
                .opd_text_review_indication_apply_panel{
                    display: flex;
                    flex-direction: row;
                    justify-content: space-evenly;
                }
                .opd_text_review_indication_apply_panel button{
                    border-radius: 100px;
                    width: 5rem;
                    display: flex;
                    justify-content: center;
                    border: #0000005e 1px solid;
                    margin: 2px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    
                }
                .opd_text_review_indication_apply_panel button:hover{
                    opacity: 0.8;
                }
            </style>`,
            );
            // Inject helper script.
            const helper_script =
                column_window.document.createElement("script");
            helper_script.src = chrome.runtime.getURL(
                "src/extensions/text_review_helper.js",
            );
            column_window.document.head.appendChild(helper_script);

            // Set paste authorization token.
            this.opd_text_review_token = crypto.randomUUID();
            setTimeout(() => {
                column_window.document.dispatchEvent(
                    new CustomEvent("opd_text_review_init", {
                        detail: JSON.stringify({
                            token: this.opd_text_review_token,
                        }),
                    }),
                );
            }, 10);

            column_window.document.addEventListener("focusin", (ev) => {
                // Attach text-empty watcher when editor gains focus.
                if (ev.target && ev.target.isContentEditable) {
                    editable_elem = ev.target;
                    if (!editable_elem.getAttribute("opd_text_counter")) {
                        // Use MutationObserver because input events miss some deletions.
                        new MutationObserver(() => {
                            is_textarea_empty =
                                editable_elem.innerText.trim() === "";
                            if (is_textarea_empty) {
                                column_window.document
                                    .getElementById("opd_post_text_review")
                                    .setAttribute(
                                        "opd_text_review_is_empty",
                                        "",
                                    );
                            } else {
                                column_window.document
                                    .getElementById("opd_post_text_review")
                                    .removeAttribute(
                                        "opd_text_review_is_empty",
                                    );
                            }
                        }).observe(editable_elem, {
                            childList: true,
                            subtree: true,
                        });
                        editable_elem.setAttribute("opd_text_counter", "true");
                    }
                } else {
                    editable_elem = null;
                }
            });
            new MutationObserver(() => {
                // Inject text review button.
                // Place under character counter because toolbar insertion hides other buttons.
                const btnAddTarget = column_window.document.querySelector(
                    'div[data-testid="toolBar"]',
                );
                const function_panel = column_window.document.querySelector(
                    "div.opd_post_functions",
                );
                if (btnAddTarget && !function_panel) {
                    // Get theme color and apply button colors.
                    const theme_color = this.CssChecker(
                        getComputedStyle(
                            column_window.document.querySelector(
                                'div[data-testid="progressBar-bar"]',
                            ),
                        ).backgroundColor,
                    );
                    column_window.document.head.insertAdjacentHTML(
                        "beforeend",
                        `<style opd_post_textreview_theme_css>.opd_text_review_btn_icon{background-color:${theme_color};}.opd_text_review_btn:not([opd_text_review_is_empty]):hover{border-radius: 100px;transition-duration: 0.2s;background-color:${theme_color.replace(")", ", 0.1)")};}.opd_text_review_panel{background-color:${theme_color.replace(")", ", 0.1)")};}</style>`,
                    );
                    // Add review button panel.
                    // TODO: Move opd_post_functions insertion to a single shared initialization point.
                    btnAddTarget.insertAdjacentHTML(
                        "afterend",
                        `<div class="opd_post_functions"><div id="opd_post_text_review" class="opd_text_review_btn" title="${this.UITexts[this.opd_use_lang].textReview_buttonTitle.message}" opd_text_review_is_empty><div class="opd_text_review_btn_icon"></div></div></div><div class="opd_text_review_panel"></div>`,
                    );
                    // Add review button behavior.
                    column_window.document
                        .getElementById("opd_post_text_review")
                        .addEventListener("click", async () => {
                            if (
                                !review_state &&
                                editable_elem &&
                                !is_textarea_empty
                            ) {
                                review_state = true;
                                const review_panel =
                                    column_window.document.querySelector(
                                        "div.opd_text_review_panel",
                                    );
                                review_panel.textContent = "";
                                review_panel.insertAdjacentHTML(
                                    "beforeend",
                                    `<div>${this.UITexts[this.opd_use_lang].textReview_panelTitle.message}</div><div><div class="opd_text_review_loader"></div>${this.UITexts[this.opd_use_lang].textReview_inProgress.message}</div>`,
                                );
                                await this.Review(
                                    editable_elem.innerText.trim(),
                                    review_panel,
                                    column_window,
                                );
                                review_state = false;
                            }
                        });
                }
            }).observe(column_window.document, {
                childList: true,
                subtree: true,
            });
        };
        this.Review = async (text, panel_elem, column_window) => {
            // Start review.
            const review_request = await this.ReviewRquest(text);

            // Exit if review fails.
            if (!review_request) {
                panel_elem.textContent = "";
                panel_elem.insertAdjacentHTML(
                    "beforeend",
                    `<div>${this.UITexts[this.opd_use_lang].textReview_panelTitle.message}</div><div>${this.UITexts[this.opd_use_lang].textReview_failed.message}</div>`,
                );
                return;
            }
            // Clear review panel.
            panel_elem.textContent = "";

            // Exit if no issues are found.
            if (review_request.indications.length === 0) {
                panel_elem.insertAdjacentHTML(
                    "beforeend",
                    `<div>${this.UITexts[this.opd_use_lang].textReview_panelTitle.message}</div><div>${this.UITexts[this.opd_use_lang].textReview_noIssues.message}</div>`,
                );
                return;
            }
            // When review result contains issues.
            let result = [];
            let indication_id = [];
            const indications_fix_enabled = [];
            let indication_fix_str = text;

            // Render issue list for each indication.
            review_request.indications.forEach((review) => {
                const id = this.CreateRandomID();
                let suggest_elem = "";
                if (review.params?.suggests != null) {
                    suggest_elem = `<span style="background:#14ff0063;">${this.EscapeHTML(review.params?.suggests?.at(-1))}</span>`;
                }
                result.push(
                    `<div class="opd_text_review_indication_switch"><input id="opd_text_review_iid_${id}" type="checkbox" opd_indication_id="${id}"><div><span style="font-size: 0.8em;">(${this.EscapeHTML(review.message)})</span><div><span style="text-decoration: line-through;background:#ff000054;">${this.EscapeHTML(review.relevant_part.problem)}</span>${suggest_elem}${this.EscapeHTML(review.relevant_part.after)}</div></div></div>`,
                );
                indication_id.push(id);
                indications_fix_enabled.push(false);
            });
            // Render full text with issue highlights.
            const review_view = this.IndicationTexts(
                text,
                review_request.indications,
                indication_id,
            );
            panel_elem.insertAdjacentHTML(
                "beforeend",
                `<div>${this.UITexts[this.opd_use_lang].textReview_panelTitle.message}</div><div class="opd_text_review_result"><div class="opd_text_review_result_preview">${review_view}</div><div class="opd_text_review_indication_switcher">${result.join("")}</div><div class="opd_text_review_indication_apply_panel"><button id="opd_text_review_apply_selected">${this.UITexts[this.opd_use_lang].textReview_applySelected.message}</button><button id="opd_text_review_apply_all">${this.UITexts[this.opd_use_lang].textReview_applyAll.message}</button></div></div>`,
            );

            indication_id.forEach((id, i) => {
                panel_elem
                    .querySelector(`#opd_text_review_iid_${id}`)
                    .addEventListener("change", (ev) => {
                        const indcation_target = panel_elem.querySelector(
                            `#opd_text_review_problem_id_${id}`,
                        );
                        indcation_target.scrollIntoView({
                            behavior: "smooth",
                            inline: "end",
                        });
                        if (ev.target.checked) {
                            indcation_target.setAttribute(
                                "opd_text_review_indication_hidden",
                                "",
                            );
                            indications_fix_enabled[i] = true;
                        } else {
                            indcation_target.removeAttribute(
                                "opd_text_review_indication_hidden",
                            );
                            indications_fix_enabled[i] = false;
                        }
                        indication_fix_str = this.GetReviewedText(
                            text,
                            review_request.indications,
                            indications_fix_enabled,
                        );
                    });
            });

            // Attach apply-buttons behavior.
            panel_elem
                .querySelector(`#opd_text_review_apply_selected`)
                .addEventListener("click", (ev) => {
                    column_window.document.dispatchEvent(
                        new CustomEvent("opd_text_review_apply", {
                            bubbles: true,
                            composed: true,
                            detail: JSON.stringify({
                                text: indication_fix_str,
                                token: this.opd_text_review_token,
                                is_firefox: this.IsFirefox(),
                            }),
                        }),
                    );
                });
            panel_elem
                .querySelector(`#opd_text_review_apply_all`)
                .addEventListener("click", (ev) => {
                    indication_id.forEach((id) => {
                        const target = panel_elem.querySelector(
                            `#opd_text_review_iid_${id}`,
                        );
                        if (!target.checked) {
                            panel_elem
                                .querySelector(`#opd_text_review_iid_${id}`)
                                .click();
                        }
                    });
                    column_window.document.dispatchEvent(
                        new CustomEvent("opd_text_review_apply", {
                            bubbles: true,
                            composed: true,
                            detail: JSON.stringify({
                                text: indication_fix_str,
                                token: this.opd_text_review_token,
                                is_firefox: this.IsFirefox(),
                            }),
                        }),
                    );
                });
        };
        this.IndicationTexts = (text, result, indication_ids) => {
            // Build HTML for full-text issue view.
            if (!result?.length) return this.EscapeHTML(text);

            // Process in ascending offset order.
            const sorted = [...result].sort((a, b) => a.offset - b.offset);

            let cur = 0;
            let html = "";

            for (const [i, ind] of sorted.entries()) {
                const { offset, length, params } = ind;
                const start = offset;
                const end = start + length;
                const suggest = params?.suggests?.at(-1) ?? "";

                // Bounds check.
                if (start < cur || start > text.length) continue;
                if (end > text.length) continue;

                html += this.EscapeHTML(text.slice(cur, start));

                let suggest_elem = "";
                if (suggest !== "") {
                    suggest_elem = `<span style="padding:3px;border-radius:3px;background:#14ff0063;">${this.EscapeHTML(suggest)}</span>`;
                }

                html += `<span class="patch" data-offset="${start}" data-length="${length}"><span id="opd_text_review_problem_id_${indication_ids[i]}" style="padding:3px;border-radius:3px;text-decoration: line-through;background:#ff000054;">${this.EscapeHTML(text.slice(start, end))}</span>${suggest_elem}</span>`;

                cur = end;
            }

            html += this.EscapeHTML(text.slice(cur));

            return html;
        };
        this.GetReviewedText = (text, result, indication_enabled) => {
            // Generate text with selected fixes applied.
            if (!result?.length) return text;

            // Process in ascending offset order.
            const sorted = [...result].sort((a, b) => a.offset - b.offset);

            let cur = 0;
            let output = "";

            for (const [i, ind] of sorted.entries()) {
                const { offset, length, params } = ind;
                const start = offset;
                const end = start + length;
                const suggest = params?.suggests?.at(-1) ?? "";
                const problem = text.slice(start, end);

                // Bounds check.
                if (start < cur || start > text.length) continue;
                if (end > text.length) continue;

                // Append unchanged segment before this fix.
                output += text.slice(cur, start);

                if (indication_enabled[i]) {
                    output += String(suggest);
                } else {
                    output += String(problem);
                }

                cur = end;
            }

            output += text.slice(cur);

            return output;
        };
        this.ReviewRquest = async (str) => {
            // Run review and return result.
            const review_result = await chrome.runtime.sendMessage({
                message: "text_review",
                review_text: str,
            });
            if (review_result) {
                return review_result;
            } else {
                return false;
            }
        };
        this.IsFirefox = () => {
            const extension_url = chrome.runtime.getURL("");
            const is_firefox = extension_url.startsWith("moz-extension://")
                ? true
                : extension_url.startsWith("chrome-extension://")
                  ? false
                  : false;
            return is_firefox;
        };
        this.CreateRandomID = () => {
            // Generate random ID.
            return Math.random().toString(32).substring(2);
        };
        this.CssChecker = (str) => {
            // Validate CSS value.
            return CSS.supports("color", str) ? str : "black";
        };
        this.EscapeHTML = (str) => {
            // Escape string for HTML.
            if (str == null) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        };
        this.UITexts = {
            ja: {
                textReview_buttonTitle: {
                    message:
                        "Proofread Japanese text (optimized for Japanese. no logs are saved).",
                },
                textReview_panelTitle: {
                    message: "Text Review (Beta)",
                },
                textReview_inProgress: {
                    message: "Reviewing...",
                },
                textReview_failed: {
                    message: "Review failed.",
                },
                textReview_noIssues: {
                    message: "No issues found.",
                },
                textReview_applySelected: {
                    message: "Apply",
                },
                textReview_applyAll: {
                    message: "Apply All",
                },
            },
            en: {
                textReview_buttonTitle: {
                    message:
                        "Proofread Japanese text (optimized for Japanese. no logs are saved).",
                },
                textReview_panelTitle: {
                    message: "Text Review (Beta)",
                },
                textReview_inProgress: {
                    message: "Reviewing...",
                },
                textReview_failed: {
                    message: "Review failed.",
                },
                textReview_noIssues: {
                    message: "No issues found.",
                },
                textReview_applySelected: {
                    message: "Apply",
                },
                textReview_applyAll: {
                    message: "Apply All",
                },
            },
        };
    }
}
window.OpdExtTextReview = OpdExtTextReview;
