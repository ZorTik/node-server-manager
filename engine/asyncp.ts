const statuses = {};
const status_types = {};
const locks = [];

export async function asyncServiceRun<T>(id: string, tp: string, f: () => Promise<T>): Promise<T> {
    let e_ = null;
    try {
        statuses[id] = true;
        status_types[id] = tp; // type of action
        return await f();
    } catch (e) {
        e_ = e;
    } finally {
        delete statuses[id];
        delete status_types[id];
    }
    if (e_) {
        throw e_;
    }
}

export function lckStatusTp(id: string, tp: string) {
    status_types[id] = tp;
}

export function ulckStatusTp(id: string) {
    delete status_types[id];
}

export function isServicePending(id: string): boolean {
    if (locks.includes(id)) {
        throw new Error("Service is locked.");
    }
    return statuses[id] || false;
}

export function getActionType(id: string): string|undefined {
    return status_types[id] || undefined;
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