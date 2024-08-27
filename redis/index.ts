import client from "./client";
import * as bus from "../event/bus";
import {ServiceManager} from "@nsm/engine";

let mng: ServiceManager;

async function updateRedis() {
    const key = 'nsm:' + mng.nodeId;
    await client
        .multi()
        .hSet(key, 'runningCount', mng.getRunningServices().length)
        // TTL for whole hash
        .expire(key, 10)
        .exec();
}

export default function (manager: ServiceManager) {
    mng = manager;
    const interval = setInterval(updateRedis, 1000);

    bus.registerEventHandler('nsm:exit', () => {
        clearInterval(interval);
    });
}

