import DockerClient from "dockerode";
import { ServiceEngine } from "@nsm/engine";

export default function (client: DockerClient): ServiceEngine["getLabels"] {
  return async (id) => {
    const container = client.getContainer(id);

    const inspect = await container.inspect();

    return inspect.Config.Labels;
  };
}
