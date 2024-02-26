import docker from "./docker";

export type BuildOptions = {
    port: number;
    ports: number[];
    ram: number; // in MB
    cpu: number; // in cores
    env: {[key: string]: string};
}

export type ServiceEngine = {
    build(buildDir: string, volumeDir: string, options: BuildOptions): Promise<string>; // Container ID (local)
    stop(id: string): Promise<boolean>;
    delete(id: string): Promise<boolean>;
}

export default async function (): Promise<ServiceEngine> {
    let id = process.env.ENGINE;
    let engine: ServiceEngine;
    if (id === 'docker') {
        engine = await docker();
    } else {
        throw new Error('Unsupported engine type. Please one of: ' + ['docker'].join(', '));
    }
    return engine;
}