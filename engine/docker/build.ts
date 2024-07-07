import DockerClient from "dockerode";
import fs from "fs";
import path from "path";
import tar from "tar";
import ignore from "../ignore";
import {currentContext as ctx} from "../../app";
import {BuildOptions, ServiceEngine} from "../engine";
import {MetaStorage} from "../manager";
import {getActionType} from "../asyncp";
import {accessNetwork, createNetwork} from "../../networking/manager";
import Dockerode from "dockerode";
import {constructObjectLabels} from "@nsm/util/services";

async function prepareImage(client: DockerClient, arDir: string, buildDir: string, volumeId: string, env: any) {
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

    // const imageTag = path.basename(buildDir) + ':' + volumeId;
    const imageTag = volumeId + ':latest';

    // Build image
    const stream = await client.buildImage(archive, { t: imageTag, buildargs: env });
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
    fs.unlinkSync(archive);
    return imageTag;
}

async function prepareNetwork(client: DockerClient, network: BuildOptions['network'], meta: MetaStorage, creatingContainer: boolean) {
    let net: Dockerode.Network|undefined = undefined;
    if (network && !network.portsOnly) {
        const metaKey = "net-id";
        let netId = await meta.get<string>(metaKey);
        if (creatingContainer || !netId) {
            net = await createNetwork(client, network.address);
            netId = net.id;
            if (!await meta.set(metaKey, netId)) {
                throw new Error("Could not save network data.");
            }
        } else {
            net = await accessNetwork(client, network.address, netId);
        }
    }
    return net;
}

async function prepareContainer(
    client: DockerClient,
    imageTag: string,
    buildDir: string,
    volumeId: string,
    options: BuildOptions,
    net: Dockerode.Network|undefined
) {
    const {ram, cpu, disk, port, network, env} = options;
    const fullPortDef = (port: number) => (network?.portsOnly ? network.address + ":" : "") + port + "";
    // Create container
    const container = await client.createContainer({
        Image: imageTag,
        Labels: {
            ...constructObjectLabels({ id: volumeId }),
            'nsm.buildDir': buildDir,
            'nsm.volumeId': volumeId,
        },
        HostConfig: {
            Memory: ram,
            CpuShares: cpu,
            PortBindings: { [port + '/tcp']: [{HostPort: fullPortDef(port)}] },
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
        ExposedPorts: { [fullPortDef(port)]: {} },
        AttachStdin: true,
        OpenStdin: true,
    });
    if (net != null) {
        await net.connect({ Container: container.id }); // Implement EndpointConfig?? TODO: Test
    }
    return container;
}

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['build'] {
    const arDir = process.cwd() + '/archives';
    if (!fs.existsSync(arDir)) {
        fs.mkdirSync(arDir);
    }
    return async (buildDir, volumeId, options, meta, onclose?: () => Promise<void>|void) => {
        const id = volumeId;

        if (!buildDir) {
            throw new Error('Docker engine does not support no-template mode!');
        }

        // Populate env with built-in vars
        options.env.SERVICE_PORT = options.port.toString();
        options.env.SERVICE_PORTS = options.ports.join(' ');
        options.env.SERVICE_RAM = options.ram.toString();
        options.env.SERVICE_CPU = options.cpu.toString();
        options.env.SERVICE_DISK = options.disk.toString();

        const {network, env} = options;
        ctx.logger.info(id + ' > Building image');
        const imageTag = await prepareImage(client, arDir, buildDir, volumeId, env);

        //fs.mkdirSync(process.cwd() + '/volumes/' + volumeId, { recursive: true });

        let container: DockerClient.Container;
        // Whether, or not we're creating a brand-new service
        let creating = false;
        try {
            // Prepare volume
            try {
                await client.getVolume(volumeId).inspect();
            } catch (e) {
                if (e.message.includes('No such')) {
                    ctx.logger.info(id + ': Creating volume');
                    await client.createVolume({
                        Name: volumeId,
                        Labels: {
                            ...constructObjectLabels({ id: volumeId }),
                            'nsm.volumeId': volumeId,
                        },
                    });
                    creating = true;
                }
            }
            ctx.logger.info(id + ' > Preparing network');
            const net = await prepareNetwork(client, network, meta, creating);
            // Port decorator that takes port and according to network changes it to <net>:<port> or keeps the same.
            ctx.logger.info(id + ' > Preparing container');
            container = await prepareContainer(client, imageTag, buildDir, volumeId, options, net);
            ctx.logger.info(id + ' > Starting container');
            await container.start();
            ctx.logger.info(id + ' > Watching changes');
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