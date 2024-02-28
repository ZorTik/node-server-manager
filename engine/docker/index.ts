import {EngineInfo, ServiceEngine} from "../";
import DockerClient from 'dockerode';
import * as path from "path";

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
        async build(buildDir, volumeDir, {ram, cpu, disk, port, ports, env}) {
            const stream = await client.buildImage({
                context: buildDir,
                src: ['Dockerfile', 'settings.yml'],
            }, {t: path.basename(buildDir) + ':latest'});
            await new Promise((resolve, reject) => {
                client.modem.followProgress(stream, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                })
            });
            const container = await client.createContainer({
                Image: path.basename(buildDir) + ':latest',
                HostConfig: {
                    Memory: ram,
                    CpuShares: cpu,
                    PortBindings: {
                        [port]: [{HostPort: port}]
                    },
                    DiskQuota: disk,
                    Binds: [`${volumeDir}:/`] // Mount volume
                },
                Env: [
                    ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
                    'SERVICE_PORT=' + port,
                    'SERVICE_PORTS=' + ports.join(' '),
                    'SERVICE_RAM=' + ram,
                    'SERVICE_CPU=' + cpu,
                    'SERVICE_DISK=' + disk,
                ],
                ExposedPorts: {
                    [port]: {}
                },
            });
            await container.start();
            return container.id;
        },
        async stop(id) {
            try {
                await client.getContainer(id).stop();
                return true;
            } catch (e) {
                console.log(e);
                return false;
            }
        },
        async delete(id) {
            try {
                await client.getContainer(id).remove({force: true});
                return true;
            } catch (e) {
                console.log(e);
                return false;
            }
        },
        async listContainers(templates) {
            try {
                const containers = await client.listContainers();
                return containers.filter(c => templates.includes(c.Image)).map(c => c.Id);
            } catch (e) {
                console.log(e);
                return [];
            }
        }
    }
}