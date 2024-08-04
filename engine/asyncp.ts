import {status} from "@nsm/server";

const statuses = {};
const status_types = {};

/**
 * Lock a service behind a pending operation lock.
 *
 * @param id The service ID
 * @param tp The type of action
 * @param f The function to run
 * @returns The result of the function
 */
export async function doBusyAction<T>(id: string, tp: string, f: () => (Promise<T>|T)): Promise<T> {
    let e_ = null;
    reqNotPending(id);
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
    return statuses[id] || false;
}

export function getActionType(id: string): string|undefined {
    return status_types[id] || undefined;
}

export function reqNotPending(id: string) {
    if (status !== "stopping" && isServicePending(id)) {
        throw new Error('Service is pending another action.');
    }
}