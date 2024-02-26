import {PrismaClient} from "@prisma/client";
import {PermaModel, SessionModel} from "./models";

const client = new PrismaClient();

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
        console.log(e);
        return false;
    }
}

export async function deletePerma(serviceId: string): Promise<boolean> {
    try {
        await client.service.delete({ where: { serviceId } });
        return true;
    } catch (e) {
        console.log(e);
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