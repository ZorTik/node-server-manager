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

export type RunListener = {
    /**
     * Called when there is a state change in the container, with the message of the state change.
     * This is used to update the logs in NSM.
     *
     * @param message The message of the state change, e.g. "Creating container", etc.
     */
    onStateMessage?: (message: string) => Promise<void>|void;
    /**
     * Called when there is a message from the container, with the message.
     *
     * @param message The message from the container
     */
    onMessage?: (message: string) => Promise<void>|void;
    /**
     * Called when the container is closed, either by stop or kill, or by itself.
     */
    onclose?: () => Promise<void>|void;
}

export type DockerServiceEngine = ServiceEngineI & {
    dockerClient: DockerClient;
    /**
     * Map of container IDs and attached watchers.
     * IMPORTANT! Don't close or modify the streams, by any means! It
     * would have unexpected fatal consequences.
     */
    rws: { [id: string]: NodeJS.ReadWriteStream };
}

export type ServiceEngineI = ServiceEngine & { // Internal
    // If we are using the default (not custom) engine
    defaultEngine: boolean,

    cast<T extends ServiceEngine>(): T;
}

/**
 * The lowest layer which manipulates containers (services) directly.
 * This is called by NSM whenever NSM needs to do something with the
 * containers themselves.
 */
export type ServiceEngine = {
    /**
     * If this engine supports no-t mode from engine/manager.
     * If enabled, buildDir from build() method can be undefined.
     */
    supportsNoTemplateMode: boolean;

    /**
     * Builds an image from build dir.
     *
     * @param imageId The image ID to build. If this is undefined, the engine should generate a random image ID and return it.
     * @param buildDir The build dir path
     * @param buildOptions The build options
     */
    build(
      imageId: string|undefined,
      buildDir: string|undefined, buildOptions: { [key: string]: string }): Promise<string>;

    run(
      templateId: string,
      imageId: string,
      volumeId: string,
      options: BuildOptions,
      meta: MetaStorage,
      listener?: RunListener): Promise<string>;

    /**
     * Stops a container.
     *
     * @param id Container ID
     * @param meta Meta storage for this unique context
     * @return Success state
     */
    stop(id: string, meta: MetaStorage): Promise<boolean>;

    /**
     * Kills a container.
     *
     * @param id Container ID
     * @param meta Meta storage for this unique context
     * @return Success state
     */
    kill(id: string, meta: MetaStorage): Promise<boolean>;

    /**
     * Reattaches to a container.
     *
     * @param id Container ID
     * @param listener Listener for container messages and state changes
     */
    reattach(id: string, listener: RunListener): Promise<void>;

    /**
     * Deletes a volume by ID.
     * This is NEVER called if ServiceEngine#useVolumes is false.
     *
     * @param id The volume ID.
     */
    deleteVolume(id: string): Promise<boolean>;

    /**
     * Send a command to the container.
     *
     * @param id Container ID
     * @param cmd The command, without new line
     */
    cmd(id: string, cmd: string): Promise<boolean>;

    /**
     * Get ID of volume that this container is attached to, or undefined
     * if not found or no volume. Meta is not present here because this func
     * is used to determine ID for building the meta.
     *
     * @param id The volume ID.
     */
    getAttachedVolume(id: string): Promise<string|undefined>;

    /**
     * Lists container ids of containers by templates.
     *
     * @param templates The templates
     * @return List of container IDs
     */
    listContainers(templates?: string[]): Promise<string[]>;

    /**
     * List running containers owned by this engine on this machine.
     *
     * @return List of container IDs
     */
    listRunning(): Promise<string[]>;

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
        cast: undefined, // Being set in manager
        ...engine,
    };
}