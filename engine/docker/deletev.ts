import DockerClient from "dockerode";
import {ServiceEngine} from "../engine";
import {currentContext} from "../../app";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['deleteVolume'] {
    return async (id) => {
        try {
            await client.getVolume(id).remove();
            return true;
        } catch (e) {
            currentContext.logger.error(e);
            return false;
        }
    }
}