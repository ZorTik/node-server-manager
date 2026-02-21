import DockerClient from "dockerode";
import ds from "check-disk-space";
import {DockerServiceEngine} from "@nsm/engine";
import {initDockerClient} from "@nsm/engine/docker/client";

// ---------- Actions ----------
import build from './action/build';
import stop from './action/stop';
import kill from './action/kill';
import del from './action/delete';
import delVolume from './action/deletev';
import cmd from './action/cmd';
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
    const engine = {} as DockerServiceEngine;
    engine.dockerClient = client;
    engine.volumesMode = true; // Docker uses volumes strategy
    engine.supportsNoTemplateMode = false;
    engine.rws = {};
    // engine.cast - Being replaced in manager.
    engine.build = build(engine, client);
    engine.stop = stop(engine, client);
    engine.kill = kill(engine, client);
    engine.delete = del(engine, client);
    engine.deleteVolume = delVolume(engine, client);
    engine.cmd = cmd(engine, client);
    engine.getAttachedVolume = async (id) => {
        const c = client.getContainer(id);
        try {
            const i = await c.inspect();
            return i.Config.Labels['nsm.volumeId'];
        } catch (e) {
            return undefined;
        }
    }
    engine.listContainers = listContainers(engine, client);
    engine.listAttachedPorts = listAttachedPorts(engine, client);
    engine.stat = stat(engine, client);
    engine.statAll = statAll(engine, client);
    engine.calcHostUsage = calcHostUsageFunc(client);
    engine.listRunning = listRunningFunc(client);
    return engine;
}