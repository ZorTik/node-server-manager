import {Router} from 'express';
import {Database} from "./database";
import {ServiceManager} from "./engine";
import loadAddons from "./addon";
import loadAppRoutes from './router';
import createDbManager from './database';
import createServiceManager from './engine';
import loadAppConfig from "./configuration/appConfig";
import loadSecurity from "./security";
import * as r from "./configuration/resources";
import {prepareLogger} from "./configuration/logger";
import winston from "winston";
import {Application} from "express-ws";

// Passed context to the routes
export type AppContext = {
    router: Router;
    engine: ServiceManager;
    database: Database;
    appConfig: any;
    logger: winston.Logger;
}
// TODO: Přidat možnost bin IP adresy do options
// TODO: Jde vyvolat stop těsně po vytvoření (resume) kontejneru a vznikne chyba
// TODO: Rozlišovat chybové stavy u endpointů
// TODO: Transfer mezi nody
let currentContext: AppContext;

// App orchestration code
export default async function (router: Application): Promise<AppContext> {
    const logger = prepareLogger();
    r.prepareResources(); // Copy resources, etc.

    // Load addon steps
    const steps = await loadAddons(logger);

    steps('BEFORE_CONFIG').forEach((f) => f({ logger }));
    const appConfig = loadAppConfig();

    // Database connection layer
    steps('BEFORE_DB').forEach((f) => f({ logger, appConfig }));
    const database = createDbManager();

    // Service (virtualization) layer
    steps('BEFORE_ENGINE').forEach((f) => f({ logger, appConfig, database }));
    const engine = await createServiceManager({ db: database, appConfig, logger });
    currentContext = { router, engine, database, appConfig, logger };

    // Load security
    steps('BEFORE_SECURITY').forEach((f) => f({ ...currentContext }));
    await loadSecurity({ ...currentContext });

    // Load HTTP routes
    steps('BEFORE_ROUTES').forEach((f) => f({ ...currentContext }));
    await loadAppRoutes({ ...currentContext });

    // Start the server
    steps('BEFORE_SERVER').forEach((f) => f({ ...currentContext }));
    return new Promise((resolve) => {
        router.listen(appConfig.port, () => {
            logger.info(`Server started on port ${appConfig.port}`);
            resolve(currentContext);
        });
    });
}

export { Database, ServiceManager, currentContext }