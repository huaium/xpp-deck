export function mount_cooldown_notice(root, deadline, message) {
    const notice = document.createElement("div");
    notice.className = "xpd_cooldown_notice";
    notice.setAttribute("role", "status");
    const heading = document.createElement("div");
    const countdown = document.createElement("div");
    countdown.setAttribute("aria-hidden", "true");
    notice.append(heading, countdown);
    root.appendChild(notice);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const render = () => {
        if (timer !== undefined) clearTimeout(timer);
        const until = deadline();
        const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        // Keep the selected DOM intact until the user finishes copying.
        const selection = document.getSelection();
        if (
            selection &&
            !selection.isCollapsed &&
            (notice.contains(selection.anchorNode) ||
                notice.contains(selection.focusNode))
        ) {
            timer = setTimeout(render, 1000);
            return;
        }
        notice.hidden = remaining === 0;
        if (!remaining) return;
        const heading_text = message("ui_rate_limit_notice");
        if (heading.textContent !== heading_text)
            heading.textContent = heading_text;
        const countdown_text = `${message("ui_api_loading_paused", [new Date(until).toLocaleTimeString()])} (${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")})`;
        if (countdown.textContent !== countdown_text)
            countdown.textContent = countdown_text;
        timer = setTimeout(render, 1000);
    };
    const changed = (changes) => {
        if (changes.xpd_rate_limit_until) render();
    };
    chrome.storage.onChanged.addListener(changed);
    render();
    return () => {
        if (timer !== undefined) clearTimeout(timer);
        chrome.storage.onChanged.removeListener(changed);
        notice.remove();
    };
}
