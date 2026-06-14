import dotenv from "dotenv";
import { loadAppConfig } from "@nsm/config";
import {
  init as initFileStructure,
  getResourcesPath,
  prepareFolders,
} from "@nsm/filestructure";

// Load .env
dotenv.config();
// Preload app config here to set needed env variables
// before some modules require them.
const appConfig = loadAppConfig();
initFileStructure(appConfig);

import { Router } from "express";
import { Database } from "@nsm/database";
import { ServiceManager } from "@nsm/engine";
import loadAppRoutes from "@nsm/router";
import createDbManager from "@nsm/database";
import loadSecurity from "@nsm/security";
import createEngine from "@nsm/engine/engine";
import { init as initImageEngine } from "@nsm/engine/image";
import * as facade from "@nsm/engine/facade";
import * as manager from "@nsm/engine/service";
import * as runner from "@nsm/engine/runner";
import * as sessionManager from "@nsm/engine/session";
import * as templateManager from "@nsm/engine/template";
import * as templateDirWatcher from "@nsm/engine/monitoring/templateDirWatcher";
import * as logging from "./logger";
import winston from "winston";
import { Application } from "express-ws";
import fs from "fs";
import {middleLayer, registerErrorPublishersFromConfig} from "@nsm/engine/middle";
import { SessionManager } from "@nsm/engine/session";
import { mkdirResource, saveResource } from "@nsm/resources";
import path from "path";
import { AppConfig } from "@nsm/config";
import { ServiceRunner } from "@nsm/engine/runner";
import {TemplateManager} from "@nsm/engine/template";
import {Facade} from "@nsm/engine/facade";

// Passed context to the routes
export type AppContext = {
  router: Router;
  facade: Facade,
  manager: ServiceManager;
  sessionManager: SessionManager;
  templateManager: TemplateManager;
  runner: ServiceRunner;
  database: Database;
  appConfig: AppConfig;
  logger: winston.Logger;
  debug: boolean;
};

export type AppBootOptions = {
  test?: boolean;
};

export let currentContext: AppContext;

function initGlobalLogger() {
  logging.createLatestLogFile();

  return logging.createLogger();
}

/**
 * App orchestration code.
 *
 * @param router The app router.
 * @param options The optional boot options.
 */
export const init = async (
  router: Application,
  options?: AppBootOptions,
): Promise<AppContext> => {
  // Prepare logging
  const logger = initGlobalLogger();
  logging.setCurrentGlobalLogger(logger);

  prepareFolders();

  // Prepare templates folder
  mkdirResource("templates");
  if (options?.test === true) {
    prepareTestResources(); // Copy resources for test
  }

  const database = createDbManager();

  // Temporarily lock manager until it's initialized
  const ctx: AppContext = (currentContext = {
    router,
    facade,
    manager,
    runner,
    sessionManager,
    templateManager,
    database,
    appConfig,
    logger,
    debug: process.env.DEBUG === "true",
  });

  await registerErrorPublishersFromConfig(appConfig);

  const engine = createEngine(appConfig);
  logger.info(`Using engine: ${engine.name}`);

  initImageEngine(engine, templateManager, templateDirWatcher, database, appConfig, logger);
  sessionManager.init(database);

  await ctx.manager.init(appConfig, database, engine, logger);
  templateDirWatcher.watchTemplateDirChanges(logger);

  await runner.init(engine, appConfig, templateManager, manager, database, logger);
  ctx.runner = currentContext.runner = middleLayer(runner);

  await loadSecurity(ctx);
  await loadAppRoutes(ctx);

  if (options?.test == undefined || options.test == false) {
    logger.info(`Starting server`);

    router.listen(appConfig.getPort(), () => {
      logger.info(`Server started on port ${appConfig.getPort()}`);
    });
  }
  return ctx;
};

const prepareTestResources = () => {
  if (fs.existsSync(path.join(getResourcesPath(), "templates", "test"))) {
    return;
  }

  saveResource(
    "template/test/test_settings.yml",
    "templates/test/settings.yml",
  );
  saveResource("template/test/test_dockerfile", "templates/test/Dockerfile");
  saveResource("template/test/test_nsmignore", "templates/test/.nsmignore");
};
