import DockerClient from "dockerode";
import { AppConfig } from "@nsm/config";

export function initDockerClient(appConfig: AppConfig) {
  let host = appConfig.getDockerHost();

  let client: DockerClient;
  if (host && (host.endsWith(".sock") || host.startsWith("\\\\.\\pipe"))) {
    client = new DockerClient({ socketPath: host });
  } else if (host) {
    // http(s)://host:port
    host = host.substring(0, host.lastIndexOf(":") + 1);

    let port = parseInt(appConfig.getDockerHost().replace(host, ""));

    host = host.substring(0, host.length - 1);

    let protocol = host.substring(0, host.indexOf("://")) as
      | "http"
      | "https"
      | "ssh";

    host = host.substring(host.indexOf("://") + 3);

    if (isNaN(port)) {
      throw new Error(
        "Docker host must be in this format: protocol://host:port",
      );
    }

    client = new DockerClient({ protocol, host, port });
  } else {
    throw new Error(
      "Docker engine configuration variable not found! Please set docker_host in resources/config.yml or override using env.",
    );
  }
  return client;
}
