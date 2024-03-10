import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({database, engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id',
        routes: {
            get: async (req, res) => {
                const id = req.params.id;
                const service = await database.getPerma(id);
                const session = await database.getSession(id);
                if (!service) {
                    res.status(404).json({status: 404, message: 'Invalid service ID.'}).end();
                    return;
                }
                const template = engine.getTemplate(service.template);
                // Build that info
                res.json({
                    id: service.serviceId,
                    template: {
                        id: service.template,
                        ...template
                    },
                    port: service.port,
                    options: service.options,
                    env: service.env,
                    session
                }).end();
            },
        },
    }
}