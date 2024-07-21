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

    // Temporarily lock manager until it's initialized
    let _manager = managerForUnsafeUse();
    currentContext = { router, manager: _manager, database, appConfig, logger, debug: process.env.DEBUG === 'true' };

    const ctxCpy = () => { return { ...currentContext } };

    // Service (virtualization) layer
    steps('BEFORE_ENGINE', ctxCpy());
    await initServiceManager({ db: database, appConfig, logger });

    // Bring back original manager
    currentContext.manager = manager;

    // Load security
    steps('BEFORE_SECURITY', ctxCpy());
    await loadSecurity(ctxCpy());

    // Load HTTP routes
    steps('BEFORE_ROUTES', ctxCpy());
    await loadAppRoutes(ctxCpy());

    // Start the server
    steps('BEFORE_SERVER', ctxCpy());

    return new Promise((resolve) => {
        const ctx = { ...ctxCpy(), steps };
        let srv = undefined;
        if (options?.test == undefined || options.test == false) {
            logger.info(`Starting server`);
            srv = router.listen(appConfig.port, () => {
                logger.info(`Server started on port ${appConfig.port}`);
                resolve(ctx);
            });
        }
        steps('BOOT', ctxCpy(), srv);
        resolve(ctx);
    });
}

export { Database, ServiceManager, currentContext }