import DockerClient from "dockerode";
import {ServiceEngine} from "@nsm/engine";
import {toDockerFilters} from "@nsm/engine/docker/util/labels";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['listContainers'] {
    return async (filter) => {
        try {
            const containers = await client.listContainers({
                all: true,
                filters: toDockerFilters(filter)
            });

            return containers.map(c => c.Id);
        } catch (e) {
            console.log(e);
            return [];
        }
    }
}