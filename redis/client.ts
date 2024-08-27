import redis from "redis";
import {env} from "@nsm/util/env";

const [host, port] = env(['CONFIG_REDIS_HOST', 'CONFIG_REDIS_PORT']);

function url(host: string, port: number, user?: string, pass?: string) {
    const prefix = user && pass ? user + ':' + pass + '@' : '';
    return 'redis://' + prefix + host + ':' + port.toString();
}

export default async function() {
    return redis.createClient({
        url: url(host, Number(port), process.env.CONFIG_REDIS_USER, process.env.CONFIG_REDIS_PASS)
    }).connect();
}