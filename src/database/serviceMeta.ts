import {PrismaClient} from "@prisma/client";
import {ServiceMetaRepository} from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
}

export const setServiceMeta: ServiceMetaRepository["setServiceMeta"] = async (
  serviceId,
  key,
  value
) => {
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

export const getServiceMeta: ServiceMetaRepository["getServiceMeta"] = async (
  serviceId,
  key
) => {
  const meta = await client.serviceMeta.findUnique({ where: { serviceId, key } });
  if (meta) {
    return meta.value;
  } else {
    return undefined;
  }
}