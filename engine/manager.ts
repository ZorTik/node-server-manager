import {DatabaseManager} from "../app";
import createEngine from "./engine";
import YAML from "yaml";
import * as fs from "fs";

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
            // Container id
            const id = await engine.create(
                buildDir(template),
                {
                    ram: ram ?? defaults.ram as number,
                    cpu: cpu ?? defaults.cpu as number,
                    env: env ?? defaults.env as {[key: string]: string},
                    port: randomPort(),
                    ports: ports ?? []
                }
            )
            // TODO: Save to db
            return id;
        },
        async resumeService(id: string, options: ServiceOptions): Promise<boolean> {
            // TODO
        }
    }
}