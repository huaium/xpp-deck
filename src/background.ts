export function start_background() {
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

    let access_limit: AccessLimit = {
        search: { limit: null, remaining: null, reset_unix_time: null },
        time_line: { limit: null, remaining: null, reset_unix_time: null },
        recommend_timeline: {
            limit: null,
            remaining: null,
            reset_unix_time: null,
        },
    };
    function send_content_script(value) {
        // session.setAccessLevel is unsupported in Firefox, so session storage is deferred for now.
        //chrome.storage.session.set
        chrome.storage.local.set({ api_access_limit: value }, function () {
            console.log("set ok");
        });
        /*chrome.storage.local.set({api_access_limit: value}).then(() => {
        console.log("set ok");
      });*/
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
            if (resp.url.search(/SearchTimeline/g) != -1) {
                //console.log(resp);
                for (let index = 0; index < response_headers.length; index++) {
                    switch (response_headers[index].name) {
                        case "x-rate-limit-remaining":
                            access_limit.search.remaining =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-limit":
                            access_limit.search.limit =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-reset":
                            access_limit.search.reset_unix_time =
                                response_headers[index].value ?? null;
                            break;
                        default:
                            break;
                    }
                }
                //(access_limit);
                send_content_script(access_limit);
            }
            if (resp.url.search(/HomeLatestTimeline/g) != -1) {
                //console.log(resp);
                for (let index = 0; index < response_headers.length; index++) {
                    switch (response_headers[index].name) {
                        case "x-rate-limit-remaining":
                            access_limit.time_line.remaining =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-limit":
                            access_limit.time_line.limit =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-reset":
                            access_limit.time_line.reset_unix_time =
                                response_headers[index].value ?? null;
                            break;
                        default:
                            break;
                    }
                }
                //console.log(access_limit)
                send_content_script(access_limit);
            }
            if (resp.url.search(/HomeTimeline/g) != -1) {
                //console.log(resp);
                for (let index = 0; index < response_headers.length; index++) {
                    switch (response_headers[index].name) {
                        case "x-rate-limit-remaining":
                            access_limit.recommend_timeline.remaining =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-limit":
                            access_limit.recommend_timeline.limit =
                                response_headers[index].value ?? null;
                            break;
                        case "x-rate-limit-reset":
                            access_limit.recommend_timeline.reset_unix_time =
                                response_headers[index].value ?? null;
                            break;
                        default:
                            break;
                    }
                }
                //console.log(access_limit)
                send_content_script(access_limit);
            }
        },
        { urls: ["*://x.com/i/api/*"] },
        ["responseHeaders"],
    );
    //
}
