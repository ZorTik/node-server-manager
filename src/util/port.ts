import net from "net";
import {PortBinding, ServiceEngine} from "@nsm/engine";

export async function isPortAvailable(
  engine: ServiceEngine,
  port: number,
  a_ports: number[] = undefined,
) {
  if (a_ports === undefined) {
    a_ports = await engine.listAttachedPorts();
  }
  if (a_ports.includes(port)) {
    return false;
  }
  const server = net.createServer();
  return new Promise<boolean>((resolve) => {
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

export async function randomPort(
  engine: ServiceEngine,
  from: number,
  to: number,
) {
  const checked = [];
  const all = await engine.listAttachedPorts();
  while (true) {
    const port = Math.floor(Math.random() * (to - from) + from);
    if (checked.includes(port)) {
      continue;
    }
    if (await isPortAvailable(engine, port, all)) {
      return port;
    }
    if (checked.length === to - from) {
      throw new Error("No available ports");
    }
    checked.push(port);
  }
}

export const parsePortBinding = (composeLikeStr: string): PortBinding => {
  const protocolMatch = composeLikeStr.match(/\/(tcp|udp)$/i);

  const protocol = protocolMatch?.[1]?.toLowerCase();

  if (protocolMatch) {
    composeLikeStr = composeLikeStr.slice(
      0,
      composeLikeStr.length - protocolMatch[0].length
    );
  }

  const parts = composeLikeStr.split(":");

  switch (parts.length) {
    case 1:
      return {
        hostString: "",
        containerPort: {
          port: Number(parts[0]),
          protocol,
        },
      };
    case 2:
      return {
        hostString: parts[0],
        containerPort: {
          port: Number(parts[1]),
          protocol,
        },
      };
    case 3:
      return {
        hostString: `${parts[0]}:${parts[1]}`,
        containerPort: {
          port: Number(parts[2]),
          protocol,
        },
      };
    default:
      throw new Error(
        `Unsupported Docker Compose port format: "${composeLikeStr}"`
      );
  }
}