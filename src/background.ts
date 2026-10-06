import { create_profile_storage } from "./profile-storage";

export function start_background() {
    const profile_storage = create_profile_storage();
    const is_deck_url = (href?: string) => {
        if (!href) return false;
        try {
            const url = new URL(href);
            return (
                url.protocol === "https:" &&
                ["x.com", "twitter.com"].includes(url.hostname) &&
                url.pathname === "/run-xppdeck"
            );
        } catch {
            return false;
        }
    };
    const rule_id = (tab_id: number) => tab_id + 2;
    // Remove the old browser-wide rule when upgrading an existing session.
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1] });
    chrome.tabs.onUpdated.addListener((tab_id, change) => {
        if (change.url && !is_deck_url(change.url)) {
            chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [rule_id(tab_id)],
            });
        }
    });
    chrome.tabs.onRemoved.addListener((tab_id) => {
        chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [rule_id(tab_id)],
        });
    });
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "profiles") {
            const source = sender as {
                frameId?: number;
                tab?: { id?: number; url?: string };
                url?: string;
            };
            if (
                source.frameId !== 0 ||
                !Number.isInteger(source.tab?.id) ||
                !is_deck_url(source.url) ||
                !is_deck_url(source.tab?.url)
            ) {
                sendResponse({ ok: false, error: "Invalid profile sender" });
                return false;
            }
            void profile_storage
                .request(
                    (
                        request as unknown as {
                            operation: Record<string, unknown>;
                        }
                    ).operation,
                )
                .then(
                    (value) => sendResponse({ ok: true, value }),
                    (error) =>
                        sendResponse({
                            ok: false,
                            error: String(error.message),
                        }),
                );
            return true;
        }
        if (request.message !== "dnr_upd") return false;
        const source = sender as {
            frameId?: number;
            url?: string;
            tab?: { id?: number; url?: string };
        };
        const tab_id = source.tab?.id;
        if (
            source.frameId !== 0 ||
            !Number.isInteger(tab_id) ||
            tab_id! < 0 ||
            !is_deck_url(source.url) ||
            !is_deck_url(source.tab?.url)
        ) {
            sendResponse(false);
            return false;
        }
        const id = rule_id(tab_id!);
        chrome.declarativeNetRequest.updateSessionRules(
            {
                removeRuleIds: [id],
                addRules: [
                    {
                        id,
                        priority: 1,
                        action: {
                            type: "modifyHeaders",
                            responseHeaders: [
                                {
                                    header: "Content-Security-Policy",
                                    operation: "remove",
                                },
                                {
                                    header: "X-Frame-Options",
                                    operation: "remove",
                                },
                            ],
                        },
                        condition: {
                            regexFilter:
                                "^https://(www\\.)?(x\\.com|twitter\\.com)/",
                            requestDomains: ["x.com", "twitter.com"],
                            tabIds: [tab_id],
                            resourceTypes: ["sub_frame"],
                        },
                    },
                ],
            },
            () => {
                sendResponse(!chrome.runtime.lastError);
            },
        );
        return true;
    });
    //
    type ApiRateLimit = {
        limit: string | null;
        remaining: string | null;
        reset_unix_time: string | null;
    };

    type AccessLimit = {
        search: ApiRateLimit;
        time_line: ApiRateLimit;
        recommend_timeline: ApiRateLimit;
    };

    const api_endpoints = [
        ["SearchTimeline", "search"],
        ["HomeLatestTimeline", "time_line"],
        ["HomeTimeline", "recommend_timeline"],
    ] as const;
    const rate_limit_fields = new Map<string | undefined, keyof ApiRateLimit>([
        ["x-rate-limit-remaining", "remaining"],
        ["x-rate-limit-limit", "limit"],
        ["x-rate-limit-reset", "reset_unix_time"],
    ]);

    let access_limit: AccessLimit = {
        search: { limit: null, remaining: null, reset_unix_time: null },
        time_line: { limit: null, remaining: null, reset_unix_time: null },
        recommend_timeline: {
            limit: null,
            remaining: null,
            reset_unix_time: null,
        },
    };
    let counters_ready = false;
    const pending_updates: Array<() => void> = [];
    chrome.storage.local.get("api_access_limit", (value) => {
        const saved = value.api_access_limit;
        if (saved && typeof saved === "object") {
            for (const key of Object.keys(access_limit) as Array<
                keyof AccessLimit
            >) {
                const counter = saved[key];
                if (!counter || typeof counter !== "object") continue;
                for (const field of Object.keys(access_limit[key]) as Array<
                    keyof ApiRateLimit
                >) {
                    const entry = counter[field];
                    if (typeof entry === "string" || entry === null) {
                        access_limit[key][field] = entry;
                    }
                }
            }
        }
        counters_ready = true;
        for (const update of pending_updates.splice(0)) update();
    });
    function send_content_script(value: AccessLimit) {
        // Snapshot each response so subsequent updates cannot mutate an in-flight write.
        chrome.storage.local.set({
            api_access_limit: {
                search: { ...value.search },
                time_line: { ...value.time_line },
                recommend_timeline: { ...value.recommend_timeline },
            },
        });
    }
    let rate_limit_until = 0;
    chrome.storage.local.get("opd_rate_limit_until", (value) => {
        rate_limit_until = Math.max(
            rate_limit_until,
            Number(value.opd_rate_limit_until) || 0,
        );
    });
    chrome.webRequest.onHeadersReceived.addListener(
        function (resp) {
            const response_headers = resp.responseHeaders ?? [];
            const header = (name: string) =>
                response_headers.find(
                    (item) => item.name?.toLowerCase() === name,
                )?.value;
            if (
                resp.statusCode === 429 ||
                header("x-rate-limit-remaining") === "0"
            ) {
                const now = Date.now();
                const reset = Number(header("x-rate-limit-reset")) * 1000;
                const retry = header("retry-after");
                const retry_time =
                    retry == null
                        ? NaN
                        : /^\d+$/.test(retry)
                          ? now + Number(retry) * 1000
                          : Date.parse(retry);
                const deadline = Math.max(
                    now + 60000,
                    Number.isFinite(reset) ? reset : 0,
                    Number.isFinite(retry_time) ? retry_time : 0,
                );
                rate_limit_until = Math.max(rate_limit_until, deadline);
                chrome.storage.local.set({
                    opd_rate_limit_until: rate_limit_until,
                });
            }
            const update_counters = () => {
                for (const [endpoint, key] of api_endpoints) {
                    if (!resp.url.includes(endpoint)) continue;
                    const counter = access_limit[key];
                    for (const item of response_headers) {
                        const field = rate_limit_fields.get(item.name);
                        if (field) counter[field] = item.value ?? null;
                    }
                    send_content_script(access_limit);
                }
            };
            // Keep the listener registered synchronously, but do not overwrite
            // persisted counters before the startup read has completed.
            if (counters_ready) update_counters();
            else pending_updates.push(update_counters);
        },
        { urls: ["*://x.com/i/api/*"] },
        ["responseHeaders"],
    );
    //
}
