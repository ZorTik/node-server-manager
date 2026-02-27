import dotenv from "dotenv";
import config from "@nsm/configuration/appConfig";

// Load .env
dotenv.config();
// Preload app config here to set needed env variables
// before some modules require them.
config();

import {Router} from 'express';
import {Database} from "@nsm/database";
import {ServiceManager} from "@nsm/engine";
import loadAddons from "./addon";
import loadAppRoutes from '@nsm/router';
import createDbManager from '@nsm/database';
import initServiceManager from '@nsm/engine';
import loadSecurity from "@nsm/security";
import * as r from "@nsm/configuration/resources";
import * as manager from "@nsm/engine";
import * as logging from "./logger";
import winston from "winston";
import {Application} from "express-ws";
import fs from "fs";
import isInsideContainer from "@nsm/lib/isInsideContainer";

export type AppBootContext = AppContext & { steps: any };

// Passed context to the routes
export type AppContext = {
    router: Router;
    manager: ServiceManager;
    database: Database;
    appConfig: any;
    logger: winston.Logger;
    debug: boolean;
    workers: boolean;
};

export type AppBootOptions = {
    test?: boolean;
    disableWorkers?: boolean;
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

function initGlobalLogger() {
    logging.createNewLatest();
    return logging.createLogger();
}

// Decorate all manager functions except those excluded to disallow using them
// before manager.engine is initialized. This is necessary as the manager is being
// used (mainly for expandEngine()) even before manager.init() is called.
function managerForUnsafeUse() {
    const excludeKeys: (keyof ServiceManager)[] = ["expandEngine", "initEngineForcibly", "engine"];
    //
    const managerRef = { ...manager };
    const handler: ProxyHandler<any> = {
        get(target, prop, receiver) {
            // If it's key of base manager, not expanded object and is not excluded, deny access
            if ((Object.keys(managerRef) as any[]).includes(prop) && !(excludeKeys as any[]).includes(prop)) {
                throw new Error("ServiceManager is not initialized yet! " +
                    "You can only access those members now: " + excludeKeys.join(", "));
            }
            return Reflect.get(target, prop, receiver);
        }
    }
    return new Proxy(manager, handler);
}

// App orchestration code
export const init = async (router: Application, options?: AppBootOptions): Promise<AppBootContext> => {
    // Prepare logging
    const logger = initGlobalLogger();
    r.prepareResources(options?.test === true); // Copy resources, etc.

    // Load addon steps
    const steps = await loadAddons(logger);

    steps('BEFORE_CONFIG', { logger });
    const appConfig = config();

    prepareServiceLogs(appConfig, logger);

    // Database connection layer
    steps('BEFORE_DB', { logger, appConfig });
    const database = createDbManager();

    // Temporarily lock manager until it's initialized
    const ctx = currentContext = {
        router,
        manager: managerForUnsafeUse(),
        database,
        appConfig,
        logger,
        debug: process.env.DEBUG === 'true',
        workers: !options?.disableWorkers && !isInsideContainer()
    };

    // Service (virtualization) layer
    steps('BEFORE_ENGINE', ctx);
    await initServiceManager({ db: database, appConfig, logger });

    // Bring back original manager
    ctx.manager = currentContext.manager = manager;

    // Load security
    steps('BEFORE_SECURITY', ctx);
    await loadSecurity(ctx);

    // Load HTTP routes
    steps('BEFORE_ROUTES', ctx);
    await loadAppRoutes(ctx);

    // Start the server
    steps('BEFORE_SERVER', ctx);

    if (isInsideContainer()) {
        logger.info('Running in container! Worker threads will be unavailable.');
    } else if(!ctx.workers) {
        logger.info('Worker threads are forcibly disabled.');
    }

    let srv = undefined;
    if (options?.test == undefined || options.test == false) {
        logger.info(`Starting server`);
        srv = router.listen(appConfig.port, () => {
            logger.info(`Server started on port ${appConfig.port}`);
        });
    }
    steps('BOOT', ctx, srv);
    return { ...ctx, steps };
}

export {
    Database,
    ServiceManager,
    currentContext
}