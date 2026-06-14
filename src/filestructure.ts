import path from "path";
import { AppConfig } from "@nsm/config";
import fs from "fs";

let appConfig: AppConfig;

export const init = (appConfig_: AppConfig) => {
  appConfig = appConfig_;
};

// The target (platform-agnostic) resources dir (the source of truth)
export const getResourcesPath = () => {
  return appConfig.getResourcesPath();
};

export const getTemplatesPath = () => {
  return appConfig.getTemplatesPath();
};

export const getTemplateBuildDir = (template: string) => {
  return appConfig.getTemplateBuildDir(template);
}

export const getTempPath = () => {
  return appConfig.getTempPath();
};

export const mkdirTemp = (...p: string[]) => {
  const dir = path.join(getTempPath(), ...p);
  if (fs.existsSync(dir)) {
    if (!fs.statSync(dir).isDirectory()) {
      throw new Error(
        "Temp path already exists and is not a directory: " + dir,
      );
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
};

export const prepareFolders = () => {
  const resourcesTargetPath = getResourcesPath();
  if (!fs.existsSync(resourcesTargetPath)) {
    fs.mkdirSync(resourcesTargetPath, { recursive: true });
  }

  const templatesPath = getTemplatesPath();
  if (!fs.existsSync(templatesPath)) {
    fs.mkdirSync(templatesPath, { recursive: true });
  }

  const tempPath = getTempPath();
  if (!fs.existsSync(tempPath)) {
    fs.mkdirSync(tempPath, { recursive: true });
  }
};
