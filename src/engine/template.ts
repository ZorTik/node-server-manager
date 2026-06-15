import {ServiceEngine} from "@nsm/engine/engine";

export type Template = {
  /**
   * The unique ID of the template.
   */
  id: string;
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
  settings: TemplateSettings;
};

export type TemplateSettings = {
  port_range: {
    min: number;
    max: number;
  };
  defaults: {
    ram: number;
    cpu: number;
    disk: number;
    env?: {
      [key: string]: string;
    }
  };
  meta: {
    [key: string]: string;
  };
  env: {
    [key: string]: string;
  }
}

export interface TemplateManager {
  /**
   * Returns a template by ID.
   *
   * @param id The ID of the template
   * @return The template, or null if not exists
   */
  getTemplate(id: string): Promise<Template | null>;

  getAllTemplates(): Promise<Template[]>;
}

let engine: ServiceEngine;

export const init = (
  engine_: ServiceEngine,
) => {
  engine = engine_;
}

export const getTemplate: TemplateManager["getTemplate"] = async (id) => {
  for (let templateRepository of engine.templateRepositoryRegistry.getAllRepositories()) {
    const template = await templateRepository.getTemplate(id);

    if (template) {
      return template;
    }
  }

  return null;
}

export const getAllTemplates: TemplateManager["getAllTemplates"] = async () => {
  const result: Template[] = [];

  for (let templateRepository of engine.templateRepositoryRegistry.getAllRepositories()) {
    const templates = await templateRepository.getAllTemplates();

    for (let template of templates) {
      if (result.find((t) => t.id === template.id)) {
        // duplicate id, we count with the first only
        continue;
      }

      result.push(template);
    }
  }
  return result;
}

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
export const prepareEnvForTemplate = (
  template: Template,
  env: any,
) => {
  env = { ...env }; // Shallow copy to avoid mutating the original object

  for (const key of Object.keys(template.settings["env"])) {
    if (env[key] && typeof env[key] == typeof template.settings["env"][key]) {
      // Keep the value
    } else if (env[key]) {
      throw new Error(
        "Invalid option type for " +
          key +
          ". Got " +
          typeof env[key] +
          " but expected " +
          typeof template.settings["env"][key] +
          ".",
      );
    } else if (isRequiredOption(template.settings["env"][key])) {
      throw new Error("Missing required option " + key);
    } else {
      // Set default
      env[key] = template.settings["env"][key];
    }
  }
  return env;
};

// Defines if the value represents required option.
const isRequiredOption = (value: any) => {
  return (
    (typeof value == "string" && value === "") ||
    (typeof value === "number" && value == -1)
  );
};
