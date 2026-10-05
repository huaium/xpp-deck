type SessionStatus = "signed-in" | "signed-out" | "unknown";
type WelcomeOptions = {
    message: (key: string, fallback: string) => string;
    start: () => void | Promise<void>;
    reload: () => void;
    check?: () => Promise<SessionStatus>;
};

export function is_deck_location(href: string) {
    const url = new URL(href);
    return (
        url.protocol === "https:" &&
        ["x.com", "twitter.com"].includes(url.hostname) &&
        url.pathname === "/run-opdeck"
    );
}

export function read_x_session(): SessionStatus {
    const page = document.getElementById("react-root") ?? document;
    const has = (selector: string) =>
        Array.from(page.querySelectorAll(selector)).some(
            (element) =>
                !element.closest(
                    '#opd_welcome, [hidden], [aria-hidden="true"]',
                ),
        );
    if (
        has(
            '[data-testid="SideNav_AccountSwitcher_Button"], a[data-testid="AppTabBar_Profile_Link"]',
        )
    )
        return "signed-in";
    if (
        has(
            'a[href="/login"], a[href="/i/flow/login"], a[href^="/i/flow/login?"], a[href^="/login?"], a[href="https://x.com/i/flow/login"], a[href^="https://x.com/i/flow/login?"], [data-testid="loginButton"]',
        )
    )
        return "signed-out";
    if (
        Array.from(
            page.querySelectorAll('a[href*="/i/jf/onboarding/web"]'),
        ).some((element) => {
            if (element.closest('#opd_welcome, [hidden], [aria-hidden="true"]'))
                return false;
            const href = element.getAttribute("href");
            if (!href) return false;
            try {
                const url = new URL(href, "https://x.com");
                return (
                    url.protocol === "https:" &&
                    ["x.com", "twitter.com"].includes(url.hostname) &&
                    url.pathname === "/i/jf/onboarding/web" &&
                    url.searchParams.get("mode") === "login"
                );
            } catch {
                return false;
            }
        })
    )
        return "signed-out";
    return "unknown";
}

export function check_x_session(signal?: AbortSignal): Promise<SessionStatus> {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve("unknown");
            return;
        }
        const initial = read_x_session();
        if (initial !== "unknown") {
            resolve(initial);
            return;
        }
        let finished = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (status: SessionStatus) => {
            if (finished) return;
            finished = true;
            observer.disconnect();
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve(status);
        };
        const onAbort = () => finish("unknown");
        const observer = new MutationObserver(() => {
            const status = read_x_session();
            if (status !== "unknown") finish(status);
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["href", "data-testid", "hidden", "aria-hidden"],
        });
        signal?.addEventListener("abort", onAbort, { once: true });
        timer = setTimeout(() => finish("unknown"), 5000);
        const current = read_x_session();
        if (current !== "unknown") finish(current);
    });
}

export function mount_session_gate(options: WelcomeOptions) {
    const root = document.documentElement;
    root.setAttribute("data-opd-deck", "");
    const style = document.createElement("style");
    style.id = "opd_welcome_style";
    style.textContent = `
html[data-opd-deck] #react-root{visibility:hidden!important;}
#opd_welcome{--welcome-bg:#fff;--welcome-text:#1f2937;--welcome-muted:#5f6b7a;--welcome-line:#c6ced8;position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;overflow:auto;box-sizing:border-box;padding:32px 24px;background:var(--welcome-bg);color:var(--welcome-text);font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;}
html[data-opd-theme="dark"] #opd_welcome{--welcome-bg:#101215;--welcome-text:#e5ebf3;--welcome-muted:#a4afbc;--welcome-line:#44505e;}
#opd_welcome [hidden]{display:none!important;}
#opd_welcome *{box-sizing:border-box;font-family:inherit;}
#opd_welcome .welcome-content{width:100%;max-width:420px;margin:auto;}
#opd_welcome .welcome-brand{font-size:clamp(32px,7vw,44px);font-weight:750;letter-spacing:-1.5px;margin:0 0 48px;}
#opd_welcome h1{font-size:24px;line-height:1.3;letter-spacing:-.5px;margin:0 0 12px;}
#opd_welcome p{font-size:15px;line-height:1.6;color:var(--welcome-muted);margin:0 0 24px;}
#opd_welcome .welcome-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px;}
#opd_welcome a,#opd_welcome button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 20px;border:1px solid var(--welcome-line);border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;background:transparent;color:var(--welcome-text);}
#opd_welcome a{background:var(--welcome-text);color:var(--welcome-bg);border-color:var(--welcome-text);}
#opd_welcome a:hover,#opd_welcome button:hover{filter:brightness(.9);}
#opd_welcome a:focus-visible,#opd_welcome button:focus-visible{outline:2px solid #2563eb;outline-offset:4px;}
#opd_welcome .welcome-note{margin:24px 0 0;font-size:13px;}
#opd_welcome button:disabled{opacity:.55;cursor:wait;}
@media(max-height:480px){#opd_welcome .welcome-brand{margin-bottom:24px;}}
`;
    document.head.appendChild(style);
    const view = document.createElement("main");
    view.id = "opd_welcome";
    view.setAttribute("aria-label", "XPP-Deck");
    const content = document.createElement("div");
    content.className = "welcome-content";
    const brand = document.createElement("div");
    brand.className = "welcome-brand";
    brand.textContent = "XPP-Deck";
    const title = document.createElement("h1");
    const description = document.createElement("p");
    description.setAttribute("role", "status");
    description.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "welcome-actions";
    const signIn = document.createElement("a");
    signIn.href = "https://x.com/i/flow/login";
    signIn.target = "_blank";
    signIn.rel = "noopener noreferrer";
    const retry = document.createElement("wa-button");
    retry.setAttribute("type", "button");
    const note = document.createElement("p");
    note.className = "welcome-note";
    actions.append(signIn, retry);
    content.append(brand, title, description, actions, note);
    view.appendChild(content);
    document.body.appendChild(view);
    document.title = "XPP-Deck";

    const cancellation = new AbortController();
    let busy = false;
    let ready = false;
    let disposed = false;
    let attemptedSignIn = false;
    const text = options.message;
    function render(state: "checking" | "signed-out" | "unknown") {
        title.textContent = text(
            state === "unknown" ? "ui_welcome_error_title" : "ui_welcome_title",
            state === "unknown"
                ? "Unable to check your session"
                : "Sign in to get started",
        );
        description.textContent =
            state === "checking"
                ? text("ui_welcome_checking", "Checking your X session...")
                : state === "unknown"
                  ? text(
                        "ui_welcome_error_description",
                        "The session check failed. Try again without changing your profiles.",
                    )
                  : text(
                        "ui_welcome_description",
                        "Use your X account to load your columns.",
                    );
        signIn.textContent = text("ui_welcome_sign_in", "Sign in to X");
        signIn.hidden = state !== "signed-out";
        retry.hidden =
            state === "checking" ||
            (state === "signed-out" && !attemptedSignIn);
        retry.disabled = busy;
        retry.textContent =
            state === "signed-out"
                ? text("ui_welcome_retry", "I've signed in")
                : text("ui_welcome_try_again", "Try again");
        note.hidden = state !== "signed-out";
        note.textContent = text(
            "ui_welcome_note",
            "Sign-in happens directly on X.",
        );
        view.setAttribute("aria-busy", String(busy));
    }
    async function check(refreshStale = false) {
        if (busy || disposed) return;
        busy = true;
        if (!ready) render("checking");
        const status = await (
            options.check
                ? options.check()
                : check_x_session(cancellation.signal)
        ).catch(() => "unknown" as const);
        if (disposed) return;
        if (ready) {
            busy = false;
            if (status === "signed-out") options.reload();
            return;
        }
        if (status === "signed-out" && attemptedSignIn && refreshStale) {
            busy = false;
            options.reload();
            return;
        }
        if (status === "signed-in") {
            try {
                await options.start();
                if (disposed) return;
                ready = true;
                view.remove();
            } catch {
                busy = false;
                render("unknown");
            }
        } else {
            busy = false;
            render(status);
        }
        busy = false;
    }
    const onFocus = () => {
        void check();
    };
    const onRetry = () => {
        void check(true);
    };
    const onVisibility = () => {
        if (!document.hidden) void check();
    };
    const onSignIn = () => {
        attemptedSignIn = true;
        render("signed-out");
    };
    signIn.addEventListener("click", onSignIn);
    retry.addEventListener("click", onRetry);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    render("checking");
    return {
        check,
        dispose() {
            disposed = true;
            cancellation.abort();
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
            signIn.removeEventListener("click", onSignIn);
            retry.removeEventListener("click", onRetry);
            view.remove();
            style.remove();
        },
    };
}
