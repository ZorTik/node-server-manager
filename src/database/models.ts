import {PrismaClient} from "@prisma/client";

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
    list(nodeId: string, page?: number, pageSize?: number, meta?: {[key: string]: any}): Promise<PermaModel[]>;
    listAllUsingImage(imageId: string): Promise<PermaModel[]>;
    listSessions(nodeId: string): Promise<SessionModel[]>;
    count(nodeId: string): Promise<number>;
    setServiceMeta(serviceId: string, key: string, value: any): Promise<boolean>;
    getServiceMeta(serviceId: string, key: string): Promise<any>;
    saveImage(info: ImageModel): Promise<boolean>;
    getImage(id: string): Promise<ImageModel|undefined>;
    deleteImage(id: string): Promise<boolean>;
    listImagesByOptions(templateId: string, buildOptions: {[key: string]: string}): Promise<ImageModel[]>;
};

export type SessionModel = {
    serviceId: string,
    nodeId: string,
    containerId: string
};

export type PermaModel = {
    serviceId: string,
    template: string,
    nodeId: string,
    imageId?: string,
    port: number,
    options: {
        [key: string]: any,
    },
    meta?: {
        stopCmd?: string,
    }
    env: {
        [key: string]: string,
    },
    network?: {
        address: string,
        portsOnly: boolean,
    }
};

export type ImageModel = {
    id: string,
    templateId: string,
    hash: string,
    buildOptions: {
        [key: string]: string,
    }
}