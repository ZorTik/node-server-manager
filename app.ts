import {Express, Router} from 'express';
import {Database} from "./database";
import {ServiceManager} from "./engine";
import loadAppRoutes from './router';
import createDbManager from './database';
import createServiceManager from './engine';
import loadAddons from './addon';
import loadAppConfig from "./configuration/appConfig";
import * as r from "./configuration/resources";
import {prepareLogger} from "./configuration/logger";
import winston from "winston";

// Passed context to the routes
export type AppContext = {
    router: Router;
    engine: ServiceManager;
    database: Database;
    appConfig: any;
    logger: winston.Logger;
}
// TODO: Změnit hledání portu podle toho, aby nebyl zabraný jiným kontejnerem.
let currentContext: AppContext;

// App orchestration code
export default async function (router: Express): Promise<number> {
    const logger = prepareLogger();
    r.prepareResources(); // Copy resources, etc.
    const appConfig = loadAppConfig();
    // Database connection layer
    const database = createDbManager();
    // Service (virtualization) layer
    const engine = await createServiceManager(database, appConfig);
    currentContext = { router, engine, database, appConfig, logger };
    await loadAddons({ ...currentContext });
    // TODO: Authorization (security module)
    // Load HTTP routes
    await loadAppRoutes({ ...currentContext });

    return new Promise((resolve) => {
        router.listen(appConfig.port, () => {
            logger.info(`Server started on port ${appConfig.port}`);
            resolve(appConfig.port);
        });
    });
}

export { Database, ServiceManager, currentContext }