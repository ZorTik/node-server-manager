import DockerClient from "dockerode";
import { build, stop, deleteFunc, deleteVolume, listContainers, listAttachedPorts, stat, statall } from "./docker";
import {getSingleton} from "../depend";

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

export type ServiceEngineI = ServiceEngine & { // Internal
    // If we are using the default (not custom) engine
    defaultEngine: boolean,
}

export type ServiceEngine = {
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
    openConsole(id: string): Promise<NodeJS.ReadWriteStream|undefined>;
    volumePath(id: string): Promise<string|undefined>;
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

export default async function (appConfig: any): Promise<ServiceEngineI> {
    let engine = getSingleton<ServiceEngine>('engine');
    const usingDefaultEngine = engine == undefined;
    if (usingDefaultEngine) {
        // Default engine implementation
        const client = initClient(appConfig);
        const engineImpl = {} as ServiceEngine & { dockerClient: DockerClient };
        engineImpl.dockerClient = client;
        engineImpl.build = build(engineImpl, client);
        engineImpl.stop = stop(engineImpl, client);
        engineImpl.delete = deleteFunc(engineImpl, client);
        engineImpl.deleteVolume = deleteVolume(engineImpl, client);
        engineImpl.openConsole = async (id) => {
            try {
                return client.getContainer(id).attach({
                    stream: true, stdin: true, stdout: true, stderr: true, hijack: true,
                    // Optional options, TODO: Extract somewhere as configuration??
                    logs: true,
                });
            } catch (e) {
                // TODO: More robust logging
                console.log(e);
                return undefined;
            }
        };
        engineImpl.volumePath = async (id: string) => {
            const vol = await client.getVolume(id).inspect();
            return vol.Mountpoint;
        };
        engineImpl.listContainers = listContainers(engineImpl, client);
        engineImpl.listAttachedPorts = listAttachedPorts(engineImpl, client);
        engineImpl.stat = stat(engineImpl, client);
        engineImpl.statAll = statall(engineImpl, client);

        // Synchronize containers
        const containerList = await client.listContainers({
            all: true,
            filters: JSON.stringify({ 'label': ['nsm=true'] }) }
        );
        for (const container of containerList) {
            if (container.State !== 'running') {
                continue;
            }
            await engineImpl.stop(container.Id);
        }

        engine = engineImpl;
    }
    return {
        defaultEngine: usingDefaultEngine,
        ...engine,
    };
}