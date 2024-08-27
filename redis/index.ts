import createClient from "./client";
import * as bus from "../event/bus";
import {ServiceManager} from "@nsm/engine";
import {RedisClientType} from "redis";

let mng: ServiceManager;
let client: RedisClientType<any, any, any>;

async function updateRedis() {
    const key = 'nsm:' + mng.nodeId;
    await client
        .multi()
        .hSet(key, 'runningCount', mng.getRunningServices().length)
        // TTL for whole hash
        .expire(key, 10)
        .exec();
}

export default async function (manager: ServiceManager) {
    mng = manager;
    client = await createClient();
    const interval = setInterval(updateRedis, 1000);

    bus.registerEventHandler('nsm:exit', () => {
        clearInterval(interval);
    });
    return client;
}

