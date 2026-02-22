import DockerClient from "dockerode";
import {BuildOptions, MetaStorage, ServiceEngine} from "@nsm/engine";
import {accessNetwork, createNetwork} from "@nsm/networking/manager";
import {constructObjectLabels} from "@nsm/util/services";
import path from "path";
import {buildDir} from "@nsm/engine/monitoring/util";

async function prepareVolume(client: DockerClient, volumeId: string) {
  try {
    await client.getVolume(volumeId).inspect();
  } catch (e) {
    if (e.message.includes('No such')) {
      await client.createVolume({
        Name: volumeId,
        Labels: {
          ...constructObjectLabels({ id: volumeId }),
          'nsm.volumeId': volumeId,
        },
      });

      return true;
    }
  }

  return false;
}

async function prepareNetwork(
  client: DockerClient,
  network: BuildOptions['network'],
  meta: MetaStorage,
  creatingContainer: boolean
) {
  let net: DockerClient.Network|undefined = undefined;
  if (network && !network.portsOnly) {
    const metaKey = "net-id";
    let netId = await meta.get<string>(metaKey);
    if (creatingContainer || !netId) {
      net = await createNetwork(client, network.address);
      netId = net.id;
      if (!await meta.set(metaKey, netId)) {
        throw new Error("Could not save network data.");
      }
    } else {
      net = await accessNetwork(client, network.address, netId);
    }
  }
  return net;
}

async function prepareContainer(
  client: DockerClient,
  imageTag: string,
  buildDir: string,
  volumeId: string,
  options: BuildOptions,
  net: DockerClient.Network|undefined
) {
  const {ram, cpu, disk, port, network, env} = options;
  const fullPortDef = (port: number) => (network?.portsOnly ? network.address + ":" : "") + port + "";
  // Create container
  const container = await client.createContainer({
    Image: imageTag,
    Labels: {
      ...constructObjectLabels({ id: volumeId }),
      'nsm.buildDir': buildDir,
      'nsm.volumeId': volumeId,
      'nsm.templateId': buildDir ? path.basename(buildDir) : '__no_t__'
    },
    HostConfig: {
      Memory: ram,
      CpuShares: cpu,
      PortBindings: { [port + '/tcp']: [{HostPort: fullPortDef(port)}] },
      DiskQuota: disk,
      Mounts: [
        {
          Type: 'volume',
          Source: client.getVolume(volumeId).name,
          Target: '/data',
          ReadOnly: false,
        }
      ],
    },
    Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
    ExposedPorts: { [fullPortDef(port)]: {} },
    AttachStdin: true,
    OpenStdin: true,
  });
  if (net != null) {
    await net.connect({ Container: container.id }); // Implement EndpointConfig?? TODO: Test
  }
  return container;
}

export default function run(self: ServiceEngine, client: DockerClient): ServiceEngine["run"] {
  return async (templateId, imageId, volumeId, options, meta, listener) => {
    let container: DockerClient.Container;
    // Prepare volume
    let creating = await prepareVolume(client, volumeId);
    if (creating) {
      listener.onStateMessage('Created new volume');
    }

    listener.onStateMessage('Preparing network');
    const net = await prepareNetwork(client, options.network, meta, creating);
    // Port decorator that takes port and according to network changes it to <net>:<port> or keeps the same.
    listener.onStateMessage('Preparing container');
    container = await prepareContainer(client, imageId, buildDir(templateId), volumeId, options, net);
    listener.onStateMessage('Starting container');

    await container.start();

    await self.reattach(container.id, listener);

    return container.id;
  }
}