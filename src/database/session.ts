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
    await client.serviceSession.create({ data });
  } catch (e) {
    console.log(e);

    return undefined;
  }
}