import DockerClient from "dockerode";
import {ServiceEngine} from "@nsm/engine";

export default function deleteImage(client: DockerClient): ServiceEngine["deleteImage"] {
  return async (id) => {
    const image = client.getImage(id);

    await image.remove();
  }
}