import {PrismaClient} from "@prisma/client";
import {PermaModel, PermaRepository} from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
}

export const savePerma: PermaRepository["savePerma"] = async (data) => {
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

export const deletePerma: PermaRepository["deletePerma"] = async (
  serviceId
) => {
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

export const getPerma: PermaRepository["getPerma"] = async (
  serviceId
) => {
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

export const listPerma: PermaRepository["listPerma"] = async (
  nodeId,
  page,
  pageSize,
  meta
) => {
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

export const listPermaUsingImage: PermaRepository["listPermaUsingImage"] = async (
  imageId
) => {
  try {
    return await client.service.findMany({ where: { imageId } }) as PermaModel[];
  } catch (e) {
    console.log(e);
    return [];
  }
}

export const countPerma: PermaRepository["countPerma"] = async (nodeId) => {
  try {
    return await client.service.count({ where: { nodeId } });
  } catch (e) {
    console.log(e);
    return -1;
  }
}
