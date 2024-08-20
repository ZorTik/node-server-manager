const statuses = {};
const status_types = {};

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