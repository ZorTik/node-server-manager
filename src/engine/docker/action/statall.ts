import {ServiceEngine} from "../../engine";
import DockerClient from "dockerode";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['statAll'] {
    return async () => {
        const list = [];
        for (const c of await self.listContainers()) {
            list.push(await self.stat(c));
        }
        return list;
    }
}