export async function prepare_custom_element_registry(
    load_polyfills = () => import("./webawesome-polyfills"),
) {
    if (
        chrome.runtime.getURL("").startsWith("moz-extension:") &&
        customElements
    ) {
        (
            customElements as CustomElementRegistry & {
                forcePolyfill?: boolean;
            }
        ).forcePolyfill = true;
    }
    await load_polyfills();
}
