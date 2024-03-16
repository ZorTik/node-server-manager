const statuses = {};
const locks = [];

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
    if (locks.includes(id)) {
        throw new Error("Service is locked.");
    }
    return statuses[id] || false;
}

export function lock(id: string) {
    if (locks.includes(id)) {
        return false;
    }
    locks.push(id);
    return true;
}

export function unlock(id: string) {
    locks.splice(locks.indexOf(id), 1);
}