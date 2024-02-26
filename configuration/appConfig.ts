import YAML from 'yaml';
import * as fs from "fs";

export default function loadAppConfig() {
    const config = YAML.parse(fs.readFileSync(`${process.cwd()}/config.yml`, 'utf8'));
    for (let key in config) {
        // Overwrite with env variable if exists.
        const envKey = 'CONFIG_' + key.toUpperCase();
        if (process.env[envKey]) {
            config[key] = process.env[envKey];
        }
    }
    return config;
}