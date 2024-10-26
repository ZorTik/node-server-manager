import {currentContext, Database} from "../app";
import createEngine, {ServiceEngineI} from "./engine";
import loadTemplate, {Template} from "./template";
import crypto from "crypto";
import {randomPort as retrieveRandomPort} from "../util/port";
import {loadYamlFile} from "../util/yaml";
import * as fs from "fs";
import {PermaModel, SessionModel} from "../database";
import {
    lckStatusTp,
    lockBusyAction,
    reqNotPending,
    ulckStatusTp,
    UnlockObserver,
    whenUnlocked, whenUnlockedAll
} from "./asyncp";
import winston from "winston";
import * as bus from "../event/bus";
import {isDebug} from "@nsm/helpers";
import {resolveSequentially} from "@nsm/util/promises";

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

export type NoTAlternateSettings = {
    port_range: {
        min: number,
        max: number,
    },
    defaults: {
        ram: number,
        cpu: number,
        disk: number,
    },
    meta: {
        stopCmd: string,
    },
    env: {
    },
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
     * @returns Whether the service was stopped
     */
    stopService(id: string): Promise<boolean>;

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
     * @returns Whether the service was deleted
     */
    deleteService(id: string): Promise<boolean>;

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
    getRunningServices(): string[];

    /**
     * List all available services.
     *
     * @param page The page number (index)
     * @param pageSize The page size
     * @param all Include services from other nodes, default false
     * @returns The list of service IDs
     */
    listServices(page: number, pageSize: number, all?: boolean): Promise<string[]>;

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
     * Enable no-template mode.
     *
     * When this is enabled, all services are being treated as same template, and it's
     * up to the internal engine to handle creating them without templates. Services
     * created using template mode can't be manipulated in this mode. Also, internal
     * engine must support this mode.
     *
     * @param alternateSettings The global template default settings, replacement for
     *                          settings.yml in template mode. This will be used as
     *                          the settings for the global template used for every
     *                          service created in this mode.
     */
    enableNoTemplateMode(alternateSettings: NoTAlternateSettings): Promise<void>;

    /**
     * Whether the no-template mode is enabled.
     */
    noTemplateMode(): boolean;

    isRunning(id: string): boolean;

    waitForBusyAction(id: string): Promise<void>;

    // DON'T call those until you really know what you are doing.
    expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T>;

    initEngineForcibly(): Promise<void>;
    //
} & {
    whenUnlocked: typeof whenUnlocked
};

export type ServiceInfo = PermaModel & {
    optionsRam: number, // From options.ram
    optionsCpu: number, // From options.cpu
    optionsDisk: number, // From options.disk
    session?: SessionModel
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
let noTAlternateSett: NoTAlternateSettings|undefined = undefined;

// Returns the build directory for the template
function buildDir(template: string) {
    return `${process.cwd()}/templates/${template}`;
}
// Returns the settings.yml file for the template
function settings(template: string) {
    return loadYamlFile(buildDir(template) + '/settings.yml');
}

// Save errors somewhere else?
// Could it be a memory leak if there are tons of them??
const errors = {};
// Service IDs that are currently running
const started = [];
const noTTemplate = '__no_t__';
const evtHandlers: Map<string, EventHandler<any>[]> = new Map();

["push", "splice"].forEach(funcName => {
    started[funcName] = (...args: any[]) => {
        // Emit services change within those methods
        bus.callEvent('nsm:engine:startedserviceschange', [...started]).then(() => {
            if (isDebug()) {
                currentContext.logger.debug('Service registry changed');
            }
        });
        return Array.prototype[funcName].apply(started, args);
    };
});

async function init(db_: Database, appConfig_: any) {
    db = db_;
    appConfig = appConfig_;
    if (!engine) {
        // Init only if it has not already been force-initialized
        await initEngineForcibly();
    }
    nodeId = appConfig['node_id'] as string;
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

export async function createService(template: string, {
    ram,
    cpu,
    disk,
    ports,
    env,
    network,
}) {
    reqCompatibleEngine();
    template = noTAlternateSett ? noTTemplate : template;
    const {defaults, port_range, meta = undefined} = noTAlternateSett ? {...noTAlternateSett} : settings(template);
    // Pick random main port from the range specified in settings.yml
    const port = await retrieveRandomPort(
        engine,
        port_range.min as number,
        port_range.max as number
    );
    const serviceId = crypto.randomUUID(); // Create new unique service id
    const metaStorage = metaStorageForService(serviceId);
    const unlock = lockBusyAction(serviceId, 'create');

    if (!meta || !meta.stopCmd) {
        throw new _InternalError('Invalid template meta for ' + template);
    }

    new Promise<any>((resolve, reject) => {
        //
        const buildHandler = async (containerId?: string, err?: any) => {
            try {
                if (err) {
                    throw err;
                }
                if (!containerId) {
                    throw new _InternalError('Failed to create container. Service: ' + serviceId);
                }
                const rollback = async () => {
                    await engine.delete(containerId, metaStorage);
                }
                const options = {ram, cpu, ports};
                // Save permanent info
                if (!await db.savePerma({ serviceId, template, nodeId, port, options, meta, env: env ?? {}, network })) {
                    await rollback();
                    throw new _InternalError('Failed to save perma info to database');
                }
                // Save this session's info
                if (!await db.saveSession({ serviceId, nodeId, containerId })) {
                    await rollback();
                    throw new _InternalError('Failed to save session info to database');
                }
                started.push(serviceId);
            } catch (e) {
                reject(e);
                return;
            }
            resolve(undefined);
        }

        // Container id
        engine.build(
            noTAlternateSett ? undefined : buildDir(template),
            serviceId,
            {
                ram: ram ?? defaults.ram as number,
                cpu: cpu ?? defaults.cpu as number,
                disk: disk ?? defaults.disk as number,
                env: {
                    ...(env ?? {}),
                    SERVICE_ID: serviceId
                },
                port: port,
                ports: ports ?? [],
                network,
            },
            metaStorage,
            buildHandler,
            async () => {
                await stopService(serviceId);
            }
        );
    })
        .catch(e => {
            // Save to be later retrieved
            errors[serviceId] = e;
            currentContext.logger.error(e.message);
            started.splice(started.indexOf(serviceId), 1);
        })
        .finally(() => {
            unlock();
        });
    const e = errors[serviceId];
    if (e) {
        throw e;
    }
    return serviceId;
}

export async function resumeService(id: string) {
    reqCompatibleEngine();
    const perma_ = await getPermaModel(id);
    // Service is already running
    if (await db.getSession(id)) {
        throw new _InternalError('Already running.', 2);
    }

    const {template, options, env, network} = perma_;

    if (noTAlternateSett && template !== noTTemplate) {
        throw new Error('Tried to resume template-based service from within no-template mode.');
    } else if (template === noTTemplate && !noTAlternateSett) {
        throw new Error('Tried to resume no-t service from within template mode.');
    }

    if (noTAlternateSett && perma_.nodeId !== nodeId) {
        throw new Error('In no-template mode, only services that came from this node can be resumed here.');
    }

    const {defaults} = noTAlternateSett ? {...noTAlternateSett} : settings(template);

    const meta = metaStorageForService(id);
    const unlock = lockBusyAction(id, 'resume');

    new Promise<boolean>((resolve, reject) => {
        //
        const buildHandler = async (containerId?: string, err?: any) => {
            if (!containerId) {
                currentContext.logger.error('Failed to create container. Service: ' + id);
                resolve(false);
                return;
            }
            const saved = await db.saveSession({ serviceId: id, nodeId, containerId });
            // Save new session info
            if (saved) {
                started.push(id);
                resolve(true);
                return;
            } else {
                // Cleanup if err with db
                await engine.stop(containerId, meta);
                resolve(false);
                return;
            }
        }

        // Rebuild container using existing volume directory,
        // stored options and custom env variables.
        engine.build(
            noTAlternateSett ? undefined : buildDir(template),
            id,
            {
                ram: options.ram ?? defaults.ram as number,
                cpu: options.cpu ?? defaults.cpu as number,
                disk: options.disk ?? defaults.disk as number,
                env: env ?? defaults.env as {[key: string]: string},
                port: perma_.port,
                ports: options.ports ?? [],
                network,
            },
            meta,
            buildHandler,
            async () => {
                await stopService(id);
            }
        );
    })
        .then((success) => {
            if (success == true) {
                currentContext.logger.info('Service ' + id + ' resumed');
                callManagerEvent('resume', { id });
            } else {
                errors[id] = new Error('Failed to resume service');
                started.splice(started.indexOf(id), 1);
                callManagerEvent('resume', { id, error: errors[id] });
            }
        })
        .finally(() => {
            unlock();
        });
    return true;
}

export async function stopService(id: string, fromDeleteFunc?: boolean) {
    if (!await db.getPerma(id)) {
        throw new _InternalError("Service not found.", 3);
    }

    const session = await db.getSession(id);
    if (!session) {
        throw new _InternalError("This service is not running.", 2);
    }

    lckStatusTp(session.containerId, 'stop');
    const unlock = lockBusyAction(id, 'stop');

    (async () => {
        const meta = metaStorageForService(id);

        await engine.stop(session.containerId, meta);

        let serviceSucc: boolean = true;
        if (engine.volumesMode) {
            serviceSucc = fromDeleteFunc == true
                ? await engine.delete(session.containerId, meta, { deleteNetwork: true })
                : await engine.delete(session.containerId, meta);
        } else if (fromDeleteFunc) {
            serviceSucc = await engine.delete(session.containerId, meta, { deleteNetwork: true });
        }
        const sessionSucc = await db.deleteSession(id);

        if (serviceSucc && sessionSucc) {
            started.splice(started.indexOf(id), 1);
            return true;
        } else {
            return false;
        }
    })()
        .then(() => {
            unlock();
            callManagerEvent('stop', { id });
        })
        .catch(e => {
            currentContext.logger.error(e);
            unlock(e);
            callManagerEvent('stop', { id, error: e });
        })
        .finally(() => {
            ulckStatusTp(session.containerId);
        });
    return true;
}

export async function sendStopSignal(id: string) {
    const perma_ = await getPermaModel(id);
    const session = await getServiceSession(id);
    const stopCmd = perma_.meta?.stopCmd;
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

    const unlockHandler: UnlockObserver = (_, __, err) => {
        let task = undefined as Promise<void>|undefined;
        //
        if (engine.volumesMode) {
            // Notify before the volume is being deleted so all can unregister their hooks
            // on this volume
            task = resolveSequentially(
                async () => bus.callEvent('nsm:engine:deletev', { id }),
                async () => engine.deleteVolume(id)
            );
        } else {
            // If the useVolumes is false, service is deleted inside stopService
        }

        const onFinish = () => {
            currentContext.logger.info(`Service ${id} deleted.`);
        }

        resolveSequentially(
            task,
            async () => db.deletePerma(id)
        ).then(onFinish);
    };

    whenUnlocked(id, unlockHandler);
    return true;
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
    if (noTemplateMode()) {
        return {
            id: noTTemplate,
            name: "Built-in",
            description: "A no-template template.",
            settings: noTAlternateSett,
        }
    } else {
        return loadTemplate(id);
    }
}

export async function getService(from: string, options?: { includeSession?: boolean, otherNodes?: boolean }) {
    const data = typeof from === 'string' ? await db.getPerma(from) : from;
    if (data && (data.nodeId == nodeId || options?.otherNodes === true)) {
        let session = undefined;
        if (options?.includeSession === true) {
            session = await currentContext.database.getSession(data.serviceId);
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

export async function listServices(page: number, pageSize: number, all?: boolean) {
    const data = await db.list((all ?? false) ? undefined : nodeId, page, pageSize);
    return data.map(d => d.serviceId);
}

export function listTemplates(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(`${process.cwd()}/templates`, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

export async function stopRunning() {
    await Promise.all(started.map(id => (
        new Promise((resolve, reject) => {
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

export async function enableNoTemplateMode(alternateSettings: NoTAlternateSettings) {
    noTAlternateSett = alternateSettings;
    currentContext.logger.info("No-template mode has been enabled.");
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
    return started.includes(id);
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

export function noTemplateMode() {
    return noTAlternateSett !== undefined;
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
    engine = await createEngine(currentContext.appConfig);
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


// Utils

function reqCompatibleEngine() {
    if (noTAlternateSett && !engine.supportsNoTemplateMode) {
        throw new Error('No-template mode is enabled, but current engine does not support it! Please switch to different engine.');
    }
}

function callManagerEvent<T extends keyof ServiceManagerEvents>(e: T, event: ServiceManagerEvents[T]) {
    if (!evtHandlers.has(e)) {
        return;
    }
    const newArray = evtHandlers.get(e)
        .filter(handler => {
            const result = handler(event);
            return typeof result != 'boolean' || !result;
        });
    evtHandlers.set(e, newArray);
}

async function getPermaModel(id: string) {
    const perma_ = await db.getPerma(id);
    // Service does not exist
    if (!perma_) {
        throw new _InternalError('Not found.', 3);
    }

    return perma_;
}

async function getServiceSession(id: string) {
    const session = await db.getSession(id);
    if (!session) {
        throw new _InternalError("This service is not running.", 2);
    }

    return session;
}

export default async function ({db, appConfig, logger}: {
    db: Database,
    appConfig: any,
    logger: winston.Logger
}) {
    const nodeId = appConfig['node_id'] as string;

    logger.info(`Initializing service manager for node ${nodeId}...`);

    const unclearedSessions = await db.listSessions(nodeId);
    await init(db, appConfig);
    if (unclearedSessions.length > 0) {
        logger.info('There are ' + unclearedSessions.length + ' uncleared sessions, trying to stop the services...');
    }
    // Perform startup cleanup
    for (const session of unclearedSessions) {
        await stopService(session.serviceId);
    }
    //
    await new Promise((resolve) => whenUnlockedAll(() => resolve(null)));
    //
    const running = await engine.listRunning();
    for (const id of running) {
        const volumeId = await engine.getAttachedVolume(id);
        if (!volumeId) {
            // The container does not exist or does not have a volume attached?
            continue;
        }
        await engine.stop(id, metaStorageForService(volumeId));
    }

    logger.info(`Using ${engine.defaultEngine ? 'default' : 'custom'} engine`);
}