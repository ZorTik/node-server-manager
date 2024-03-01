const statuses = {};

export async function asyncServiceRun<T>(id: string, f: () => Promise<T>): Promise<T> {
    let e_ = null;
    try {
        statuses[id] = true;
        return await f();
    } catch (e) {
        e_ = e;
    } finally {
        delete statuses[id];
    }
    if (e_) {
        throw e_;
    }
}

export function isServicePending(id: string): boolean {
    return statuses[id] || false;
}