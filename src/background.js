chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message == "dnr_upd") {
        /*chrome.declarativeNetRequest.updateEnabledRulesets(({disableRulesetIds: ["ruleset_1"]}));
            chrome.declarativeNetRequest.updateEnabledRulesets(({enableRulesetIds: ["ruleset_1"]}));*/
        const dnr_rules = [
            {
                id: 1,
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
                    urlFilter: "x.com",
                    resourceTypes: [
                        "main_frame",
                        "sub_frame",
                        "stylesheet",
                        "script",
                        "image",
                        "font",
                        "object",
                        "xmlhttprequest",
                        "ping",
                        "csp_report",
                        "media",
                        "websocket",
                        "other",
                    ],
                },
            },
        ];
        chrome.declarativeNetRequest.updateSessionRules(
            {
                //updateDynamicRules
                removeRuleIds: [1],
                addRules: dnr_rules,
            },
            function () {
                console.log("dnr_update_ok");
                sendResponse(true);
            },
        );
    }
    if (request.message == "ext_reload") {
        chrome.runtime.reload();
    }
    return true;
});
//
let access_limit = {
    search: { limit: null, remaining: null, reset_unix_time: null },
    time_line: { limit: null, remaining: null, reset_unix_time: null },
    recommend_timeline: { limit: null, remaining: null, reset_unix_time: null },
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
chrome.webRequest.onHeadersReceived.addListener(
    function (resp) {
        const response_headers = resp.responseHeaders ?? [];
        if (resp.url.search(/SearchTimeline/g) != -1) {
            //console.log(resp);
            for (let index = 0; index < response_headers.length; index++) {
                switch (response_headers[index].name) {
                    case "x-rate-limit-remaining":
                        access_limit.search.remaining =
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-limit":
                        access_limit.search.limit =
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-reset":
                        access_limit.search.reset_unix_time =
                            response_headers[index].value;
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
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-limit":
                        access_limit.time_line.limit =
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-reset":
                        access_limit.time_line.reset_unix_time =
                            response_headers[index].value;
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
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-limit":
                        access_limit.recommend_timeline.limit =
                            response_headers[index].value;
                        break;
                    case "x-rate-limit-reset":
                        access_limit.recommend_timeline.reset_unix_time =
                            response_headers[index].value;
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
