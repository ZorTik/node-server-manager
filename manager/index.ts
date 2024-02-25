import {DatabaseManager} from "../app";
import docker from './docker';

export type ServiceEngine = {
    // TODO: Engine that runs containers
}

export type ServiceManager = {
    // TODO: Mediator between db and engine
}

export type Service = {
    // TODO
}

export default async function (db: DatabaseManager): Promise<ServiceManager> {
    let id = process.env.ENGINE;
    let engine: ServiceEngine;
    if (id === 'docker') {
        engine = await docker(db);
    } else {
        throw new Error('Unsupported engine type. Please one of: ' + ['docker'].join(', '));
    }
    return { // Manager
        // TODO
    }
}