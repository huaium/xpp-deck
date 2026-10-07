export type LoadingPreferences = {
    concurrency: number;
    minGapMs: number;
    maxGapMs: number;
    timeoutMs: number;
};
export const default_loading_preferences: LoadingPreferences = {
    concurrency: 1,
    minGapMs: 2000,
    maxGapMs: 3000,
    timeoutMs: 30000,
};
export const loading_preferences = { ...default_loading_preferences };
export function parse_loading_preferences(
    value: unknown,
): LoadingPreferences | null {
    const candidate = value as LoadingPreferences | null;
    if (
        !candidate ||
        !Number.isInteger(candidate.concurrency) ||
        candidate.concurrency < 1 ||
        candidate.concurrency > 2 ||
        !Number.isInteger(candidate.minGapMs) ||
        !Number.isInteger(candidate.maxGapMs) ||
        candidate.minGapMs < 500 ||
        candidate.maxGapMs > 60000 ||
        candidate.minGapMs > candidate.maxGapMs ||
        !Number.isInteger(candidate.timeoutMs) ||
        candidate.timeoutMs < 5000 ||
        candidate.timeoutMs > 120000
    )
        return null;
    return {
        concurrency: candidate.concurrency,
        minGapMs: candidate.minGapMs,
        maxGapMs: candidate.maxGapMs,
        timeoutMs: candidate.timeoutMs,
    };
}
export function apply_loading_preferences(value: unknown) {
    Object.assign(
        loading_preferences,
        parse_loading_preferences(value) ?? default_loading_preferences,
    );
}
