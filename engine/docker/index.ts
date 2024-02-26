import {ServiceEngine} from "../engine";
import DockerClient from 'dockerode';

function initClient() {
    let client: DockerClient;
    if (process.env.DOCKER_HOST) {
        // http(s)://host:port
        let host = process.env.DOCKER_HOST;
        host = host.substring(host.lastIndexOf(':'));
        let port = parseInt(process.env.DOCKER_HOST.replace(host, ''));
        client = new DockerClient({host, port});
    } else if (process.env.DOCKER_SOCK) {
        client = new DockerClient({socketPath: process.env.DOCKER_SOCK});
    } else {
        throw new Error('Docker engine configuration env variables not found! Please set either DOCKER_HOST or DOCKER_SOCK variables.');
    }
    return client;
}

export default async function (): Promise<ServiceEngine> {
    const client = initClient();
    return {
        async build(buildDir, volumeDir, {ram, cpu, port, ports, env}) {
            // TODO
        },
        async stop(id) {
            // TODO
        },
        async delete(id) {
            // TODO
        }
    }
}