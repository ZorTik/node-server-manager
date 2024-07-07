import DockerClient from "dockerode";
import buildDockerEngine from "./docker";
import {getSingleton} from "../depend";
import {MetaStorage} from "./manager";

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

export type DeleteOptions = {
    /**
     * If this is true, it indicates that the service should be also
     * disconnected from any custom network it is connected to and the
     * network should be deleted.
     */
    deleteNetwork?: boolean;
}

export type DockerServiceEngine = ServiceEngineI & {
    dockerClient: DockerClient;
}

export type ServiceEngineI = ServiceEngine & { // Internal
    // If we are using the default (not custom) engine
    defaultEngine: boolean,
}

/**
 * The lowest layer which manipulates containers (services) directly.
 * This is called by NSM whenever NSM needs to do something with the
 * containers themselves.
 */
export type ServiceEngine = {
    /**
     * Indicates if this engine uses external storage and should keep
     * the services or not. This significantly changes the behaviour of NSM
     * to the ServiceEngine.
     *
     * There are several differences that apply according to this state.
     * If Enabled:
     * - The delete function is called on DELETE and also STOP!
     *   In other words, the container is deleted ALWAYS, and rebuilt everytime
     *   with the used volume that holds the files.
     * - The deleteVolume function is called only on DELETE
     * If Disabled:
     * - The delete function is called ONLY ON DELETE, not on stop (services are kept)
     * - The deleteVolume function is NEVER CALLED!
     */
    useVolumes: boolean;
    /**
     * If this engine supports no-t mode from engine/manager.
     * If enabled, buildDir from build() method can be undefined.
     */
    supportsNoTemplateMode: boolean;

    cast<T extends ServiceEngine>(): T;

    /**
     * (Re)builds a container from provided build dir and volume dir.
     *
     * @param buildDir The image build dir, or undefined if no-template mode is enabled.
     *                 Should throw error if no-t mode is not supported by this engine.
     * @param volumeId The volume name
     * @param options Build options
     * @param meta Meta storage for this unique context
     * @param onclose Function on internal container close
     * @return ID of created container
     */
    build(
        buildDir: string|undefined,
        volumeId: string,
        options: BuildOptions,
        meta: MetaStorage,
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
    delete(id: string, options?: DeleteOptions): Promise<boolean>;

    /**
     * Deletes a volume by ID.
     * This is NEVER called if ServiceEngine#useVolumes is false.
     *
     * @param id The volume ID.
     */
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

    // Disk usage of all services here
    // [0]: free, [1]: size
    calcHostUsage(): Promise<number[]>;
}

export default async function (appConfig: any): Promise<ServiceEngineI> {
    let engine = getSingleton<ServiceEngine>('engine');
    const usingBuiltInEngine = engine == undefined;
    const engineId = process.env.NSM_ENGINE ?? 'docker';
    if (usingBuiltInEngine) {
        switch (engineId) {
            case 'docker':
                engine = await buildDockerEngine(appConfig);
                break;
            default:
                throw new Error('Invalid engine ID ' + engineId);
        }
    }
    return {
        defaultEngine: usingBuiltInEngine && engineId === 'docker',
        ...engine,
    };
}