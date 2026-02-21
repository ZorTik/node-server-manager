import {createClient} from "@redis/client";
import {env} from "@nsm/util/env";

function url(host: string, port: number, user?: string, pass?: string) {
    const prefix = user && pass ? user + ':' + pass + '@' : '';
    return 'redis://' + prefix + host + ':' + port.toString();
}

export default async function() {
    const [host, port] = env(['CONFIG_REDIS_HOST', 'CONFIG_REDIS_PORT']);

    const client = createClient({
        url: url(host, Number(port), process.env.CONFIG_REDIS_USER, process.env.CONFIG_REDIS_PASS)
    })
    /*.on('error', (err) => {
        // TODO: Error handling
    })*/;
    await client.connect();
    return client;
}