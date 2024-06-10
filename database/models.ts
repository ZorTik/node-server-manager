import {PrismaClient} from "@prisma/client";

export type SessionModel = {
    serviceId: string,
    nodeId: string,
    containerId: string,
}

export type PermaModel = {
    serviceId: string,
    template: string,
    nodeId: string,
    port: number,
    options: {[key: string]: any},
    env: {[key: string]: string},
}

export type Database = {
    client: PrismaClient;

    saveSession(info: SessionModel): Promise<boolean>;
    savePerma(info: PermaModel): Promise<boolean>;
    deleteSession(serviceId: string): Promise<boolean>;
    deleteSessions(nodeId: string): Promise<boolean>;
    deletePerma(serviceId: string): Promise<boolean>;
    getSession(serviceId: string): Promise<SessionModel|undefined>;
    getPerma(serviceId: string): Promise<PermaModel|undefined>;
    getMetaVal(key: string, defaultVal?: string): Promise<string>;
    list(nodeId: string, page?: number, pageSize?: number): Promise<PermaModel[]>;
    listSessions(nodeId: string): Promise<SessionModel[]>;
    count(nodeId: string): Promise<number>;
}