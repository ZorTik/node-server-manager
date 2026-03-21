import path from "path";
import envPaths, {Paths} from "env-paths";

export const currentPaths: Paths = envPaths("nsm");

// The local resources dir (not the source of truth)
export const resourcesPath = path.join(process.cwd(), "resources");
// The target (platform-agnostic) resources dir (the source of truth)
export const resourcesTargetPath = path.join(currentPaths.data);
export const templatesPath = path.join(resourcesTargetPath, 'templates');