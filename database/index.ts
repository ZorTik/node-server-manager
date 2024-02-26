export type SessionInfo = {
    serviceId: string,
    nodeId: string,
    containerId: string,
}

export type PermaInfo = {
    serviceId: string,
    template: string,
    nodeId: string,
    port: number,
}

export type DatabaseManager = {
    saveSession(info: SessionInfo): Promise<boolean>;
    savePerma(info: PermaInfo): Promise<boolean>;
    deleteSession(serviceId: string): Promise<boolean>;
    deletePerma(serviceId: string): Promise<boolean>;
    getSession(serviceId: string): Promise<SessionInfo|undefined>;
    getPerma(serviceId: string): Promise<PermaInfo|undefined>;
}

export default async function (): Promise<DatabaseManager> {
    // TODO
}