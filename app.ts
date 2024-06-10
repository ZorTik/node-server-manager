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
import * as engine from "./engine";
import {prepareLogger} from "./logger";
import winston from "winston";
import {Application} from "express-ws";
import fs from "fs";

export type AppBootContext = AppContext & { steps: any };

// Passed context to the routes
export type AppContext = {
    router: Router;
    engine: ServiceManager;
    database: Database;
    appConfig: any;
    logger: winston.Logger;
    debug: boolean;
};
// TODO: Přidat možnost bin IP adresy do options
// TODO: Jde vyvolat stop těsně po vytvoření (resume) kontejneru a vznikne chyba
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

// App orchestration code
export default async function (router: Application): Promise<AppBootContext> {
    const logger = prepareLogger(process.env.DEBUG === 'true');
    r.prepareResources(); // Copy resources, etc.

    // Load addon steps
    const steps = await loadAddons(logger);

    steps('BEFORE_CONFIG').forEach((f) => f({ logger }));
    const appConfig = loadAppConfig();

    prepareServiceLogs(appConfig, logger);

    // Database connection layer
    steps('BEFORE_DB').forEach((f) => f({ logger, appConfig }));
    const database = createDbManager();

    // Service (virtualization) layer
    steps('BEFORE_ENGINE').forEach((f) => f({ logger, appConfig, database }));
    await initServiceManager({ db: database, appConfig, logger });
    currentContext = { router, engine, database, appConfig, logger, debug: process.env.DEBUG === 'true' };

    // Load security
    steps('BEFORE_SECURITY').forEach((f) => f({ ...currentContext }));
    await loadSecurity({ ...currentContext });

    // Load HTTP routes
    steps('BEFORE_ROUTES').forEach((f) => f({ ...currentContext }));
    await loadAppRoutes({ ...currentContext });

    // Start the server
    steps('BEFORE_SERVER').forEach((f) => f({ ...currentContext }));
    return new Promise((resolve) => {
        const srv = router.listen(appConfig.port, () => {
            logger.info(`Server started on port ${appConfig.port}`);
            resolve({ ...currentContext, steps });
        });
        steps('AFTER_SERVER').forEach((f) => f({ ...currentContext }, srv));
    });
}

export { Database, ServiceManager, currentContext }