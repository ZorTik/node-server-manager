import build from './build';
import stop from './stop';
import deleteFunc from './delete';
import deleteVolume from './deletev';
import listContainers from './listc';
import listAttachedPorts from './listp';
import stat from "./stat";
import statall from "./statall";
import DockerClient from "dockerode";
import {DockerServiceEngine} from "@nsm/engine";
import ds from "check-disk-space";

export function initDockerClient(appConfig: { docker_host: string }) {
    let client: DockerClient;
    if (appConfig.docker_host && (
        appConfig.docker_host.endsWith('.sock') ||
        appConfig.docker_host.startsWith('\\\\.\\pipe')
    )) {
        client = new DockerClient({ socketPath: appConfig.docker_host });
    } else if (appConfig.docker_host) {
        // http(s)://host:port
        let host = appConfig.docker_host;
        host = host.substring(host.lastIndexOf(':'));
        let port = parseInt(appConfig.docker_host.replace(host, ''));
        client = new DockerClient({host, port});
    } else {
        throw new Error('Docker engine configuration variable not found! Please set docker_host in resources/config.yml or override using env.');
    }
    return client;
}

function calcHostUsageFunc(client: DockerClient) {
    return async () => {
        const { Volumes } = await client.listVolumes();
        let free_ = 0;
        let size_ = 0;
        for (const vol of Volumes) {
            if (!vol.Labels || !('nsm' in vol.Labels)) {
                // Not a NSM volume.
                continue;
            }
            const { free, size } = await ds(vol.Mountpoint);
            free_ += free;
            size_ += size;
        }
        return [free_, size_];
    }
}

function listRunningFunc(client: DockerClient) {
    return async () => {
        const list = await client.listContainers({
            all: true,
            filters: JSON.stringify({ 'label': ['nsm=true'] }) }
        );
        return list
            .filter(c => c.State === 'running')
            .map(c => c.Id);
    }
}

export default async function buildDockerEngine(appConfig: any) {
    // Default engine implementation
    const client = initDockerClient(appConfig);
    const engineImpl = {} as DockerServiceEngine;
    engineImpl.dockerClient = client;
    engineImpl.volumesMode = true; // Docker uses volumes strategy
    engineImpl.supportsNoTemplateMode = false;
    // engineImpl.cast - Being replaced in manager.
    engineImpl.build = build(engineImpl, client);
    engineImpl.stop = stop(engineImpl, client);
    engineImpl.delete = deleteFunc(engineImpl, client);
    engineImpl.deleteVolume = deleteVolume(engineImpl, client);
    engineImpl.getAttachedVolume = async (id) => {
        const c = client.getContainer(id);
        try {
            const i = await c.inspect();
            return i.Config.Labels['nsm.volumeId'];
        } catch (e) {
            return undefined;
        }
    }
    engineImpl.listContainers = listContainers(engineImpl, client);
    engineImpl.listAttachedPorts = listAttachedPorts(engineImpl, client);
    engineImpl.stat = stat(engineImpl, client);
    engineImpl.statAll = statall(engineImpl, client);
    engineImpl.calcHostUsage = calcHostUsageFunc(client);
    engineImpl.listRunning = listRunningFunc(client);
    return engineImpl;
}