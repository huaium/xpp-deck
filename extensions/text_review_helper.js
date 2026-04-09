// Create custom text-replacement events for text review.
(() => {
    const isAllowed = (u) => {
        const url = new URL(u, location.href);
        return (
            url.origin === location.origin &&
            url.pathname.startsWith("/compose/post")
        );
    };
    // Hide GIF button.
    document
        .querySelector("head")
        .insertAdjacentHTML(
            "beforeend",
            `<style opd_post_css>main button[data-testid="gifSearchButton"]{display:none;}div[data-testid="twc-cc-mask"]{display:none;}</style>`,
        );
    new MutationObserver(function () {
        const back_button = document.querySelector(
            'main button[data-testid="app-bar-back"]',
        );
        if (!back_button) return;
        if (location.pathname === "/compose/post") {
            back_button.style.display = "none";
        } else {
            back_button.style.display = "block";
        }
    }).observe(document, { childList: true, subtree: true });

    (function () {
        // Disable post-submit navigation prompt.
        const native_add_evt = EventTarget.prototype.addEventListener;
        native_add_evt.call(
            window,
            "beforeunload",
            function (e) {
                // Stop existing event handlers.
                e.stopImmediatePropagation();
            },
            { capture: true },
        );

        // Block future added events.
        EventTarget.prototype.addEventListener = function (
            type,
            listener,
            options,
        ) {
            if (String(type).toLowerCase() === "beforeunload") {
                return;
            }
            return native_add_evt.call(this, type, listener, options);
        };

        // Prevent navigation back to home after posting.
        const originalPushState = history.pushState;
        history.pushState = function (state, title, url) {
            const dest = url ? new URL(url, location.href).href : location.href;
            if (!isAllowed(dest)) {
                // Block navigation to home.
                location.replace(location.href);
                return;
            }
            return originalPushState.apply(this, arguments);
        };
    })();

    // Text review processing.
    let target_editor_elem = null;
    let opd_paste_token = null;
    document.addEventListener("focusin", (ev) => {
        if (ev.target && ev.target.isContentEditable) {
            target_editor_elem = ev.target;
        }
    });
    const handler = async (e) => {
        // Use JSON in detail because Firefox cannot carry object payload here.
        const detail = JSON.parse(e.detail);
        // Validate token before paste.
        if (opd_paste_token && opd_paste_token !== detail.token) return;

        // Use X editor internals to input text correctly.
        if (target_editor_elem && target_editor_elem.isContentEditable) {
            // Select all text.
            text_all_select(target_editor_elem);
            // Wait until selection is applied.
            await new Promise((resolve) => setTimeout(resolve, 30));

            // Use separate path because Firefox lacks DataTransfer/ClipboardEvent behavior here.
            if (!detail.is_firefox) {
                // Get React props.
                const propsKey = Object.getOwnPropertyNames(
                    target_editor_elem,
                ).find((k) => k.includes("__reactProps$"));
                const props = propsKey ? target_editor_elem[propsKey] : null;
                const editor =
                    props?.children?.props?.editor ??
                    props?.children?.[0]?.props?.editor ??
                    null;

                // Create DataTransfer for reviewed text.
                const dt = new DataTransfer();
                dt.setData("text/plain", detail.text);

                // Create clipboard paste event.
                const evt = new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dt,
                });
                // Pseudo-paste reviewed text through internal handler.
                editor?._onPaste(evt, editor);
            } else {
                // execCommand is deprecated but used as Firefox fallback.
                // Replace text.
                document.execCommand("insertText", false, detail.text);
            }
        }
    };

    async function text_all_select(target) {
        // Select-all helper.
        if (!target && !target.isContentEditable) return false;

        const win = target.ownerDocument.defaultView;
        const doc = target.ownerDocument;

        target.focus();
        const sel = win.getSelection();
        sel.removeAllRanges();

        const range = doc.createRange();
        range.selectNodeContents(target);
        sel.addRange(range);

        return true;
    }

    // Register event to receive paste-auth token.
    window.addEventListener(
        "opd_text_review_init",
        (e) => {
            const detail = JSON.parse(e.detail);
            opd_paste_token = detail.token;
        },
        true,
    );

    // Register event that applies reviewed text.
    window.addEventListener("opd_text_review_apply", handler, true);
})();
