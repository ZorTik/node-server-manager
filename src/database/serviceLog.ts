import { Prisma, PrismaClient } from "@prisma/client";
import { ServiceLogRepository } from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
};

export const createRecords: ServiceLogRepository["createRecords"] = async (
  records,
) => {
  try {
    await client.serviceLogRecord.createMany({ data: records });
    return true;
  } catch (e) {
    console.error(e);

    return false;
  }
};

export const listRecords: ServiceLogRepository["listRecords"] = async (
  args,
) => {
  const { filter, sort, page } = args;

  const query: Prisma.ServiceLogRecordFindManyArgs = {};
  if (filter?.sessionId) {
    query.where = filter;
  }
  query.orderBy = {
    [sort?.by ?? "timestamp"]: sort?.direction ?? "desc",
  };
  if (page) {
    query.skip = page.index * page.size;
    query.take = page.size;
  }

  try {
    return await client.serviceLogRecord.findMany(query);
  } catch (e) {
    console.log(e);

    return undefined;
  }
};
