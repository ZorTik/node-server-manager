import dotenv from "dotenv";
import { loadAppConfig } from "@nsm/config";
import {
  init as initFileStructure,
  getResourcesTargetPath,
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
import loadAddons from "./addon";
import loadAppRoutes from "@nsm/router";
import createDbManager from "@nsm/database";
import loadSecurity from "@nsm/security";
import * as manager from "@nsm/engine/manager";
import * as sessionManager from "@nsm/engine/session";
import * as logging from "./logger";
import winston from "winston";
import { Application } from "express-ws";
import fs from "fs";
import { middleLayer } from "@nsm/engine/middle";
import { SessionManager } from "@nsm/engine/session";
import { mkdirResource, saveResource } from "@nsm/resources";
import path from "path";
import { AppConfig } from "@nsm/config";

export type AppBootContext = AppContext & { steps: any };

// Passed context to the routes
export type AppContext = {
  router: Router;
  manager: ServiceManager;
  sessionManager: SessionManager;
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

// Decorate all manager functions except those excluded to disallow using them
// before manager.engine is initialized. This is necessary as the manager is being
// used (mainly for expandEngine()) even before manager.init() is called.
function managerForUnsafeUse() {
  const excludeKeys: (keyof ServiceManager)[] = [
    "expandEngine",
    "initEngineForcibly",
    "engine",
  ];
  //
  const managerRef = { ...manager };
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      // If it's key of base manager, not expanded object and is not excluded, deny access
      if (
        (Object.keys(managerRef) as any[]).includes(prop) &&
        !(excludeKeys as any[]).includes(prop)
      ) {
        throw new Error(
          "ServiceManager is not initialized yet! " +
            "You can only access those members now: " +
            excludeKeys.join(", "),
        );
      }
      return Reflect.get(target, prop, receiver);
    },
  };
  return new Proxy(manager, handler);
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
): Promise<AppBootContext> => {
  // Prepare logging
  const logger = initGlobalLogger();

  prepareFolders();

  // Prepare templates folder
  mkdirResource("templates");
  if (options?.test === true) {
    prepareTestResources(); // Copy resources for test
  }

  // Load addon steps
  const steps = await loadAddons(logger);

  steps("BEFORE_CONFIG", { logger });

  // Database connection layer
  steps("BEFORE_DB", { logger, appConfig });
  const database = createDbManager();

  // Temporarily lock manager until it's initialized
  const ctx = (currentContext = {
    router,
    manager: managerForUnsafeUse(),
    sessionManager,
    database,
    appConfig,
    logger,
    debug: process.env.DEBUG === "true",
  });

  // Service (virtualization) layer
  steps("BEFORE_ENGINE", ctx);
  await manager.init(database, appConfig, logger);

  // Bring back original manager
  ctx.manager = currentContext.manager = middleLayer(manager);

  // Load security
  steps("BEFORE_SECURITY", ctx);
  await loadSecurity(ctx);

  // Load HTTP routes
  steps("BEFORE_ROUTES", ctx);
  await loadAppRoutes(ctx);

  // Start the server
  steps("BEFORE_SERVER", ctx);

  let srv = undefined;
  if (options?.test == undefined || options.test == false) {
    logger.info(`Starting server`);
    srv = router.listen(appConfig.getPort(), () => {
      logger.info(`Server started on port ${appConfig.getPort()}`);
    });
  }
  steps("BOOT", ctx, srv);
  return { ...ctx, steps };
};

const prepareTestResources = () => {
  if (fs.existsSync(path.join(getResourcesTargetPath(), "templates", "test"))) {
    return;
  }

  saveResource(
    "template/test/test_settings.yml",
    "templates/test/settings.yml",
  );
  saveResource("template/test/test_dockerfile", "templates/test/Dockerfile");
  saveResource("template/test/test_nsmignore", "templates/test/.nsmignore");
};
