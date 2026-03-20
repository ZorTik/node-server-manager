export interface Database {
    permaRepository: PermaRepository;
    metaRepository: MetaRepository;
    serviceMetaRepository: ServiceMetaRepository;
    imageRepository: ImageRepository;
    sessionRepository: SessionRepository;
    serviceLogRepository: ServiceLogRepository;
}

export interface PermaRepository {
    savePerma(info: PermaModel): Promise<boolean>;
    deletePerma(serviceId: string): Promise<boolean>;
    getPerma(serviceId: string): Promise<PermaModel|undefined>;
    listPerma(nodeId: string, page?: number, pageSize?: number, meta?: {[key: string]: any}): Promise<PermaModel[]>;
    listPermaUsingImage(imageId: string): Promise<PermaModel[]>;
    countPerma(nodeId: string): Promise<number>;
}

export interface MetaRepository {
    getMetaVal(key: string, defaultVal?: string): Promise<string>;
}

export interface ServiceMetaRepository {
    setServiceMeta(serviceId: string, key: string, value: any): Promise<boolean>;
    getServiceMeta(serviceId: string, key: string): Promise<any>;
}

export interface ImageRepository {
    saveImage(info: ImageModel): Promise<boolean>;
    getImage(id: string): Promise<ImageModel|undefined>;
    deleteImage(id: string): Promise<boolean>;
    listImagesByOptions(templateId: string, buildOptions: {[key: string]: string}): Promise<ImageModel[]>;
}

export interface SessionRepository {
    createSession(serviceId: string): Promise<ServiceSessionModel|undefined>;

    listSessions(args: ListSessionsArgs): Promise<ServiceSessionModel[]|undefined>;
}

export type ListSessionsArgs = {
    filter?: {
        serviceId?: string;
    }
    sort?: {
        by?: 'startedAt'
        direction?: 'asc' | 'desc'
    }
    page?: {
        index: number;
        size: number;
    }
}

export interface ServiceLogRepository {
    createRecords(records: CreateLogRecordArgs[]): Promise<boolean>;

    listRecords(args: ListRecordsArgs): Promise<ServiceLogRecordModel[]|undefined>;
}

export type CreateLogRecordArgs = Omit<ServiceLogRecordModel, 'id' | 'timestamp'>;

export type ListRecordsArgs = {
    filter?: {
        sessionId?: string;
    }
    sort?: {
        by?: 'timestamp',
        direction?: 'asc' | 'desc'
    }
    page?: {
        index: number;
        size: number;
    }
}

export type PermaModel = {
    serviceId: string;
    template: string;
    nodeId: string;
    imageId?: string;
    port: number;
    options: {
        [key: string]: any;
    };
    meta?: {
        stopCmd?: string;
    };
    env: {
        [key: string]: string;
    };
    network?: {
        address: string;
        portsOnly: boolean;
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

export type ServiceSessionModel = {
    id: string,
    serviceId: string,
}

export type ServiceLogRecordModel = {
    id: bigint;
    sessionId: string;
    source: 'ENGINE' | 'CONTAINER'
    timestamp: Date;
    logLevel: string;
    message: string;
}