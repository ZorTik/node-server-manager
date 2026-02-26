import {afterAll, beforeAll, expect, it} from "@jest/globals";
import {ServiceEngineI} from "@nsm/engine";
import createEngine from "@nsm/engine/engine";
import {init as initImageEngine} from "@nsm/engine/image";
import getDb from "@nsm/database";
import {Database} from "@nsm/database";
import {StartedMariaDbContainer} from "@testcontainers/mariadb";
import {initDbContainerForTest} from "../testUtils";
import {initClientForTest} from "@nsm/database/manager";
import {PrismaClient} from "@prisma/client";
import {processImage} from "@nsm/engine/image";
import {createLogger} from "@nsm/logger";
import {Template, TemplateManager} from "@nsm/engine/template";
import {TemplateDirWatcher} from "@nsm/engine/monitoring/templateDirWatcher";
import * as templateManager from "@nsm/engine/template";
import * as templateDirWatcher from "@nsm/engine/monitoring/templateDirWatcher";

let container: StartedMariaDbContainer;

let engine: ServiceEngineI;
let db: Database;

beforeAll(async () => {
  const [
    container_,
    dbUrl_
  ] = await initDbContainerForTest();

  container = container_;
  engine = createEngine({
    // Just to prevent assertion errors
    docker_host: "///var/run/docker.sock"
  });
  db = getDb();
  initClientForTest(new PrismaClient({
    datasourceUrl: dbUrl_,
  }));
}, 20000);

afterAll(async () => {
  await container.stop();
});

it("reuses image with same options", async () => {
  const template: Template = {
    id: "test-template",
    name: "idk",
    description: "idk more",
    settings: {
      env: {
        option1: "",
        option2: "",
      }
    }
  }

  let buildCount = 0;

  const customEngine: ServiceEngineI = {
    ...engine,
    build(imageId: string | undefined, buildDir: string | undefined, buildOptions: {
      [p: string]: string
    }): Promise<string> {
      buildCount++;

      return Promise.resolve(imageId ?? "generated-image-id-" + (Math.random() * 1000000).toFixed(0));
    }
  }
  const customTemplateManager: TemplateManager = {
    ...templateManager,
    getTemplate(id: string): Template | null {
      if (id == "test-template") {
        return template;
      }

      return null;
    }
  };
  const customTemplateDirWatcher: TemplateDirWatcher = {
    ...templateDirWatcher,
    getTemplateHash(template: string): string {
      if (template == "test-template") {
        return "test-hash";
      }

      throw new Error(`Unknown template ${template}`);
    }
  };

  initImageEngine(customEngine, customTemplateManager, customTemplateDirWatcher, db, createLogger());

  const buildOptions = {
    option1: "value1",
    option2: "value2",
  };
  const imageId = await processImage(undefined, "test-template", buildOptions);
  expect(imageId).not.toBeNull();

  const imageId2 = await processImage(undefined, "test-template", buildOptions);
  expect(imageId2).not.toBeNull();
  expect(imageId2).toEqual(imageId);

  expect(buildCount).toBe(1);
});