import {loadYamlFile} from "@nsm/util/yaml";
import path from "path";
import {resourcesTargetPath} from "@nsm/filestructure";
import {saveResource} from "@nsm/resources";

export interface AppConfig {
  getNodeId(): string;

  getPort(): number;

  getAuth(): string;

  getDockerHost(): string;
}

/**
 * An implementation of AppConfig stored in config.yml file.
 *
 * @author ZorTik
 */
export class YamlAppConfig implements AppConfig {
  private readonly data: any;

  constructor() {
    this.data = YamlAppConfig.loadData();

    // TODO: validate
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

  private static loadData = () => {
    // Copy if it does not exist
    saveResource('config.yml', 'config.yml', true);

    const config = loadYamlFile(path.join(resourcesTargetPath, 'config.yml'));
    for (let key in config) {
      // Overwrite with env variable if exists.
      // Sync
      const envKey = 'CONFIG_' + key.toUpperCase();
      if (process.env[envKey]) {
        config[key] = process.env[envKey];
      } else {
        process.env[envKey] = config[key];
      }
    }
    return config;
  }
}

export const loadAppConfig = (): AppConfig => {
  return new YamlAppConfig();
}