import {Express, Router} from 'express';
import {DatabaseManager} from "./database";
import {ServiceManager} from "./engine";
import loadAppRoutes from './router';
import createDbManager from './database';
import createServiceManager from './engine';

// Passed context to the routes
export type AppContext = {
    router: Router;
    manager: ServiceManager;
    database: DatabaseManager;
}

// App orchestration code
export default async function (router: Express) {
    // Database connection layer
    const database = await createDbManager();
    // Service (virtualization) layer
    const manager = await createServiceManager(database);
    // Load HTTP routes
    await loadAppRoutes({ router, manager, database });
}

export { DatabaseManager, ServiceManager }