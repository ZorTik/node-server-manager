import DockerClient from "dockerode";

export default function listRunningFunc(client: DockerClient) {
  return async () => {
    const list = await client.listContainers({
      all: true,
      filters: JSON.stringify({ 'label': ['nsm=true'] }) }
    );
    return list
      .filter(c => c.State === 'running')
      .map(c => c.Id);
  }
}