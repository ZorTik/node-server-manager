import DockerClient from "dockerode";
import ds from "check-disk-space";
import {DockerServiceEngine} from "@nsm/engine";
import {initDockerClient} from "@nsm/engine/docker/client";

// ---------- Actions ----------
import build from './action/build';
import stop from './action/stop';
import del from './action/delete';
import delVolume from './action/deletev';
import listContainers from './action/listc';
import listAttachedPorts from './action/listp';
import stat from "./action/stat";
import statAll from "./action/statall";
// -----------------------------

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
    engineImpl.delete = del(engineImpl, client);
    engineImpl.deleteVolume = delVolume(engineImpl, client);
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
    engineImpl.statAll = statAll(engineImpl, client);
    engineImpl.calcHostUsage = calcHostUsageFunc(client);
    engineImpl.listRunning = listRunningFunc(client);
    return engineImpl;
}