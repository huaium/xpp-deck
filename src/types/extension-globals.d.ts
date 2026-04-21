declare const chrome: any;

interface Window {
    __opdBootstrap?: {
        beforeunloadBypassKey?: string;
        rootThemeAttribute?: string;
        getCookieColorMode?: () => string | null;
        applyRootThemeMarker?: (theme?: string | null) => void;
    };
    OpdExtAutoReload?: unknown;
    OpdExtMediaViewer?: unknown;
    OpdMediaViewerBlocker?: unknown;
}

interface Navigator {
    brave?: unknown;
}

interface Element {
    value?: any;
    checked?: boolean;
    href?: string;
    src?: string;
    title?: string;
    style: CSSStyleDeclaration;
    focus?: () => void;
    load?: () => void;
    play?: () => Promise<void> | void;
    pause?: () => void;
    volume?: number;
}

interface Event {
    detail?: any;
}
