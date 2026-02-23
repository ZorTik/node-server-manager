import {loadYamlFile} from "@nsm/util/yaml";
import * as fs from "fs";
import {baseTemplatesDir} from "@nsm/engine/monitoring/util";

export type Template = {
    id: string,
    name: string;
    description: string;
    settings: any;
}

const templateCache = {};

/**
 * Returns a template by ID.
 *
 * @param id The ID of the template
 * @return The template, or null if not exists
 */
export const getTemplate = (id: string): Template|null => {
    if (templateCache[id]) {
        return templateCache[id];
    }
    const settingsPath = `${baseTemplatesDir()}/${id}/settings.yml`;
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

export const getAllTemplates = () => {
    const templatesDir = baseTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
        return [];
    }

    return fs
      .readdirSync(templatesDir)
      .filter(file => fs.statSync(`${templatesDir}/${file}`).isDirectory())
      .map(id => getTemplate(id))
      .filter(template => template !== null);
}