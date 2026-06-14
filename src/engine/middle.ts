import {ServiceManager} from "@nsm/engine/manager";
import {currentContext} from "@nsm/app";
import {KnownError} from "@nsm/engine/error";
import {AsyncTask} from "@nsm/util/promises";

export type ServiceActionType =
  | "create"
  | "resume"
  | "stop"
  | "delete";

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
  // The publishers
];

/**
 * Registers a new error publisher to publish notifications of service action errors.
 * This is called when fails an ServiceManager call that manipulates with service lifecycle state,
 * so registering this is quite useful for handling service action request errors.
 *
 * @param publisher The error publisher to register.
 */
export const registerErrorPublisher = (publisher: ErrorPublisher) => {
  publishers.push(publisher);
};

const publishError = async (action: ServiceActionError) => {
  try {
    await Promise.all(publishers.map((p) => p.publishError(action)));
  } catch (e) {
    currentContext.logger.error("Failed to publish service action error", e);
  }
};

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
  serviceIdExtractor?: (args: Parameters<F>) => string,
) => {
  return async (...args: Parameters<F>) => {
    try {
      // @ts-ignore
      const result = await fn(...args);
      if (result instanceof AsyncTask) {
        // if the result is a scheduled task, attach error handler to catch any errors during the execution of the task
        result.promise.catch((e) => handleExecutionError(serviceIdExtractor, args, actionType, e));
      }

      return result;
    } catch (e) {
      await handleExecutionError(serviceIdExtractor, args, actionType, e);
    }
  };
};

/**
 * Handles errors that occur during the execution of a service action.
 *
 * @see {@link decorateFunc}
 */
const handleExecutionError = async <T, F extends (...args: Parameters<F>) => Promise<T>>(
  serviceIdExtractor: (args: Parameters<F>) => string,
  args: Parameters<F>,
  actionType: ServiceActionType,
  e: Error
) => {
  const action: ServiceActionError = {
    serviceId: serviceIdExtractor?.(args),
    type: actionType,
    message: e instanceof Error ? e.message : String(e),
  };
  await publishError(action);

  // don't log stack trace of known errors
  const errorMeta: any[] = e instanceof KnownError ? [] : [e];
  currentContext.logger.error(
    `${action.serviceId ? `Service ${action.serviceId} f` : "F"}ailed action ${action.type}: ${action.message}`,
    ...errorMeta,
  );

  throw e;
}

/**
 * Creates a service ID extractor function that extracts the service ID from the
 * specified argument index of the function arguments.
 *
 * @param argIndex The index of the argument from which to extract the service ID.
 * @returns A function that takes the function arguments and returns the extracted service ID.
 */
const argServiceIdExtractor = (
  argIndex: number,
): (<T, F extends (...args: Parameters<F>) => Promise<T>>(
  args: Parameters<F>,
) => string) => {
  return (args) => {
    if (!Array.isArray(args)) {
      throw new Error("Expected function call arguments to be an array");
    }

    const argsArray = args as unknown[];
    // Check if the argument index is within bounds
    if (argsArray.length <= argIndex) {
      throw new Error(
        `Expected at least ${argIndex + 1} arguments, but got ${argsArray.length}`,
      );
    }

    const serviceId = argsArray[argIndex];
    if (typeof serviceId !== "string") {
      throw new Error(
        `Expected service ID argument to be a string, but got ${typeof serviceId}`,
      );
    }

    return serviceId;
  };
};

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

    createService: decorateFunc(manager.createService, "create"),

    resumeService: decorateFunc(
      manager.resumeService,
      "resume",
      argServiceIdExtractor(0),
    ),

    stopService: decorateFunc(
      manager.stopService,
      "stop",
      argServiceIdExtractor(0),
    ),

    deleteService: decorateFunc(
      manager.deleteService,
      "delete",
      argServiceIdExtractor(0),
    ),
  };
};
