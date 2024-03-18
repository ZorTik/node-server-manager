import {currentContext, Database} from "../app";
import createEngine, {ServiceEngine} from "./engine";
import loadTemplate, {Template} from "./template";
import crypto from "crypto";
import {randomPort as retrieveRandomPort} from "../util/port";
import {loadYamlFile} from "../util/yaml";
import * as fs from "fs";
import {PermaModel} from "../database";
import {asyncServiceRun, isServicePending, lckStatusTp, ulckStatusTp} from "./asyncp";
import winston from "winston";
import {status} from "../index";

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
}

export type ServiceManager = {
    engine: ServiceEngine;
    nodeId: string;
    volumesDir: string;

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
     * @param id The service ID
     */
    getService(id: string): Promise<PermaModel|undefined>;
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
}

// 1 = unknown, 2 = conflict, 3 = not found
export type StatusCode = 1 | 2 | 3;

class _InternalError extends Error {
    readonly code: StatusCode;

    constructor(msg: string, code?: StatusCode) {
        super(msg);
        this.code = code ?? 1;
    }
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

// Implementation

async function init(db: Database, appConfig: any): Promise<ServiceManager> {
    const engine = await createEngine(appConfig);
    const nodeId = appConfig['node_id'] as string;
    const volumesDir = process.cwd() + '/volumes';
    // Returns the build directory for the template
    const buildDir = (template: string) => {
        return `${process.cwd()}/templates/${template}`;
    }
    // Returns the settings.yml file for the template
    const settings = (template: string) => {
        return loadYamlFile(buildDir(template) + '/settings.yml');
    }

    // Save errors somewhere else?
    // Could it be a memory leak if there are tons of them??
    const errors = {};
    // Service IDs that are currently running
    const started = [];

    return { // Manager
        engine,
        nodeId,
        volumesDir,

        async createService(template, {
            ram,
            cpu,
            disk,
            ports,
            env
        }) {
            const {defaults, port_range} = settings(template);
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
                    buildDir(template),
                    serviceId,
                    {
                        ram: ram ?? defaults.ram as number,
                        cpu: cpu ?? defaults.cpu as number,
                        disk: disk ?? defaults.disk as number,
                        env: env ?? {},
                        port: port,
                        ports: ports ?? []
                    },
                    async () => {
                        await self.stopService(serviceId);
                    }
                );
                if (!containerId) {
                    throw new _InternalError('Failed to create container');
                }
                const rollback = async () => {
                    await engine.delete(containerId);
                }
                const options = {ram, cpu, ports};
                // Save permanent info
                if (!await db.savePerma({ serviceId, template, nodeId, port, options, env })) {
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
        },

        async resumeService(id) {
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

            const {template, options, env} = perma_;
            const {defaults} = settings(template);

            const self = this;

            asyncServiceRun(id, 'resume', async () => {
                // Rebuild container using existing volume directory,
                // stored options and custom env variables.
                const containerId = await engine.build(
                    buildDir(template),
                    id,
                    {
                        ram: options.ram ?? defaults.ram as number,
                        cpu: options.cpu ?? defaults.cpu as number,
                        disk: options.disk ?? defaults.disk as number,
                        env: env ?? defaults.env as {[key: string]: string},
                        port: perma_.port,
                        ports: options.ports ?? []
                    },
                    async () => {
                        await self.stopService(id);
                    }
                )
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
                    // TODO
                } else {
                    errors[id] = new Error('Failed to resume service');
                    started.splice(started.indexOf(id), 1);
                }
            });
            return true;
        },

        async stopService(id) {
            reqNoPending(id);
            const session = await db.getSession(id);
            if (!session) {
                throw new _InternalError("This service is not running.", 2);
            }

            lckStatusTp(session.containerId, 'stop');

            try {
                await engine.stop(session.containerId);

                const one = await engine.delete(session.containerId);
                const two = await db.deleteSession(id);

                if (one && two) {
                    started.splice(started.indexOf(id), 1);
                    return true;
                } else {
                    return false;
                }
            } finally {
                ulckStatusTp(session.containerId);
            }
        },

        async deleteService(id) {
            try {
                await this.stopService(id);
            } catch (e) {
                // Skip not running error
                if (!(e.code && e.code == 2)) {
                    throw e;
                }
            }
            await engine.deleteVolume(id);
            return db.deletePerma(id);
        },

        async updateOptions(id: string, options: Options): Promise<boolean> {
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
        },

        getTemplate(id: string): Template|undefined {
            return loadTemplate(id);
        },

        async getService(id: string): Promise<PermaModel | undefined> {
            return db.getPerma(id);
        },

        getLastPowerError(id: string): Error | undefined {
            return errors[id];
        },

        async listServices(page: number, pageSize: number, all?: boolean): Promise<string[]> {
            return db.list((all ?? false) ? undefined : nodeId, page, pageSize);
        },

        listTemplates(): Promise<string[]> {
            return new Promise((resolve, reject) => {
                fs.readdir(`${process.cwd()}/templates`, (err, files) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(files);
                    }
                });
            });
        },

        async stopRunning() {
            for (let id of started) {
                try {
                    await this.stopService(id);
                } catch (e) {
                    currentContext.logger.error(e.message);
                }
            }
        }
    }
}

export default async function ({db, appConfig, logger}: {
    db: Database,
    appConfig: any,
    logger: winston.Logger
}): Promise<ServiceManager> {
    const nodeId = appConfig['node_id'] as string;

    logger.info(`Initializing service manager for node ${nodeId}...`)

    const unclearedSessions = await db.listSessions(nodeId);
    const manager = await init(db, appConfig);
    for (let session of unclearedSessions) {
        await manager.stopService(session.serviceId);
    }
    return manager;
}