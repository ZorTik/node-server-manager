import path from "path";
import fs from "fs";
import { getResourcesPath} from "@nsm/filestructure";

// The local resources dir (not the source of truth)
const resourcesPath = path.join(process.cwd(), "resources");

/**
 * Reads resource from target dir.
 *
 * @param name The name of the resource in the target dir.
 */
export const readResource = (name: string) => {
  const p = path.join(getResourcesPath(), name);

  return fs.readFileSync(p, "utf8");
};

/**
 * Creates a directory in the target dir. Creates parent dirs if missing.
 *
 * @param name The name of the dir in the target dir.
 */
export const mkdirResource = (name: string) => {
  const p = path.join(getResourcesPath(), name);

  fs.mkdirSync(p, { recursive: true });
};

/**
 * Saves resource to target dir. Creates parent dirs if missing.
 *
 * @param name The name of the resource in the resources dir.
 * @param targetName The target name where to copy.
 * @param skipIfExists If true, the resource will not be copied if a file with the same name already exists in the target dir. Default is false.
 * @param targetDirPath The target dir path. Default is the platform-agnostic resources dir.
 */
export const saveResource = (
  name: string,
  targetName: string,
  skipIfExists: boolean = false,
  targetDirPath: string = getResourcesPath(),
) => {
  const targetPath = path.join(targetDirPath, targetName);
  // Create parent dirs if missing
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (skipIfExists == true && fs.existsSync(targetPath)) {
    return;
  }
  fs.writeFileSync(targetPath, readCwdResource(name));
};

/**
 * Reads resource from resources dir.
 *
 * @param name The name of the resource in the resources dir.
 */
export const readCwdResource = (name: string) => {
  const p = path.join(resourcesPath, name);

  return fs.readFileSync(p, "utf8");
};
