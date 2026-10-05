export function profileHarness(confirmed, active = 1, count = 3) {
    const store = Array.from({ length: count }, (_, i) => ({
        name: `profile-${i}`,
        profile: [{ type: "home" }],
    }));
    const writes = [];
    const alerts = [];
    const buttons = new Map();
    const globals = {
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
                            opd_settings: JSON.stringify({
                                version: "1",
                                last_load_profile: active,
                            }),
                        });
                    },
                },
            },
        },
        opd_confirm: async () => confirmed,
        opd_alert: async (message) => alerts.push(message),
        i18n_message: (key) => key,
        column_settings_save: () => ({
            column_settings: [
                { type: "explore", column_save_path: "/i/bookmarks" },
            ],
        }),
        create_profile_list_btn: () => {},
    };
    return { store, writes, alerts, buttons, globals };
}
