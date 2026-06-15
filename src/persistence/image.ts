import { ImageRepository } from "@nsm/persistence/models";
import { optionsDiffer } from "@nsm/engine/docker/repository/filesystem/image";
import { PrismaClient } from "@prisma/client";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
};

export const saveImage: ImageRepository["saveImage"] = async (info) => {
  const { id, templateId, hash, buildOptions } = info;

  try {
    await client.image.upsert({
      where: { id },
      update: {
        templateId,
        hash,
        buildOptions: {
          deleteMany: {},
          create: Object.entries(buildOptions).map(([key, value]) => ({
            key,
            value,
          })),
        },
      },
      create: {
        id,
        templateId,
        hash,
        buildOptions: {
          create: Object.entries(buildOptions).map(([key, value]) => ({
            key,
            value,
          })),
        },
      },
    });
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

export const getImage: ImageRepository["getImage"] = async (id) => {
  const image = await client.image.findUnique({
    where: { id },
    include: {
      buildOptions: {
        select: { key: true, value: true },
      },
    },
  });
  if (image) {
    const buildOptions = {};
    image.buildOptions.forEach(
      (option) => (buildOptions[option.key] = option.value),
    );

    return {
      ...image,
      buildOptions,
    };
  } else {
    return undefined;
  }
};

export const deleteImage: ImageRepository["deleteImage"] = async (id) => {
  try {
    await client.image.delete({
      where: { id },
    });
    return true;
  } catch (e) {
    if (e.code !== "P2025") {
      console.log(e);
    }

    return false;
  }
};

export const listImagesByOptions: ImageRepository["listImagesByOptions"] =
  async (templateId, buildOptions) => {
    return client.image
      .findMany({
        include: {
          buildOptions: {
            select: { key: true, value: true },
          },
        },
      })
      .then((images) =>
        images.map((image) => ({
          ...image,
          buildOptions: image.buildOptions.reduce((acc, option) => {
            acc[option.key] = option.value;
            return acc;
          }, {}),
        })),
      )
      .then((images) =>
        images.filter(
          (image) =>
            image.templateId === templateId &&
            !optionsDiffer(image.buildOptions, buildOptions),
        ),
      );
  };
