import DockerClient from "dockerode";
import {RunOptions, MetaStorage, ServiceEngine, ServiceState} from "@nsm/engine";
import {accessNetwork, createNetwork} from "@nsm/networking/manager";
import {constructObjectLabels} from "@nsm/util/services";
import {currentContext as ctx} from "@nsm/app";
import {propagateOptionsToEnv} from "@nsm/engine/docker/util/env";
import {infoRecord as info} from "@nsm/engine/docker/util/logging";

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
  network: RunOptions['network'],
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
  volumeId: string,
  options: RunOptions,
  net: DockerClient.Network|undefined
) {
  const {ram, cpu, disk, port, network} = options;
  const env = {...options.env};
  propagateOptionsToEnv(options, env);

  const fullPortDef = (port: number) => (network?.portsOnly ? network.address + ":" : "") + port + "";
  // Create container
  const container = await client.createContainer({
    Image: imageTag,
    Labels: options.labels,
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

const createState = (id: string, description: string, ready?: boolean): ServiceState => {
  return {
    id,
    description,
    ready: ready ?? false
  }
};

const createErrorState = (description: string): ServiceState => {
  return {
    id: 'error',
    description,
    ready: false
  }
}

export default function run(self: ServiceEngine, client: DockerClient): ServiceEngine["run"] {
  return async (imageId, volumeId, options, meta, listener) => {
    let container: DockerClient.Container;
    // Prepare volume

    let creating = await prepareVolume(client, volumeId);

    await listener.onStateChange?.(createState('preparing_network', 'Preparing network'));
    const net = await prepareNetwork(client, options.network, meta, creating);
    // Port decorator that takes port and according to network changes it to <net>:<port> or keeps the same.
    await listener.onStateChange?.(createState('preparing_container', 'Preparing container'));
    container = await prepareContainer(client, imageId, volumeId, options, net);
    await listener.onStateChange?.(createState('starting_container', 'Starting container'));

    await container.start();
    const inspectInfo = await container.inspect();
    if (!inspectInfo.State.Running) {
      // Wait a bit for logs to be available
      await new Promise(r => setTimeout(r, 300));

      // Container failed to start, try to get logs and error message
      // The necessary error will be thrown by reattach call
      try {
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: false,
          tail: 100,
        });
        const msg = logs.toString("utf8");

        await listener.onStateChange?.(createErrorState('Container failed to start'));
        await listener.onMessage(info(msg));
      } catch (e) {
        ctx.logger.error("Error while fetching logs for failed container " + container.id, e);
      }
    }

    await self.reattach(container.id, listener);

    return container.id;
  }
}