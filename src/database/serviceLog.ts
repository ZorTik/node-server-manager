import {PrismaClient} from "@prisma/client";
import {ServiceLogRepository} from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
}

export const createRecords: ServiceLogRepository["createRecords"] = async (
  records
) => {
  try {
    await client.serviceLogRecord.createMany({ data: records });
    return true;
  } catch (e) {
    console.error(e);

    return false;
  }
}