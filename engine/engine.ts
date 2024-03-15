import docker from "./docker";
import DockerClient from "dockerode";

export type BuildOptions = {
    port: number;
    ports: number[];
    ram: number; // in MB
    cpu: number; // in cores
    disk: number;
    env: {[key: string]: string};
}

export type SigType = 'SIGINT';

export type ServiceEngine = {
    client: DockerClient;

    /**
     * (Re)builds a container from provided build dir and volume dir.
     *
     * @param buildDir The image build dir
     * @param volumeId The volume name
     * @param options Build options
     * @param onclose Function on internal container close
     * @return ID of created container
     */
    build(buildDir: string, volumeId: string, options: BuildOptions, onclose?: () => Promise<void>|void): Promise<string>; // Container ID (local)
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

export default docker;