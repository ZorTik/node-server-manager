import {Database, ImageModel} from "@nsm/database";
import {getTemplateHash} from "@nsm/engine/monitoring/templateDirWatcher";
import winston from "winston";
import {ServiceEngineI} from "@nsm/engine/engine";
import {buildDir} from "@nsm/engine/monitoring/util";

type BuildOptionsMap = {
  [key: string]: string
};

let engine: ServiceEngineI;
let db: Database;
let logger: winston.Logger;

export const init = (engine_: ServiceEngineI, db_: Database, logger_: winston.Logger) => {
  engine = engine_;
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
 * @param buildOptions Build arguments used when building the image
 * @returns The ID of the image that should be used
 */
export const processImage = async (id: string, buildOptions: BuildOptionsMap) => {
  const imageModel = await getImage(id);

  const imageOutdated = imageModel.hash != getTemplateHash(imageModel.templateId);
  const optionsChanged = optionsDiffer(buildOptions, imageModel.buildOptions);

  if (imageOutdated || optionsChanged) {
    if (optionsChanged) {
      id = await pickImage(buildOptions);
      if (id == null) {
        logger.info(`No compatible image found for request. Building new image...`);

        // No compatible image, need to build a new one
        id = await buildImage(imageModel.templateId, buildOptions);
      }

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

const optionsDiffer = (options1: BuildOptionsMap, options2: BuildOptionsMap): boolean => {
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
export const getImage = async (id: string) => {
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
export const buildImage = async (templateId: string, options: BuildOptionsMap, imageId?: string): Promise<string> => {
  const hash = getTemplateHash(templateId);
  imageId = await engine.build(imageId, buildDir(templateId), options);

  await db.saveImage({
    id: imageId,
    templateId,
    hash,
    buildOptions: options,
  });
  return imageId;
}

const pickImage = async (options: BuildOptionsMap): Promise<string|null> => {
  const images = await db.listImagesByOptions(options);
  if (images.length == 0) {
    return null;
  }

  const image = images[Math.floor(Math.random() * images.length)]; // TODO: implement better image picking strategy (e.g. based on usage)

  return image.id;
}

const rebuildImage = async (image: ImageModel) => {
  return buildImage(image.templateId, image.buildOptions, image.id);
}

const deleteImageIfUnused = async (image: ImageModel) => {
  const servicesUsingImage = await db.listAllUsingImage(image.id);
  if (servicesUsingImage.length > 0) {
    // Image is still in use, do not delete
    return;
  }

  await db.deleteImage(image.id);
}