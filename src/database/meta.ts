import {PrismaClient} from "@prisma/client";
import {MetaRepository} from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
}

export const getMetaVal: MetaRepository["getMetaVal"] = async (key, defaultVal) => {
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