import DockerClient from "dockerode";
import {ServiceEngine} from "../../engine";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['listAttachedPorts'] {
    return async () => {
        try {
            return (await client.listContainers())
                .map(c => c.Ports.map(p => p.PublicPort))
                .flat();
        } catch (e) {
            console.log(e);
            return [];
        }
    }
}