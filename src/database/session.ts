import {Prisma, PrismaClient} from "@prisma/client";
import {SessionRepository} from "@nsm/database/models";

let client: PrismaClient;

export const init = (client_: PrismaClient) => {
  client = client_;
}

export const createSession: SessionRepository["createSession"] = async (serviceId) => {
  const data: Prisma.ServiceSessionUncheckedCreateInput = {
    serviceId
  };

  try {
    return await client.serviceSession.create({ data });
  } catch (e) {
    console.log(e);

    return undefined;
  }
}

export const listSessions: SessionRepository["listSessions"] = async (args) => {
  const {
    filter,
    sort,
    page
  } = args;

  const query: Prisma.ServiceSessionFindManyArgs = {};
  if (filter?.serviceId) {
    query.where = filter;
  }
  query.orderBy = {
    [sort?.by ?? "startedAt"]: sort?.direction ?? "desc"
  };
  if (page) {
    query.skip = page.index * page.size;
    query.take = page.size;
  }

  try {
    return await client.serviceSession.findMany(query);
  } catch (e) {
    console.log(e);

    return undefined;
  }
}