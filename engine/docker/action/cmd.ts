import {DockerServiceEngine, ServiceEngine} from "@nsm/engine";
import DockerClient from "dockerode";

export default function (self: ServiceEngine, _: DockerClient): ServiceEngine['cmd'] {
    return async (id, cmd) => {
        const watchers = (self as DockerServiceEngine).rws;
        //
        if (id in watchers) {
            watchers[id].write(cmd);
            return true;
        } else {
            return false;
        }
    }
}