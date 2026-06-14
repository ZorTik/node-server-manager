import { currentContext } from "../app";
import createEngine, {
  RunOptions,
  RunListener,
  ServiceEngineI,
  StandardLabel,
  Filters,
  combineRunListeners,
} from "./engine";
import {
  Template,
  getTemplate as loadTemplate,
  getAllTemplates,
} from "./template";
import * as templateManager from "./template";
import * as sessionManager from "./session";
import * as templateDirWatcher from "./monitoring/templateDirWatcher";
import crypto from "crypto";
import { randomPort as retrieveRandomPort } from "@nsm/util/port";
import { Database, PermaModel } from "../database";
import {
  getActionType,
  isServicePending,
  lockBusyAction,
  reqNotPending, unlockBusyAction,
  UnlockObserver,
  whenUnlocked,
  whenUnlockedAll,
} from "./asyncp";
import winston from "winston";
import { isDebug } from "../helpers";
import {AsyncTask, resolveSequentially} from "@nsm/util/promises";
import { watchTemplateDirChanges } from "@nsm/engine/monitoring/templateDirWatcher";
import {
  processImage,
  init as initImageEngine,
  deleteImageIfUnused,
} from "@nsm/engine/image";
import { propagateOptionsToEnv } from "@nsm/engine/docker/util/env";
import {
  ActiveServiceSession,
  beginServiceSession,
  ServiceSession,
  init as initSessionEngine,
} from "@nsm/engine/session";
import {
  InternalError,
  InvalidMetaError,
  ServiceAlreadyRunningError,
  ServiceNotFoundError,
  ServiceNotRunningError, ServicePendingActionError, ServiceWasNeverActiveError, TemplateNotFoundError
} from "@nsm/engine/error";

export type Options = {
  /**
   * The amount of RAM that the service can allocate in MB.
   * (optional)
   */
  ram?: number;
  /**
   * The amount of CPU cores that the service can use.
   * (optional)
   */
  cpu?: number;
  /**
   * The amount of disk space that the service can use in MB.
   * (optional)
   */
  disk?: number;
  /**
   * The additional ports to expose. (optional)
   * Main port will be chosen automatically.
   * (optional)
   */
  ports?: number[]; // Optional ports to expose
  meta?: { [key: string]: any };
  /**
   * The optional environment variables (template options) to set.
   * These are custom variables that the specific template uses to correctly
   * build its environment.
   *
   * Firstly, you need to specify those env variables and their defaults
   * in the settings.yml file of the template, and then they can be used
   * in the Dockerfile of template. Those variables can be listed by the
   * lookup and will be stored for later use when resuming the service.
   * (optional)
   */
  env?: { [key: string]: string }; // Optional ENV, see example_settings.yml
  /**
   * The (optional) network settings for the service.
   * This specifies fi the service will be bind to custom network interface
   * in the future and how.
   */
  network?: {
    /**
     * Bind address.
     */
    address: string;
    /**
     * If whole service interface (all ports) should be exposed to the
     * interface (false), or only defined ports (true).
     *
     * Defined ports are those specified in ports?: number[], and main
     * service port.
     */
    portsOnly: boolean;
  };
};

/**
 * Per-service storage.
 * Data set here are being persisted to the relational database and being kept
 * as long term data. Every key set here is per-service.
 */
export type MetaStorage = {
  set: (key: string, value: any) => Promise<boolean>;
  get: <T>(key: string, def?: T) => Promise<T | undefined>;
};

export type EngineExpansion = {
  [k in keyof ServiceEngineI | string]: any;
};

type ServiceEvent = {
  id: string;
  error?: Error;
};

type ServiceStateChangeEvent = ServiceEvent & {
  state: State;
}

type ServiceEngineErrorEvent = ServiceEvent & {
  error: Error;
}

type ServiceManagerEvents = {
  resume: ServiceEvent;
  stop: ServiceEvent;
  statechange: ServiceStateChangeEvent;
  engine_err: ServiceEngineErrorEvent;
};

/**
 * The event handler for service manager events.
 * If the handler returns true or nothing, it will be unsubscribed after this call.
 */
type EventHandler<T extends keyof ServiceManagerEvents> = (
  event: ServiceManagerEvents[T],
) => boolean | void;

type ServiceManagerEventBus = {
  on<T extends keyof ServiceManagerEvents>(evt: T, h: EventHandler<T>): void;
};

export type ListServicesOptions = {
  /**
   * The page number (index).
   */
  page: number;
  /**
   * The page size.
   */
  pageSize: number;

  /**
   * Filter options.
   */
  filter?: {
    /**
     * Filter services by their meta attributes.
     */
    meta?: { [key: string]: any };
  };
};

export type ServiceManager = ServiceManagerEventBus & {
  /**
   * This NSM instance ID
   */
  nodeId: string;
  /**
   * Internal engine implementation
   */
  engine: ServiceEngineI;

  /**
   * Initialize the service manager.
   *
   * @param db The database
   * @param appConfig The app config
   * @param logger The global logger
   */
  init(db: Database, appConfig: any, logger: winston.Logger): Promise<void>;

  /**
   * Create a new service.
   *
   * @param template The template ID (folder name) to use
   * @param options The options to use. Options will be stored for later use.
   * @returns The service ID
   * @throws InvalidMetaError if the template meta is invalid
   */
  createService(template: string, options: Options): Promise<string>; // Service ID

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
   * Delete a service.
   *
   * @param id The service ID
   */
  deleteService(id: string): Promise<void>;

  /**
   * Update the options of a service.
   *
   * @param id The service ID
   * @param options The new options
   */
  updateOptions(id: string, options: Options): Promise<boolean>;

  /**
   * Get the template by ID.
   *
   * @param id The template ID
   * @returns The template wrapper
   */
  getTemplate(id: string): Template | undefined;

  /**
   * Get the service by ID.
   *
   * @param from The service ID, or model
   * @param options The get options
   *   includeSession: Whether to include the session to result
   *   otherNodes: If true, we will include services on other NSM nodes to search
   */
  getService(
    from: string | PermaModel,
    options?: { includeSession?: boolean; otherNodes?: boolean },
  ): Promise<ServiceInfo | undefined>;

  /**
   * Get the last power error of a service.
   *
   * @param id The service ID
   */
  getLastPowerError(id: string): Error | undefined;

  /**
   * Get the last session ID of a service.
   *
   * @param id The service ID
   * @throws ServiceWasNeverActiveError if the service was never active and thus does not have a last session
   */
  getLastSession(id: string): Promise<ServiceSession>;

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
   * List all available services.
   *
   * @param options The list options
   * @returns The list of service IDs
   */
  listServices(options: ListServicesOptions): Promise<string[]>;

  /**
   * List all available templates.
   *
   * @returns The list of template IDs
   */
  listTemplates(): Promise<string[]>;

  /**
   * Stop all running services on this instance.
   */
  stopRunning(): Promise<void>;

  /**
   * Kill all running services on this instance.
   */
  killRunning(): Promise<void>;

  isRunning(id: string): boolean;

  waitForBusyAction(id: string): Promise<void>;

  waitForStopped(id: string): Promise<void>;

  // DON'T call those until you really know what you are doing.
  expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T>;

  initEngineForcibly(): Promise<void>;
  //
};

type RunningService = {
  id: string;
  session: ServiceSession;
  internalSession: InternalSession;
};

export type InternalSession = {
  containerId: string;
  // TODO: add more useful information?
};

export type ServiceInfo = PermaModel & {
  optionsRam: number; // From options.ram
  optionsCpu: number; // From options.cpu
  optionsDisk: number; // From options.disk
  state: State;
  session?: ServiceSession;
  internalSession?: InternalSession;
};

export type State = "BUILDING" | "RUNNING" | "STOPPING" | "STOPPED";

export let engine: ServiceEngineI = undefined;
export let nodeId: string;

let db: Database;
let logger: winston.Logger;

// TODO: Save errors somewhere else?
// Could it be a memory leak if there are tons of them??
const errors = {};
// Service IDs that are currently running
const started: RunningService[] = [];
const startedStates: Map<string, State> = new Map();
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

export const init: ServiceManager["init"] = async (
  db_,
  appConfig_,
  logger_,
) => {
  db = db_;
  logger = logger_;

  const nodeId_ = appConfig_.getNodeId();
  logger.info(`Initializing service manager for node ${nodeId_}...`);
  if (!engine) {
    // Init only if it has not already been force-initialized
    await initEngineForcibly();
  }
  nodeId = nodeId_ as string;

  initImageEngine(
    engine,
    templateManager,
    templateDirWatcher,
    db_,
    appConfig_,
    logger,
  );
  initSessionEngine(db_);
  watchTemplateDirChanges(logger);

  gatherEngineErrors();
  registerLoggingEventHandlers();
  await deleteGarbage(logger);
  await reattachStaleContainers(logger);

  logger.info(`Using engine: ${engine.name}`);
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
                runningService.internalSession.containerId === id,
            ),
        ),
    );

  for (let containerId of running) {
    const labels = await engine.getLabels(containerId);
    if (!labels[StandardLabel.ServiceId]) {
      // The container was in the running list, but does not have the required labels
      // Should not happen, but just in case
      logger.warn(
        `Found a running container with id ${containerId} that does not have a service id label, stopping.`,
      );

      await engine.stop(containerId);
    }

    const serviceId = labels[StandardLabel.ServiceId];

    // We must begin a new session since the previous was interrupted
    const session = await beginServiceSession(serviceId);
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

const gatherEngineErrors = () => {
  on("engine_err", (event) => {
    errors[event.id] = event.error;
  });
}

/**
 * Registers event handlers for logging in debug mode.
 */
const registerLoggingEventHandlers = () => {
  const notifyIfSuccess = <E extends keyof ServiceManagerEvents>(
    messageProvider: (serviceId: string) => string
  ): EventHandler<E> => {
    return ({ id, error }) => {
      if (error) {
        return;
      }

      logger.debug(messageProvider(id));
    }
  }

  on("resume", notifyIfSuccess((id) => `Service ${id} resumed`));
  on("stop", notifyIfSuccess((id) => `Service ${id} stopped`));
}

export const expandEngine: ServiceManager["expandEngine"] = async <T extends EngineExpansion>(
  exp?: T,
): Promise<ServiceEngineI & T> => {
  if (exp) {
    if (!engine && (!currentContext || !currentContext.appConfig)) {
      throw new Error("Engine is not yet loaded and can't be loaded forcibly!");
    } else if (!engine) {
      // Engine is not initialized yet, but we want to expand it, so
      // we need to force load it.
      await initEngineForcibly();
    }
    // An expansion is provided, so there are changes to be applied.
    Object.keys(exp).forEach((expKey) => {
      if (!Number.isNaN(Number(expKey))) {
        throw new Error(
          "Invalid expansion format, please replace functions within with lambda functions. " +
            "Invalid: { funcName(param) {}, funcName2(param) {} }" +
            "Valid: { funcName: (param) => {}, funcName2: (param) => {} }",
        );
      }
      engine[expKey] = exp[expKey];
    });
  }
  return engine as any;
}

export const createService: ServiceManager["createService"] = async (template, options) => {
  const { ram, cpu, disk, ports, env, network } = options;
  const serviceSettings = reqTemplate(template).settings;

  // Join meta supplied by user and template meta
  const meta = {
    ...(options.meta ?? {}),
    ...(serviceSettings.meta ?? {}),
  };
  if (!meta || !meta.stopCmd) {
    throw new InvalidMetaError("Invalid template meta for " + template);
  }

  const serviceId = crypto.randomUUID(); // Create new unique service id
  // Pick random main port from the range specified in settings.yml
  const portRange = serviceSettings.port_range;
  const port = await retrieveRandomPort(
    engine,
    portRange.min as number,
    portRange.max as number,
  );

  const perma: PermaModel = {
    serviceId,
    template,
    nodeId,
    port,
    options: { ram, cpu, disk, ports },
    meta,
    env: env ?? {},
    network,
  };
  // Save permanent info
  if (!(await db.permaRepository.savePerma(perma))) {
    throw new InternalError("Failed to save perma info to database");
  }

  return serviceId;
}

export const resumeService: ServiceManager["resumeService"] = async (id) => {
  reqNotRunning(id);
  let { template, options, env, network, port } = await reqExists(id);

  const { defaults, env: settingsEnv } = reqTemplate(template).settings;
  // Filter env to only those that are defined in settings.yml, because those are the only ones that
  // we can guarantee to be used and will not make problems when handling images.
  env = {
    ...Object.entries(env)
      .filter(([key]) => settingsEnv && key in settingsEnv)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
  };

  const meta = metaStorageForService(id);
  const unlock = lockBusyAction(id, "resume");

  const runOptions: RunOptions = {
    ram: options.ram ?? (defaults.ram as number),
    cpu: options.cpu ?? (defaults.cpu as number),
    disk: options.disk ?? (defaults.disk as number),
    env: env ?? (defaults.env as { [key: string]: string }),
    port,
    ports: options.ports ?? [],
    network,
    labels: {
      [StandardLabel.Nsm]: "true",
      [StandardLabel.ServiceId]: id,
      [StandardLabel.NodeId]: nodeId,
      [StandardLabel.VolumeId]: id,
      [StandardLabel.TemplateId]: template,
    },
  };

  const perma = await db.permaRepository.getPerma(id);
  //let image = perma.imageId;

  // Propagate other options to env, so they can be used in image processing and building
  propagateOptionsToEnv(runOptions, runOptions.env);
  // Include service ID in env
  runOptions.env.SERVICE_ID = id;

  // Omit the always-changing args from build env, since they would always trigger an
  // image rebuild
  const { SERVICE_ID, SERVICE_PORT, SERVICE_PORTS, ...buildEnv } =
    runOptions.env;

  const updateImageIfChanged = async (image: string) => {
    // If the image was changed by processing (e.g. it was built or rebuilt), update the image id in database
    if (image != perma.imageId) {

      // Update image in database if it was changed by processing
      perma.imageId = image;
      await db.permaRepository.savePerma(perma);
    }

    return image;
  }

  return new AsyncTask(
    // TODO: logovat někam message z image processingu pomocí posledního parametru
    processImage(perma.imageId, template, buildEnv)
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
          const runningService: RunningService = {
            id,
            session,
            internalSession: {
              containerId,
            },
          };
          started.push(runningService);

          callManagerEvent("resume", { id });
        } catch (e) {
          callManagerEvent("resume", { id, error: e });
          callServiceEngineError(id, e);
        }
      })
      .finally(() => unlock())
  );
}

export const stopService: ServiceManager["stopService"] = async (id, force) => {
  await reqExists(id);

  const { internalSession } = reqRunning(id);

  const callEngine = async (task: () => Promise<any>) => {
    try {
      await task();
    } catch (e) {
      logger.error(e);
      callManagerEvent("stop", { id, error: e });
    }
  }

  let awaitingPromise: Promise<void>;
  if (force) {
    const pendingAction = getActionType(id);
    if (pendingAction && getActionType(id) !== "stop") {
      // the service is locked and not stopping, the force stop can't be allowed
      throw new ServicePendingActionError(id, pendingAction);
    }

    await callEngine(async () => engine.kill(internalSession.containerId, metaStorageForService(id)));
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

    // TODO: stop strategy
    const service = await getService(id);
    const stopCmd = service.meta?.stopCmd;
    await callEngine(async () => {
      if (stopCmd) {
        // send stop cmd if set
        await engine.cmd(internalSession.containerId, stopCmd);
      } else {
        // send stop signal
        await engine.stop(internalSession.containerId);
      }
    });
  }
  awaitingPromise = awaitingPromise.then(() => waitForStopped(id));

  return new AsyncTask(awaitingPromise);
}

export const deleteService: ServiceManager["deleteService"] = async (id) => {
  try {
    await stopService(id, true);
  } catch (e) {
    // Skip not running error
    if (!(e instanceof ServiceNotRunningError)) {
      throw e;
    }
  }

  const unlockHandler: UnlockObserver = (_, __, ___) => {
    const resolveDeleteImageFunc = async () => {
      const image = await db.permaRepository
        .getPerma(id)
        .then((perma) =>
          perma.imageId
            ? db.imageRepository.getImage(perma.imageId)
            : undefined,
        );

      return async () => {
        if (image) {
          // If the image becomes unused after service deletion, delete it
          await deleteImageIfUnused(image);
        }
      };
    };

    resolveDeleteImageFunc()
      .then((deleteImageFunc) =>
        resolveSequentially(
          async () => engine.deleteVolume(id),
          async () => db.permaRepository.deletePerma(id),
          deleteImageFunc,
        ),
      )
      .then(() => {
        logger.debug(`Service ${id} deleted`);
      });
  };

  whenUnlocked(id, unlockHandler);
}

export const updateOptions: ServiceManager["updateOptions"] = async (id, options) => {
  reqNotPending(id);
  const perma = await db.permaRepository.getPerma(id);
  const data: PermaModel = {
    ...perma,
    ...options,
    meta: {
      ...perma.meta,
      ...options.meta,
    },
    env: {
      ...perma.env,
      ...options.env,
    },
  };
  return db.permaRepository.savePerma(data);
}

export const getTemplate: ServiceManager["getTemplate"] = (id) => {
  return loadTemplate(id);
}

export const getService: ServiceManager["getService"] = async (
  from,
  options,
): ReturnType<ServiceManager["getService"]> => {
  const data =
    typeof from === "string" ? await db.permaRepository.getPerma(from) : from;
  if (data && (data.nodeId == nodeId || options?.otherNodes === true)) {
    let session = undefined;
    let internalSession = undefined;
    if (options?.includeSession === true) {
      const runningService = getRunningService(data.serviceId);
      if (runningService) {
        session = runningService.session;
        internalSession = runningService.internalSession;
      }
    }

    return {
      ...data,
      optionsRam: data.env.SERVICE_RAM ? Number(data.env.SERVICE_RAM) : 0,
      optionsCpu: data.env.SERVICE_CPU ? Number(data.env.SERVICE_CPU) : 0,
      optionsDisk: data.env.SERVICE_DISK ? Number(data.env.SERVICE_DISK) : 0,
      state: getServiceState(data.serviceId),
      session,
      internalSession,
    };
  } else {
    return undefined;
  }
}

export const getLastPowerError: ServiceManager["getLastPowerError"] = (id) => {
  return errors[id];
}

export const getLastSession: ServiceManager["getLastSession"] = async (id) => {
  await reqExists(id);

  const runningService = getRunningService(id);
  if (runningService) {
    // Service currently running, we can use logs from the current session
    return runningService.session;
  } else {
    // Service not running, so we need to retrieve last session ID
    const lastSession = await sessionManager.listSessions({
      filter: { serviceId: id },
      sort: { by: "startedAt", direction: "desc" },
      page: { index: 0, size: 1 },
    });
    if (lastSession && lastSession.length > 0) {
      return lastSession[0];
    }
  }

  throw new ServiceWasNeverActiveError();
}

export const listServices: ServiceManager["listServices"] = async (options) => {
  const meta = options.filter?.meta;
  return db.permaRepository
    .listPerma(nodeId, options.page, options.pageSize, meta)
    .then((list) => list.map((d) => d.serviceId));
}

export const listTemplates: ServiceManager["listTemplates"] = async () => {
  return getAllTemplates().map((template) => template.id);
}

export const stopRunning: ServiceManager["stopRunning"] = async () => {
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

export const killRunning: ServiceManager["killRunning"] = async () => {
  await Promise.all(
    started.map(
      async ({ id }) => stopService(id, true).catch((e) => logger.error(e))
    )
  )
}

export const waitForBusyAction: ServiceManager["waitForBusyAction"] = async (id: string) => {
  return new Promise<void>((resolve, reject) => {
    whenUnlocked(id, (_, __, err) => (err ? reject(err) : resolve(null)));
  });
}

export const waitForStopped: ServiceManager["waitForStopped"] = async (id: string) => {
  if (!isRunning(id)) {
    // service not running, so we continue immediately
    return;
  }

  return new Promise<void>((resolve, reject) => {
    on("stop", ({ id, error }) => {
      if (id !== id) {
        // This call is not for me
        return false;
      }

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export const isRunning: ServiceManager["isRunning"] = (id: string) => {
  return getRunningService(id) != undefined;
}

export const getRunningService: ServiceManager["getRunningService"] = (id: string) => {
  return started.find((service) => service.id === id);
}

const metaStorageForService = (id: string): MetaStorage => {
  // service id
  return {
    set: async (key, value) => {
      return db.serviceMetaRepository.setServiceMeta(id, key, value);
    },
    get: async (key, def) => {
      const meta = await db.serviceMetaRepository.getServiceMeta(id, key);

      return meta ?? def;
    },
  };
}

export const initEngineForcibly = async () => {
  if (engine) {
    throw new Error("Engine is already loaded.");
  }
  if (!currentContext || !currentContext.appConfig) {
    throw new Error("Engine can't be loaded forcibly!");
  }
  engine = createEngine(currentContext.appConfig);
  // I set it here to keep the exact reference if the engine
  // is changed in the future.
  engine.cast = () => engine as any;
}

export const getRunningServices: ServiceManager["getRunningServices"] = () => {
  return [...started];
}

export const on: ServiceManager["on"] = <T extends keyof ServiceManagerEvents>(
  evt: T,
  h: EventHandler<T>,
) => {
  if (!evtHandlers.has(evt)) {
    evtHandlers.set(evt, []);
  }
  evtHandlers.get(evt).push(h);
}

const clearRunningServiceIfExists = (id: string) => {
  const service = getRunningService(id);

  if (service) {
    started.splice(started.indexOf(service, 1));
  }
}

const callManagerEvent = <T extends keyof ServiceManagerEvents>(
  e: T,
  event: ServiceManagerEvents[T],
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
      setServiceState(serviceId, state.ready ? "RUNNING" : "BUILDING");
    },
    onClose: async () => {
      clearRunningServiceIfExists(serviceId);
      startedStates.delete(serviceId);
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

const setServiceState = (id: string, state: State) => {
  startedStates.set(id, state);

  callManagerEvent("statechange", {
    id,
    state,
  });
}

/**
 * Returns the local service state managed by this manager.
 *
 * @param id The id of the service.
 * @returns The state of the service
 */
const getServiceState = (id: string) => {
  if (getActionType(id) === "stop") {
    // service has stop locked, so is stopping
    return "STOPPING";
  }

  return startedStates.get(id) ?? "STOPPED";
}

// ---------------------------------------------------------------------------------------

const reqExists = async (id: string) => {
  const perma_ = await db.permaRepository.getPerma(id);
  if (!perma_) {
    // service does not exist
    throw new ServiceNotFoundError(id);
  }

  return perma_;
}

const reqRunning = (id: string) => {
  const session = getRunningService(id);
  if (!session) {
    throw new ServiceNotRunningError(id);
  }

  return session;
}

const reqNotRunning = (id: string) => {
  if (isRunning(id)) {
    throw new ServiceAlreadyRunningError(id);
  }
}

const reqTemplate = (id: string) => {
  const template = getTemplate(id);
  if (!template) {
    throw new TemplateNotFoundError(id);
  }

  return template;
}
