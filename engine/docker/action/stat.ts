import {ServiceEngine} from "../../engine";
import DockerClient from "dockerode";
import {adaptContainerStatsFromDocker} from "@nsm/util/docker";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['stat'] {
    return async (id) => {
        const stats = await client.getContainer(id).stats({ stream: false });
        return adaptContainerStatsFromDocker(id, stats);
    }
}