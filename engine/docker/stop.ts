import DockerClient from "dockerode";
import {ServiceEngine} from "../engine";

export default function (client: DockerClient): ServiceEngine['stop'] {
    return async (id) => {
        try {
            const list = await client.listContainers();
            if (list.map(c => c.Id).includes(id)) {
                await client.getContainer(id).stop();
            }
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }
}