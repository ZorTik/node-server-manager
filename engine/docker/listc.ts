import DockerClient from "dockerode";
import {ServiceEngine} from "../engine";
import {currentContext} from "../../app";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['listContainers'] {
    return async (templates) => {
        if (templates === undefined) {
            templates = await currentContext.manager.listTemplates();
        }
        try {
            return (await client.listContainers())
                .filter(c => templates.some(function (t) {
                    return c.Labels.hasOwnProperty('nsm.templateId') && c.Labels['nsm.templateId'] == t;
                }))
                .map(c => c.Id);
        } catch (e) {
            console.log(e);
            return [];
        }
    }
}