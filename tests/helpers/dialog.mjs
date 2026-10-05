import { loadFunctions } from "./source.mjs";

// Event adapter only; real layout and focus are covered by the browser suite.
export function dialogHarness() {
    const listeners = new Map();
    const document = {
        activeElement: null,
        createElement: (tag) => new Element(tag),
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name, fn) => {
            if (listeners.get(name) === fn) listeners.delete(name);
        },
    };
    class Element {
        constructor(tag) {
            this.tag = tag;
            this.children = [];
            this.attributes = new Map();
            this.handlers = new Map();
            this.classList = { add: () => {} };
        }
        appendChild(child) {
            child.parent = this;
            this.children.push(child);
        }
        setAttribute(key, value) {
            this.attributes.set(key, value);
        }
        hasAttribute(key) {
            return this.attributes.has(key);
        }
        contains(element) {
            return (
                this === element ||
                this.children.some((child) => child.contains(element))
            );
        }
        querySelectorAll() {
            return this.children
                .flatMap((child) => [child, ...child.querySelectorAll()])
                .filter((child) =>
                    ["button", "input", "select"].includes(child.tag),
                );
        }
        addEventListener(name, fn) {
            this.handlers.set(name, fn);
        }
        click() {
            this.handlers.get("click")?.();
        }
        focus() {
            document.activeElement = this;
        }
        select() {
            this.selected = true;
        }
        remove() {
            this.parent.children = this.parent.children.filter(
                (child) => child !== this,
            );
        }
    }
    document.body = new Element("body");
    const trigger = new Element("button");
    trigger.focus();
    const { open_opd_dialog: open } = loadFunctions(
        "../src/content/prelude.ts",
        ["enqueue_opd_dialog", "open_opd_dialog", "animate_dialog_exit"],
        `let opd_dialog_queue = Promise.resolve();
         function ensure_opd_dialog_style() {}
         function is_opd_dark_theme_enabled() { return false; }
         function i18n_message_or_fallback(key, fallback) { return fallback; }`,
        {
            document,
            HTMLElement: Element,
            window: { matchMedia: () => ({ matches: true }) },
        },
    );
    return {
        document,
        trigger,
        listeners,
        open,
        controls: () =>
            document.body.children[0].children[0].querySelectorAll(),
        key(key, options = {}) {
            const event = {
                key,
                preventDefault() {
                    this.prevented = true;
                },
                stopPropagation() {},
                ...options,
            };
            listeners.get("keydown")?.(event);
            return event;
        },
    };
}
