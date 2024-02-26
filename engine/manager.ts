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
    // TODO: Mediator between db and engine
}

export default async function (db: DatabaseManager): Promise<ServiceManager> {
    const engine = await createEngine();
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
            const { defaults } = settings(template);
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
            // TODO: Save service id, node id, container id, and port to db (current session info)
            // TODO: Save service id, node id (permanent)
            return serviceId;
        },
        async resumeService(id: string, options: ServiceOptions): Promise<boolean> {
            // TODO: Load session info from db, rebuild from volume using engine
        }
    }
}