import {currentContext, Database} from "../app";
import createEngine, {RunOptions, RunListener, ServiceEngineI, StandardLabel, Filters} from "./engine";
import {Template, getTemplate as loadTemplate, getAllTemplates} from "./template";
import * as templateManager from "./template";
import * as templateDirWatcher from "./monitoring/templateDirWatcher";
import crypto from "crypto";
import {randomPort as retrieveRandomPort} from "@nsm/util/port";
import {loadYamlFile} from "@nsm/util/yaml";
import {PermaModel} from "../database";
import {
    isServicePending,
    lckStatusTp,
    lockBusyAction,
    reqNotPending,
    ulckStatusTp,
    UnlockObserver,
    whenUnlocked, whenUnlockedAll
} from "./asyncp";
import winston from "winston";
import path from "path";
import {isDebug} from "../helpers";
import {resolveSequentially} from "@nsm/util/promises";
import {buildDir} from "@nsm/engine/monitoring/util";
import {watchTemplateDirChanges} from "@nsm/engine/monitoring/templateDirWatcher";
import {logService} from "@nsm/logger";
import {processImage, init as initImageEngine, deleteImageIfUnused} from "@nsm/engine/image";
import {propagateOptionsToEnv} from "@nsm/engine/docker/util/env";

export type Options = {
    /**
     * The amount of RAM that the service can allocate in MB.
     * (optional)
     */
    ram?: number,
    /**
     * The amount of CPU cores that the service can use.
     * (optional)
     */
    cpu?: number,
    /**
     * The amount of disk space that the service can use in MB.
     * (optional)
     */
    disk?: number,
    /**
     * The additional ports to expose. (optional)
     * Main port will be chosen automatically.
     * (optional)
     */
    ports?: number[], // Optional ports to expose
    meta?: {[key: string]: any},
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
    env?: {[key: string]: string}, // Optional ENV, see example_settings.yml
    /**
     * The (optional) network settings for the service.
     * This specifies fi the service will be bind to custom network interface
     * in the future and how.
     */
    network?: {
        /**
         * Bind address.
         */
        address: string,
        /**
         * If whole service interface (all ports) should be exposed to the
         * interface (false), or only defined ports (true).
         *
         * Defined ports are those specified in ports?: number[], and main
         * service port.
         */
        portsOnly: boolean,
    }
}

/**
 * Per-service storage.
 * Data set here are being persisted to the relational database and being kept
 * as long term data. Every key set here is per-service.
 */
export type MetaStorage = {
    set: (key: string, value: any) => Promise<boolean>;
    get: <T>(key: string, def?: T) => Promise<T|undefined>;
}

export type EngineExpansion = {
    [k in keyof ServiceEngineI | string]: any;
};

type ServiceEvent = {
    id: string;
    error?: Error;
}

type ServiceManagerEvents = {
    resume: ServiceEvent;
    stop: ServiceEvent;
}

type EventHandler<T extends keyof ServiceManagerEvents> = (event: ServiceManagerEvents[T]) => boolean|void;

type ServiceManagerEventBus = {
    on<T extends keyof ServiceManagerEvents>(evt: T, h: EventHandler<T>): void;
}


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
        meta?: {[key: string]: any};
    }
}

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
     */
    createService(template: string, options: Options): Promise<string>; // Service ID

    /**
     * Resume a service.
     *
     * @param id The service ID
     * @returns Whether the service was resumed
     */
    resumeService(id: string): Promise<boolean>;

    /**
     * Stop a service.
     *
     * @param id The service ID
     */
    stopService(id: string): Promise<void>;

    /**
     * Stop a service forcibly (kill).
     *
     * @param id The service ID
     */
    stopServiceForcibly(id: string): Promise<void>;

    /**
     * Send pre-configured stop signal to the service.
     *
     * @param id The service ID
     * @returns Whether the signal has been sent
     */
    sendStopSignal(id: string): Promise<boolean>;

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
    getTemplate(id: string): Template|undefined;

    /**
     * Get the service by ID.
     *
     * @param from The service ID, or model
     * @param options The get options
     *   includeSession: Whether to include the session to result
     *   otherNodes: If true, we will include services on other NSM nodes to search
     */
    getService(from: string|PermaModel, options?: { includeSession?: boolean, otherNodes?: boolean }): Promise<ServiceInfo|undefined>;

    /**
     * Get the last power error of a service.
     *
     * @param id The service ID
     */
    getLastPowerError(id: string): Error|undefined;

    /**
     * Get list of running services on this node.
     */
    getRunningServices(): RunningService[];

    /**
     * Get the running service by ID.
     *
     * @param id The service ID
     */
    getRunningService(id: string): RunningService|undefined;

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

    isRunning(id: string): boolean;

    waitForBusyAction(id: string): Promise<void>;

    // DON'T call those until you really know what you are doing.
    expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T>;

    initEngineForcibly(): Promise<void>;
    //
} & {
    whenUnlocked: typeof whenUnlocked
};

type RunningService = {
    id: string;
    session: Session;
}

export type Session = {
    containerId: string;
    // TODO: add more useful information?
}

export type ServiceInfo = PermaModel & {
    optionsRam: number, // From options.ram
    optionsCpu: number, // From options.cpu
    optionsDisk: number, // From options.disk
    session?: Session
}

// 1 = unknown, 2 = conflict, 3 = not found
export type StatusCode = 1 | 2 | 3;

class _InternalError extends Error {
    readonly code: StatusCode;
    readonly msg: string;

    constructor(msg: string, code?: StatusCode) {
        super(msg);
        this.code = code ?? 1;
        this.msg = msg;
    }
}

export let engine: ServiceEngineI = undefined;
export let nodeId: string;

let db: Database;
let appConfig: any;

// Returns the settings.yml file for the template
function settings(template: string) {
    return loadYamlFile(buildDir(template) + path.sep + 'settings.yml');
}

// Save errors somewhere else?
// Could it be a memory leak if there are tons of them??
const errors = {};
// Service IDs that are currently running
const started: RunningService[] = [];
const evtHandlers: Map<string, EventHandler<any>[]> = new Map();

["push", "splice"].forEach(funcName => {
    started[funcName] = (...args: any[]) => {
        const result = Array.prototype[funcName].apply(started, args);

        // Emit services change within those methods
        if (isDebug()) {
            currentContext.logger.debug('Service registry changed');
        }

        return result;
    };
});

export async function init(db_: Database, appConfig_: any, logger: winston.Logger) {
    const nodeId_ = appConfig_['node_id'] as string;

    logger.info(`Initializing service manager for node ${nodeId_}...`);

    db = db_;
    appConfig = appConfig_;
    if (!engine) {
        // Init only if it has not already been force-initialized
        await initEngineForcibly();
    }
    nodeId = appConfig['node_id'] as string;

    initImageEngine(engine, templateManager, templateDirWatcher, db_, currentContext.logger);
    watchTemplateDirChanges(currentContext.logger);

    await reattachStaleContainers(logger);

    logger.info(`Using ${engine.defaultEngine ? 'default' : 'custom'} engine`);
}

export async function expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T> {
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
                throw new Error("Invalid expansion format, please replace functions within with lambda functions. " +
                    "Invalid: { funcName(param) {}, funcName2(param) {} }" +
                    "Valid: { funcName: (param) => {}, funcName2: (param) => {} }")
            }
            engine[expKey] = exp[expKey];
        });
    }
    return engine as any;
}

export async function createService(template: string, options: Options) {
    const {
        ram,
        cpu,
        disk,
        ports,
        env,
        network
    } = options;

    const serviceSettings = settings(template);

    // Join meta supplied by user and template meta
    const meta = {
        ...(options.meta ?? {}),
        ...(serviceSettings.meta ?? {})
    };

    if (!meta || !meta.stopCmd) {
        throw new _InternalError('Invalid template meta for ' + template);
    }

    const serviceId = crypto.randomUUID(); // Create new unique service id
    // Pick random main port from the range specified in settings.yml
    const portRange = serviceSettings.port_range;
    const port = await retrieveRandomPort(
      engine,
      portRange.min as number,
      portRange.max as number
    );

    const perma: PermaModel = {
        serviceId,
        template,
        nodeId,
        port,
        options: {ram, cpu, disk, ports},
        meta,
        env: env ?? {},
        network
    };
    let err: any;
    // Save permanent info
    if (!await db.savePerma(perma)) {
        err = new _InternalError('Failed to save perma info to database');
    }

    if (err) {
        // Save to be later retrieved
        errors[serviceId] = err;
        currentContext.logger.error(err.message);
    }

    if (err) {
        throw err;
    } else {
        return serviceId;
    }
}

export async function resumeService(id: string) {
    reqNotRunning(id);

    let {
        template,
        options,
        env,
        network,
        port,
    } = await getPermaModel(id);

    const {defaults, env: settingsEnv} = settings(template);
    // Filter env to only those that are defined in settings.yml, because those are the only ones that
    // we can guarantee to be used and will not make problems when handling images.
    env = {
        ...Object.entries(env)
          .filter(([key]) => settingsEnv && key in settingsEnv)
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
    }


    const meta = metaStorageForService(id);
    const unlock = lockBusyAction(id, 'resume');

    const runOptions: RunOptions = {
        ram: options.ram ?? defaults.ram as number,
        cpu: options.cpu ?? defaults.cpu as number,
        disk: options.disk ?? defaults.disk as number,
        env: env ?? defaults.env as {[key: string]: string},
        port,
        ports: options.ports ?? [],
        network,
        labels: {
            [StandardLabel.Nsm]: 'true',
            [StandardLabel.ServiceId]: id,
            [StandardLabel.VolumeId]: id,
            [StandardLabel.TemplateId]: template,
            // TODO: nsm.buildDir
        }
    };

    const perma = await db.getPerma(id);
    let image = perma.imageId;

    // Propagate other options to env, so they can be used in image processing and building
    propagateOptionsToEnv(runOptions, runOptions.env);
    // Include service ID in env
    runOptions.env.SERVICE_ID = id;

    // Omit the always-changing args from build env, since they would always trigger an
    // image rebuild
    const { SERVICE_ID, SERVICE_PORT, SERVICE_PORTS, ...buildEnv } = runOptions.env;
    const processedImage = await processImage(image, template, buildEnv);
    // If the image was changed by processing (e.g. it was built or rebuilt), update the image id in database
    if (processedImage != image) {
        image = processedImage;

        // Update image in database if it was changed by processing
        perma.imageId = image;
        await db.savePerma(perma);
    }

    let containerId: string|undefined;
    try {
        // Run the container with the built image and save the container id for later use.
        if (image) {
            currentContext.logger.info('Running service ' + id + "...");
            containerId = await engine.run(
              image,
              id,
              runOptions,
              meta,
              buildRunListener(id)
            );
        }
    } catch (e) {
        currentContext.logger.error('Failed to run container for service ' + id, e);
    }

    let success: boolean = false;
    if (containerId) {
        const runningService: RunningService = {
            id,
            session: {
                containerId
            }
        };
        started.push(runningService);
        success = true;
    }

    if (success == true) {
        currentContext.logger.info('Service ' + id + ' resumed');
        callManagerEvent('resume', { id });
    } else {
        errors[id] = new Error('Failed to resume service');
        clearRunningServiceIfExists(id);
        callManagerEvent('resume', { id, error: errors[id] });
    }

    unlock();

    return true;
}

export async function stopService(id: string, force?: boolean) {
    await reqExists(id);

    const { session } = reqRunning(id);

    lckStatusTp(session.containerId, 'stop');
    const unlock = lockBusyAction(id, 'stop');

    try {
        on("stop", ({ id: stoppedId, error }) => {
            if (stoppedId !== id) {
                // This call is not for me
                return false;
            }

            if (isServicePending(id)) {
                unlock(error);
            }
            ulckStatusTp(session.containerId);
            return true;
        })

        const meta = metaStorageForService(id);
        if (force) {
            await engine.kill(session.containerId, meta);
        } else {
            await engine.stop(session.containerId);
        }
    } catch (e) {
        currentContext.logger.error(e);

        callManagerEvent('stop', { id, error: e });
    }
}

export async function stopServiceForcibly(id: string) {
    return stopService(id, true);
}

export async function sendStopSignal(id: string) {
    const perma = await reqExists(id);
    const { session } = reqRunning(id);

    const stopCmd = perma.meta?.stopCmd;
    if (!stopCmd) {
        throw new _InternalError('Service does not have stop command set.');
    }

    await engine.cmd(session.containerId, stopCmd);
    return true;
}

export async function deleteService(id: string) {
    try {
        await stopService(id, true);
    } catch (e) {
        // Skip not running error
        if (!(e.code && e.code == 2)) {
            throw e;
        }
    }

    const unlockHandler: UnlockObserver = (_, __, ___) => {
        const resolveDeleteImageFunc = async () => {
            const image = await db.getPerma(id)
              .then((perma) => perma.imageId
                ? db.getImage(perma.imageId)
                : undefined);

            return async () => {
                if (image) {
                    // If the image becomes unused after service deletion, delete it
                    await deleteImageIfUnused(image);
                }
            }
        };

        resolveDeleteImageFunc()
          .then((deleteImageFunc) => (
            resolveSequentially(
              async () => engine.deleteVolume(id),
              async () => db.deletePerma(id),
              deleteImageFunc,
            )
          ))
          .then(() => {
              currentContext.logger.info(`Service ${id} deleted`);
          });
    };

    whenUnlocked(id, unlockHandler);
}

export async function updateOptions(id: string, options: Options) {
    reqNotPending(id);
    const perma = await db.getPerma(id);
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
    return db.savePerma(data);
}

export function getTemplate(id: string) {
    return loadTemplate(id);
}

export async function getService(from: string, options?: { includeSession?: boolean, otherNodes?: boolean }) {
    const data = typeof from === 'string' ? await db.getPerma(from) : from;
    if (data && (data.nodeId == nodeId || options?.otherNodes === true)) {
        let session = undefined;
        if (options?.includeSession === true) {
            session = getRunningService(data.serviceId);
        }
        return {
            ...data,
            optionsRam: data.env.SERVICE_RAM ? Number(data.env.SERVICE_RAM) : 0,
            optionsCpu: data.env.SERVICE_CPU ? Number(data.env.SERVICE_CPU) : 0,
            optionsDisk: data.env.SERVICE_DISK ? Number(data.env.SERVICE_DISK) : 0,
            session
        }
    } else {
        return undefined;
    }
}

export function getLastPowerError(id: string) {
    return errors[id];
}

export async function listServices(options: ListServicesOptions) {
    const meta = options.filter?.meta;
    return db
        .list(nodeId, options.page, options.pageSize, meta)
        .then(list => list.map(d => d.serviceId));
}

export async function listTemplates(): Promise<string[]> {
    return getAllTemplates().map(template => template.id);
}

export async function stopRunning() {
    await Promise.all(started.map(({id}) => (
        new Promise((resolve) => {
            whenUnlocked(id, () => {
                stopService(id)
                    .catch(e => console.log(e))
                    .then(() => {
                        whenUnlocked(id, () => resolve(null));
                    });
            });
        })
    )));
}

export async function waitForBusyAction(id: string) {
    return new Promise<void>((resolve, reject) => {
        whenUnlocked(id, (_, status, err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(null);
        });
    });
}

export function isRunning(id: string) {
    return getRunningService(id) != undefined;
}

export function getRunningService(id: string) {
    return started.find(service => service.id === id);
}

function metaStorageForService(id: string): MetaStorage { // service id
    return {
        set: async (key, value) => {
            return db.setServiceMeta(id, key, value);
        },
        get: async (key, def) => {
            return (await db.getServiceMeta(id, key)) ?? def;
        },
    };
}

export function initialized() {
    return engine !== undefined;
}

export async function initEngineForcibly() {
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

export function getRunningServices() {
    return [...started];
}

export function on<T extends keyof ServiceManagerEvents>(evt: T, h: EventHandler<T>) {
    if (!evtHandlers.has(evt)) {
        evtHandlers.set(evt, []);
    }
    evtHandlers.get(evt).push(h);
}

export {
    whenUnlocked
}

async function reqExists(id: string) {
    const perma = await db.getPerma(id);
    if (!perma) {
        throw new _InternalError("Service not found.", 3);
    }

    return perma;
}

function reqRunning(id: string) {
    const session = getRunningService(id);
    if (!session) {
        throw new _InternalError("This service is not running.", 2);
    }

    return session;
}

function reqNotRunning(id: string) {
    if (isRunning(id)) {
        throw new _InternalError('Already running.', 2);
    }
}

function clearRunningServiceIfExists(id: string) {
    const service = getRunningService(id);
    if (service) {
        started.splice(started.indexOf(service, 1));
    }
}

function callManagerEvent<T extends keyof ServiceManagerEvents>(e: T, event: ServiceManagerEvents[T]) {
    if (!evtHandlers.has(e)) {
        return;
    }
    const newArray = evtHandlers.get(e)
        .filter(handler => {
            // Filter out those who returned true, which means they want to be unsubscribed after this call.
            const result = handler(event);

            return typeof result != 'boolean' || !result;
        });
    evtHandlers.set(e, newArray);
}

function buildRunListener(serviceId: string): RunListener {
    return {
        onStateMessage: (msg) => {
            // TODO: handle state messages in a better way
        },
        onMessage: (msg) => {
            logService(serviceId, msg);
        },
        onClose: async () => {
            // Remove session when container is closed, because the service is not running anymore
            await db.deleteSession(serviceId);

            clearRunningServiceIfExists(serviceId);

            // Call stop event on the manager for the stopService() to potentially
            // unlock a busy action
            callManagerEvent("stop", { id: serviceId });

            currentContext.logger.info("Service " + serviceId + " stopped");
        }
    };
}

async function getPermaModel(id: string) {
    const perma_ = await db.getPerma(id);
    if (!perma_) {
        // Service does not exist
        throw new _InternalError('Not found.', 3);
    }

    return perma_;
}

/**
 * Reattach to containers that are still running from the previous session.
 * This may happen if NSM was force-stopped and not properly cleared up resources.
 *
 * @param logger The logger to use
 */
async function reattachStaleContainers(logger: winston.Logger) {
    const running = await engine.listRunning(Filters.node(nodeId))
      .then(containerIds => containerIds
        // Filter out those that we have already started in this session, just in case
        // this was started more than once a session
        .filter(id => !started.find(runningService => runningService.session.containerId === id)));

    for (let containerId of running) {
        const labels = await engine.getLabels(containerId);
        if (!labels[StandardLabel.ServiceId]) {
            // The container was in the running list, but does not have the required labels
            // Should not happen, but just in case
            logger.warn(`Found a running container with id ${containerId} that does not have a service id label, stopping.`);

            await engine.stop(containerId);
        }

        const serviceId = labels[StandardLabel.ServiceId];
        logger.info(`Reattaching container ${containerId} for service ${serviceId}...`);

        // Reattach and watch the container
        await engine.reattach(containerId, buildRunListener(serviceId));

        // Save session in-memory
        const info: RunningService = {
            id: serviceId,
            session: {
                containerId
            }
        };
        started.push(info);
    }

    await new Promise((resolve) => whenUnlockedAll(() => resolve(null)));
}