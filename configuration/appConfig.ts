import {loadYamlFile} from "../util/yaml";

let cached: any = undefined;

export default function getAppConfig() {
    if (cached) {
        return cached;
    }
    const config = loadYamlFile(`${process.cwd()}/resources/config.yml`);
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