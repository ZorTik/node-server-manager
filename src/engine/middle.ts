import {ServiceManager} from "@nsm/engine/manager";
import {currentContext} from "@nsm/app";

export type ServiceActionType = 'create' | 'resume' | 'stop' | 'forceStop' | 'sendStopSignal' | 'delete';

/**
 * Represents an error that occurred during a service action.
 */
export interface ServiceActionError {
  serviceId?: string;
  type: ServiceActionType;
  message: string;
}

export interface ErrorPublisher {

  /**
   * Publishes an error that occurred during a service action.
   *
   * @param action The details of the service action error to publish.
   */
  publishError(action: ServiceActionError): Promise<void>;
}

const publishers: ErrorPublisher[] = [
  {
    // Logger publisher
    async publishError(action: ServiceActionError) {
      currentContext.logger.error(`${action.serviceId ? `Service ${action.serviceId} f` : "F"}ailed action ${action.type}: ${action.message}`);
    }
  }
];

/**
 * Registers a new error publisher to publish notifications of service action errors.
 *
 * @param publisher The error publisher to register.
 */
export const registerErrorPublisher = (publisher: ErrorPublisher) => {
  publishers.push(publisher);
}

const publishError = async (action: ServiceActionError) => {
  try {
    await Promise.all(publishers.map(p => p.publishError(action)));
  } catch (e) {
    currentContext.logger.error('Failed to publish service action error', e);
  }
}

/**
 * Decorates an asynchronous function to allow for additional behavior, such as error handling or logging.
 *
 * @param fn The asynchronous function to decorate.
 * @param actionType The type of action being performed, used for logging or error handling purposes.
 * @param serviceIdExtractor An optional function to extract the service ID from the function arguments.
 * @returns A new function
 */
const decorateFunc = <T, F extends (...args: Parameters<F>) => Promise<T>>(
  fn: F,
  actionType: ServiceActionType,
  serviceIdExtractor: (args: Parameters<F>) => string = (args) => args[0] as string,
) => {
  return async (...args: Parameters<F>) => {
    try {
      return await fn(...args);
    } catch (e) {
      const action: ServiceActionError = {
        serviceId: serviceIdExtractor?.(args),
        type: actionType,
        message: e instanceof Error ? e.message : String(e),
      };
      await publishError(action);

      throw e;
    }
  }
}

/**
 * Wraps a {@link ServiceManager} instance with additional capabilities.
 * Asynchronous service lifecycle methods are decorated to allow
 * additional behavior.
 *
 * @param manager The original ServiceManager instance to wrap.
 * @returns A new ServiceManager instance with decorated methods.
 */
export const middleLayer = (manager: ServiceManager): ServiceManager => {
  return {
    ...manager,

    createService: decorateFunc(manager.createService, "create", null),

    resumeService: decorateFunc(manager.resumeService, "resume"),

    stopService: decorateFunc(manager.stopService, "stop"),

    stopServiceForcibly: decorateFunc(manager.stopServiceForcibly, "forceStop"),

    sendStopSignal: decorateFunc(manager.sendStopSignal, "sendStopSignal"),

    deleteService: decorateFunc(manager.deleteService, "delete"),
  }
}