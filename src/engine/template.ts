import {loadYamlFile} from "@nsm/util/yaml";
import * as fs from "fs";
import {baseTemplatesDir} from "@nsm/engine/monitoring/util";

export type Template = {
    /**
     * The unique ID of the template.
     */
    id: string,
    /**
     * The display name of the template, used for display purposes.
     */
    name: string;
    /**
     * A short description of the template, used for display purposes.
     */
    description: string;
    /**
     * The settings (definitions) object.
     */
    settings: any;
}

export type TemplateManager = {

    /**
     * Prepares the environment variables for a template by validating the provided env object against
     * the template's settings and filling in default values where necessary. It checks for required options, validates
     * types, and returns a new env object that can be used when creating a service from the template.
     *
     * @param template The template or template ID for which to prepare the environment variables
     * @param env The environment variables provided by the user, which may be incomplete or have incorrect types
     * @return A new env object that has been validated and filled with default values according to the template's settings
     * @throws Error if a required option is missing or if an option has an invalid type
     */
    prepareEnvForTemplate(template: Template | string, env: any): any;

    /**
     * Returns a template by ID.
     *
     * @param id The ID of the template
     * @return The template, or null if not exists
     */
    getTemplate(id: string): Template|null;

    getAllTemplates(): Template[];
}

const templateCache = {};

export const prepareEnvForTemplate = (template: Template | string, env: any) => {
    env = { ...env }; // Shallow copy to avoid mutating the original object
    if (typeof template === 'string') {
        template = getTemplate(template); // Load the template if ID provided
    }

    for (const key of Object.keys(template.settings['env'])) {
        if (env[key] && typeof env[key] == typeof template.settings['env'][key]) {
            // Keep the value
        } else if (env[key]) {
            throw new Error('Invalid option type for ' + key + '. Got ' + typeof env[key] + ' but expected ' + typeof template.settings['env'][key] + '.');
        } else if (isRequiredOption(template.settings['env'][key])) {
            throw new Error('Missing required option ' + key);
        } else {
            // Set default
            env[key] = template.settings['env'][key];
        }
    }
    return env;
}

// Defines if the value represents required option.
const isRequiredOption = (value: any) => {
    return (
      (typeof value == "string" && value === "") ||
      (typeof value === "number" && value == -1)
    )
}

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