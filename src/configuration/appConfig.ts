import {loadYamlFile} from "@nsm/util/yaml";
import {saveResource} from "@nsm/resources";
import path from "path";
import {resourcesTargetPath} from "@nsm/filestructure";

let cached: any = undefined;

export const saveAppConfig = () => {
    saveResource('config.yml', 'config.yml', true);
}

export const getAppConfig = () => {
    saveAppConfig();

    return loadAppConfig();
}

const loadAppConfig = () => {
    if (cached) {
        return cached;
    }

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
    return cached = config;
}