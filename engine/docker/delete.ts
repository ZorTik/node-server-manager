import DockerClient from "dockerode";
import {currentContext} from "../../app";
import {ServiceEngine} from "../engine";
import {deleteNetwork as doDeleteNetwork, isInNetwork} from "../../networking/manager";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['delete'] {
    return async (id, options) => {
        try {
            if (self) {
                // del func is called on startup,
                // this prevents it from accessing undefined 'self' stop.
                await self.stop(id);
            }
            const c = client.getContainer(id);
            const {Image} = await c.inspect();
            await c.remove({ force: true });
            await client.getImage(Image).remove({ force: true });
            // Delete network if it's associated with any.
            const networkId = await isInNetwork(client, id);
            if (networkId) {
                // Disconnect this container from the attached network.
                await client.getNetwork(networkId).disconnect({ Container: id, Force: true });
                if (options.deleteNetwork == true) {
                    // Delete network if requested.
                    await doDeleteNetwork(client, id);
                }
            }
            return true;
        } catch (e) {
            if (e.message.includes('No such container:') || e.message.includes('removal of container')) {
                currentContext?.logger.warn('Ignoring error: ' + e.message);
                return true;
            }
            console.log(e);
            return false;
        }
    }
}