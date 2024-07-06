import {currentContext, Database} from "../app";
import createEngine, {ServiceEngineI} from "./engine";
import loadTemplate, {Template} from "./template";
import crypto from "crypto";
import {randomPort as retrieveRandomPort} from "../util/port";
import {loadYamlFile} from "../util/yaml";
import * as fs from "fs";
import {PermaModel} from "../database";
import {asyncServiceRun, isServicePending, lckStatusTp, ulckStatusTp} from "./asyncp";
import winston from "winston";
import {status} from "../server";

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

export type MetaStorage = {
    set: (key: string, value: any) => Promise<boolean>;
    get: <T>(key: string, def?: T) => Promise<T|undefined>;
}

export type NoTAlternateSettings = {
    port_range: {
        min: number,
        max: number
    },
    defaults: {
        ram: number,
        cpu: number,
        disk: number
    },
    env: {
    }
}

export type EngineExpansion = {
    [k in keyof ServiceEngineI | string]: any;
};

export type ServiceManager = {
    engine: ServiceEngineI;
    nodeId: string;
    volumesDir: string;

    expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T>;

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
     */
    getService(from: string|PermaModel): Promise<ServiceInfo|undefined>;

    /**
     * Get the last power error of a service.
     *
     * @param id The service ID
     */
    getLastPowerError(id: string): Error|undefined;

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

    stopRunning(): Promise<void>;

    enableNoTemplateMode(alternateSettings: NoTAlternateSettings): Promise<void>;

    noTemplateMode(): boolean;
}

export type ServiceInfo = PermaModel & {
    optionsRam: number, // From options.ram
    optionsCpu: number, // From options.cpu
    optionsDisk: number, // From options.disk
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
export let volumesDir: string;

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

async function init(db_: Database, appConfig_: any) {
    db = db_;
    appConfig = appConfig_;
    engine = await createEngine(appConfig);
    nodeId = appConfig['node_id'] as string;
    volumesDir = process.cwd() + '/volumes';
}

export async function expandEngine<T extends EngineExpansion>(exp?: T): Promise<ServiceEngineI & T> {
    if (exp) {
        if (!engine && (!currentContext || !currentContext.appConfig)) {
            throw new Error("Engine is not yet loaded and can't be loaded forcibly!");
        } else if (!engine) {
            // Engine is not initialized yet, but we want to expand it, so
            // we need to force load it.
            engine = await createEngine(currentContext.appConfig);
        }
        // An expansion is provided, so there are changes to be applied.
        for (const k in Object.keys(exp)) {
            engine[k] = exp[k];
        }
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
    const {defaults, port_range} = noTAlternateSett ? {...noTAlternateSett} : settings(template);
    // Pick random main port from the range specified in settings.yml
    const port = await retrieveRandomPort(
        engine,
        port_range.min as number,
        port_range.max as number
    );
    const serviceId = crypto.randomUUID(); // Create new unique service id
    const self = this;
    asyncServiceRun(serviceId, 'create', async () => {
        // Container id
        const containerId = await engine.build(
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
            metaStorageForService(serviceId),
            async () => {
                await self.stopService(serviceId);
            }
        );
        if (!containerId) {
            throw new _InternalError('Failed to create container. Service: ' + serviceId);
        }
        const rollback = async () => {
            await engine.delete(containerId);
        }
        const options = {ram, cpu, ports};
        // Save permanent info
        if (!await db.savePerma({ serviceId, template, nodeId, port, options, env: env ?? {}, network })) {
            await rollback();
            throw new _InternalError('Failed to save perma info to database');
        }
        // Save this session's info
        if (!await db.saveSession({ serviceId, nodeId, containerId })) {
            await rollback();
            throw new _InternalError('Failed to save session info to database');
        }
        started.push(serviceId);
    }).catch(e => {
        // Save to be later retrieved
        errors[serviceId] = e;
        currentContext.logger.error(e.message);
        started.splice(started.indexOf(serviceId), 1);
    });
    const e = errors[serviceId];
    if (e) {
        throw e;
    }
    return serviceId;
}

export async function resumeService(id: string) {
    reqCompatibleEngine();
    reqNoPending(id);
    const perma_ = await db.getPerma(id);
    // Service does not exist
    if (!perma_) {
        throw new _InternalError('Not found.', 3);
    }
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

    const self = this;

    asyncServiceRun(id, 'resume', async () => {
        // Rebuild container using existing volume directory,
        // stored options and custom env variables.
        const containerId = await engine.build(
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
            metaStorageForService(id),
            async () => {
                await self.stopService(id);
            }
        );
        if (!containerId) {
            currentContext.logger.error('Failed to create container. Service: ' + id);
            return false;
        }
        // Save new session info
        if (await db.saveSession({ serviceId: id, nodeId, containerId })) {
            started.push(id);
            return true;
        } else {
            // Cleanup if err with db
            await engine.stop(containerId);
            return false;
        }
    }).then(success => {
        if (success) {
            currentContext.logger.info('Service ' + id + ' resumed.');
        } else {
            errors[id] = new Error('Failed to resume service');
            started.splice(started.indexOf(id), 1);
        }
    });
    return true;
}

export async function stopService(id: string, fromDeleteFunc?: boolean) {
    reqNoPending(id);
    const session = await db.getSession(id);
    if (!session) {
        throw new _InternalError("This service is not running.", 2);
    }

    lckStatusTp(session.containerId, 'stop');

    try {
        await engine.stop(session.containerId);

        let serviceSucc: boolean = true;
        if (engine.useVolumes) {
            serviceSucc = fromDeleteFunc == true
                ? await engine.delete(session.containerId, { deleteNetwork: true })
                : await engine.delete(session.containerId);
        } else if (fromDeleteFunc) {
            serviceSucc = await engine.delete(session.containerId, { deleteNetwork: true });
        }
        const sessionSucc = await db.deleteSession(id);

        if (serviceSucc && sessionSucc) {
            started.splice(started.indexOf(id), 1);
            return true;
        } else {
            return false;
        }
    } finally {
        ulckStatusTp(session.containerId);
    }
}

export async function deleteService(id: string) {
    try {
        await this.stopService(id, true);
    } catch (e) {
        // Skip not running error
        if (!(e.code && e.code == 2)) {
            throw e;
        }
    }
    if (engine.useVolumes) {
        await engine.deleteVolume(id);
    } else {
        // If the useVolumes is false, service is deleted inside stopService
    }
    return db.deletePerma(id);
}

export async function updateOptions(id: string, options: Options): Promise<boolean> {
    reqNoPending(id);
    const perma = await db.getPerma(id);
    const data: PermaModel = {
        ...perma,
        ...options,
        env: {
            ...perma.env,
            ...options.env
        }
    };
    return db.savePerma(data);
}

export function getTemplate(id: string): Template|undefined {
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

export async function getService(from: string): Promise<ServiceInfo | undefined> {
    const data = typeof from === 'string' ? await db.getPerma(from) : from;
    if (!data) {
        return undefined;
    }
    return {
        ...data,
        optionsRam: data.env.SERVICE_RAM ? Number(data.env.SERVICE_RAM) : 0,
        optionsCpu: data.env.SERVICE_CPU ? Number(data.env.SERVICE_CPU) : 0,
        optionsDisk: data.env.SERVICE_DISK ? Number(data.env.SERVICE_DISK) : 0,
    }
}

export function getLastPowerError(id: string): Error | undefined {
    return errors[id];
}

export async function listServices(page: number, pageSize: number, all?: boolean): Promise<string[]> {
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
    for (let id of started) {
        try {
            await this.stopService(id);
        } catch (e) {
            currentContext.logger.error(e.message);
        }
    }
}

export async function enableNoTemplateMode(alternateSettings: NoTAlternateSettings) {
    noTAlternateSett = alternateSettings;
    currentContext.logger.info("No-template mode has been enabled.");
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


// Utils

function reqNoPending(id: string) {
    if (status === "stopping") {
        // If the NSM engine is in stopping state, ignore this
        return;
    }
    if (isServicePending(id)) {
        throw new Error('Service is pending another action.');
    }
}

function reqCompatibleEngine() {
    if (noTAlternateSett && !engine.supportsNoTemplateMode) {
        throw new Error('No-template mode is enabled, but current engine does not support it! Please switch to different engine.');
    }
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
    for (let session of unclearedSessions) {
        await stopService(session.serviceId);
    }

    logger.info(`Using ${engine.defaultEngine ? 'default' : 'custom'} engine`);
}