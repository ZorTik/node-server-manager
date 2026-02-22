import DockerClient from "dockerode";
import {ServiceEngine} from "@nsm/engine";

export default function (client: DockerClient): ServiceEngine['stop'] {
    return async (id) => {
        try {
            const list = await client.listContainers();
            if (list.map(c => c.Id).includes(id)) {
                await client.getContainer(id).stop({ signal: 'SIGINT' });
            }

            return true;
        } catch (e) {
            if (!e.message.includes('container already stopped')) {
                console.log(e);
            }
            return false;
        }
    }
}