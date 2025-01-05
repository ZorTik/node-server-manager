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

        if (!host.includes(':') || isNaN(port)) {
            throw new Error('Docker host must be in this format: protocol://host:port');
        }

        client = new DockerClient({host, port});
    } else {
        throw new Error('Docker engine configuration variable not found! Please set docker_host in resources/config.yml or override using env.');
    }
    return client;
}