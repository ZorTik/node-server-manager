import DockerClient from "dockerode";

export async function accessNetwork(client: DockerClient, ip: string, id: string) {
    let net = client.getNetwork(id);
    try {
        await net.inspect();
    } catch (e) {
        if (e.message.includes('not found')) {
            net = await createNetwork(client, ip);
        } else {
            // Something unexpected occurred here.
            throw e;
        }
    }
    return net;
}

export async function createNetwork(client: DockerClient, ip: string) {
    const uuid = crypto.randomUUID();
    return client.createNetwork({
        Name: uuid,
        Driver: 'bridge',
        Options: {
            'com.docker.network.bridge.enable_icc': 'true', // Inter-container connectivity, may disable
            'com.docker.network.bridge.enable_ip_masquerade': 'true',
            'com.docker.network.bridge.host_binding_ipv4': ip,
            'com.docker.network.bridge.name': uuid,
            'com.docker.network.driver.mtu': '1500'
        },
        Labels: {
            'nsm': 'true',
        }
    });
}

export async function deleteNetwork(client: DockerClient, id: string) {
    try {
        await client.getNetwork(id).remove();
    } catch (e) {
        if (!e.message.toLowerCase().includes('no such network')) {
            console.log(e);
        }
    }
}

// Returns network id, or undef if not in net
export async function isInNetwork(client: DockerClient, containerId: string): Promise<string|undefined> {
    try {
        await client.getNetwork(containerId).inspect();
        return containerId;
    } catch (e) {
        if (!e.message.includes('not found')) {
            console.log(e);
        }
        return undefined;
    }
}