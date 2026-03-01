import {Database, ImageModel} from "@nsm/database";
import winston from "winston";
import {ServiceEngineI} from "@nsm/engine/engine";
import {buildDir} from "@nsm/engine/monitoring/util";
import {TemplateManager} from "@nsm/engine/template";
import {TemplateDirWatcher} from "@nsm/engine/monitoring/templateDirWatcher";

type BuildOptionsMap = {
  [key: string]: string
};

let engine: ServiceEngineI;
let templateManager: TemplateManager;
let templateDirWatcher: TemplateDirWatcher;
let db: Database;
let logger: winston.Logger;

export const init = (
  engine_: ServiceEngineI,
  templateManager_: TemplateManager,
  templateDirWatcher_: TemplateDirWatcher,
  db_: Database,
  logger_: winston.Logger
) => {
  engine = engine_;
  templateManager = templateManager_;
  templateDirWatcher = templateDirWatcher_;
  db = db_;
  logger = logger_;
}

/**
 * Ensures that the image associated with the given ID is up to date and
 * compatible with the provided build options. If the template has changed
 * or the options differ, it will try to find an existing compatible image
 * or build a new one. It may also trigger a rebuild or remove unused images.
 *
 * @param id The ID of the current image
 * @param templateId The ID of the template
 * @param buildOptions Build arguments used when building the image
 * @returns The ID of the image that should be used
 */
export const processImage = async (
  id: string | undefined | null,
  templateId: string, buildOptions: BuildOptionsMap
) => {
  const template = templateManager.getTemplate(templateId);
  // Checks if the provided options are still compatible with the template
  buildOptions = templateManager.prepareEnvForTemplate(template, buildOptions);

  if (!id) {
    // No image specified, need to build or pick a new one
    id = await pickImageOrBuild(templateId, buildOptions);
  }

  const imageModel = await getImage(id);
  if (imageModel.templateId != templateId) {
    throw new Error(`Image ${id} is based on template ${imageModel.templateId}, but template ${templateId} was expected`);
  }

  const imageOutdated = imageModel.hash != templateDirWatcher.getTemplateHash(imageModel.templateId);
  const optionsChanged = optionsDiffer(buildOptions, imageModel.buildOptions);

  if (imageOutdated || optionsChanged) {
    if (optionsChanged) {
      logger.info(`The target options differ, finding or building a new compatible image...`);
      id = await pickImageOrBuild(templateId, buildOptions);

      // If the image becomes unused after the switch, delete it
      await deleteImageIfUnused(imageModel);
    } else {
      logger.info(`Image ${id} is outdated due to template changes. Rebuilding...`);

      // Template changed, we need to rebuild the image
      await rebuildImage(imageModel);
    }
  }

  return id;
}

/**
 * Tries to find an existing image that is compatible with the given template ID and build options.
 * If no compatible image is found, it builds a new one.
 *
 * @param templateId The ID of the template to find/build the image for
 * @param buildOptions Build options to use when finding/building the image
 * @returns The ID of the found or built image
 */
const pickImageOrBuild = async (templateId: string, buildOptions: BuildOptionsMap) => {
  let id = await pickImage(templateId, buildOptions);
  if (id == null) {
    logger.info(`No compatible image found for request. Building new image...`);

    // No compatible image, need to build a new one
    id = await buildImage(templateId, buildOptions);
  }

  return id;
}

export const optionsDiffer = (options1: BuildOptionsMap, options2: BuildOptionsMap): boolean => {
  const keys1 = Object.keys(options1);
  const keys2 = Object.keys(options2);

  if (keys1.length !== keys2.length) {
    return true;
  }

  for (const key of keys1) {
    if (!(key in options2)) {
      return true;
    }

    if (options1[key] !== options2[key]) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves the image information from the database for the given image ID.
 *
 * @param id The ID of the image to retrieve
 * @returns The image info
 * @throws Error if the image with the given ID is not found in the database
 */
const getImage = async (id: string) => {
  const image = await db.getImage(id);
  if (!image) {
    throw new Error(`Image with ID ${id} not found`);
  }

  return image;
}

/**
 * Builds a new image based on the given template ID and build options, and saves it to the database.
 * If an image ID is provided, it will overwrite the existing image with that ID.
 *
 * @param templateId The ID of the template to build the image from
 * @param options Build options to use when building the image
 * @param imageId (Optional) The ID of the image to overwrite. If not provided, a new image will be created.
 * @return The ID of the built image
 */
const buildImage = async (templateId: string, options: BuildOptionsMap, imageId?: string): Promise<string> => {
  const hash = templateDirWatcher.getTemplateHash(templateId);
  imageId = await engine.build(imageId, buildDir(templateId), options);

  await db.saveImage({
    id: imageId,
    templateId,
    hash,
    buildOptions: options,
  });
  return imageId;
}

const pickImage = async (templateId: string, options: BuildOptionsMap): Promise<string|null> => {
  const images = await db.listImagesByOptions(templateId, options);
  if (images.length == 0) {
    return null;
  }

  const image = images[Math.floor(Math.random() * images.length)]; // TODO: implement better image picking strategy (e.g. based on usage)

  return image.id;
}

const rebuildImage = async (image: ImageModel) => {
  return buildImage(image.templateId, image.buildOptions, image.id);
}

export const deleteImageIfUnused = async (image: ImageModel) => {
  const servicesUsingImage = await db.listAllUsingImage(image.id);
  if (servicesUsingImage.length > 0) {
    // Image is still in use, do not delete
    return;
  }

  logger.debug(`Image ${image.id} is no longer used by any service. Deleting...`);

  try {
    await engine.deleteImage(image.id);
  } catch (e) {
    logger.error(`Failed to delete image ${image.id}`, e);
  }
  await db.deleteImage(image.id);
}