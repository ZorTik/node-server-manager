import {ServiceEngine} from "../";
import DockerClient from 'dockerode';
import buildEngine from "./engine";

function initClient(appConfig: { docker_host: string }) {
    let client: DockerClient;
    if (appConfig.docker_host && (
            appConfig.docker_host.endsWith('.sock') ||
            appConfig.docker_host.startsWith('\\\\.\\pipe')
    )) {
        client = new DockerClient({socketPath: appConfig.docker_host});
    } else if (appConfig.docker_host) {
        // http(s)://host:port
        let host = appConfig.docker_host;
        host = host.substring(host.lastIndexOf(':'));
        let port = parseInt(appConfig.docker_host.replace(host, ''));
        client = new DockerClient({host, port});
    } else {
        throw new Error('Docker engine configuration variable not found! Please set docker_host in config.yml or override using env.');
    }
    return client;
}

async function synchronizeContainers(client: DockerClient, engine: ServiceEngine) {
    const list = await client.listContainers({ all: true, filters: { 'label': ['nsm=true'] } });
    for (const c of list) {
        if (c.State !== 'running') {
            continue;
        }
        await engine.stop(c.Id);
    }
}

export default async function (appConfig: any): Promise<ServiceEngine> {
    const client = initClient(appConfig);
    const engine = buildEngine(client);
    await synchronizeContainers(client, engine);
    return engine;
}