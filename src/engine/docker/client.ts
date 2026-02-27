import DockerClient from "dockerode";

export function initDockerClient(appConfig: { docker_host: string }) {
    let client: DockerClient;
    if (appConfig.docker_host && (
        appConfig.docker_host.endsWith('.sock') ||
        appConfig.docker_host.startsWith('\\\\.\\pipe')
    )) {
        client = new DockerClient({ socketPath: appConfig.docker_host });
    } else if (appConfig.docker_host) {
        // http(s)://host:port
        let host = appConfig.docker_host;
        host = host.substring(0, host.lastIndexOf(':') + 1);

        let port = parseInt(appConfig.docker_host.replace(host, ''));

        host = host.substring(0, host.length - 1);

        let protocol = host.substring(0, host.indexOf('://')) as "http" | "https" | "ssh";

        host = host.substring(host.indexOf('://') + 3);

        if (isNaN(port)) {
            throw new Error('Docker host must be in this format: protocol://host:port');
        }

        client = new DockerClient({protocol, host, port});
    } else {
        throw new Error('Docker engine configuration variable not found! Please set docker_host in resources/config.yml or override using env.');
    }
    return client;
}