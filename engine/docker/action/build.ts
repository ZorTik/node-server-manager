import DockerClient from "dockerode";
import fs from "fs";
import path from "path";
import tar from "tar";
import ignore from "../../ignore";
import {currentContext as ctx} from "../../../app";
import {BuildOptions, ServiceEngine} from "../../engine";
import {MetaStorage} from "../../manager";
import {getActionType} from "../../asyncp";
import {accessNetwork, createNetwork} from "../../../networking/manager";
import {constructObjectLabels} from "../../../util/services";
import {createLogger} from "../../../logger";
import {clock} from "@nsm/util/clock";

type PrepareImageOptions = {
    client: DockerClient,
    arDir: string,
    buildDir: string,
    volumeId: string,
    env: any
}

function logService(id: string, str: any) {
    // Isn't this thing blocking??? Look at it later, zort - by zort xdd
    const log_path = process.cwd() + '/service_logs/' + id + '.log';
    fs.appendFileSync(log_path, (str ?? '').toString() + '\n');
}

function prepareImage({ client, arDir, buildDir, volumeId, env }: PrepareImageOptions, cb: (imageTag: string) => void) {
    const archive = arDir + '/' + path.basename(buildDir) + '-' + volumeId + '.tar';
    try {
        fs.unlinkSync(archive);
    } catch (e) {
        if (!e.message.includes('ENOENT')) {
            throw e;
        }
    }
    tar.c({
        gzip: false,
        file: archive,
        cwd: buildDir
    }, [...ignore(buildDir)]).then(() => {
        // const imageTag = path.basename(buildDir) + ':' + volumeId;
        const imageTag = volumeId + ':latest';
        const logs = [];
        const msgHandler = (msg: any) => {
            if (Array.isArray(msg)) {
                msg.forEach(m => logService(volumeId, m));
            } else {
                cb(msg);
            }
        }

        // Build image
        client.buildImage(archive, { t: imageTag, buildargs: env }).then(stream => {
            logs.push('--------- Begin Build Log ---------');
            client.modem.followProgress(stream, (err, res) => {
                if (err) {
                    console.error(err);
                } else {
                    res.forEach(r => {
                        if (r.errorDetail) {
                            console.error(new Error(r.errorDetail));
                        } else {
                            const msg = r.stream?.trim();
                            //ctx.logger.info(msg);
                            logs.push(msg);
                        }
                    });
                    logs.push('--------- End Of Build Log ---------\n');
                    fs.unlinkSync(archive);
                    msgHandler(logs);
                    msgHandler(imageTag);
                }
            });
        });
        /*new Worker(__dirname + path.sep + 'build.worker.js', {
            workerData: {
                archive,
                imageTag,
                env,
                appConfig: ctx.appConfig,
                debug: ctx.debug
            }
        }).on('message', msgHandler);*/
    });
}

async function prepareVolume(client: DockerClient, volumeId: string) {
    try {
        await client.getVolume(volumeId).inspect();
    } catch (e) {
        if (e.message.includes('No such')) {
            await client.createVolume({
                Name: volumeId,
                Labels: {
                    ...constructObjectLabels({ id: volumeId }),
                    'nsm.volumeId': volumeId,
                },
            });
            return true;
        }
    }
    return false;
}

async function prepareNetwork(
    client: DockerClient,
    network: BuildOptions['network'],
    meta: MetaStorage,
    creatingContainer: boolean
) {
    let net: DockerClient.Network|undefined = undefined;
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
    net: DockerClient.Network|undefined
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
            'nsm.templateId': buildDir ? path.basename(buildDir) : '__no_t__'
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
    return (buildDir, volumeId, options, meta, cb, onclose) => {
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
        const serviceLogger = createLogger({ label: volumeId.substring(0, 13) });
        serviceLogger.info('Building image');
        const imageBuildClock = clock();

        prepareImage({client, arDir, buildDir, volumeId, env}, (imageTag) => {
            serviceLogger.info('Image built in ' + imageBuildClock.durFromCreation() + 'ms');

            (async () => {
                let container: DockerClient.Container;
                // Whether, or not we're creating a brand-new service
                let creating = false;
                try {
                    // Prepare volume
                    creating = await prepareVolume(client, volumeId);
                    if (creating) {
                        serviceLogger.info('Created new volume');
                    }
                    serviceLogger.info('Preparing network');
                    const net = await prepareNetwork(client, network, meta, creating);
                    // Port decorator that takes port and according to network changes it to <net>:<port> or keeps the same.
                    serviceLogger.info('Preparing container');
                    container = await prepareContainer(client, imageTag, buildDir, volumeId, options, net);
                    serviceLogger.info('Starting container');
                    await container.start();
                    serviceLogger.info('Watching changes');
                    // Watcher
                    setTimeout(async () => {
                        const attachOptions = { stream: true, stdout: true, hijack: true };
                        const rws = await client.getContainer(container.id).attach(attachOptions);
                        rws.on('data', (data) => {
                            logService(volumeId, data);
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
                    await cb(undefined, e);
                }
                await cb(container.id, undefined);
            })();
        });
    }
}