import DockerClient from "dockerode";

export default function getAttachedVolume(client: DockerClient) {
  return async (id: string) => {
    const c = client.getContainer(id);
    try {
      const i = await c.inspect();
      return i.Config.Labels['nsm.volumeId'];
    } catch (e) {
      return undefined;
    }
  }
}