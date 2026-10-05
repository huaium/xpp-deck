import assert from "node:assert/strict";
import test from "node:test";
import { loadFunctions } from "./helpers/source.mjs";

test("column drops preserve iframe state and save the new order", () => {
    for (const scenario of [
        "move",
        "self",
        "adjacent",
        "unsupported",
        "missing",
    ]) {
        let moves = 0;
        let saves = 0;
        let alerts = 0;
        class Element {
            style = {};
            handlers = new Map();
            addEventListener(name, handler) {
                this.handlers.set(name, handler);
            }
            matches() {
                return true;
            }
            querySelector() {
                assert.fail("Drag must not read or reset iframe URLs");
            }
        }
        const dragged = new Element();
        const target = scenario === "self" ? dragged : new Element();
        if (scenario === "adjacent") dragged.nextElementSibling = target;
        target.parentElement =
            scenario === "unsupported"
                ? {}
                : {
                      moveBefore(node, before) {
                          assert.equal(node, dragged);
                          assert.equal(before, target);
                          moves++;
                      },
                      insertBefore() {
                          assert.fail("Must not disconnect the iframe");
                      },
                  };
        const { column_dd } = loadFunctions(
            "../src/content/run.ts",
            ["column_dd"],
            "",
            {
                document: {
                    querySelectorAll: () => [target],
                    getElementById: () =>
                        scenario === "missing" ? null : dragged,
                },
                HTMLElement: Element,
                last_load_profile: 1,
                column_rename: () => {},
                column_settings_save: () => saves++,
                opd_alert: () => alerts++,
                i18n_message_or_fallback: (_key, fallback) => fallback,
            },
        );
        column_dd();
        target.handlers.get("drop")({
            currentTarget: target,
            preventDefault() {},
            dataTransfer: { getData: () => "column-1" },
        });
        assert.equal(moves, scenario === "move" ? 1 : 0);
        assert.equal(saves, moves);
        assert.equal(alerts, scenario === "unsupported" ? 1 : 0);
        assert.equal(target.style.borderLeft, "");
    }
});
