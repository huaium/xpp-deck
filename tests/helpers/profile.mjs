export function profileHarness(confirmed, active = 1, count = 3) {
    const deck_lifetime = new globalThis.AbortController();
    const store = Array.from({ length: count }, (_, i) => ({
        id: `profile-id-${i}`,
        name: `profile-${i}`,
        profile: [{ type: "home" }],
    }));
    const writes = [];
    const alerts = [];
    const buttons = new Map();
    const globals = {
        deck_lifetime,
        profile_storage_request: async (operation) => {
            if (operation.op === "create") {
                store.push({
                    id: "new-id",
                    name: operation.name,
                    profile: operation.columns,
                });
                writes.push({ xpd_profile_store: JSON.stringify(store) });
            } else if (operation.op === "delete") {
                store.splice(
                    store.findIndex((p) => p.id === operation.id),
                    1,
                );
                writes.push({ xpd_profile_store: JSON.stringify(store) });
            } else if (operation.op === "select") {
                writes.push({
                    xpd_settings: JSON.stringify({
                        last_load_profile: store.findIndex(
                            (p) => p.id === operation.id,
                        ),
                        version: "1",
                    }),
                });
            } else if (operation.op === "save") {
                store.find((p) => p.id === operation.id).profile =
                    operation.columns;
                writes.push({ xpd_profile_store: JSON.stringify(store) });
            }
            return { profiles: store.slice() };
        },
        profile_store: store,
        last_load_profile: active,
        document: { querySelector: () => null },
        HTMLElement: class {},
        chrome: {
            storage: {
                local: {
                    set(value, done) {
                        writes.push(value);
                        done();
                    },
                    get(_key, done) {
                        done({
                            xpd_settings: JSON.stringify({
                                version: "1",
                                last_load_profile: active,
                            }),
                        });
                    },
                },
            },
        },
        xpd_confirm: async () => confirmed,
        xpd_prompt: async () => (confirmed ? "Named profile" : null),
        next_profile_name: () => "Profile 1",
        profile_display_name: (profile) => profile.name,
        i18n_message_or_fallback: (_key, fallback) => fallback,
        open_xpd_dialog: async () => String(active),
        xpd_alert: async (message) => alerts.push(message),
        i18n_message: (key) => key,
        column_settings_save: () => ({
            column_settings: [
                { type: "explore", column_save_path: "/i/bookmarks" },
            ],
        }),
        create_profile_list_btn: () => {},
        run: () => {},
    };
    return { store, writes, alerts, buttons, globals };
}
