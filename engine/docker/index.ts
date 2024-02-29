import {ServiceEngine} from "../";
import DockerClient from 'dockerode';
import * as path from "path";
import tar from "tar";
import * as fs from "fs";
import {currentContext} from "../../app";
import ignore from "ignore";

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
            if (!fs.existsSync(process.cwd() + '/archives')) {
                fs.mkdirSync(process.cwd() + '/archives');
            }
            const archive = process.cwd() + '/archives/' + path.basename(buildDir) + '.tar';
            if (fs.existsSync(archive)) {
                fs.unlinkSync(archive);
            }
            let nsmignore = fs.readdirSync(buildDir);
            if (fs.existsSync(buildDir + '/.nsmignore')) {
                const ig = ignore().add(fs.readFileSync(buildDir + '/.nsmignore', 'utf8').split('\n'));
                nsmignore = ig.filter(nsmignore);
            }
            await tar.c({
                gzip: false,
                file: archive,
                cwd: buildDir
            }, [...nsmignore]);

            // Populate env with built-in vars
            env.SERVICE_PORT = port.toString();
            env.SERVICE_PORTS = ports.join(' ');
            env.SERVICE_RAM = ram.toString();
            env.SERVICE_CPU = cpu.toString();
            env.SERVICE_DISK = disk.toString();

            const imageTag = path.basename(buildDir) + ':' + path.basename(volumeDir);

            // Build image
            const stream = await client.buildImage(archive, {
                t: imageTag,
                buildargs: env,
            });
            try {
                await new Promise((resolve, reject) => {
                    client.modem.followProgress(stream, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            for (const r of res) {
                                if (r.errorDetail) {
                                    reject(r.errorDetail.message);
                                    return;
                                } else {
                                    currentContext.logger.info(r.stream?.trim());
                                }
                            }
                            resolve(res);
                        }
                    })
                });
            } catch (e) {
                currentContext.logger.error(e);
                return null;
            }
            fs.unlinkSync(archive);
            let container: DockerClient.Container;
            try {
                // Create container
                container = await client.createContainer({
                    Image: imageTag,
                    HostConfig: {
                        Memory: ram,
                        CpuShares: cpu,
                        PortBindings: {
                            [port + '/tcp']: [{HostPort: `${port}`}]
                        },
                        DiskQuota: disk,
                        //Binds: [`${volumeDir}:/service`] // Mount volume
                    },
                    Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
                    ExposedPorts: {
                        [port]: {}
                    },
                });
                await container.start();
            } catch (e) {
                if (!container) {
                    await client.getImage(imageTag).remove({ force: true });
                }
                throw e;
            }
            return container.id;
        },
        async stop(id) {
            try {
                if ((await client.listContainers()).map(c => c.Id).includes(id)) {
                    await client.getContainer(id).stop();
                }
                return true;
            } catch (e) {
                console.log(e);
                return false;
            }
        },
        async delete(id) {
            try {
                this.stop(id);
                const c = client.getContainer(id);
                const { Image } = await c.inspect();
                await c.remove({force: true});
                await client.getImage(Image).remove({force: true});
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