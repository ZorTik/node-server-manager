import {loadYamlFile} from "../util/yaml";

export default function loadAppConfig() {
    const config = loadYamlFile(`${process.cwd()}/resources/config.yml`);
    for (let key in config) {
        // Overwrite with env variable if exists.
        const envKey = 'CONFIG_' + key.toUpperCase();
        if (process.env[envKey]) {
            config[key] = process.env[envKey];
        }
    }
    return config;
}