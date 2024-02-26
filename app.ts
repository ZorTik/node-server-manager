import {Express, Router} from 'express';
import {Database} from "./database";
import {ServiceManager} from "./engine";
import loadAppRoutes from './router';
import createDbManager from './database';
import createServiceManager from './engine';
import loadAppConfig from "./configuration/appConfig";
import * as r from "./configuration/resources";

// Passed context to the routes
export type AppContext = {
    router: Router;
    engine: ServiceManager;
    database: Database;
    appConfig: any;
}

// App orchestration code
export default async function (router: Express) {
    r.prepareResources(); // Copy resources, etc.
    const appConfig = loadAppConfig();
    // Database connection layer
    const database = createDbManager();
    // Service (virtualization) layer
    const engine = await createServiceManager(database, appConfig);
    // Load HTTP routes
    await loadAppRoutes({ router, engine, database, appConfig });
}

export { Database, ServiceManager }