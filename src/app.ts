import dotenv from "dotenv";
import { loadAppConfig } from "@nsm/config";
import {
  init as initFileStructure,
  prepareFolders,
} from "@nsm/filestructure";

// Load .env
dotenv.config();
// Preload app config here to set needed env variables
// before some modules require them.
const appConfig = loadAppConfig();
initFileStructure(appConfig);

import { Router } from "express";
import { Database } from "@nsm/persistence";
import {initEngine, ServiceManager} from "@nsm/engine";
import loadAppRoutes from "@nsm/router";
import createDbManager from "@nsm/persistence";
import loadSecurity from "@nsm/security";
import * as facade from "@nsm/engine/facade";
import * as manager from "@nsm/engine/service";
import * as runner from "@nsm/engine/runner";
import * as sessionManager from "@nsm/engine/session";
import * as templateManager from "@nsm/engine/template";
import * as logging from "./logger";
import winston from "winston";
import { Application } from "express-ws";
import {middleLayer, registerErrorPublishersFromConfig} from "@nsm/engine/middle";
import { SessionManager } from "@nsm/engine/session";
import { mkdirResource } from "@nsm/resources";
import { AppConfig } from "@nsm/config";
import { ServiceRunner } from "@nsm/engine/runner";
import {Facade} from "@nsm/engine/facade";
import {TemplateManager} from "@nsm/engine/template";

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

  const engine = await initEngine(ctx);
  logger.info(`Using engine: ${engine.name}`);

  templateManager.init(engine);
  sessionManager.init(database);

  await manager.init(appConfig, database, engine, templateManager, logger);

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