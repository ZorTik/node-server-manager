import DockerClient, {Volume} from "dockerode";
import fs from "fs";
import path from "path";
import tar from "tar";
import ignore from "../ignore";
import {currentContext as ctx} from "../../app";
import {ServiceEngine} from "../engine";
import {getActionType} from "../asyncp";

async function imageExists(dc: DockerClient, tag: string) {
    try {
        await dc.getImage(tag).inspect();
        return true;
    } catch (e) {
        if (!e.message.includes('No such')) {
            ctx.logger.info('Image ' + tag + ' does not exist.');
            return false;
        }
    }
}

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['build'] {
    const arDir = process.cwd() + '/archives';
    if (!fs.existsSync(arDir)) {
        fs.mkdirSync(arDir);
    }
    return async (buildDir, volumeId,
                  {ram, cpu, disk, port, ports, env},
                  onclose?: () => Promise<void>|void
    ) => {
        const archive = arDir + '/' + path.basename(buildDir) + '-' + volumeId + '.tar';
        try {
            fs.unlinkSync(archive);
        } catch (e) {
            if (!e.message.includes('ENOENT')) {
                throw e;
            }
        }
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

        if (!await imageExists(client, imageTag)) { // TODO: Test this a udělat aby se image rebuildnul pokud byla provedena změna portů ve službě!!
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
                            res.forEach(r => {
                                if (r.errorDetail) {
                                    reject(r.errorDetail.message);
                                    return;
                                } else {
                                    ctx.logger.info(r.stream?.trim());
                                }
                            });
                            resolve(res);
                        }
                    })
                });
            } catch (e) {
                ctx.logger.error(e);
                return null;
            }
        }

        fs.unlinkSync(archive);
        fs.mkdirSync(process.cwd() + '/volumes/' + volumeId, { recursive: true });

        let container: DockerClient.Container;
        try {
            // Prepare volume
            try {
                await client.getVolume(volumeId).inspect();
            } catch (e) {
                if (e.message.includes('No such')) {
                    await client.createVolume({ Name: volumeId });
                }
            }
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
                            Source: client.getVolume(volumeId).name,
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
                const attachOptions = { stream: true, stdout: true, hijack: true };
                const rws = await client.getContainer(container.id).attach(attachOptions);
                rws.on('data', (data) => {
                    // Isn't this thing blocking??? Look at it later, zort - by zort xdd
                    const log_path = process.cwd() + '/service_logs/' + volumeId + '.log';
                    fs.appendFileSync(log_path, data.toString());
                }); // no-op, keepalive
                rws.on('end', async () => {
                    // I only want to trigger close when the container is not being
                    // stopped by nsm to prevent loops.
                    if (getActionType(container.id) != 'stop') {
                        ctx.logger.info('Container ' + container.id + ' stopped from the inside.');
                        await onclose();
                    } else {
                        ctx.logger.info('Container ' + container.id + ' stopped by NSM.');
                    }
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