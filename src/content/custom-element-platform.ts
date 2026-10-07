import "@webcomponents/custom-elements";

declare const XPCNativeWrapper: { unwrap<T>(value: T): T };

// Unwrap only the objects installed by our polyfill, never X's page objects.
export const xpdCustomElements = XPCNativeWrapper.unwrap(window.customElements);
export const xpdCustomElementRegistry = XPCNativeWrapper.unwrap(
    window.CustomElementRegistry,
);
export const xpdHTMLElement = XPCNativeWrapper.unwrap(window.HTMLElement);
