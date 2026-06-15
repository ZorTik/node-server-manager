import { loadYamlFile } from "@nsm/util/yaml";
import path from "path";
import { saveResource } from "@nsm/resources";
import z from "zod";
import envPaths, {Paths} from "env-paths";

export const currentPaths: Paths = envPaths("nsm");

export interface AppConfig {
  getNodeId(): string;

  getPort(): number;

  getAuth(): string;

  getDockerHost(): string;

  getResourcesPath(): string;

  getTemplatesPath(): string;

  getTemplateBuildDir(template: string): string;

  getTempPath(): string;
}

/**
 * An implementation of AppConfig stored in config.yml file.
 *
 * @author ZorTik
 */
export class YamlAppConfig implements AppConfig {
  private static readonly schema: z.ZodObject<any> = z
    .object({
      node_id: z.string(),
      // Coerce port to auto-parse from env if overwritten
      port: z.coerce.number().int().positive(),
      auth: z.string(),
      docker_host: z.string(),
      resources_path: z.string().optional(),
    })
    .strict();

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

  getResourcesPath(): string {
    const resourcesPath = this.data["resources_path"];

    return resourcesPath ? path.resolve(resourcesPath) : path.join(currentPaths.data);
  }

  getTemplatesPath(): string {
    return path.join(this.getResourcesPath(), "templates");
  }

  getTemplateBuildDir(template: string): string {
    return path.join(this.getTemplatesPath(), template);
  }

  getTempPath(): string {
    return currentPaths.temp;
  }

  private validate = () => {
    const result = YamlAppConfig.schema.safeParse(this.data);
    if (!result.success) {
      throw new Error("Invalid config file. " + result.error.toString());
    }
  };

  private static loadData = () => {
    // Copy if it does not exist
    saveResource("config.yml", "config.yml", true, currentPaths.config);

    const config = loadYamlFile(path.join(currentPaths.config, "config.yml"));

    return YamlAppConfig.fillDataFromEnv(YamlAppConfig.schema.shape, config);
  };


  /**
   * Recursively fills config data from environment variables.
   *
   * @param shape The shape of the config schema, used to determine which keys to look for in env variables.
   * @param config The config object to fill with env variables.
   * @param envPrefix The prefix to use for env variables, default is "CONFIG_". For nested objects, the prefix will be extended with the parent key in uppercase followed by an underscore.
   * @returns The config object filled with env variables where applicable.
   */
  private static fillDataFromEnv = (
    shape: z.ZodObject<any>,
    config: any,
    envPrefix?: string,
  ) => {
    const prefix = envPrefix ?? "CONFIG_";

    for (let key in shape) {
      const envKey = prefix + key.toUpperCase();

      // Recursively fill nested objects
      if (shape[key] instanceof z.ZodObject) {
        config[key] = YamlAppConfig.fillDataFromEnv(
          shape[key].shape,
          config[key] || {},
          envKey + "_",
        );
        continue;
      }

      // Overwrite with env variable if exists.
      // Sync
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
};
