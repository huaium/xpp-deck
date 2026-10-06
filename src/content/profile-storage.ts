export async function profile_storage_request(
    operation: Record<string, unknown>,
) {
    const response = await chrome.runtime.sendMessage<{
        ok: boolean;
        value?: any;
        error?: string;
    }>({
        message: "profiles",
        operation,
    });
    if (!response?.ok)
        throw new Error(
            response?.error ||
                "Unable to save profiles. Please reload the deck.",
        );
    return response.value;
}
