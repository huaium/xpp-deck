import "@webcomponents/custom-elements";
import { forceElementInternalsPolyfill } from "element-internals-polyfill";
import { CustomStateSet } from "element-internals-polyfill/dist/CustomStateSet.js";

// Native attachInternals cannot attach to polyfilled custom elements in Chromium's
// isolated content-script world. Leave native browser registries untouched.
if ("polyfillWrapFlushCallback" in customElements) {
    // This polyfill still requires the old '--' state prefix. Web Awesome uses
    // modern identifiers; normalize all operations so membership stays coherent.
    const prototype = CustomStateSet.prototype;
    const normalize = (state: string) =>
        state.startsWith("--") ? state : `--${state}`;
    const add = prototype.add;
    const remove = prototype.delete;
    const has = prototype.has;
    prototype.add = function (state: string) {
        return add.call(this, normalize(state));
    };
    prototype.delete = function (state: string) {
        return remove.call(this, normalize(state));
    };
    prototype.has = function (state: string) {
        return has.call(this, normalize(state));
    };
    forceElementInternalsPolyfill();
}
