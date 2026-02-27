import DockerClient from "dockerode";
import {DockerServiceEngine, ServiceEngine} from "@nsm/engine";
import {getActionType} from "@nsm/engine/asyncp";
import {currentContext, currentContext as ctx} from "@nsm/app";
import {deleteNetwork as doDeleteNetwork, isInNetwork} from "@nsm/networking/manager";

async function deleteContainer(id: string, client: DockerClient, options: { deleteNetwork?: boolean }) {
  try {
    const c = client.getContainer(id);
    try {
      await c.remove({ force: true });
    } catch (e) {
      currentContext.logger.error("Unable to delete container " + id);
    }

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

export default function reattach(self: ServiceEngine, client: DockerClient): ServiceEngine["reattach"] {
  return async (id, listener) => {
    const container = client.getContainer(id);

    const handleClosed = async () => {
      await deleteContainer(container.id, client, { deleteNetwork: true });

      await listener.onclose?.();
    }

    const info = await container.inspect();
    if (!info.State.Running) {
      // If the container is not running, we can delete it right after
      await handleClosed();
      throw new Error("Container is not running. Maybe it stopped before it could be attached?");
    }

    const attachOptions = { stream: true, stdin: true, stdout: true, stderr: true, hijack: true };
    const rws = await container.attach(attachOptions);
    rws.on('data', (data) => {
      listener.onMessage?.(data);
    }); // no-op, keepalive
    rws.on('end', async () => {
      if (getActionType(container.id) != 'stop') {
        // Stopped from the inside

        await handleClosed();
      } else {
        // Stopped by the NSM

        await handleClosed();
      }
    });
    (self as DockerServiceEngine).rws[container.id] = rws;

    listener.onStateMessage?.('Watching changes');
  }
}