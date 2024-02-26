import {DatabaseManager} from "../app";
import createEngine from "./engine";
import YAML from "yaml";
import * as fs from "fs";
import uuid from "uuid";

type ServiceOptions = {
    ram?: number,
    cpu?: number,
    ports?: number[], // Optional ports to expose
    env?: {[key: string]: string}, // Optional ENV, see example_settings.yml
}

export type ServiceManager = {
    createService(template: string, options: ServiceOptions): Promise<string>; // Service ID
    resumeService(id: string, options: ServiceOptions): Promise<boolean>;
    stopService(id: string): Promise<boolean>;
    deleteService(id: string): Promise<boolean>;
    isRunning(id: string): Promise<boolean>;
}

export default async function (db: DatabaseManager): Promise<ServiceManager> {
    const engine = await createEngine();
    const nodeId = ;
    const buildDir = (template: string) => {
        return `${process.cwd()}/templates/${template}/settings.yml`;
    }
    const volumeDir = (id: string) => {
        return `${process.cwd()}/volumes/${id}`;
    }
    const settings = (template: string) => {
        return YAML.parse(fs.readFileSync(buildDir(template), 'utf8'));
    }
    const randomPort = () => {
        // TODO
    }

    return { // Manager
        async createService(template, {
            ram,
            cpu,
            ports,
            env
        }) {
            const {defaults} = settings(template);
            const port = randomPort();
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
            let saved = true;
            // Save permanent info
            if (!await db.savePerma({ serviceId, template, nodeId, port })) {
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
        async resumeService(id: string, options: ServiceOptions): Promise<boolean> {
            const perma_ = await db.getPerma(id);
            if (!perma_) {
                return false;
            }
            const {template} = perma_;
            const {defaults} = settings(template);
            const session = await db.getSession(id);
            if (!session) {
                return false;
            }
            const containerId = await engine.build(
                buildDir(template),
                volumeDir(id),
                {
                    ram: options.ram ?? defaults.ram as number,
                    cpu: options.cpu ?? defaults.cpu as number,
                    env: options.env ?? defaults.env as {[key: string]: string},
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
        async stopService(id: string): Promise<boolean> {
            const session = await db.getSession(id);
            if (!session) {
                return false;
            }
            if (!await engine.stop(session.containerId)) {
                return false;
            }
            return await db.deleteSession(id);
        },
        async deleteService(id: string): Promise<boolean> {
            if (this.isRunning(id) && !await this.stopService(id)) {
                return false;
            }
            return await db.deletePerma(id);
        },
        async isRunning(id: string): Promise<boolean> {
            const session = await db.getSession(id);
            return session && await engine.isRunning(session.containerId);
        }
    }
}