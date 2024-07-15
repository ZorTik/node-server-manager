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

function initDockerClient(appConfig: { docker_host: string }) {
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
        throw new Error('Docker engine configuration variable not found! Please set docker_host in config.yml or override using env.');
    }
    return client;
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
    engineImpl.listContainers = listContainers(engineImpl, client);
    engineImpl.listAttachedPorts = listAttachedPorts(engineImpl, client);
    engineImpl.stat = stat(engineImpl, client);
    engineImpl.statAll = statall(engineImpl, client);
    engineImpl.calcHostUsage = async () => {
        const { Volumes } = await client.listVolumes();
        let free_ = 0;
        let size_ = 0;
        for (const vol of Volumes) {
            if (!vol.Labels || !('nsm' in vol.Labels)) {
                // Not a NSM volume.
                continue;
            }

            const mp = vol.Mountpoint;
            const { free, size } = await ds(mp);

            free_ += free;
            size_ += size;
        }
        return [free_, size_];
    }

    // Synchronize containers
    const containerList = await client.listContainers({
        all: true,
        filters: JSON.stringify({ 'label': ['nsm=true'] }) }
    );
    for (const container of containerList) {
        if (container.State !== 'running') {
            continue;
        }
        await engineImpl.stop(container.Id);
    }
    return engineImpl;
}