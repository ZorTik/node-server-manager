import DockerClient from "dockerode";
import {BuildOptions, DockerServiceEngine, MetaStorage, ServiceEngine} from "@nsm/engine";
import {currentContext as ctx, currentContext} from "@nsm/app";
import {accessNetwork, createNetwork, deleteNetwork as doDeleteNetwork, isInNetwork} from "@nsm/networking/manager";
import {getActionType} from "@nsm/engine/asyncp";
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

async function deleteContainer(id: string, client: DockerClient, options: { deleteNetwork?: boolean }) {
  try {
    const c = client.getContainer(id);
    const {Config,} = await c.inspect();
    try {
      await c.remove({ force: true });
    } catch (e) {
      currentContext.logger.error("Unable to delete container " + id);
    }
    const volumeIdUsed = Config.Labels['nsm.volumeId'];
    await client.getImage(volumeIdUsed + ':latest').remove({ force: true });
    // Delete network if it's associated with any.
    const networkId = await isInNetwork(client, id);
    if (networkId) {
      // Disconnect this container from the attached network.
      await client.getNetwork(networkId).disconnect({ Container: id, Force: true });
      if (options.deleteNetwork == true) {
        // Delete network if requested.
        await doDeleteNetwork(client, id);
      }
    }
    return true;
  } catch (e) {
    if (e.message.includes('No such container:') || e.message.includes('removal of container')) {
      currentContext?.logger.warn('Ignoring error: ' + e.message);
      return true;
    }

    currentContext.logger.error(e);
    return false;
  }
}

export default function run(self: ServiceEngine, client: DockerClient): ServiceEngine["run"] {
  return async (templateId, imageId, volumeId, options, meta, listener) => {
    let container: DockerClient.Container;
    // Whether, or not we're creating a brand-new service
    let creating = false;
    try {
      // Prepare volume
      creating = await prepareVolume(client, volumeId);
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
      listener.onStateMessage('Watching changes');
      // Watcher
      setTimeout(async () => {
        const attachOptions = { stream: true, stdin: true, stdout: true, stderr: true, hijack: true };
        const rws = await client.getContainer(container.id).attach(attachOptions);
        rws.on('data', (data) => {
          listener.onMessage(data);
        }); // no-op, keepalive
        rws.on('end', async () => {
          // I only want to trigger close when the container is not being
          // stopped by nsm to prevent loops.
          if (getActionType(container.id) != 'stop') {
            ctx.logger.info('Container ' + container.id + ' stopped from the inside.');

            await listener.onclose();
          } else {
            ctx.logger.info('Container ' + container.id + ' stopped by NSM.');
          }

          // Clean up resources
          await deleteContainer(container.id, client, { deleteNetwork: true });
        });
        (self as DockerServiceEngine).rws[container.id] = rws;
      }, 500);
    } catch (e) {
      if (!container) {
        await client.getImage(imageId).remove({ force: true });
      }

      throw e;
    }

    return container.id;
  }
}