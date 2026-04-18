import {loadYamlFile} from "@nsm/util/yaml";
import path from "path";
import {currentPaths} from "@nsm/filestructure";
import {saveResource} from "@nsm/resources";
import z from "zod";

export interface AppConfig {
  getNodeId(): string;

  getPort(): number;

  getAuth(): string;

  getDockerHost(): string;

  getResourcesPath(): string|undefined;
}

/**
 * An implementation of AppConfig stored in config.yml file.
 *
 * @author ZorTik
 */
export class YamlAppConfig implements AppConfig {
  private static readonly schema: z.ZodObject<any> = z.object({
    node_id: z.string(),
    // Coerce port to auto-parse from env if overwritten
    port: z.coerce.number().int().positive(),
    auth: z.string(),
    docker_host: z.string(),
    resources_path: z.string().optional()
  }).strict();

  private readonly data: any;

  constructor() {
    this.data = YamlAppConfig.loadData();

    this.validate();
  }

  getNodeId(): string {
    return this.data["node_id"];
  }

  getPort(): number {
    return this.data["port"];
  }

  getAuth(): string {
    return this.data["auth"];
  }

  getDockerHost(): string {
    return this.data["docker_host"];
  }

  getResourcesPath(): string | undefined {
    return this.data["resources_path"];
  }

  private validate = () => {
    const result = YamlAppConfig.schema.safeParse(this.data);
    if (!result.success) {
      throw new Error('Invalid config file. ' + result.error.toString());
    }
  }

  private static loadData = () => {
    // Copy if it does not exist
    saveResource('config.yml', 'config.yml', true, currentPaths.config);

    const config = loadYamlFile(path.join(currentPaths.config, 'config.yml'));
    for (let key in YamlAppConfig.schema.shape) {
      // Overwrite with env variable if exists.
      // Sync
      const envKey = 'CONFIG_' + key.toUpperCase();
      if (process.env[envKey]) {
        config[key] = process.env[envKey];
      } else if (config[key]) {
        process.env[envKey] = config[key];
      }
    }
    return config;
  }
}

export const loadAppConfig = (): AppConfig => {
  return new YamlAppConfig();
}