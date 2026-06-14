import {
  ServiceEngine,
} from "./engine";
import * as templateManager from "./template";
import crypto from "crypto";
import { randomPort as retrieveRandomPort } from "@nsm/util/port";
import { Database, PermaModel } from "../database";
import {
  reqNotPending,
} from "./asyncp";
import winston from "winston";
import {resolveSequentially} from "@nsm/util/promises";
import {
  deleteImageIfUnused,
} from "@nsm/engine/image";
import {
  InternalError,
  InvalidMetaError,
  ServiceNotFoundError,
  TemplateNotFoundError
} from "@nsm/engine/error";
import {AppConfig} from "@nsm/config";

export type Options = {
  /**
   * The amount of RAM that the service can allocate in MB.
   * (optional)
   */
  ram?: number;
  /**
   * The amount of CPU cores that the service can use.
   * (optional)
   */
  cpu?: number;
  /**
   * The amount of disk space that the service can use in MB.
   * (optional)
   */
  disk?: number;
  /**
   * The additional ports to expose. (optional)
   * Main port will be chosen automatically.
   * (optional)
   */
  ports?: number[]; // Optional ports to expose
  meta?: { [key: string]: any };
  /**
   * The optional environment variables (template options) to set.
   * These are custom variables that the specific template uses to correctly
   * build its environment.
   *
   * Firstly, you need to specify those env variables and their defaults
   * in the settings.yml file of the template, and then they can be used
   * in the Dockerfile of template. Those variables can be listed by the
   * lookup and will be stored for later use when resuming the service.
   * (optional)
   */
  env?: { [key: string]: string }; // Optional ENV, see example_settings.yml
  /**
   * The (optional) network settings for the service.
   * This specifies fi the service will be bind to custom network interface
   * in the future and how.
   */
  network?: {
    /**
     * Bind address.
     */
    address: string;
    /**
     * If whole service interface (all ports) should be exposed to the
     * interface (false), or only defined ports (true).
     *
     * Defined ports are those specified in ports?: number[], and main
     * service port.
     */
    portsOnly: boolean;
  };
};

export type UpdateServiceOptions = {
  imageId?: string;
  options?: Options;
}

export type ListServicesOptions = {
  /**
   * The page number (index).
   */
  page: number;
  /**
   * The page size.
   */
  pageSize: number;

  /**
   * Filter options.
   */
  filter?: {
    /**
     * Filter services by their meta attributes.
     */
    meta?: { [key: string]: any };
  };
};

export interface ServiceManager {
  /**
   * Initialize the service manager.
   *
   * @param appConfig The app config
   * @param db The database
   * @param engine The service engine to use
   * @param logger The global logger
   */
  init(
    appConfig: AppConfig,
    db: Database,
    engine: ServiceEngine,
    logger: winston.Logger
  ): Promise<void>;

  /**
   * Create a new service.
   *
   * @param template The template ID (folder name) to use
   * @param options The options to use. Options will be stored for later use.
   * @returns The service ID
   * @throws InvalidMetaError if the template meta is invalid
   */
  createService(template: string, options: Options): Promise<string>; // Service ID

  /**
   * Delete a service.
   *
   * @param id The service ID
   */
  deleteService(id: string): Promise<void>;

  /**
   * Update the options of a service.
   *
   * @param id The service ID
   * @param options The new options
   */
  updateOptions(id: string, options: Options): Promise<boolean>;

  /**
   * Update the service.
   *
   * @param id The service ID
   * @param options The update options
   */
  updateService(id: string, options: UpdateServiceOptions): Promise<boolean>;

  /**
   * Get the service by ID.
   *
   * @param from The service ID, or model
   */
  getService(from: string | PermaModel): Promise<Service | undefined>;

  /**
   * List all available services.
   *
   * @param options The list options
   * @returns The list of service IDs
   */
  listServices(options: ListServicesOptions): Promise<string[]>;
}

export type Service = PermaModel & {
  optionsRam: number; // From options.ram
  optionsCpu: number; // From options.cpu
  optionsDisk: number; // From options.disk
};

let nodeId: string;
let db: Database;
let engine: ServiceEngine;
let logger: winston.Logger;

export const init: ServiceManager["init"] = async (
  appConfig_,
  db_,
  engine_,
  logger_,
) => {
  nodeId = appConfig_.getNodeId();
  db = db_;
  engine = engine_;
  logger = logger_;
}

export const createService: ServiceManager["createService"] = async (template, options) => {
  const { ram, cpu, disk, ports, env, network } = options;

  const foundTemplate = templateManager.getTemplate(template);
  if (!foundTemplate) {
    throw new TemplateNotFoundError(template);
  }
  const serviceSettings = foundTemplate.settings;

  // Join meta supplied by user and template meta
  const meta = {
    ...(options.meta ?? {}),
    ...(serviceSettings.meta ?? {}),
  };
  if (!meta || !meta.stopCmd) {
    throw new InvalidMetaError("Invalid template meta for " + template);
  }

  const serviceId = crypto.randomUUID(); // Create new unique service id
  // Pick random main port from the range specified in settings.yml
  const portRange = serviceSettings.port_range;
  const port = await retrieveRandomPort(
    engine,
    portRange.min as number,
    portRange.max as number,
  );

  const perma: PermaModel = {
    serviceId,
    template,
    nodeId,
    port,
    options: {
      ram,
      cpu,
      disk,
      ports
    },
    meta,
    env: env ?? {},
    network,
  };
  // Save permanent info
  const saved = await db.permaRepository.savePerma(perma);
  if (!saved) {
    throw new InternalError("Failed to save perma info to database");
  }

  return serviceId;
}

export const deleteService: ServiceManager["deleteService"] = async (id) => {
  const image = await db.permaRepository
    .getPerma(id)
    .then((perma) =>
      perma.imageId
        ? db.imageRepository.getImage(perma.imageId)
        : undefined,
    );
  await resolveSequentially(
    async () => engine.deleteVolume(id),
    async () => db.permaRepository.deletePerma(id),
    async () => {
      if (image) {
        // If the image becomes unused after service deletion, delete it
        await deleteImageIfUnused(image);
      }
    },
  );

  logger.debug(`Service ${id} deleted`);
}

export const updateService: ServiceManager["updateService"] = async (id, options) => {
  let success = true;
  if (options.imageId) {
    const perma = await db.permaRepository.getPerma(id);
    if (!perma) {
      throw new ServiceNotFoundError(id);
    }
    perma.imageId = options.imageId;

    success = await db.permaRepository.savePerma(perma);
  }
  if (options.options && !await updateOptions(id, options.options)) {
    success = false;
  }
  return success;
}

export const updateOptions: ServiceManager["updateOptions"] = async (id, options) => {
  reqNotPending(id);
  const perma = await db.permaRepository.getPerma(id);
  const data: PermaModel = {
    ...perma,
    ...options,
    meta: {
      ...perma.meta,
      ...options.meta,
    },
    env: {
      ...perma.env,
      ...options.env,
    },
  };
  return db.permaRepository.savePerma(data);
}

export const getService: ServiceManager["getService"] = async (from) => {
  const data = typeof from === "string" ? await db.permaRepository.getPerma(from) : from;
  if (!data) {
    return undefined;
  }

  return {
    ...data,
    optionsRam: data.env.SERVICE_RAM ? Number(data.env.SERVICE_RAM) : 0,
    optionsCpu: data.env.SERVICE_CPU ? Number(data.env.SERVICE_CPU) : 0,
    optionsDisk: data.env.SERVICE_DISK ? Number(data.env.SERVICE_DISK) : 0,
  };
}

export const listServices: ServiceManager["listServices"] = async (options) => {
  const meta = options.filter?.meta;

  const list = await db.permaRepository.listPerma(nodeId, options.page, options.pageSize, meta);

  return list.map((d) => d.serviceId);
}