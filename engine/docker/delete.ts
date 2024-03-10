import DockerClient from "dockerode";
import {currentContext} from "../../app";
import {ServiceEngine} from "../engine";

export default function (client: DockerClient): ServiceEngine['delete'] {
    return async (id) => {
        try {
            this.stop(id);
            const c = client.getContainer(id);
            const {Image} = await c.inspect();
            await c.remove({ force: true });
            await client.getImage(Image).remove({ force: true });
            return true;
        } catch (e) {
            if (e.message.includes('No such container:')) {
                currentContext?.logger.warn('Container not found, ignoring...');
                return true;
            }
            console.log(e);
            return false;
        }
    }
}