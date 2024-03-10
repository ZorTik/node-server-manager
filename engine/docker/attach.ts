import {ServiceEngine} from "../engine";
import DockerClient from "dockerode";

export default function (client: DockerClient): ServiceEngine['attach'] {
    return async (id: string, strIn: ReadableStream, strOut: WritableStream, keepAliveFunc: () => boolean) => {
        // TODO
    }
}