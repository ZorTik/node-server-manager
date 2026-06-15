import DockerClient from "dockerode";
import { ServiceEngine } from "@nsm/engine";

export default function deleteImage(
  client: DockerClient,
): ServiceEngine["deleteImage"] {
  return async (id) => {
    try {
      const image = client.getImage(id);
      await image.remove();
    } catch (e) {
      if (!e.message.includes("no such image")) {
        throw e;
      }
    }
  };
}
