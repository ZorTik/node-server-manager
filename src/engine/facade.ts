import {Service} from "@nsm/engine/service";
import {ServiceSession} from "@nsm/engine/session";
import {InternalSession} from "@nsm/engine/runner";
import {PermaModel} from "@nsm/persistence";

import * as manager from "@nsm/engine/service";
import * as runner from "@nsm/engine/runner";

export type ServiceInfo = Service & {
  state: State;
  session?: ServiceSession;
  internalSession?: InternalSession;
}

export type State = "BUILDING" | "RUNNING" | "STOPPING" | "STOPPED";

export interface Facade {
  /**
   * Deletes a service by its ID. If the service is currently running, it will be stopped before deletion.
   *
   * @param id The ID of the service to delete.
   */
  deleteService(id: string): Promise<void>;

  /**
   * Retrieves information about a service, including its current state and session information if requested.
   *
   * @param from The identifier for the service, which can be either a string ID or a PermaModel instance.
   * @param options Optional parameters for retrieving service information.
   * @returns A promise that resolves to the service information, or undefined if the service is not found.
   */
  getServiceInfo(
    from: string | PermaModel,
    options?: { includeSession?: boolean },
  ): Promise<ServiceInfo | undefined>;

  /**
   * Retrieves the current state of a service by its ID.
   *
   * @param id The ID of the service to check the state of.
   * @returns A promise that resolves to the current state of the service.
   */
  getServiceState(id: string): Promise<State>;
}

export const deleteService: Facade["deleteService"] = async (id) => {
  if (runner.isStarting(id) || runner.isRunning(id)) {
    // if running, stop the service first before deleting
    const task = await runner.stopService(id, true);
    await task.promise;
  }

  await runner.clearService(id);
  await manager.deleteService(id);
}

export const getServiceInfo: Facade["getServiceInfo"] = async (from, options) => {
  const service = await manager.getService(from);
  if (!service) {
    return undefined;
  }

  const runningService = options?.includeSession
    ? runner.getRunningService(service.serviceId)
    : null;

  return {
    ...service,
    state: await getServiceState(service.serviceId),
    session: runningService ? runningService.session : undefined,
    internalSession: runningService ? runningService.internalSession : undefined,
  }
}

export const getServiceState: Facade["getServiceState"] = async (id) => {
  if (runner.isStopping(id)) {
    return "STOPPING";
  }

  const stage = runner.getServiceStage(id);
  if (stage) {
    return stage.state.ready ? "RUNNING" : "BUILDING";
  } else if (runner.isStarting(id)) {
    return "BUILDING";
  } else {
    return "STOPPED";
  }
}