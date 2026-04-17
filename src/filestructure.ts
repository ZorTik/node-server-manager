import path from "path";
import envPaths, {Paths} from "env-paths";
import {AppConfig} from "@nsm/config";

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