import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({database, engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/lookup/:id',
        routes: {
            get: async (req, res) => {
                const id = req.params.id;
                const service = await database.getPerma(id);
                const session = await database.getSession(id);
                const template = engine.getTemplate(service.template);
                // Build that info
                res.json({
                    id: service.serviceId,
                    template: {
                        id: service.template,
                        ...template
                    },
                    node: service.nodeId,
                    port: service.port,
                    options: service.options,
                    env: service.env,
                    session
                }).end();
            },
        },
    }
}