import { ServiceEngine } from "@nsm/engine";
import DockerClient from "dockerode";

export default function (client: DockerClient): ServiceEngine["kill"] {
  return async (id) => {
    try {
      const list = await client.listContainers({ all: true });
      if (list.map((c) => c.Id).includes(id)) {
        await client.getContainer(id).remove({ force: true });
      }

      return true;
    } catch (e) {
      if (!e.message.includes("is not running") && !e.message.includes("no such container")) {
        console.log(e);
      }
      return false;
    }
  };
}
