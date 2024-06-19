import DockerClient from "dockerode";

// TODO: Remove id from options and figure out how to use net unique ID from manager (store it in db)
export async function accessNetwork(client: DockerClient, ip: string, options: { id: string }) {
    let net = client.getNetwork(options.id);
    try {
        await net.inspect();
    } catch (e) {
        if (e.message.includes('not found')) {
            // TODO: Create network and assign it to net
        } else {
            // Something unexpected occurred here.
            throw e;
        }
    }
    return net;
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