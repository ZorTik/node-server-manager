import {expect, it} from "@jest/globals";
import {ServiceEngine} from "@nsm/engine";
import {init as initImageEngine} from "@nsm/engine/docker/repository/filesystem/image";
import {processImage } from "@nsm/engine/docker/repository/filesystem/image";
import {Template} from "@nsm/engine/template";
import {TemplateDirWatcher} from "@nsm/engine/docker/repository/filesystem/monitoring/templateDirWatcher";
import {DeepMockProxy, mock, mockDeep} from "jest-mock-extended";
import {Database, ImageModel} from "@nsm/persistence";
import {createTestLogger} from "../testUtils";
import {AppConfig} from "@nsm/config";

it("reuses image with same options", async () => {
  const template: Template = {
    id: "test-template",
    name: "idk",
    description: "idk more",
    config: {
      port_range: {
        min: 1000,
        max: 2000,
      },
      args: {
        option1: "",
        option2: "",
      },
      defaults: {
        cpu: 1,
        disk: 100000,
        ram: 512000000,
      },
      meta: {}
    },
  };

  const engineMock = mock<ServiceEngine>();
  engineMock
    .build
    .mockImplementation(async (imageId) =>
      imageId ?? "generated-image-id-" + (Math.random() * 1000000).toFixed(0));

  const templateDirWatcherMock = mock<TemplateDirWatcher>();
  templateDirWatcherMock.getTemplateHash.mockImplementation(async (template) => {
    if (template == "test-template") {
      return "test-hash";
    }

    throw new Error(`Unknown template ${template}`);
  });

  const dbMock = createMockDatabase();
  const appConfigMock = mock<AppConfig>();
  appConfigMock.getTemplateBuildDir.mockImplementation(() => "/tmp/test-build-dir");

  initImageEngine(
    engineMock,
    templateDirWatcherMock,
    dbMock,
    appConfigMock,
    createTestLogger(),
  );

  const buildOptions = {
    option1: "value1",
    option2: "value2",
  };
  const imageId = await processImage(undefined, template, buildOptions);
  expect(imageId).not.toBeNull();

  const imageId2 = await processImage(undefined, template, buildOptions);
  expect(imageId2).not.toBeNull();
  expect(imageId2).toEqual(imageId);

  expect(engineMock.build).toBeCalledTimes(1);
});

const createMockDatabase = (): DeepMockProxy<Database> => {
  const images: ImageModel[] = [];

  const db = mockDeep<Database>();
  db.imageRepository.saveImage.mockImplementation(async (image) => {
    const existingIndex = images.findIndex((img) => img.id === image.id);
    if (existingIndex !== -1) {
      images[existingIndex] = image; // Overwrite existing image
    } else {
      images.push(image); // Add new image
    }
    return true;
  });
  db.imageRepository.getImage.mockImplementation(async (id) => {
    return images.find((image) => image.id === id);
  });
  db.imageRepository.listImagesByOptions.mockImplementation(async (templateId, options) => {
    return images.filter((image) => {
      if (image.templateId !== templateId) {
        return false;
      }

      for (const key in options) {
        if (image.buildOptions[key] !== options[key]) {
          return false;
        }
      }

      return true;
    });
  });
  db.permaRepository.listPermaUsingImage.mockImplementation(async () => {{
    return []; // In this mock, no services ae using any image
  }});
  return db;
}
