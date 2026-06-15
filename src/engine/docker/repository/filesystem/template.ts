import path from "path";
import {getTemplatesPath} from "@nsm/filestructure";
import fs from "fs";
import {loadYamlFile} from "@nsm/util/yaml";
import {Template} from "@nsm/engine/template";

export type FileSystemTemplateManager = {
  /**
   * Returns a template by ID.
   *
   * @param id The ID of the template
   * @return The template, or null if not exists
   */
  getTemplate(id: string): Template | null;

  getAllTemplates(): Template[];
};

export const getTemplate = (id: string): Template | null => {
  const settingsPath = path.join(getTemplatesPath(), id, "settings.yml");
  if (!fs.existsSync(settingsPath)) {
    return null;
  }
  const settings = loadYamlFile(settingsPath);
  return {
    id,
    name: settings.name,
    description: settings.description,
    settings,
  };
};

export const getAllTemplates = () => {
  if (!fs.existsSync(getTemplatesPath())) {
    return [];
  }

  return fs
    .readdirSync(getTemplatesPath())
    .filter((file) =>
      fs.statSync(path.join(getTemplatesPath(), file)).isDirectory(),
    )
    .map((id) => getTemplate(id))
    .filter((template) => template !== null);
};