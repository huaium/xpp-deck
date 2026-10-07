// All profile mutations share this queue in the background worker.
export function create_profile_storage() {
    let queue: Promise<unknown> = Promise.resolve();
    const read = () =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
            chrome.storage.local.get(
                ["xpd_profile_store", "xpd_settings"],
                (value) => {
                    if (chrome.runtime.lastError)
                        reject(new Error(chrome.runtime.lastError.message));
                    else resolve(value);
                },
            );
        });
    const write = (value: Record<string, unknown>) =>
        new Promise<void>((resolve, reject) => {
            chrome.storage.local.set(value, () => {
                if (chrome.runtime.lastError)
                    reject(new Error(chrome.runtime.lastError.message));
                else resolve();
            });
        });
    const valid_columns = (columns: unknown) =>
        Array.isArray(columns) &&
        columns.length > 0 &&
        columns.every(
            (column) =>
                column &&
                typeof column === "object" &&
                typeof column.type === "string",
        );
    async function execute(operation: Record<string, unknown>) {
        if (!operation || typeof operation !== "object")
            throw new Error("Invalid profile operation");
        const stored = await read();
        if (
            operation.op === "reset" &&
            operation.only_if_missing &&
            (stored.xpd_profile_store !== undefined ||
                stored.xpd_settings !== undefined)
        )
            return stored;
        if (operation.op === "read" && stored.xpd_profile_store === undefined)
            return stored;
        let profiles =
            operation.op === "reset"
                ? operation.profiles
                : JSON.parse(String(stored.xpd_profile_store));
        if (
            !Array.isArray(profiles) ||
            profiles.length === 0 ||
            profiles.some(
                (profile) =>
                    !profile ||
                    typeof profile !== "object" ||
                    !valid_columns(profile.profile),
            )
        ) {
            throw new Error("Invalid saved deck profiles");
        }
        const ids = new Set<string>();
        let migrated = false;
        for (const profile of profiles) {
            if (
                operation.op === "reset" ||
                typeof profile.id !== "string" ||
                !profile.id ||
                ids.has(profile.id)
            ) {
                profile.id = crypto.randomUUID();
                migrated = true;
            }
            ids.add(profile.id);
        }
        if (operation.op === "read") {
            if (migrated)
                await write({ xpd_profile_store: JSON.stringify(profiles) });
            return { ...stored, xpd_profile_store: JSON.stringify(profiles) };
        }
        const settings =
            operation.op === "reset"
                ? operation.settings
                : JSON.parse(String(stored.xpd_settings));
        if (
            !settings ||
            typeof settings !== "object" ||
            Array.isArray(settings)
        )
            throw new Error("Invalid saved settings");
        const index = profiles.findIndex(
            (profile) => profile.id === operation.id,
        );
        let save_settings = false;
        switch (operation.op) {
            case "save":
                if (index < 0)
                    throw new Error(
                        "This profile was deleted in another tab. Reload the deck.",
                    );
                if (!valid_columns(operation.columns))
                    throw new Error("Invalid column settings");
                profiles[index].profile = operation.columns;
                break;
            case "create":
                if (
                    typeof operation.name !== "string" ||
                    !operation.name.trim() ||
                    !valid_columns(operation.columns)
                )
                    throw new Error("Invalid profile");
                profiles.push({
                    id: crypto.randomUUID(),
                    name: operation.name,
                    profile: operation.columns,
                });
                break;
            case "delete":
                if (index < 0)
                    throw new Error(
                        "This profile was already deleted. Reload the deck.",
                    );
                if (profiles.length <= 1)
                    throw new Error("The final profile cannot be deleted.");
                profiles.splice(index, 1);
                if (index <= settings.last_load_profile)
                    settings.last_load_profile = Math.max(
                        0,
                        settings.last_load_profile - 1,
                    );
                save_settings = true;
                break;
            case "select":
                if (index < 0)
                    throw new Error(
                        "This profile was deleted in another tab. Reload the deck.",
                    );
                settings.last_load_profile = index;
                save_settings = true;
                break;
            case "version":
                if (typeof operation.version !== "string")
                    throw new Error("Invalid version");
                settings.version = operation.version;
                save_settings = true;
                break;
            case "reset":
                settings.last_load_profile = 0;
                save_settings = true;
                break;
            default:
                throw new Error("Unknown profile operation");
        }
        await write({
            xpd_profile_store: JSON.stringify(profiles),
            ...(save_settings
                ? { xpd_settings: JSON.stringify(settings) }
                : {}),
        });
        return { profiles, settings };
    }
    return {
        request(operation: Record<string, unknown>) {
            const pending = queue.then(() => execute(operation));
            queue = pending.catch(() => {});
            return pending;
        },
    };
}
