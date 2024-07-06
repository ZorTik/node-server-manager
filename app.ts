import {Router} from 'express';
import {Database} from "./database";
import {ServiceManager} from "./engine";
import loadAddons from "./addon";
import loadAppRoutes from './router';
import createDbManager from './database';
import initServiceManager from './engine';
import loadAppConfig from "./configuration/appConfig";
import loadSecurity from "./security";
import * as r from "./configuration/resources";
import * as manager from "./engine";
import {prepareLogger} from "./logger";
import winston from "winston";
import {Application} from "express-ws";
import fs from "fs";

export type AppBootContext = AppContext & { steps: any };

// Passed context to the routes
export type AppContext = {
    router: Router;
    manager: ServiceManager;
    database: Database;
    appConfig: any;
    logger: winston.Logger;
    debug: boolean;
};

export type AppBootOptions = {
    test?: boolean;
}

let currentContext: AppContext;

function prepareServiceLogs(appConfig: any, logger: winston.Logger) {
    if (appConfig.service_logs === true) {
        logger.info('Service logs are enabled');
        const path = process.cwd() + '/service_logs';
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }
}

// Decorate all manager functions except those excluded to disallow using them
// before manager.engine is initialized. This is necessary as the manager is being
// used (mainly for expandEngine()) even before manager.init() is called.
function managerForUnsafeUse() {
    const excludeKeys: (keyof ServiceManager)[] = ["expandEngine"];
    for (const k of Object.keys(manager)) {
        const attr = manager[k];
        if (typeof attr !== "function") {
            // We only decorate functions
            continue;
        }
        if ((excludeKeys as any[]).includes(k)) {
            // Key is excluded
            continue;
        }
        const func = manager[k];
        manager[k] = (...args: any[]) => {
            if (!manager.initialized()) {
                throw new Error("ServiceManager is not initialized yet! Please do this later.");
            }
            return func(...args);
        }
    }
}

// App orchestration code
export default async function (router: Application, options?: AppBootOptions): Promise<AppBootContext> {
    const logger = prepareLogger(process.env.DEBUG === 'true');
    r.prepareResources(options?.test === true); // Copy resources, etc.

    // Load addon steps
    const steps = await loadAddons(logger);

    steps('BEFORE_CONFIG', { logger });
    const appConfig = loadAppConfig();

    prepareServiceLogs(appConfig, logger);

    // Database connection layer
    steps('BEFORE_DB', { logger, appConfig });
    const database = createDbManager();

    managerForUnsafeUse();
    currentContext = { router, manager, database, appConfig, logger, debug: process.env.DEBUG === 'true' };

    // Service (virtualization) layer
    steps('BEFORE_ENGINE', { ...currentContext });
    await initServiceManager({ db: database, appConfig, logger });

    // Load security
    steps('BEFORE_SECURITY', { ...currentContext });
    await loadSecurity({ ...currentContext });

    // Load HTTP routes
    steps('BEFORE_ROUTES', { ...currentContext });
    await loadAppRoutes({ ...currentContext });

    // Start the server
    steps('BEFORE_SERVER', { ...currentContext });

    return new Promise((resolve) => {
        const ctx = { ...currentContext, steps };
        let srv = undefined;
        if (options?.test == undefined || options.test == false) {
            logger.info(`Starting server`);
            srv = router.listen(appConfig.port, () => {
                logger.info(`Server started on port ${appConfig.port}`);
                resolve(ctx);
            });
        }
        steps('AFTER_SERVER', { ...currentContext }, srv);
        resolve(ctx);
    });
}

export { Database, ServiceManager, currentContext }