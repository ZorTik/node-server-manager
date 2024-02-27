import docker from "./docker";

export type BuildOptions = {
    port: number;
    ports: number[];
    ram: number; // in MB
    cpu: number; // in cores
    env: {[key: string]: string};
}

export type EngineInfo = {
    /**
     * Amount of running services on this node.
     */
    runningCount: number;
}

export type ServiceEngine = {
    /**
     * (Re)builds a container from provided build dir and volume dir.
     *
     * @param buildDir The image build dir
     * @param volumeDir The volume dir
     * @param options Build options
     * @return ID of created container
     */
    build(buildDir: string, volumeDir: string, options: BuildOptions): Promise<string>; // Container ID (local)
    /**
     * Stops a container.
     *
     * @param id Container ID
     * @return Success state
     */
    stop(id: string): Promise<boolean>;
    /**
     * Deletes a container.
     *
     * @param id Container ID
     * @return Success state
     */
    delete(id: string): Promise<boolean>;
    /**
     * Build info about current engine.
     *
     * @return Engine info
     */
    info(): Promise<EngineInfo>;
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