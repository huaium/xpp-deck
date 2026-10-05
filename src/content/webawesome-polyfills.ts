import "@webcomponents/custom-elements";
import { forceElementInternalsPolyfill } from "element-internals-polyfill";

// Native attachInternals cannot attach to polyfilled custom elements in Chromium's
// isolated content-script world. Leave native browser registries untouched.
if ("polyfillWrapFlushCallback" in customElements) {
    forceElementInternalsPolyfill();
}
