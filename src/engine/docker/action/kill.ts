import {ServiceEngine} from "@nsm/engine";
import DockerClient from "dockerode";

export default function (client: DockerClient): ServiceEngine['kill'] {
    return async (id) => {
        try {
            const list = await client.listContainers();
            if (list.map(c => c.Id).includes(id)) {
                await client.getContainer(id).kill();
            }

            return true;
        } catch (e) {
            if (!e.message.includes('container is not running')) {
                console.log(e);
            }
            return false;
        }
    }
}