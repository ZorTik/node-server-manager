import {ServiceEngine} from "@nsm/engine/engine";
import z from "zod";

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
   * The config (definitions) object.
   */
  config: TemplateConfig;
};

export type TemplateFinding = Template & {
  /**
   * The ID of the repository where the template was found.
   */
  sourceRepositoryId: string;
}

export type TemplateConfig = {
  port_range: {
    min: number;
    max: number;
  };
  meta: {
    [key: string]: string;
  };
  args: {
    [key: string]: string;
  };
  container: TemplateContainerConfig;
}

export type TemplateContainerConfig = {
  env: {
    [key: string]: string;
  };
  resources: {
    limits: {
      ram: number;
      cpu: number;
      disk: number;
    }
  };
}

export const templateSettingsModel = z.object({
  port_range: z.object({
    min: z.number(),
    max: z.number()
  }),
  meta: z.record(z.string(), z.string()),
  args: z.record(z.string(), z.string()),
  container: z.object({
    env: z.record(z.string(), z.string()),
    resources: z.object({
      limits: z.object({
        ram: z.number(),
        cpu: z.number(),
        disk: z.number()
      })
    })
  })
});

export const templateModel = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  config: templateSettingsModel
});

export interface TemplateManager {
  /**
   * Returns a template by ID.
   *
   * @param id The ID of the template
   * @return The template, or null if not exists
   */
  getTemplate(id: string): Promise<TemplateFinding | null>;

  getAllTemplates(): Promise<TemplateFinding[]>;
}

let engine: ServiceEngine;

export const init = (
  engine_: ServiceEngine,
) => {
  engine = engine_;
}

export const getTemplate: TemplateManager["getTemplate"] = async (id) => {
  for (let registration of engine.templateRepositoryRegistry.getAllRepositories()) {
    const template = await registration.repository.getTemplate(id);

    if (template) {
      return { ...template, sourceRepositoryId: registration.id };
    }
  }

  return null;
}

export const getAllTemplates: TemplateManager["getAllTemplates"] = async () => {
  const result: TemplateFinding[] = [];

  for (let registration of engine.templateRepositoryRegistry.getAllRepositories()) {
    const templates = await registration.repository.getAllTemplates();

    for (let template of templates) {
      if (result.find((t) => t.id === template.id)) {
        // duplicate id, we count with the first only
        continue;
      }

      result.push({ ...template, sourceRepositoryId: registration.id });
    }
  }
  return result;
}

/**
 * Prepares the args for a template by validating the provided args object against
 * the template's settings and filling in default values where necessary. It checks for required options, validates
 * types, and returns a new args object that can be used when creating a service from the template.
 *
 * @param template The template or template ID for which to prepare the environment variables
 * @param args The environment variables provided by the user, which may be incomplete or have incorrect types
 * @return A new args object that has been validated and filled with default values according to the template's settings
 * @throws Error if a required option is missing or if an option has an invalid type
 */
export const prepareArgsForTemplate = (
  template: Template,
  args: any,
) => {
  args = { ...args }; // Shallow copy to avoid mutating the original object

  for (const key of Object.keys(template.config["args"])) {
    if (args[key] && typeof args[key] == typeof template.config["args"][key]) {
      // Keep the value
    } else if (args[key]) {
      throw new Error(
        "Invalid option type for " +
          key +
          ". Got " +
          typeof args[key] +
          " but expected " +
          typeof template.config["args"][key] +
          ".",
      );
    } else if (isRequiredOption(template.config["args"][key])) {
      throw new Error("Missing required option " + key);
    } else {
      // Set default
      args[key] = template.config["args"][key];
    }
  }
  return args;
};

// Defines if the value represents required option.
const isRequiredOption = (value: any) => {
  return (
    (typeof value == "string" && value === "") ||
    (typeof value === "number" && value == -1)
  );
};
