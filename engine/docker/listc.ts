import DockerClient from "dockerode";
import {ServiceEngine} from "../engine";
import {currentContext} from "../../app";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['listContainers'] {
    return async (templates) => {
        try {
            return (await client.listContainers())
                .filter(c => templates.some(function (t) {
                    return c.Image.startsWith(t + ':');
                }))
                .map(c => c.Id);
        } catch (e) {
            console.log(e);
            return [];
        }
    }
}