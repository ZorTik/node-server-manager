import {DockerServiceEngine} from "@nsm/engine";
import {initDockerClient} from "@nsm/engine/docker/client";

import build from './action/build';
import run from "./action/run";
import stop from './action/stop';
import kill from './action/kill';
import reattach from "./action/reattach";
import delVolume from './action/deletev';
import cmd from './action/cmd';
import getAttachedVolume from "./action/getAttachedVolume";
import listContainers from './action/listc';
import listAttachedPorts from './action/listp';
import stat from "./action/stat";
import statAll from "./action/statall";
import calcHostUsage from "./action/calcHostUsage";
import listRunning from "./action/listRunning";

export default async function buildDockerEngine(appConfig: any) {
    // Default engine implementation
    const client = initDockerClient(appConfig);
    const engine = {} as DockerServiceEngine;
    engine.dockerClient = client;
    engine.volumesMode = true; // Docker uses volumes strategy
    engine.supportsNoTemplateMode = false;
    engine.rws = {};
    // engine.cast - Being replaced in manager.
    engine.build = build(client);
    engine.run = run(engine, client);
    engine.stop = stop(client);
    engine.kill = kill(client);
    engine.reattach = reattach(engine, client);
    engine.deleteVolume = delVolume(engine, client);
    engine.cmd = cmd(engine, client);
    engine.getAttachedVolume = getAttachedVolume(client);
    engine.listContainers = listContainers(engine, client);
    engine.listAttachedPorts = listAttachedPorts(engine, client);
    engine.stat = stat(engine, client);
    engine.statAll = statAll(engine, client);
    engine.calcHostUsage = calcHostUsage(client);
    engine.listRunning = listRunning(client);
    return engine;
}