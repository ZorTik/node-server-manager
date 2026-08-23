import DockerClient from "dockerode";
import {PortBinding, RunOptions, ServiceEngine, ServiceState,} from "@nsm/engine";
import {constructObjectLabels} from "@nsm/util/services";
import {currentContext as ctx} from "@nsm/app";
import {demuxBuffer, infoRecord as info} from "@nsm/engine/docker/util/logging";

async function prepareVolume(client: DockerClient, volumeId: string) {
  try {
    await client.getVolume(volumeId).inspect();
  } catch (e) {
    if (e.message.includes("No such")) {
      await client.createVolume({
        Name: volumeId,
        Labels: {
          ...constructObjectLabels({ id: volumeId }),
          "nsm.volumeId": volumeId,
        },
      });

      return true;
    }
  }

  return false;
}

async function prepareContainer(
  client: DockerClient,
  imageTag: string,
  volumeId: string,
  options: RunOptions,
) {
  const { ram, cpu, disk, portBindings } = options;

  const containerPortDef = (binding: PortBinding) => {
    return binding.containerPort.port + "/" + (binding.containerPort.protocol ?? "tcp");
  }
  // Create container
  return client.createContainer({
    Image: imageTag,
    Labels: options.labels,
    HostConfig: {
      Memory: ram,
      CpuShares: cpu,
      //PortBindings: { [port + "/tcp"]: [{ HostPort: fullPortDef(port) }] },
      PortBindings: portBindings.reduce(
        (acc, binding) => {
          acc[containerPortDef(binding)] = [{HostPort: binding.hostString}];

          return acc;
        },
        {} as { [key: string]: { HostPort: string }[] },
      ),
      DiskQuota: disk,
      Mounts: [
        {
          Type: "volume",
          Source: client.getVolume(volumeId).name,
          Target: "/data",
          ReadOnly: false,
        },
      ],
    },
    Env: Object.entries(options.env).map(([k, v]) => `${k}=${v}`),
    /*ExposedPorts: portBindings.reduce(
      (acc, binding) => {
        acc[containerPortDef(binding)] = {};

        return acc;
      },
      {} as { [key: string]: {} },
    ),*/
    AttachStdin: true,
    OpenStdin: true,
    Tty: true,
  });
}

const createState = (
  id: string,
  description: string,
  ready?: boolean,
): ServiceState => {
  return {
    id,
    description,
    ready: ready ?? false,
  };
};

const createErrorState = (description: string): ServiceState => {
  return {
    id: "error",
    description,
    ready: false,
  };
};

export default function run(
  self: ServiceEngine,
  client: DockerClient,
): ServiceEngine["run"] {
  return async (imageId, volumeId, options, meta, listener) => {
    let container: DockerClient.Container;
    // Prepare volume
    await prepareVolume(client, volumeId);

    await listener.onStateChange?.(
      createState("preparing_container", "Preparing container"),
    );
    container = await prepareContainer(client, imageId, volumeId, options);
    await listener.onStateChange?.(
      createState("starting_container", "Starting container"),
    );

    await container.start();
    const inspectInfo = await container.inspect();
    if (!inspectInfo.State.Running) {
      // Wait a bit for logs to be available
      await new Promise((r) => setTimeout(r, 300));

      // Container failed to start, try to get logs and error message
      // The necessary error will be thrown by reattach call
      try {
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: false,
          tail: 100,
        });
        const msg = inspectInfo.Config.Tty
          ? logs.toString("utf8")
          : demuxBuffer(logs);

        await listener.onStateChange?.(
          createErrorState("Container failed to start"),
        );
        await listener.onMessage(info(msg));
      } catch (e) {
        ctx.logger.error(
          "Error while fetching logs for failed container " + container.id,
          e,
        );
      }
    }

    await self.reattach(container.id, listener);

    return container.id;
  };
}
