type ColumnLoadJob = {
    key: object;
    start: (done: () => void) => void | (() => void);
    valid: () => boolean;
    priority: () => number;
};

// A load event/timeout ends navigation work; internal X requests remain opaque.
export function create_column_load_scheduler() {
    const jobs = new Map<object, ColumnLoadJob>();
    const active = new Map<object, () => void>();
    const dispose_callbacks: (() => void)[] = [];
    let stopped = false;
    let last_start = -Infinity;
    let start_gap = 0;
    let concurrency_limit = Math.random() < 0.5 ? 1 : 2;
    let wake: ReturnType<typeof setTimeout> | undefined;
    const pump = () => {
        if (stopped) return;
        if (wake !== undefined) clearTimeout(wake);
        wake = undefined;
        for (const [key, job] of jobs) {
            if (!active.has(key) && !job.valid()) jobs.delete(key);
        }
        if (active.size >= concurrency_limit) return;
        const pending = [...jobs.values()].filter(
            (job) => !active.has(job.key),
        );
        if (pending.length === 0) return;
        const wait = start_gap - (Date.now() - last_start);
        if (wait > 0) {
            wake = setTimeout(pump, wait);
            return;
        }
        pending.sort((a, b) => a.priority() - b.priority());
        const job = pending[0];
        let cleanup: (() => void) | undefined;
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            cleanup?.();
            active.delete(job.key);
            jobs.delete(job.key);
            pump();
        };
        const timeout = setTimeout(done, 30000);
        active.set(job.key, done);
        last_start = Date.now();
        // Sample once per start, not on every queue wake-up or enqueue.
        start_gap = 800 + Math.floor(Math.random() * 401);
        concurrency_limit = Math.random() < 0.5 ? 1 : 2;
        try {
            cleanup = job.start(done) || undefined;
            if (finished) cleanup?.();
        } catch (error) {
            done();
            console.error("Column load failed", error);
        }
        pump();
    };
    return {
        has(key: object) {
            return jobs.has(key);
        },
        enqueue(job: ColumnLoadJob) {
            if (stopped || jobs.has(job.key) || !job.valid()) return false;
            jobs.set(job.key, job);
            pump();
            return true;
        },
        onDispose(callback: () => void) {
            if (stopped) callback();
            else dispose_callbacks.push(callback);
            return () => {
                const index = dispose_callbacks.indexOf(callback);
                if (index !== -1) dispose_callbacks.splice(index, 1);
            };
        },
        dispose() {
            if (stopped) return;
            stopped = true;
            if (wake !== undefined) clearTimeout(wake);
            for (const finish of [...active.values()]) finish();
            jobs.clear();
            dispose_callbacks.splice(0).forEach((callback) => callback());
        },
    };
}
