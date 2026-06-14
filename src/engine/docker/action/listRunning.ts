import DockerClient from "dockerode";
import { ContainerFilter } from "@nsm/engine";
import { toDockerFilters } from "@nsm/engine/docker/util/labels";

export default function listRunningFunc(client: DockerClient) {
  return async (filter: ContainerFilter) => {
    const list = await client.listContainers({
      all: true,
      filters: toDockerFilters(filter),
    });
    return list.filter((c) => c.State === "running").map((c) => c.Id);
  };
}
