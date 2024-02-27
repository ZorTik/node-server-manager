import {loadYamlFile} from "../util/yaml";

export type Template = {
    id: string,
    name: string;
    description: string;
    settings: any;
}

const templateCache= {};

export default function (id: string): Template {
    if (templateCache[id]) {
        return templateCache[id];
    }
    const settings = loadYamlFile(`${process.cwd()}/templates/${id}/settings.yml`);
    const template = {
        id,
        name: settings.name,
        description: settings.description,
        settings
    };
    templateCache[id] = template;
    return template;
}