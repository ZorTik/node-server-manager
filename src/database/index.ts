import {Database} from "./models";
import {PrismaClient} from "@prisma/client";

import * as permaRepository from "./perma";
import * as metaRepository from "./meta";
import * as serviceMetaRepository from "./serviceMeta";
import * as imageRepository from "./image";
import * as sessionRepository from "./session";
import * as serviceLogRepository from "./serviceLog";

export * from './models';

export default function (client?: PrismaClient): Database {
    if (!client) {
        client = new PrismaClient();
    }

    // Propagate client
    (
      [
        permaRepository,
        metaRepository,
        serviceMetaRepository,
        imageRepository,
        sessionRepository,
        serviceLogRepository
      ] as unknown as { init: (client: PrismaClient) => void }[]
    ).forEach(repository => repository.init(client));

    return {
        permaRepository,
        metaRepository,
        serviceMetaRepository,
        imageRepository,
        sessionRepository,
        serviceLogRepository
    }
}