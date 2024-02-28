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

// App orchestration code
export default async function (router: Express): Promise<number> {
    const logger = prepareLogger();
    r.prepareResources(); // Copy resources, etc.
    const appConfig = loadAppConfig();
    // Database connection layer
    const database = createDbManager();
    // Service (virtualization) layer
    const engine = await createServiceManager(database, appConfig);
    const ctx = { router, engine, database, appConfig, logger };
    await loadAddons({ ...ctx });
    // TODO: Authorization (security module)
    // Load HTTP routes
    await loadAppRoutes({ ...ctx });

    return new Promise((resolve) => {
        router.listen(appConfig.port, () => {
            logger.info(`Server started on port ${appConfig.port}`);
            resolve(appConfig.port);
        });
    });
}

export { Database, ServiceManager }