export type UnlockObserver = (id: string, status?: string) => void;

const statuses = {};
const status_types = {};
const obs: Map<string, UnlockObserver[]> = new Map();

let stopping = false;

/**
 * Lock a service behind a pending operation lock.
 *
 * @param id The service ID
 * @param tp The type of action
 * @returns The unlock function
 */
export function lockBusyAction(id: string, tp: string) {
    reqNotPending(id);
    statuses[id] = true;
    status_types[id] = tp; // type of action
    return () => {
        delete statuses[id];
        delete status_types[id];
        //
        (obs.get(id) ?? []).forEach(o => o(id, tp));
    }
}

export function whenUnlocked(id: string, cb: UnlockObserver) {
    if (isServicePending(id)) {
        obs.set(id, obs.get(id) ?? []);
        obs.get(id).push(cb);
    } else {
        cb(id, undefined);
    }
}

export function lckStatusTp(id: string, tp: string) {
    status_types[id] = tp;
}

export function ulckStatusTp(id: string) {
    delete status_types[id];
}

export function isServicePending(id: string): boolean {
    return statuses[id] || false;
}

export function getActionType(id: string): string|undefined {
    return status_types[id] || undefined;
}

export function reqNotPending(id: string) {
    if (stopping == false && isServicePending(id)) {
        throw new Error('Service is pending another action.');
    }
}

export function setStopping() {
    stopping = true;
}