import {Database} from "../app";
import createEngine, {ServiceEngine} from "./engine";
import loadTemplate, {Template} from "./template";
import uuid from "uuid";
import {randomPort as retrieveRandomPort} from "../util/port";
import {loadYamlFile} from "../util/yaml";
import * as fs from "fs";

export type Options = {
    /**
     * The amount of RAM that the service can allocate in MB.
     */
    ram?: number,
    /**
     * The amount of CPU cores that the service can use.
     */
    cpu?: number,
    /**
     * The additional ports to expose. (optional)
     * Main port will be chosen automatically.
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
     */
    env?: {[key: string]: string}, // Optional ENV, see example_settings.yml
}

export type ServiceManager = {
    engine: ServiceEngine;

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
     * Get the template by ID.
     *
     * @param id The template ID
     * @returns The template wrapper
     */
    getTemplate(id: string): Template;
    /**
     * List all available services.
     *
     * @returns The list of service IDs
     */
    listServices(): Promise<string[]>;
    listTemplates(): Promise<string[]>;
}

// Implementation

export default async function (db: Database, appConfig: any): Promise<ServiceManager> {
    const engine = await createEngine(appConfig);
    const nodeId = appConfig['node_id'] as string;
    // Returns the build directory for the template
    const buildDir = (template: string) => {
        return `${process.cwd()}/templates/${template}`;
    }
    // Returns the volume directory for the service
    const volumeDir = (id: string) => {
        return `${process.cwd()}/volumes/${id}`;
    }
    // Returns the settings.yml file for the template
    const settings = (template: string) => {
        return loadYamlFile(buildDir(template) + '/settings.yml');
    }
    return { // Manager
        engine,

        async createService(template, {
            ram,
            cpu,
            ports,
            env
        }) {
            const {defaults, port_range} = settings(template);
            // Pick random main port from the range specified in settings.yml
            const port = await retrieveRandomPort(
                port_range.min as number,
                port_range.max as number
            );
            const serviceId = uuid.v4(); // Create new unique service id
            // Container id
            const containerId = await engine.build(
                buildDir(template),
                volumeDir(serviceId),
                {
                    ram: ram ?? defaults.ram as number,
                    cpu: cpu ?? defaults.cpu as number,
                    env: env ?? defaults.env as {[key: string]: string},
                    port: port,
                    ports: ports ?? []
                }
            )
            const options = {ram, cpu, ports};
            let saved = true;
            // Save permanent info
            if (!await db.savePerma({ serviceId, template, nodeId, port, options, env })) {
                saved = false;
            }
            // Save this session's info
            if (!await db.saveSession({ serviceId, nodeId, containerId })) {
                saved = false;
            }
            if (!saved) {
                throw new Error('Failed to save session or perma info to database');
            }
            return serviceId;
        },

        async resumeService(id) {
            const perma_ = await db.getPerma(id);
            if (!perma_) {
                return false;
            }
            const {template, options, env} = perma_;
            const {defaults} = settings(template);
            const session = await db.getSession(id);
            const perma = await db.getPerma(id);
            if (!session || !perma) {
                return false;
            }
            // Rebuild container using existing volume directory,
            // stored options and custom env variables.
            const containerId = await engine.build(
                buildDir(template),
                volumeDir(id),
                {
                    ram: options.ram ?? defaults.ram as number,
                    cpu: options.cpu ?? defaults.cpu as number,
                    env: env ?? defaults.env as {[key: string]: string},
                    port: perma_.port,
                    ports: options.ports ?? []
                }
            )
            // Save new session info
            if (await db.saveSession({ serviceId: id, nodeId, containerId })) {
                return true;
            } else {
                // Cleanup if err with db
                await engine.stop(containerId);
                return false;
            }
        },

        async stopService(id) {
            const session = await db.getSession(id);
            if (!session) {
                return false;
            }
            if (!await engine.stop(session.containerId)) {
                return false;
            }
            return db.deleteSession(id);
        },

        async deleteService(id) {
            await this.stopService(id);
            return db.deletePerma(id);
        },
        getTemplate(id: string): Template {
            return loadTemplate(id);
        },
        listServices(): Promise<string[]> {
            return db.list(nodeId);
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
        }
    }
}