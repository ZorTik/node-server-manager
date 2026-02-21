import * as fs from "fs";
import YAML from "yaml";

export function loadYamlFile(path: string) {
    return YAML.parse(fs.readFileSync(path, 'utf8'));
}