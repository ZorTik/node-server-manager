import DockerClient from "dockerode";
import { build, stop, deleteFunc, deleteVolume, listContainers, listAttachedPorts, stat, statall } from "./docker";

export type BuildOptions = {
    port: number;
    ports: number[];
    ram: number; // in MB
    cpu: number; // in cores
    disk: number;
    env: {[key: string]: string};
    network?: {
        address: string,
        // If only ports should be exposed to this
        // IP address.
        portsOnly: boolean,
    };
}

export type ContainerStat = {
    id: string,
    memory: {
        used: number,
        total: number,
        percent: number
    },
    cpu: {
        used: number,
        total: number,
        percent: number
    },
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
    build(
        buildDir: string,
        volumeId: string,
        options: BuildOptions,
        onclose?: () => Promise<void>|void): Promise<string>; // Container ID (local)
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
     * @param options The delete options
     * @return Success state
     */
    delete(id: string, options?: { deleteNetwork?: boolean }): Promise<boolean>;
    deleteVolume(id: string): Promise<boolean>;
    /**
     * Lists container ids of containers by templates.
     *
     * @param templates The templates
     * @return List of container IDs
     */
    listContainers(templates?: string[]): Promise<string[]>;
    listAttachedPorts(): Promise<number[]>;
    stat(id: string): Promise<ContainerStat|null>;
    statAll(): Promise<ContainerStat[]>;
}

function initClient(appConfig: { docker_host: string }) {
    let client: DockerClient;
    if (appConfig.docker_host && (
        appConfig.docker_host.endsWith('.sock') ||
        appConfig.docker_host.startsWith('\\\\.\\pipe')
    )) {
        client = new DockerClient({ socketPath: appConfig.docker_host });
    } else if (appConfig.docker_host) {
        // http(s)://host:port
        let host = appConfig.docker_host;
        host = host.substring(host.lastIndexOf(':'));
        let port = parseInt(appConfig.docker_host.replace(host, ''));
        client = new DockerClient({host, port});
    } else {
        throw new Error('Docker engine configuration variable not found! Please set docker_host in config.yml or override using env.');
    }
    return client;
}

async function synchronizeContainers(client: DockerClient, engine: ServiceEngine) {
    const options: DockerClient.ContainerListOptions = { all: true, filters: JSON.stringify({ 'label': ['nsm=true'] }) };
    const list = await client.listContainers(options);
    for (const c of list) {
        if (c.State !== 'running') {
            continue;
        }
        await engine.stop(c.Id);
    }
}

export default async function (appConfig: any): Promise<ServiceEngine> {
    const client = initClient(appConfig);
    const engine: ServiceEngine = {} as ServiceEngine;
    engine.client = client;
    engine.build = build(engine, client);
    engine.stop = stop(engine, client);
    engine.delete = deleteFunc(engine, client);
    engine.deleteVolume = deleteVolume(engine, client);
    engine.listContainers = listContainers(engine, client);
    engine.listAttachedPorts = listAttachedPorts(engine, client);
    engine.stat = stat(engine, client);
    engine.statAll = statall(engine, client);
    await synchronizeContainers(client, engine);
    return engine;
}