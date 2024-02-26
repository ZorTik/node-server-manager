import {Database} from "../app";
import createEngine from "./engine";
import YAML from "yaml";
import * as fs from "fs";
import uuid from "uuid";
import {randomPort as retrieveRandomPort} from "../util/port";

type Options = {
    ram?: number,
    cpu?: number,
    ports?: number[], // Optional ports to expose
    env?: {[key: string]: string}, // Optional ENV, see example_settings.yml
}

export type ServiceManager = {
    createService(template: string, options: Options): Promise<string>; // Service ID
    resumeService(id: string): Promise<boolean>;
    stopService(id: string): Promise<boolean>;
    deleteService(id: string): Promise<boolean>;
}

// Impl

export default async function (db: Database, appConfig: any): Promise<ServiceManager> {
    const engine = await createEngine();
    const nodeId = appConfig['node_id'] as string;
    const buildDir = (template: string) => {
        return `${process.cwd()}/templates/${template}/settings.yml`;
    }
    const volumeDir = (id: string) => {
        return `${process.cwd()}/volumes/${id}`;
    }
    const settings = (template: string) => {
        return YAML.parse(fs.readFileSync(buildDir(template), 'utf8'));
    }
    return { // Manager

        async createService(template, {
            ram,
            cpu,
            ports,
            env
        }) {
            const {defaults, port_range} = settings(template);
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
    }
}