type ChromeStorageChanges = Record<
    string,
    { oldValue?: unknown; newValue?: unknown }
>;

interface ChromeStorageArea {
    get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void,
    ): void;
    set(items: Record<string, unknown>, callback?: () => void): void;
    remove(keys: string | string[], callback?: () => void): void;
}

interface ChromeRuntime {
    getManifest(): { version: string };
    getURL(path: string): string;
    reload(): void;
    sendMessage<T = unknown>(message: unknown): Promise<T>;
    onMessage: {
        addListener(
            callback: (
                request: { message?: string },
                sender: unknown,
                sendResponse: (response?: unknown) => void,
            ) => boolean | void,
        ): void;
    };
}

interface ChromeDeclarativeNetRequest {
    updateSessionRules(
        options: { removeRuleIds?: number[]; addRules?: unknown[] },
        callback?: () => void,
    ): void;
}

interface ChromeTabs {
    create(createProperties: { url?: string }): void;
}

interface ChromeWebRequest {
    onHeadersReceived: {
        addListener(
            callback: (details: {
                url: string;
                statusCode?: number;
                responseHeaders?: Array<{
                    name?: string;
                    value?: string;
                }>;
            }) => void,
            filter: { urls: string[] },
            extraInfoSpec?: string[],
        ): void;
    };
}

interface ChromeI18n {
    getMessage(messageName: string, substitutions?: string | string[]): string;
}

interface Chrome {
    runtime: ChromeRuntime;
    storage: {
        local: ChromeStorageArea;
        onChanged: {
            removeListener(callback: (changes: ChromeStorageChanges, namespace: string) => void): void;
            addListener(
                callback: (
                    changes: ChromeStorageChanges,
                    namespace: string,
                ) => void,
            ): void;
        };
    };
    i18n: ChromeI18n;
    declarativeNetRequest: ChromeDeclarativeNetRequest;
    tabs: ChromeTabs;
    webRequest: ChromeWebRequest;
}

declare const chrome: Chrome;

interface Window {
    __opdBootstrap?: {
        beforeunloadBypassKey?: string;
        rootThemeAttribute?: string;
        getCookieColorMode?: () => string | null;
        applyRootThemeMarker?: (theme?: string | null) => void;
    };
}

interface Navigator {
    brave?: unknown;
}

interface Element {
    value?: string;
    style: CSSStyleDeclaration;
}

interface Event {
    detail?: unknown;
}
