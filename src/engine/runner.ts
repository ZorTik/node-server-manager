import {AsyncTask} from "@nsm/util/promises";
import {ActiveServiceSession, beginServiceSession, ServiceSession} from "@nsm/engine/session";
import {
  getActionType,
  isServicePending,
  lockBusyAction,
  unlockBusyAction,
  whenUnlocked,
  whenUnlockedAll
} from "@nsm/engine/asyncp";
import {
  combineRunListeners,
  Filters,
  MetaStorage,
  RunListener,
  RunOptions, ServiceEngine,
  ServiceState,
  StandardLabel
} from "@nsm/engine/engine";
import {
  InternalError,
  ServiceAlreadyRunningError, ServiceEngineError,
  ServiceNotFoundError, ServiceNotRunningError, ServicePendingActionError,
  TemplateNotFoundError
} from "@nsm/engine/error";
import {Service, ServiceManager} from "@nsm/engine/service";
import {Template, TemplateManager} from "@nsm/engine/template";
import {Database} from "@nsm/persistence";
import {isDebug} from "@nsm/helpers";
import winston from "winston";
import {AppConfig} from "@nsm/config";
import {ParamsResolver, ServiceArgs} from "@nsm/util/args";

type ServiceEvent = {
  id: string;
  error?: Error;
};

type ServiceStateChangeEvent = ServiceEvent & {
  state: ServiceState;
}

type ServiceEngineErrorEvent = ServiceEvent & {
  error: Error;
}

type ServiceRunnerEvents = {
  resume: ServiceEvent;
  stop: ServiceEvent;
  statechange: ServiceStateChangeEvent;
  engine_err: ServiceEngineErrorEvent;
};

/**
 * The event handler for service runner events.
 * If the handler returns true or nothing, it will be unsubscribed after this call.
 */
type EventHandler<T extends keyof ServiceRunnerEvents> = (
  event: ServiceRunnerEvents[T],
) => boolean | void;

interface StopStrategyProvider {
  /**
   * Get the stop strategy for a service.
   *
   * @param service The service for which to get the stop strategy
   * @returns The stop strategy for the service
   */
  getStopStrategy(service: Service): Promise<StopStrategy>;
}

class MetaStopStrategyProvider implements StopStrategyProvider {

  async getStopStrategy(service: Service) {
    const metaKey = "internal/stop-command";

    if (service.meta[metaKey]) {
      return new StopCommandStopStrategy(service.meta[metaKey]);
    } else {
      return new DefaultStopStrategy();
    }
  }
}

interface StopStrategy {
  /**
   * Stop a service.
   *
   * @param service The service to stop
   */
  stop(service: Service): Promise<void>;
}

class StopCommandStopStrategy implements StopStrategy {
  constructor(
    private readonly command: string,
  ) {}

  async stop(service: Service) {
    const runningService = getRunningService(service.serviceId);
    if (!runningService) {
      throw new ServiceNotRunningError(service.serviceId);
    }

    const callEngine = createEngineCaller(
      "stop",
      (e) => ({ id: service.serviceId, error: e })
    );
    await callEngine(() => engine.cmd(runningService.internalSession.containerId, this.command));
  }
}

class DefaultStopStrategy implements StopStrategy {

  async stop(service: Service) {
    const runningService = getRunningService(service.serviceId);
    if (!runningService) {
      throw new ServiceNotRunningError(service.serviceId);
    }

    const callEngine = createEngineCaller(
      "stop",
      (e) => ({ id: service.serviceId, error: e })
    );
    await callEngine(() => engine.stop(runningService.internalSession.containerId));
  }
}

interface ServiceRunnerEventBus {
  on<T extends keyof ServiceRunnerEvents>(evt: T, h: EventHandler<T>): void;
}

export interface ServiceRunner extends ServiceRunnerEventBus {
  engine: ServiceEngine;

  /**
   * Resume a service.
   *
   * @param id The service ID
   */
  resumeService(id: string): Promise<AsyncTask<void>>;

  /**
   * Stop a service.
   * This hereby sends a stop signal and does not wait for it to be stopped. For waiting, use {@link waitForStopped}.
   *
   * @param id The service ID
   * @param force Whether to force stop (kill) the service.
   */
  stopService(id: string, force?: boolean): Promise<AsyncTask<void>>;

  /**
   * Clear a service, that is, delete all its resources.
   *
   * @param id The service ID
   */
  clearService(id: string): Promise<void>;

  /**
   * Get list of running services on this node.
   */
  getRunningServices(): RunningService[];

  /**
   * Get the running service by ID.
   *
   * @param id The service ID
   */
  getRunningService(id: string): RunningService | undefined;

  /**
   * Get the current stage of a service, that is, currently being handled by the runner.
   *
   * @param id The service ID
   */
  getServiceStage(id: string): HandledServiceStage | undefined;

  /**
   * Get the last power error of a service.
   *
   * @param id The service ID
   */
  getLastPowerError(id: string): Error | undefined;

  /**
   * Stop all running services on this instance.
   */
  stopRunning(): Promise<void>;

  /**
   * Kill all running services on this instance.
   */
  killRunning(): Promise<void>;

  isRunning(id: string): boolean;

  isStarting(id: string): boolean;

  isStopping(id: string): boolean;

  waitForBusyAction(id: string): Promise<void>;

  waitForStopped(id: string): Promise<void>;
}

type HandledServiceStage = {
  state: ServiceState;
}

type RunningService = {
  id: string;
  session: ServiceSession;
  internalSession: InternalSession;
  state?: ServiceState;
};

export type InternalSession = {
  containerId: string;
  // TODO: add more useful information?
};

export let engine: ServiceEngine;

let nodeId: string;
let templateManager: TemplateManager;
let serviceManager: ServiceManager;
let stopStrategyProvider: StopStrategyProvider;
let db: Database;
let logger: winston.Logger;

// Service IDs that are currently running
const started: RunningService[] = [];
const startedStages: Map<string, HandledServiceStage> = new Map();
// TODO: Save errors somewhere else?
// Could it be a memory leak if there are tons of them??
const errors = {};
const evtHandlers: Map<string, EventHandler<any>[]> = new Map();

["push", "splice"].forEach((funcName) => {
  started[funcName] = (...args: any[]) => {
    const result = Array.prototype[funcName].apply(started, args);

    // Emit services change within those methods
    if (isDebug()) {
      logger.debug("Service registry changed");
    }

    return result;
  };
});

export const init = async (
  engine_: ServiceEngine,
  appConfig: AppConfig,
  templateManager_: TemplateManager,
  serviceManager_: ServiceManager,
  db_: Database,
  logger_: winston.Logger,
) => {
  engine = engine_;
  nodeId = appConfig.getNodeId();
  templateManager = templateManager_;
  serviceManager = serviceManager_;
  stopStrategyProvider = new MetaStopStrategyProvider();
  db = db_;
  logger = logger_;

  registerLoggingEventHandlers();
  gatherEngineErrors();
  await deleteGarbage(logger);
  await reattachStaleContainers(logger);
}

const deleteGarbage = async (logger: winston.Logger) => {
  // TODO: delete containers that are not running and remained from last session
}

/**
 * Reattach to containers that are still running from the previous session.
 * This may happen if NSM was force-stopped and not properly cleared up resources.
 *
 * @param logger The logger to use
 */
const reattachStaleContainers = async (logger: winston.Logger) => {
  const running = await engine
    .listRunning(Filters.node(nodeId))
    .then((containerIds) =>
      containerIds
        // Filter out those that we have already started in this session, just in case
        // this was started more than once a session
        .filter(
          (id) =>
            !started.find(
              (runningService) =>
                runningService.internalSession?.containerId === id,
            ),
        ),
    );

  for (let containerId of running) {
    const labels = await engine.getLabels(containerId);
    if (!labels[StandardLabel.ServiceId]) {
      // The container was in the running list, but does not have the required labels
      // Should not happen, but just in case
      logger.warn(
        `Found a running container with id ${containerId} that does not have a service id label, killing.`,
      );

      await engine.kill(containerId);
      continue;
    }

    const serviceId = labels[StandardLabel.ServiceId];

    // We must begin a new session since the previous was interrupted
    let session: ActiveServiceSession;
    try {
      session = await beginServiceSession(serviceId);
    } catch (e) {
      if (e instanceof ServiceNotFoundError) {
        logger.warn(
          `Found a running container ${containerId} for service ${serviceId}, but the service was not found 
          in database, killing the container and clearing resources.`,
        );
        await clearService(serviceId);
        continue;
      }
    }
    // Reattach and watch the container
    await engine.reattach(containerId, buildRunListener(session));

    // Save session in-memory
    const info: RunningService = {
      id: serviceId,
      session,
      internalSession: {
        containerId,
      },
    };
    started.push(info);
    logger.info(`Reattached container ${containerId} for service ${serviceId}`);
  }

  await new Promise((resolve) => whenUnlockedAll(() => resolve(null)));
}

/**
 * Registers event handlers for logging in debug mode.
 */
const registerLoggingEventHandlers = () => {
  const notifyIfSuccess = <E extends keyof ServiceRunnerEvents>(
    messageProvider: (serviceId: string) => string
  ): EventHandler<E> => {
    return ({ id, error }) => {
      if (error) {
        return;
      }

      logger.debug(messageProvider(id));
    }
  }

  on("resume",
    notifyIfSuccess((id) => `Service ${id} resumed`));
  on("stop",
    notifyIfSuccess((id) => `Service ${id} stopped`));
}

const gatherEngineErrors = () => {
  on("engine_err", (event) => {
    errors[event.id] = event.error;
  });
}

export const resumeService: ServiceRunner["resumeService"] = async (id) => {
  if (isRunning(id)) {
    throw new ServiceAlreadyRunningError(id);
  }

  const service = await serviceManager.getService(id);
  if (!service) {
    throw new ServiceNotFoundError(id);
  }

  let {
    options,
    args,
    network,
    port,
    ...rest
  } = service;

  const template = await templateManager.getTemplate(rest.template);
  if (!template) {
    throw new TemplateNotFoundError(rest.template);
  }

  let { container: { env: envTemplate, resources } } = template.settings;

  args = prepareArgsForRun(args, template);

  const meta = buildMetaStorage(id);

  const runOptions: RunOptions = {
    ram: options.ram ?? resources.limits.ram,
    cpu: options.cpu ?? resources.limits.cpu,
    disk: options.disk ?? resources.limits.disk,
    env: {},
    port,
    ports: options.ports ?? [],
    network,
    labels: {
      [StandardLabel.Nsm]: "true",
      [StandardLabel.ServiceId]: id,
      [StandardLabel.NodeId]: nodeId,
      [StandardLabel.VolumeId]: id,
      [StandardLabel.TemplateId]: template.id,
    },
  };
  runOptions.env = prepareEnvForRun(envTemplate, service, args, runOptions);

  const updateImageIfChanged = async (image: string) => {
    // If the image was changed by processing (e.g. it was built or rebuilt), update the image id in database
    if (image != service.imageId) {

      // Update image in database if it was changed by processing
      const updated = await serviceManager.updateService(service.serviceId, { imageId: image });
      if (!updated) {
        throw new InternalError(`Failed to update image ID for service ${service.serviceId}`);
      }
    }

    return image;
  }

  const templateRepository = engine.templateRepositoryRegistry.getRepository(
    template.sourceRepositoryId
  )?.repository;
  if (!templateRepository) {
    throw new InternalError(`Failed to get template repository for template ${template.id} with 
      source repository id ${template.sourceRepositoryId}`);
  }

  const unlock = lockBusyAction(id, "resume");

  const task = templateRepository.prepareImage(template.id, args, service.imageId) // TODO: logovat někam message z image processingu pomocí posledního parametru
    .then(updateImageIfChanged)
    .then(async (image) => {
      const session = await beginServiceSession(id);
      // Run the container with the built image and save the container id for later use.
      try {
        const containerId = await engine.run(
          image,
          id,
          runOptions,
          meta,
          buildRunListener(session),
        );
        started.push({
          id,
          session,
          internalSession: {
            containerId,
          },
        });

        callManagerEvent("resume", { id });
      } catch (e) {
        callManagerEvent("resume", { id, error: e });
        callServiceEngineError(id, e);

        clearRunningServiceIfExists(id);

        throw new ServiceEngineError(e);
      }
    })
    .finally(() => unlock());

  return new AsyncTask(task);
}

const prepareArgsForRun = (args: { [key: string]: string }, template: Template) => {
  const settingsArgs = template.settings.args;

  // Filter env to only those that are defined in settings.yml, because those are the only ones that
  // we can guarantee to be used and will not make problems when handling images.
  args = {
    ...Object.entries(args)
      .filter(([key]) => settingsArgs && key in settingsArgs)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
  };
  return args;
}

const prepareEnvForRun = (
  envTemplate: { [key: string]: string },
  service: Service,
  args: { [key: string]: string },
  runOptions: RunOptions
) => {
  // preprocess placeholders in the configured env template
  const serviceArgs: ServiceArgs = {
    id: service.serviceId,
    port: runOptions.port.toString(),
    ports: runOptions.ports.join(" "),
    ram: runOptions.ram.toString(),
    cpu: runOptions.cpu.toString(),
    disk: runOptions.disk.toString(),
  };

  const resolver = new ParamsResolver(envTemplate);
  resolver.setArgs(args);
  resolver.setServiceArgs(serviceArgs);
  envTemplate = resolver.getParams();

  return {
    ...envTemplate,
    SERVICE_ID: serviceArgs.id,
    SERVICE_PORT: serviceArgs.port,
    SERVICE_PORTS: serviceArgs.ports,
    SERVICE_RAM: serviceArgs.ram,
    SERVICE_CPU: serviceArgs.cpu,
    SERVICE_DISK: serviceArgs.disk,
  }
}

/**
 * Creates a wrapper for calling engine methods, which handles errors and calls the appropriate events.
 *
 * @param action The action type for which to call the events in case of error
 * @param onErrorEventFactory A factory function that creates the event to be called in case of error, based on the error that happened
 * @returns A function that takes a task to be executed
 */
const createEngineCaller = <T extends keyof ServiceRunnerEvents>(
  action: T,
  onErrorEventFactory: (e: Error) => ServiceRunnerEvents[T]
) => {
  return async <R>(task: () => Promise<R>): Promise<R> => {
    try {
      return await task();
    } catch (e) {
      logger.error(e);
      callManagerEvent(action, onErrorEventFactory(e));

      throw new ServiceEngineError(e);
    }
  }
}

export const stopService: ServiceRunner["stopService"] = async (id, force) => {
  const service = await serviceManager.getService(id);
  if (!service) {
    throw new ServiceNotFoundError(id);
  }

  const runningService = getRunningService(id);
  if (!runningService) {
    throw new ServiceNotRunningError(id);
  }

  const callEngine = createEngineCaller("stop", (e) => ({ id, error: e }));

  let awaitingPromise: Promise<void>;
  if (force) {
    const pendingAction = getActionType(id);
    if (pendingAction && pendingAction !== "stop") {
      // the service is locked and not stopping, the force stop can't be allowed
      throw new ServicePendingActionError(id, pendingAction);
    }

    await callEngine(async () => engine.kill(runningService.internalSession.containerId));
    // resolves immediately on kill
    awaitingPromise = Promise.resolve();
  } else {
    // lock only on soft stop, to allow hard-killing if any issues happen during stopping
    const unlock = lockBusyAction(id, "stop");
    awaitingPromise = new Promise((resolve) => {
      // wait for stop
      // this is really not necessary because any busy action is unlocked on stop, but
      // just in case and for the promise
      on("stop", ({ id: stoppedId, error }) => {
        if (stoppedId !== id) {
          // This call is not for me
          return false;
        }

        if (isServicePending(id)) {
          unlock(error);
        }
        resolve();
        return true;
      });
    });

    const stopStrategy = await stopStrategyProvider.getStopStrategy(service);
    await stopStrategy.stop(service);
  }
  awaitingPromise = awaitingPromise.then(() => waitForStopped(id));

  return new AsyncTask(awaitingPromise);
}

export const clearService: ServiceRunner["clearService"] = async (id) => {
  try {
    const task = await stopService(id, true);
    await task.promise;
  } catch (e) {
    if (e instanceof ServiceNotRunningError) {
      // ignore
    } else {
      throw e;
    }
  }

  const containerIds = await engine.listContainers(Filters.service(id));
  for (let containerId of containerIds) {
    try {
      await engine.kill(containerId);
    } catch (e) {
      throw new ServiceEngineError(e);
    }
  }

  try {
    const deleted = await engine.deleteVolume(id);
    if (!deleted) {
      logger.warn(`Failed to delete volume for service ${id}`);
    }
  } catch (e) {
    throw new ServiceEngineError(e);
  }
}

export const getRunningService: ServiceRunner["getRunningService"] = (id) => {
  return started.find((service) => service.id === id);
}

export const getServiceStage: ServiceRunner["getServiceStage"] = (id) => {
  return startedStages.get(id);
}

export const isRunning: ServiceRunner["isRunning"] = (id: string) => {
  return getRunningService(id) != undefined;
}

export const isStarting: ServiceRunner["isStarting"] = (id: string) => {
  return getActionType(id) === "resume";
}

export const isStopping: ServiceRunner["isStopping"] = (id: string) => {
  return getActionType(id) === "stop";
}

/**
 * Builds the meta storage for a service, which is used for storing and retrieving internal metadata for the service.
 *
 * @param serviceId The ID of the service for which to build the meta storage.
 */
const buildMetaStorage = (serviceId: string): MetaStorage => {
  // service id
  return {
    set: async (key, value) => {
      return db.serviceMetaRepository.setServiceMeta(serviceId, key, value);
    },
    get: async (key, def) => {
      const meta = await db.serviceMetaRepository.getServiceMeta(serviceId, key);

      return meta ?? def;
    },
  };
}

/**
 * Collects all relevant run listeners and builds a composite one
 * to be used directly when running/attaching service container.
 *
 * @param session The session for whom to create the session.
 */
const buildRunListener = (session: ActiveServiceSession): RunListener => {
  const { serviceId } = session;

  // The internal run listener of this manager
  const internalRunListener: RunListener = {
    onStateChange: (state) => {
      const stage = startedStages.get(serviceId);
      if (stage) {
        stage.state = state;
      } else {
        startedStages.set(serviceId, { state });
      }

      callManagerEvent("statechange", { id: serviceId, state });
    },
    onClose: async () => {
      clearRunningServiceIfExists(serviceId);
      startedStages.delete(serviceId);
      // clear any busy action that may potentially still be locked
      try {
        unlockBusyAction(serviceId);
      } catch (e) {
        if (e.message && e.message.includes("No busy action")) {
          // ignore, since it just means there is no busy action to unlock, so nothing to do
        }
      }

      callManagerEvent("stop", { id: serviceId });
    },
  };
  // Combine collected listeners
  return combineRunListeners([
    internalRunListener,
    // Add listener from the session
    session.runListener,
  ]);
}

export const on: ServiceRunner["on"] = <T extends keyof ServiceRunnerEvents>(
  evt: T,
  h: EventHandler<T>,
) => {
  if (!evtHandlers.has(evt)) {
    evtHandlers.set(evt, []);
  }
  evtHandlers.get(evt).push(h);
}

const callManagerEvent = <T extends keyof ServiceRunnerEvents>(
  e: T,
  event: ServiceRunnerEvents[T],
) => {
  if (!evtHandlers.has(e)) {
    return;
  }
  const newArray = evtHandlers.get(e).filter((handler) => {
    // Filter out those who returned true, which means they want to be unsubscribed after this call.
    const result = handler(event);

    return typeof result != "boolean" || !result;
  });
  evtHandlers.set(e, newArray);
}

/**
 * Notifies about an error that happened during internal engine calling.
 *
 * @param id The service ID for which the error happened
 * @param error The error that happened
 */
const callServiceEngineError = (id: string, error: Error) => {
  callManagerEvent("engine_err", { id, error });
}

const clearRunningServiceIfExists = (id: string) => {
  const service = getRunningService(id);

  if (service) {
    started.splice(started.indexOf(service, 1));
  }

  startedStages.delete(id);
}

export const getLastPowerError: ServiceRunner["getLastPowerError"] = (id) => {
  return errors[id];
}

export const getRunningServices: ServiceRunner["getRunningServices"] = () => {
  return [...started];
}

export const waitForStopped: ServiceRunner["waitForStopped"] = async (id: string) => {
  if (!isRunning(id)) {
    // service not running, so we continue immediately
    return;
  }

  return new Promise<void>((resolve, reject) => {
    on("stop", ({ id: stoppedId, error }) => {
      if (stoppedId !== id) {
        // This call is not for me
        return false;
      }

      if (error) {
        reject(error);
      } else {
        resolve();
      }

      return true;
    });
  });
}

export const stopRunning: ServiceRunner["stopRunning"] = async () => {
  const tasks = started.map(
    ({ id }) =>
      new Promise((resolve) => {
        whenUnlocked(id, () => {
          stopService(id)
            .catch((e) => logger.error(e))
            .then(() => {
              whenUnlocked(id, () => resolve(null));
            });
        });
      }),
  );

  await Promise.all(tasks);
}

export const killRunning: ServiceRunner["killRunning"] = async () => {
  await Promise.all(
    started.map(
      async ({ id }) => stopService(id, true).catch((e) => logger.error(e))
    )
  )
}

export const waitForBusyAction: ServiceRunner["waitForBusyAction"] = async (id: string) => {
  return new Promise<void>((resolve, reject) => {
    whenUnlocked(id, (_, __, err) => (err ? reject(err) : resolve(null)));
  });
}