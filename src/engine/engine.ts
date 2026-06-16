import DockerClient from "dockerode";
import buildDockerEngine from "./docker";
import {getSingleton} from "../depend";
import {Template} from "@nsm/engine/template";
import {AppContext} from "@nsm/app";
import {TemplateRepositoryConfigurationError} from "@nsm/engine/error";

/**
 * The options for running a service.
 */
export type RunOptions = {
  port: number;
  ports: number[];
  ram: number; // in MB
  cpu: number; // in cores
  disk: number;
  env: { [key: string]: string };
  network?: {
    address: string;
    // If only ports should be exposed to this
    // IP address.
    portsOnly: boolean;
  };
  labels?: {
    [key: string]: string;
  };
};

/**
 * The stats of a container, used for monitoring.
 */
export type ContainerStat = {
  id: string;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: {
    used: number;
    total: number;
    percent: number;
  };
};

export type ContainerFilter = {
  /**
   * Filter containers that have all those labels.
   */
  labels?: { [key: string]: string };
};

export type ServiceLogRecord = {
  level: "error" | "info";
  message: string;
};

export type ServiceState = {
  /**
   * Internal ID of the state.
   */
  id: string;
  /**
   * A brief description of the state, for display purposes.
   */
  description: string;
  /**
   * Whether the service is ready to accept commands and connections
   * in this state, thus is running.
   */
  ready: boolean;
};

export type MessageListener = {
  /**
   * Called when there is a message from the container, with the message.
   *
   * @param message The message from the container
   */
  onMessage?: (message: ServiceLogRecord) => Promise<void> | void;
};

export type RunListener = MessageListener & {
  /**
   * Called when the container progress changes state.
   *
   * @param state The new state.
   */
  onStateChange?: (state: ServiceState) => Promise<void> | void;

  /**
   * Called when the container is closed, either by stop or kill, or by itself.
   */
  onClose?: () => Promise<void> | void;
};

/**
 * Per-service storage.
 * Data set here are being persisted to the relational database and being kept
 * as long term data. Every key set here is per-service.
 */
export type MetaStorage = {
  set: (key: string, value: any) => Promise<boolean>;
  get: <T>(key: string, def?: T) => Promise<T | undefined>;
};

export interface TemplateRepository {
  init(ctx: AppContext): Promise<void>;

  /**
   * Prepares an image from the template with the given arguments, and returns the image ID.
   *
   * @param templateId The template ID used (from this repository)
   * @param args The template args provided
   * @param imageId The image ID to use. If this is undefined, the engine should generate a random image ID and return it.
   * @param messageListener A message listener for logs propagation during image preparation
   * @return The prepared image ID
   * @throws TemplateNotFoundError if the template with the given ID is not found in this repository
   * @throws Error if the image cannot be prepared for any reason
   */
  prepareImage(
    templateId: string,
    args: { [key: string]: string },
    imageId?: string,
    messageListener?: MessageListener
  ): Promise<string>;

  /**
   * Gets the template by ID.
   *
   * @param id The template ID
   * @return The template, or undefined if not exists
   */
  getTemplate(id: string): Promise<Template | undefined>;

  getAllTemplates(): Promise<Template[]>;
}

export interface RepositoryRegistration {
  id: string;
  repository: TemplateRepository;
}

export interface TemplateRepositoryRegistry {

  /**
   * Set up and save the template repository based on the configuration.
   *
   * @param config The template repository configuration
   * @throws TemplateRepositoryConfigurationError if the configuration is invalid or the repository cannot be set up
   */
  saveRepository(config: TemplateRepositoryConfig): Promise<void>;

  /**
   * Get the template repository by ID.
   *
   * @param id The template repository ID
   * @returns The template repository, or undefined if not exists
   */
  getRepository(id: string): RepositoryRegistration | undefined;

  /**
   * Get all template repositories.
   *
   * @return An array of all template repositories.
   */
  getAllRepositories(): RepositoryRegistration[];
}

export interface TemplateRepositoryConfig {
  id: string;
  type: string;
  config: { [key: string]: any };
}

export type DockerServiceEngine = ServiceEngineI & {
  dockerClient: DockerClient;
  /**
   * Map of container IDs and attached watchers.
   * IMPORTANT! Don't close or modify the streams, by any means! It
   * would have unexpected fatal consequences.
   */
  rws: { [id: string]: NodeJS.ReadWriteStream };
};

export type ServiceEngineI = ServiceEngine & {
  // Internal
  cast<T extends ServiceEngine>(): T;
};

/**
 * The lowest layer which manipulates containers (services) directly.
 * This is called by NSM whenever NSM needs to do something with the
 * containers themselves.
 */
export type ServiceEngine = {
  // Just for display purposes
  name: string;
  templateRepositoryRegistry: TemplateRepositoryRegistry;

  /**
   * Builds an image from build dir.
   *
   * @param imageId The image ID to build. If this is undefined, the engine should generate a random image ID and return it.
   * @param buildDir The build dir path
   * @param buildOptions The build options
   * @param listener The listener to use for calling back up messages from the process
   */
  build(
    imageId: string | undefined,
    buildDir: string,
    buildOptions: { [key: string]: string },
    listener?: MessageListener,
  ): Promise<string>;

  /**
   * Runs a container from an image, with the given options.
   *
   * @param imageId The ID of the image to use
   * @param volumeId The ID of the volume to use
   * @param options The options
   * @param meta The meta storage
   * @param listener An optional listener for back propagation
   */
  run(
    imageId: string,
    volumeId: string,
    options: RunOptions,
    meta: MetaStorage,
    listener?: RunListener,
  ): Promise<string>;

  /**
   * Stops a container.
   *
   * @param id Container ID
   * @return Success state
   */
  stop(id: string): Promise<boolean>;

  /**
   * Kills a container.
   *
   * @param id Container ID
   * @return Success state
   */
  kill(id: string): Promise<boolean>;

  /**
   * Reattaches to a container.
   *
   * When this completes, the service is up and running.
   *
   * @param id Container ID
   * @param listener Listener for container messages and state changes
   */
  reattach(id: string, listener: RunListener): Promise<void>;

  /**
   * Deletes a volume by ID.
   *
   * @param id The volume ID.
   */
  deleteVolume(id: string): Promise<boolean>;

  /**
   * Deletes an image by ID.
   *
   * @param id The image ID.
   * @throw Error if the image cannot be deleted
   */
  deleteImage(id: string): Promise<void>;

  /**
   * Send a command to the container.
   *
   * @param id Container ID
   * @param cmd The command, without new line
   */
  cmd(id: string, cmd: string): Promise<boolean>;

  /**
   * Gets the labels of a container.
   *
   * @param id Container ID
   */
  getLabels(id: string): Promise<{ [key: string]: string }>;

  /**
   * Lists container ids of containers by templates.
   *
   * @param filter The filter to apply
   * @return List of container IDs
   */
  listContainers(filter: ContainerFilter): Promise<string[]>;

  /**
   * List running containers owned by this engine on this machine.
   *
   * @param filter The filter to apply
   * @return List of container IDs
   */
  listRunning(filter: ContainerFilter): Promise<string[]>;

  listAttachedPorts(): Promise<number[]>;

  stat(id: string): Promise<ContainerStat | null>;

  statAll(filter: ContainerFilter): Promise<ContainerStat[]>;

  // Disk usage of all services here
  // [0]: free, [1]: size
  calcHostUsage(): Promise<number[]>;
};

/**
 * Standard labels that NSM uses to identify and manage containers.
 * Used by the manager to keep consistency across the codebase.
 */
export enum StandardLabel {
  // The default label identifying a NSM-managed container.
  Nsm = "nsm",
  // The service ID that owns the container.
  ServiceId = "nsm.id",
  // The volume ID that the container is using.
  VolumeId = "nsm.volumeId",
  // The template ID that the container is created from.
  TemplateId = "nsm.templateId",
  // The node ID of the managing worker.
  NodeId = "nsm.nodeId",
}

export const Filters = {
  /**
   * The standard filter for NSM-managed containers, which
   * filters containers that have the label "nsm" with value "true".
   */
  nsm() {
    return {
      labels: {
        [StandardLabel.Nsm]: "true",
      },
    };
  },
  /**
   * The filter for containers belonging to a node with the given node ID.
   *
   * @param nodeId The node ID
   */
  node(nodeId: string) {
    return {
      labels: {
        ...this.nsm().labels,
        [StandardLabel.NodeId]: nodeId,
      },
    };
  },

  service(serviceId: string) {
    return {
      labels: {
        ...this.nsm().labels,
        [StandardLabel.ServiceId]: serviceId,
      }
    }
  }
};

/**
 * Combines multiple run listeners into one, by calling them in sequence.
 *
 * @param listeners The listeners to combine.
 */
export const combineRunListeners = (listeners: RunListener[]): RunListener => {
  return {
    onStateChange: async (state) => {
      for (let listener of listeners) {
        await listener.onStateChange?.(state);
      }
    },
    onMessage: async (record) => {
      for (let listener of listeners) {
        await listener.onMessage?.(record);
      }
    },
    onClose: () => {
      for (let listener of listeners) {
        listener.onClose?.();
      }
    },
  };
};

/**
 * Initializes the service engine based on the configuration.
 *
 * @param ctx The application context.
 * @returns The initialized service engine instance.
 * @throws Error if the engine ID specified in the configuration is invalid.
 */
export const initEngine = async (ctx: AppContext): Promise<ServiceEngineI> => {
  let engine = getSingleton<ServiceEngine>("engine");
  if (!engine) {
    const engineId = process.env.NSM_ENGINE ?? "docker";
    switch (engineId) {
      case "docker":
        engine = buildDockerEngine(ctx.appConfig);
        break;
      default:
        throw new Error("Invalid engine ID: " + engineId);
    }
  }

  const repositoryRegistry = engine.templateRepositoryRegistry;
  for (let config of ctx.appConfig.getTemplateRepositoryConfigs()) {
    await repositoryRegistry.saveRepository(config);

    const repositoryRegistration = repositoryRegistry.getRepository(config.id);
    if (!repositoryRegistration) {
      // it just didn't register
      throw new TemplateRepositoryConfigurationError(config.id);
    }

    // init repository
    await repositoryRegistration.repository.init(ctx);
  }

  return {
    cast: undefined, // Being set in manager
    ...engine,
  };
}