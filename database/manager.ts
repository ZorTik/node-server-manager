import {PrismaClient} from "@prisma/client";
import {PermaModel, SessionModel} from "./models";

export const client = new PrismaClient();

// Database manager implementation

export async function saveSession({ serviceId, nodeId, containerId }: SessionModel): Promise<boolean> {
    try {
        await client.session.upsert({
            where: { serviceId },
            update: { nodeId, containerId },
            create: { serviceId, nodeId, containerId }
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function savePerma(data: PermaModel): Promise<boolean> {
    const { serviceId } = data;
    try {
        await client.service.upsert({
            where: { serviceId },
            update: data,
            create: data
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function deleteSession(serviceId: string): Promise<boolean> {
    try {
        await client.session.delete({ where: { serviceId } });
        return true;
    } catch (e) {
        if (!e.message.includes('does not exist')) {
            console.log(e);
        }
        return false;
    }
}

export async function deleteSessions(nodeId: string): Promise<boolean> {
    try {
        await client.session.deleteMany({ where: { nodeId } });
        return true;
    } catch (e) {
        if (!e.message.includes('does not exist')) {
            console.log(e);
        }
        return false;
    }
}

export async function deletePerma(serviceId: string): Promise<boolean> {
    try {
        await client.service.delete({ where: { serviceId } });
        return true;
    } catch (e) {
        if (e.code !== 'P2025') {
            console.log(e);
        }
        return false;
    }
}

export async function getSession(serviceId: string): Promise<SessionModel|undefined> {
    try {
        const session = await client.session.findUnique({ where: { serviceId } });
        if (!session) {
            return undefined;
        }
        return session;
    } catch (e) {
        console.log(e);
        return undefined;
    }
}

export async function getPerma(serviceId: string): Promise<PermaModel|undefined> {
    try {
        const service = await client.service.findUnique({ where: { serviceId } });
        if (!service) {
            return undefined;
        }
        return service as PermaModel;
    } catch (e) {
        console.log(e);
        return undefined;
    }
}

export async function getMetaVal(key: string, defaultVal?: string): Promise<string> {
    try {
        let meta = await client.meta.findUnique({ where: { key } });
        if (!meta) {
            if (!defaultVal) {
                return defaultVal;
            }
            meta = await client.meta.create({ data: { key, value: defaultVal } });
        }
        return meta.value;
    } catch (e) {
        console.log(e);
        return '';
    }
}

export async function list(nodeId: string|undefined, page?: number, pageSize?: number): Promise<PermaModel[]> {
    try {
        let services: any[];
        if (page != undefined && pageSize != undefined) {
            services = await client.service.findMany({
                ...nodeId ? { where: { nodeId } } : {},
                skip: page * pageSize,
                take: pageSize,
            });
        } else {
            services = await client.service.findMany({
                ...nodeId ? { where: { nodeId } } : {},
            })
        }
        return services as PermaModel[];
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function listSessions(nodeId: string): Promise<SessionModel[]> {
    try {
        return await client.session.findMany({ where: { nodeId } });
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function count(nodeId: string): Promise<number> {
    try {
        return await client.service.count({ where: { nodeId } });
    } catch (e) {
        console.log(e);
        return -1;
    }
}

export async function setServiceMeta(serviceId: string, key: string, value: any): Promise<boolean> {
    try {
        await client.serviceMeta.upsert({
            where: { serviceId },
            update: { serviceId, key, value },
            create: { serviceId, key, value }
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function getServiceMeta(serviceId: string, key: string): Promise<any> {
    const meta = await client.serviceMeta.findUnique({ where: { serviceId, key } });
    if (meta) {
        return meta.value;
    } else {
        return undefined;
    }
}