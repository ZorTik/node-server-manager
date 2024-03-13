import DockerClient, {Volume} from "dockerode";
import fs from "fs";
import path from "path";
import tar from "tar";
import ignore from "../ignore";
import {currentContext} from "../../app";
import {ServiceEngine} from "../engine";

function buildArchive(buildDir: string) {
    const arDir = process.cwd() + '/archives';
    if (!fs.existsSync(arDir)) {
        fs.mkdirSync(arDir);
    }
    const archive = arDir + '/' + path.basename(buildDir) + '.tar';
    if (fs.existsSync(archive)) {
        fs.unlinkSync(archive);
    }
    return archive;
}

async function prepareVol(client: DockerClient, id: string) {
    try {
        await client.getVolume(id).inspect();
    } catch (e) {
        if (e.message.includes('No such')) {
            await client.createVolume({ Name: id });
        }
    }
    return client.getVolume(id);
}

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['build'] {
    return async (buildDir, volumeId,
                  {ram, cpu, disk, port, ports, env},
                  onclose?: () => Promise<void>|void
    ) => {
        const ctx = currentContext;
        const archive = buildArchive(buildDir);
        await tar.c({
            gzip: false,
            file: archive,
            cwd: buildDir
        }, [...ignore(buildDir)]);

        // Populate env with built-in vars
        env.SERVICE_PORT = port.toString();
        env.SERVICE_PORTS = ports.join(' ');
        env.SERVICE_RAM = ram.toString();
        env.SERVICE_CPU = cpu.toString();
        env.SERVICE_DISK = disk.toString();

        const imageTag = path.basename(buildDir) + ':' + volumeId;

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
                                ctx.logger.info(r.stream?.trim());
                            }
                        }
                        resolve(res);
                    }
                })
            });
        } catch (e) {
            ctx.logger.error(e);
            return null;
        }
        fs.unlinkSync(archive);
        let container: DockerClient.Container;
        try {
            // Create container
            container = await client.createContainer({
                Image: imageTag,
                Labels: {
                    'nsm': 'true',
                    'nsm.id': path.basename(buildDir),
                    'nsm.buildDir': buildDir,
                    'nsm.volumeId': volumeId,
                },
                HostConfig: {
                    Memory: ram,
                    CpuShares: cpu,
                    PortBindings: { [port + '/tcp']: [{HostPort: `${port}`}] },
                    DiskQuota: disk,
                    Mounts: [
                        {
                            Type: 'volume',
                            Source: (await prepareVol(client, volumeId)).name,
                            Target: '/data',
                            ReadOnly: false,
                        }
                    ],
                },
                Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
                ExposedPorts: { [port]: {} },
                AttachStdin: true,
                OpenStdin: true,
            });
            await container.start();
            // Watcher
            setTimeout(async () => {
                const rws = await client.getContainer(container.id).attach({ stream: true, stdout: true, hijack: true });
                rws.on('data', () => {}); // no-op, keepalive
                rws.on('end', async () => {
                    await onclose();
                });
            }, 500);
        } catch (e) {
            if (!container) {
                await client.getImage(imageTag).remove({ force: true });
            }
            throw e;
        }
        return container.id;
    }
}