import DockerClient from "dockerode";
import { PassThrough } from "stream";
import {
  DockerServiceEngine,
  ServiceEngine,
  ServiceLogRecord,
} from "@nsm/engine";
import { getActionType } from "@nsm/engine/asyncp";
import { currentContext } from "@nsm/app";
import {
  deleteNetwork as doDeleteNetwork,
  isInNetwork,
} from "@nsm/engine/docker/networking/manager";
import winston from "winston";

async function deleteContainer(
  id: string,
  client: DockerClient,
  options: { deleteNetwork?: boolean },
) {
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
      await client
        .getNetwork(networkId)
        .disconnect({ Container: id, Force: true });
      if (options.deleteNetwork == true) {
        // Delete network if requested.
        await doDeleteNetwork(client, id);
      }
    }
    return true;
  } catch (e) {
    if (
      e.message.includes("No such container:") ||
      e.message.includes("removal of container")
    ) {
      currentContext?.logger.warn("Ignoring error: " + e.message);
      return true;
    }

    currentContext.logger.error(e);
    return false;
  }
}

export default function reattach(
  self: ServiceEngine,
  client: DockerClient,
): ServiceEngine["reattach"] {
  return async (id, listener) => {
    const container = client.getContainer(id);
    const logger = currentContext.logger;

    const handleClosed = async () => {
      await deleteContainer(container.id, client, { deleteNetwork: true });

      await listener.onClose?.();
    };

    const info = await container.inspect();
    if (!info.State.Running) {
      // If the container is not running, we can delete it right after
      await handleClosed();
      throw new Error(
        "Container is not running. Maybe it stopped before it could be attached?",
      );
    }

    const attachOptions = {
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true,
    };
    const rws = await container.attach(attachOptions);

    const handleData = (data: Buffer, level: "info" | "error" = "info") => {
      try {
        const message = data.toString("utf8");
        const record: ServiceLogRecord = {
          level,
          message,
        };

        listener.onMessage?.(record);
      } catch (e) {
        logger.error("Error producing container output: " + e);
      }
    };

    if (info.Config.Tty) {
      rws.on("data", handleData);
    } else {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      container.modem.demuxStream(rws, stdout, stderr);
      stdout.on("data", (data) => handleData(data, "info"));
      stderr.on("data", (data) => handleData(data, "error"));
    }
    rws.on("end", async () => {
      if (getActionType(container.id) != "stop") {
        // Stopped from the inside

        await handleClosed();
      } else {
        // Stopped by the NSM

        await handleClosed();
      }
    });
    (self as DockerServiceEngine).rws[container.id] = rws;

    await listener.onStateChange?.({
      id: "watching_changes",
      description: "Watching changes",
      ready: true,
    });
  };
}
