import {PrismaClient, Image} from "@prisma/client";
import {ImageModel, PermaModel, SessionModel} from "./models";

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

export async function list(nodeId: string|undefined, page?: number, pageSize?: number, meta?: {[key: string]: any}): Promise<PermaModel[]> {
    try {
        // SELECT * FROM Service WHERE JSON_EXTRACT(Meta, "$.tag1") IS NOT NULL;
        let where = " WHERE 1";
        // Pagination part
        let pg = "";
        // Values for prepared statement
        let values = [];

        if (nodeId != undefined) {
            where += " AND nodeId = ?";
            // Store for prepare statement
            values.push(nodeId);
        }
        if (page != undefined && pageSize != undefined) {
            // Insert pagination
            pg += " LIMIT " + pageSize;
            pg += " OFFSET " + page * pageSize;
        }
        if (meta != undefined) {
            // AND clause for every key,value pair
            for (const key in meta) {
                // Add another AND clause for specific key,value pair
                where += " AND JSON_EXTRACT(meta, ?) = ?";

                // Push key and value to be replaced in prepared statement
                values.push("$." + key, meta[key]);
            }
        }
        return client
            .$queryRawUnsafe<PermaModel[]>(`SELECT * FROM Service${where}${pg};`, ...values)
            .then(result => result as PermaModel[]);
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function listAllUsingImage(imageId: string): Promise<PermaModel[]> {
    try {
        return await client.service.findMany({ where: { imageId } }) as PermaModel[];
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

export async function saveImage(info: ImageModel): Promise<boolean> {
    const { id, templateId, hash, buildOptions } = info;

    try {
        await client.image.upsert({
            where: { id },
            update: {
                templateId,
                hash,
                buildOptions: {
                    deleteMany: {},
                    create: Object.entries(buildOptions).map(([key, value]) => ({ key, value })),
                }
            },
            create: {
                id,
                templateId,
                hash,
                buildOptions: {
                    create: Object.entries(buildOptions).map(([key, value]) => ({ key, value })),
                }
            }
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function getImage(id: string): Promise<ImageModel|undefined> {
    const image = await client.image.findUnique({
        where: { id },
        include: {
            buildOptions: {
                select: { key: true, value: true },
            }
        }
    });
    if (image) {
        const buildOptions = {};
        image.buildOptions.forEach((option) => buildOptions[option.key] = option.value);

        return {
            ...image,
            buildOptions,
        }
    } else {
        return undefined;
    }
}

export async function deleteImage(id: string): Promise<boolean> {
    try {
        await client.image.delete({ where: { id } });
        return true;
    } catch (e) {
        if (e.code !== 'P2025') {
            console.log(e);
        }

        return false;
    }
}

export async function listImagesByOptions(templateId: string, buildOptions: {[key: string]: string}): Promise<ImageModel[]> { // TODO: toto možná nefunguje správně, furtt vrací prázdný array
    try {
        const images = await client.image.findMany({
            where: {
                AND: [
                    { templateId },
                    ...Object.entries(buildOptions).map(([key, value]) => ({
                        buildOptions: {
                            some: {
                                key,
                                value,
                            }
                        }
                    }))
                ]
            },
            include: {
                buildOptions: {
                    select: { key: true, value: true },
                }
            }
        });

        return images.map(image => {
            const options = {};
            image.buildOptions.forEach(option => options[option.key] = option.value);

            return {
                id: image.id,
                templateId: image.templateId,
                hash: image.hash,
                buildOptions: options,
            } as ImageModel;
        });
    } catch (e) {
        console.log(e);
        return [];
    }
}