import path from "path";
import envPaths, {Paths} from "env-paths";
import {AppConfig} from "@nsm/config";
import fs from "fs";

export const currentPaths: Paths = envPaths("nsm");

let appConfig: AppConfig;

export const init = (appConfig_: AppConfig) => {
  appConfig = appConfig_;
}

// The local resources dir (not the source of truth)
export const resourcesPath = path.join(process.cwd(), "resources");

// The target (platform-agnostic) resources dir (the source of truth)
export const getResourcesTargetPath = () => {
  return appConfig.getResourcesPath() ?? path.join(currentPaths.data);
}

export const getTemplatesPath = () => {
  return path.join(getResourcesTargetPath(), 'templates')
}

export const getTempPath = () => {
  return currentPaths.temp;
}

export const prepareFolders = () => {
  const resourcesTargetPath = getResourcesTargetPath();
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
}