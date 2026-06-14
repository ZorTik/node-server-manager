import {ServicePendingActionError} from "@nsm/engine/error";

export type UnlockObserver = (id: string, status?: string, err?: any) => void;

const statuses = {};
const status_types = {};
const obs: Map<string, UnlockObserver[]> = new Map();
const obsAll: (() => void)[] = [];

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

  return (err?: any) => {
    if (getActionType(id) !== tp) {
      throw new Error(
        `Unlocking action type ${tp} does not match the current action type ${getActionType(id)} for service ${id}`,
      );
    }

    unlockBusyAction(id, err);
  };
}

export function unlockBusyAction(id: string, err?: any) {
  const tp = getActionType(id);
  if (!tp) {
    throw new Error("No busy action in process");
  }

  delete statuses[id];
  delete status_types[id];

  (obs.get(id) ?? []).forEach((o) => o(id, tp, err));
  obs.delete(id);

  if (pendingCount() == 0) {
    obsAll.forEach((o) => o());
    obsAll.splice(0, obsAll.length);
  }
}

export function whenUnlocked(id: string, cb: UnlockObserver) {
  if (isServicePending(id)) {
    obs.set(id, obs.get(id) ?? []);
    obs.get(id).push(cb);
  } else {
    cb(id, undefined, undefined);
  }
}

export function whenUnlockedAll(cb: () => void) {
  if (pendingCount() > 0) {
    obsAll.push(cb);
  } else {
    cb();
  }
}

export function isServicePending(id: string): boolean {
  return statuses[id] || false;
}

export function getActionType(id: string): string | undefined {
  return status_types[id] || undefined;
}

export function reqNotPending(id: string) {
  if (stopping == false && isServicePending(id)) {
    throw new ServicePendingActionError(id, getActionType(id));
  }
}

export function setStopping() {
  stopping = true;
}

export function pendingCount() {
  return Object.keys(statuses).filter((k) => statuses[k]).length;
}
