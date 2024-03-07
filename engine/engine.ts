import docker from "./docker";

export type BuildOptions = {
    port: number;
    ports: number[];
    ram: number; // in MB
    cpu: number; // in cores
    disk: number;
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
     * Lists container ids of containers by templates.
     *
     * @param templates The templates
     * @return List of container IDs
     */
    listContainers(templates: string[]): Promise<string[]>;
    listAttachedPorts(): Promise<number[]>;
}

export default async function (appConfig: any): Promise<ServiceEngine> {
    let id = appConfig.engine;
    let engine: ServiceEngine;
    if (id === 'docker') {
        engine = await docker(appConfig);
    } else {
        throw new Error('Unsupported engine type. Please use one of: ' + ['docker'].join(', '));
    }
    return engine;
}