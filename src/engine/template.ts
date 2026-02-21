import {loadYamlFile} from "@nsm/util/yaml";
import * as fs from "fs";

export type Template = {
    id: string,
    name: string;
    description: string;
    settings: any;
}

const templateCache= {};

export default function (id: string) {
    if (templateCache[id]) {
        return templateCache[id];
    }
    const settingsPath = `${process.cwd()}/templates/${id}/settings.yml`;
    if (!fs.existsSync(settingsPath)) {
        return null;
    }
    const settings = loadYamlFile(settingsPath);
    const template = {
        id,
        name: settings.name,
        description: settings.description,
        settings
    };
    templateCache[id] = template;
    return template;
}